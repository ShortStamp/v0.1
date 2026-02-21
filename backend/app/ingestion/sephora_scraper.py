"""Dedicated Sephora product ingestion module.

Covers all 18 build-page categories with rich product data:
  - Shade/color variants with hex codes and per-variant images
  - Full ingredient lists via Sephora's internal JSON product API
  - Multiple product images (extra_image_urls)
  - ProductVariant rows per SKU

Detail enrichment strategy
---------------------------
Sephora's HTML renderer (sephora.com/product/...) is protected by Cloudflare
and returns 403 for automated requests.  We avoid it entirely:

  1. Constructor.io search API  (/search/{query}) — provides product list,
     primary image, price, and the default SKU (shade/hex/image).  This is the
     bulk of what we need and is never blocked.

  2. Sephora internal JSON product API  (/api/catalog/products/{id}?ch=rwd) —
     the same endpoint the Next.js SPA calls via XHR.  Used only for ingredient
     lists and the full SKU/variant array.  Much less aggressively rate-limited
     than the HTML product page, but we still apply a polite 0.5 s delay.

Run manually:
    python -m app.ingestion.sephora_scraper
"""

from __future__ import annotations

import asyncio
import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from html import unescape
from typing import Any
from urllib.parse import quote_plus, urljoin

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.ingestion import run_job
from app.ingestion.retailer_scrape import (
    SCRAPER_USER_AGENT,
    _clean_product_name,
    _extract_sephora_constructor_key,
    _get_or_create_brand,
    _normalize,
    _parse_ingredient_string,
)
from app.models.product import Product, ProductPrice, ProductVariant, Retailer

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Category map: build-page key → Constructor.io query
# ---------------------------------------------------------------------------

SEPHORA_CATEGORIES: dict[str, str] = {
    "foundation":    "foundation",
    "concealer":     "concealer",
    "primer":        "face primer",
    "powder":        "setting powder",
    "setting-spray": "setting spray",
    "eyeshadow":     "eyeshadow palette",
    "eyeliner":      "eyeliner",
    "mascara":       "mascara",
    "false-lashes":  "false lashes",
    "brow-pencil":   "eyebrow pencil",
    "brow-gel":      "eyebrow gel",
    "contour":       "contour",
    "bronzer":       "bronzer",
    "blush":         "blush",
    "highlighter":   "highlighter",
    "lip-liner":     "lip liner",
    "lipstick":      "lipstick",
    "lip-gloss":     "lip gloss",
}

SEPHORA_BASE = "https://www.sephora.com"

# Headers for the internal JSON API (mimics the SPA's XHR calls)
_API_HEADERS = {
    "Accept": "application/json",
    "Referer": "https://www.sephora.com/",
    "x-requested-with": "XMLHttpRequest",
    "Origin": "https://www.sephora.com",
}


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------

@dataclass
class SephoraVariant:
    external_sku_id: str
    shade_name: str | None
    hex_color: str | None
    image_url: str | None
    price: float | None
    is_default: bool


@dataclass
class SephoraProduct:
    external_id: str            # Sephora product ID, e.g. "P12345"
    name: str
    brand: str
    url: str
    image_url: str | None
    price: float | None
    ingredients: list[str] | None
    extra_image_urls: list[str] = field(default_factory=list)
    variants: list[SephoraVariant] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Shared SKU / price parsing helpers
# ---------------------------------------------------------------------------

def _parse_price(raw: Any) -> float | None:
    """Parse a price value that may be a float, int, or '$32.00' string."""
    if raw is None:
        return None
    try:
        cleaned = re.sub(r"[^\d.]", "", str(raw))
        return float(cleaned) if cleaned else None
    except (TypeError, ValueError):
        return None


def _parse_sku(sku: dict[str, Any], index: int) -> SephoraVariant | None:
    """Convert a single SKU dict (from constructor or product API) to SephoraVariant."""
    sku_id = str(sku.get("skuId") or "").strip()
    if not sku_id:
        return None

    shade_name: str | None = (
        str(sku.get("variationValue") or "").strip()
        or str(sku.get("skuKeyWords") or "").strip()
        or None
    )

    hex_color: str | None = str(sku.get("hexCode") or "").strip() or None
    if hex_color and not hex_color.startswith("#"):
        hex_color = f"#{hex_color}"

    # Image — check skuImages sub-object first, then direct imageUrl
    sku_images = sku.get("skuImages") or {}
    image_url: str | None = None
    if isinstance(sku_images, dict):
        image_url = str(sku_images.get("imageUrl") or "").strip() or None
    if not image_url:
        image_url = str(sku.get("imageUrl") or "").strip() or None

    price = _parse_price(sku.get("salePrice") or sku.get("listPrice"))
    if price is None:
        price = _parse_price(sku.get("finalPriceFloat") or sku.get("listPriceFloat"))

    is_default = bool(sku.get("isDefault")) or index == 0

    return SephoraVariant(
        external_sku_id=sku_id,
        shade_name=shade_name,
        hex_color=hex_color,
        image_url=image_url,
        price=price,
        is_default=is_default,
    )


def _parse_variants(skus: list[Any]) -> list[SephoraVariant]:
    variants: list[SephoraVariant] = []
    for i, sku in enumerate(skus):
        if isinstance(sku, dict):
            v = _parse_sku(sku, i)
            if v:
                variants.append(v)
    return variants


# ---------------------------------------------------------------------------
# Constructor.io — product list + default variant
# ---------------------------------------------------------------------------

async def _get_constructor_key(client: httpx.AsyncClient) -> str | None:
    """Fetch sephora.com home page and extract the Constructor.io API key."""
    try:
        resp = await client.get(SEPHORA_BASE + "/", timeout=20.0)
    except Exception as exc:
        logger.warning("Failed to fetch Sephora home for constructor key: %s", exc)
        return None
    if resp.status_code >= 400:
        return None
    return _extract_sephora_constructor_key(resp.text)


async def _search_constructor(
    client: httpx.AsyncClient,
    query: str,
    page: int,
    key: str,
    limit: int = 100,
) -> list[SephoraProduct]:
    """Call Constructor.io search API.

    Extracts products with their default SKU variant (shade/hex/image) baked in,
    so no detail page is needed just for variant data.
    """
    try:
        response = await client.get(
            f"https://ac.cnstrc.com/search/{quote_plus(query)}",
            params={
                "key": key,
                "i": str(uuid.uuid4()),
                "num_results_per_page": limit,
                "page": page,
                "c": "ciojs-client-2.55.0",
            },
            timeout=20.0,
        )
    except Exception as exc:
        logger.debug("Constructor search failed query=%r page=%d: %s", query, page, exc)
        return []

    if response.status_code >= 400:
        return []
    try:
        payload = response.json()
    except Exception:
        return []

    results = payload.get("response", {}).get("results", [])
    products: list[SephoraProduct] = []
    seen: set[str] = set()

    for result in results:
        data = result.get("data", {}) if isinstance(result, dict) else {}
        external_id = str(data.get("id") or "").strip()
        rel_url = str(data.get("url") or "").strip()
        if not external_id or not rel_url:
            continue
        if external_id in seen:
            continue
        seen.add(external_id)

        name = _clean_product_name(str(result.get("value") or data.get("name") or "Product"))
        brand = str(data.get("brandName") or "Sephora").strip() or "Sephora"
        image_url = str(data.get("image_url") or "").strip() or None

        # Price from currentSku
        current_sku_raw = data.get("currentSku") or {}
        price = _parse_price(
            current_sku_raw.get("finalPriceFloat") or current_sku_raw.get("listPriceFloat")
        )

        # Build variant list from constructor data.
        # constructor may include currentSku and/or a skus array.
        variants: list[SephoraVariant] = []
        if isinstance(current_sku_raw, dict) and current_sku_raw.get("skuId"):
            v = _parse_sku(current_sku_raw, 0)
            if v:
                variants.append(v)

        raw_skus = data.get("skus")
        if isinstance(raw_skus, list):
            sku_ids_seen = {v.external_sku_id for v in variants}
            for i, s in enumerate(raw_skus):
                if isinstance(s, dict):
                    v = _parse_sku(s, i)
                    if v and v.external_sku_id not in sku_ids_seen:
                        variants.append(v)
                        sku_ids_seen.add(v.external_sku_id)

        products.append(
            SephoraProduct(
                external_id=external_id,
                name=name or "Product",
                brand=brand,
                url=urljoin(SEPHORA_BASE, rel_url),
                image_url=image_url,
                price=price,
                ingredients=None,
                variants=variants,
            )
        )

    return products


# ---------------------------------------------------------------------------
# Sephora internal JSON product API — used only for ingredient enrichment
# ---------------------------------------------------------------------------

def _parse_product_api_response(body: dict[str, Any], sp: SephoraProduct) -> SephoraProduct:
    """Parse a /api/catalog/products/{id} JSON response and merge into sp."""
    # The API may wrap the product under a top-level key or return it directly.
    product_node: dict[str, Any] = body
    if "currentProduct" in body:
        product_node = body["currentProduct"]

    # Name / brand (use constructor values if API gives nothing useful)
    name = _clean_product_name(
        str(product_node.get("displayName") or sp.name)
    ).strip() or sp.name

    brand_node = product_node.get("brand") or {}
    brand = (
        str(brand_node.get("displayName") or "").strip()
        or str(product_node.get("brandName") or "").strip()
        or sp.brand
    )

    # Price from currentSku
    price = sp.price
    current_sku = product_node.get("currentSku") or {}
    if isinstance(current_sku, dict):
        p = _parse_price(current_sku.get("salePrice") or current_sku.get("listPrice"))
        if p is not None:
            price = p

    # Ingredients
    ingredients = sp.ingredients
    raw_ing = str(product_node.get("ingredientDesc") or "").strip()
    if raw_ing and len(raw_ing) > 20:
        parsed = _parse_ingredient_string(raw_ing)
        if parsed:
            ingredients = parsed

    # Extra images from media array
    extra_image_urls: list[str] = list(sp.extra_image_urls)
    media = product_node.get("media") or []
    if isinstance(media, list):
        for item in media:
            if not isinstance(item, dict):
                continue
            url = str(item.get("mediaUrl") or item.get("imageUrl") or "").strip()
            if url and url not in extra_image_urls:
                extra_image_urls.append(url)

    # Full variants from skus array — merge with any already found from constructor
    existing_sku_ids = {v.external_sku_id for v in sp.variants}
    variants = list(sp.variants)
    raw_skus = product_node.get("skus") or []
    if isinstance(raw_skus, list):
        for i, s in enumerate(raw_skus):
            if isinstance(s, dict):
                v = _parse_sku(s, i)
                if v and v.external_sku_id not in existing_sku_ids:
                    variants.append(v)
                    existing_sku_ids.add(v.external_sku_id)

    image_url = sp.image_url
    if not image_url and variants:
        default_v = next((v for v in variants if v.is_default), variants[0])
        image_url = default_v.image_url

    return SephoraProduct(
        external_id=sp.external_id,
        name=name,
        brand=brand,
        url=sp.url,
        image_url=image_url,
        price=price,
        ingredients=ingredients,
        extra_image_urls=extra_image_urls,
        variants=variants,
    )


async def _fetch_product_api(
    client: httpx.AsyncClient,
    sp: SephoraProduct,
) -> SephoraProduct:
    """Call Sephora's internal JSON product API for ingredient + full SKU enrichment.

    Endpoint: GET /api/catalog/products/{productId}?ch=rwd
    This is the XHR endpoint the Next.js SPA calls — it returns JSON and is
    far less aggressively blocked than the rendered HTML product page.
    """
    # Strip leading 'P' for the numeric ID the API uses
    numeric_id = sp.external_id.lstrip("Pp")
    if not numeric_id:
        return sp

    # Prefer the skuId of the default variant as preferedSku param
    default_sku_id = ""
    if sp.variants:
        default_v = next((v for v in sp.variants if v.is_default), sp.variants[0])
        default_sku_id = default_v.external_sku_id

    params: dict[str, str] = {"ch": "rwd"}
    if default_sku_id:
        params["preferedSku"] = default_sku_id

    try:
        resp = await client.get(
            f"{SEPHORA_BASE}/api/catalog/products/{sp.external_id}",
            params=params,
            headers=_API_HEADERS,
            timeout=25.0,
        )
    except Exception as exc:
        logger.debug("Product API failed %s: %s", sp.external_id, exc)
        return sp

    if resp.status_code >= 400:
        logger.debug("Product API %s returned %d", sp.external_id, resp.status_code)
        return sp

    try:
        body = resp.json()
    except Exception:
        return sp

    if not isinstance(body, dict):
        return sp

    return _parse_product_api_response(body, sp)


# ---------------------------------------------------------------------------
# DB upsert helpers
# ---------------------------------------------------------------------------

async def _get_or_create_sephora_retailer(db: AsyncSession) -> int:
    result = await db.execute(select(Retailer).where(Retailer.slug == "sephora"))
    retailer = result.scalar_one_or_none()
    if not retailer:
        retailer = Retailer(
            name="Sephora",
            slug="sephora",
            base_url=SEPHORA_BASE,
        )
        db.add(retailer)
        await db.flush()
    return retailer.id


async def _upsert_product(
    db: AsyncSession,
    sp: SephoraProduct,
    retailer_id: int,
    brand_id: int,
    cat_key: str,
) -> tuple[str, bool]:
    """Upsert a Product row. Returns (product_id, created)."""
    now = datetime.now(UTC)
    source_name = "sephora_scraper"

    # Lookup order: source+source_id → sephora_product_id → brand+name
    result = await db.execute(
        select(Product).where(
            Product.source == source_name,
            Product.source_id == sp.external_id,
        )
    )
    product = result.scalar_one_or_none()

    if product is None and sp.external_id:
        result = await db.execute(
            select(Product).where(Product.sephora_product_id == sp.external_id)
        )
        product = result.scalar_one_or_none()

    if product is None:
        normalized_name = _normalize(sp.name)
        result = await db.execute(
            select(Product).where(
                Product.brand_id == brand_id,
                func.lower(Product.name) == normalized_name,
            )
        )
        product = result.scalar_one_or_none()

    if product is None:
        product = Product(
            name=sp.name[:300],
            brand_id=brand_id,
            category_key=cat_key,
            image_url=sp.image_url or "/placeholder-product.jpg",
            source=source_name,
            source_id=sp.external_id,
            sephora_product_id=sp.external_id,
            extra_image_urls=sp.extra_image_urls or None,
            inci_ingredients=sp.ingredients,
            last_seen_at=now,
            is_active=True,
        )
        db.add(product)
        await db.flush()
        return product.id, True
    else:
        product.last_seen_at = now
        product.source = source_name
        product.source_id = sp.external_id
        if sp.external_id:
            product.sephora_product_id = sp.external_id
        if sp.extra_image_urls:
            product.extra_image_urls = sp.extra_image_urls
        if sp.ingredients and not product.inci_ingredients:
            product.inci_ingredients = sp.ingredients
        if sp.image_url:
            product.image_url = sp.image_url
        return product.id, False


async def _upsert_price(
    db: AsyncSession,
    product_id: str,
    retailer_id: int,
    sp: SephoraProduct,
) -> None:
    now = datetime.now(UTC)
    result = await db.execute(
        select(ProductPrice).where(
            ProductPrice.product_id == product_id,
            ProductPrice.source == "sephora",
        )
    )
    price_row = result.scalar_one_or_none()
    has_price = sp.price is not None and sp.price > 0
    price_value = sp.price if has_price else 0.0

    if price_row is None:
        db.add(
            ProductPrice(
                product_id=product_id,
                retailer_id=retailer_id,
                source="sephora",
                price=price_value,
                currency="USD",
                url=sp.url,
                in_stock=has_price,
                availability="in_stock" if has_price else "unknown",
                fetched_at=now,
            )
        )
    else:
        if has_price:
            price_row.price = price_value
            price_row.in_stock = True
            price_row.availability = "in_stock"
        price_row.url = sp.url
        price_row.fetched_at = now


async def _upsert_variants(
    db: AsyncSession,
    product_id: str,
    variants: list[SephoraVariant],
) -> int:
    """Upsert ProductVariant rows. Returns count of new rows."""
    if not variants:
        return 0

    result = await db.execute(
        select(ProductVariant).where(ProductVariant.product_id == product_id)
    )
    existing: dict[str, ProductVariant] = {
        v.external_sku_id: v
        for v in result.scalars().all()
        if v.external_sku_id
    }

    new_count = 0
    for sv in variants:
        if not sv.external_sku_id:
            continue
        row = existing.get(sv.external_sku_id)
        if row is None:
            db.add(ProductVariant(
                product_id=product_id,
                source="sephora",
                external_sku_id=sv.external_sku_id,
                shade_name=sv.shade_name,
                hex_color=sv.hex_color,
                image_url=sv.image_url,
                price=sv.price,
                is_default=sv.is_default,
            ))
            new_count += 1
        else:
            row.shade_name = sv.shade_name
            row.hex_color = sv.hex_color
            if sv.image_url:
                row.image_url = sv.image_url
            if sv.price is not None:
                row.price = sv.price
            row.is_default = sv.is_default

    return new_count


# ---------------------------------------------------------------------------
# Main ingestion loop
# ---------------------------------------------------------------------------

async def ingest_sephora(db: AsyncSession) -> dict[str, Any]:
    max_pages = max(1, settings.sephora_max_pages_per_category)
    enrich_limit = max(0, settings.sephora_detail_enrich_limit)

    stats: dict[str, Any] = {
        "products_created": 0,
        "products_updated": 0,
        "variants_created": 0,
        "pages_fetched": 0,
        "api_enriched": 0,
        "api_errors": 0,
        "categories_processed": 0,
    }

    brand_cache: dict[str, int] = {}

    async with httpx.AsyncClient(
        timeout=30.0,
        follow_redirects=True,
        headers={
            "User-Agent": SCRAPER_USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
        },
    ) as client:
        constructor_key = await _get_constructor_key(client)
        if not constructor_key:
            logger.warning("Could not extract Constructor.io key; aborting Sephora scrape")
            return stats

        retailer_id = await _get_or_create_sephora_retailer(db)

        for cat_key, query in SEPHORA_CATEGORIES.items():
            logger.info("[sephora] category=%s query=%r", cat_key, query)

            products_found: list[SephoraProduct] = []
            seen_ids: set[str] = set()

            for page in range(1, max_pages + 1):
                page_products = await _search_constructor(
                    client, query, page, constructor_key
                )
                stats["pages_fetched"] += 1
                if not page_products:
                    break
                for sp in page_products:
                    if sp.external_id not in seen_ids:
                        seen_ids.add(sp.external_id)
                        products_found.append(sp)

            # Enrich with ingredient data from the JSON product API.
            # Variants come from constructor above so we only call the API for
            # products that don't yet have ingredients (all of them on first run).
            enrich_remaining = enrich_limit
            enriched: list[SephoraProduct] = []
            for sp in products_found:
                if enrich_remaining > 0 and sp.ingredients is None:
                    await asyncio.sleep(0.5)
                    sp = await _fetch_product_api(client, sp)
                    stats["api_enriched"] += 1
                    enrich_remaining -= 1
                enriched.append(sp)

            # Upsert into DB
            for sp in enriched:
                try:
                    async with db.begin_nested():
                        brand_id = await _get_or_create_brand(db, sp.brand, brand_cache)
                        product_id, created = await _upsert_product(
                            db, sp, retailer_id, brand_id, cat_key
                        )
                        await _upsert_price(db, product_id, retailer_id, sp)
                        new_variants = await _upsert_variants(db, product_id, sp.variants)
                        stats["variants_created"] += new_variants
                        if created:
                            stats["products_created"] += 1
                        else:
                            stats["products_updated"] += 1
                except Exception as exc:
                    logger.debug(
                        "Skipping sephora product id=%s error=%s",
                        sp.external_id,
                        exc,
                    )
                    stats["api_errors"] += 1

            stats["categories_processed"] += 1

    await db.commit()
    return stats


async def _skip_disabled(db: AsyncSession) -> dict[str, Any]:
    return {"skipped": "disabled"}


async def run_ingestion() -> None:
    if not settings.enable_sephora_scraper:
        logger.info("Sephora scraper disabled (ENABLE_SEPHORA_SCRAPER != true)")
        await run_job(
            job_name="sephora_scrape",
            source="sephora_scraper",
            job_fn=_skip_disabled,
        )
        return

    await run_job(
        job_name="sephora_scrape",
        source="sephora_scraper",
        job_fn=ingest_sephora,
        parameters={
            "max_pages_per_category": max(1, settings.sephora_max_pages_per_category),
            "detail_enrich_limit": max(0, settings.sephora_detail_enrich_limit),
            "categories": list(SEPHORA_CATEGORIES.keys()),
        },
    )


if __name__ == "__main__":
    import asyncio as _asyncio
    import logging as _logging

    _logging.basicConfig(level=_logging.INFO)
    _asyncio.run(run_ingestion())
