"""Sephora product ingestion — discovery via Constructor.io + detail enrichment.

Stage 1 — Discovery (Constructor.io, no anti-bot):
    Queries Sephora's search API for each of the 18 categories, extracting
    product_id, name, brand, image, price, and default variant data.

Stage 2 — Detail enrichment (Sephora internal JSON API):
    Fetches /api/catalog/products/{id}?ch=rwd for ingredient lists, full SKU
    arrays, and high-quality CDN image URLs.

Image rule: Sephora CDN images always win. OBF images are never used here.
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

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ingestion.config import settings
from ingestion.database import async_session
from ingestion.enrichers.filters import extract_and_save as save_filters
from ingestion.http.client import ResilientClient
from ingestion.models import Brand, Product, ProductPrice, ProductVariant, Retailer
from ingestion.pipeline.runner import run_job

logger = logging.getLogger(__name__)

SEPHORA_BASE = "https://www.sephora.com"

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

_API_HEADERS = {
    "Accept": "application/json",
    "Referer": "https://www.sephora.com/",
    "x-requested-with": "XMLHttpRequest",
    "Origin": "https://www.sephora.com",
}


# ──────────────────────────────────────────────────────────────────────────────
# Data types
# ──────────────────────────────────────────────────────────────────────────────

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
    external_id: str
    name: str
    brand: str
    url: str
    image_url: str | None
    price: float | None
    ingredients: list[str] | None
    extra_image_urls: list[str] = field(default_factory=list)
    variants: list[SephoraVariant] = field(default_factory=list)


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _parse_price(raw: Any) -> float | None:
    if raw is None:
        return None
    try:
        cleaned = re.sub(r"[^\d.]", "", str(raw))
        return float(cleaned) if cleaned else None
    except (TypeError, ValueError):
        return None


def _parse_ingredient_string(text: str) -> list[str]:
    """Strip HTML, split on commas, return cleaned ingredient list."""
    # Remove HTML tags
    cleaned = re.sub(r"<[^>]+>", " ", text)
    # Decode HTML entities
    cleaned = unescape(cleaned)
    # Normalize whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    # Split on commas
    parts = [p.strip().rstrip(".") for p in cleaned.split(",")]
    return [p for p in parts if p and len(p) > 1]


def _clean_product_name(value: str) -> str:
    """Strip brand-name prefix patterns Sephora often includes."""
    value = re.sub(r"^\s*[\w\s]+\s*[-|]\s*", "", value, count=1)
    return re.sub(r"\s+", " ", value).strip()


def _parse_sku(sku: dict[str, Any], index: int) -> SephoraVariant | None:
    sku_id = str(sku.get("skuId") or "").strip()
    if not sku_id:
        return None

    shade_name = (
        str(sku.get("variationValue") or "").strip()
        or str(sku.get("skuKeyWords") or "").strip()
        or None
    )

    hex_color = str(sku.get("hexCode") or "").strip() or None
    if hex_color and not hex_color.startswith("#"):
        hex_color = f"#{hex_color}"

    sku_images = sku.get("skuImages") or {}
    image_url: str | None = None
    if isinstance(sku_images, dict):
        image_url = str(sku_images.get("imageUrl") or "").strip() or None
    if not image_url:
        image_url = str(sku.get("imageUrl") or "").strip() or None

    price = _parse_price(sku.get("salePrice") or sku.get("listPrice"))
    if price is None:
        price = _parse_price(sku.get("finalPriceFloat") or sku.get("listPriceFloat"))

    return SephoraVariant(
        external_sku_id=sku_id,
        shade_name=shade_name,
        hex_color=hex_color,
        image_url=image_url,
        price=price,
        is_default=bool(sku.get("isDefault")) or index == 0,
    )


def _parse_variants(skus: list[Any]) -> list[SephoraVariant]:
    variants: list[SephoraVariant] = []
    for i, sku in enumerate(skus):
        if isinstance(sku, dict):
            v = _parse_sku(sku, i)
            if v:
                variants.append(v)
    return variants


# ──────────────────────────────────────────────────────────────────────────────
# Stage 1 — Constructor.io search
# ──────────────────────────────────────────────────────────────────────────────

async def _get_constructor_key(client: ResilientClient) -> str | None:
    """Extract Constructor.io API key from the Sephora search page.

    The key is embedded as constructorAPIKeyUS in the page's JSON config blob.
    We fetch the search page (not home) because the home page doesn't include it.
    """
    for url in [
        SEPHORA_BASE + "/search?keyword=foundation",
        SEPHORA_BASE + "/",
    ]:
        try:
            resp = await client.get(url, timeout=20.0)
            html = resp.text
        except Exception as exc:
            logger.warning("Failed to fetch Sephora page %s: %s", url, exc)
            continue

        match = re.search(r'"constructorAPIKeyUS"\s*:\s*"([^"]+)"', html)
        if match:
            key = match.group(1)
            logger.info("Extracted Constructor.io key: %s", key)
            return key

    logger.warning("Could not find constructorAPIKeyUS in any Sephora page")
    return None


async def _search_constructor(
    client: ResilientClient,
    query: str,
    page: int,
    key: str,
    limit: int = 90,
) -> list[SephoraProduct]:
    """Query Constructor.io search API for one category page."""
    try:
        resp = await client.get(
            f"https://ac.cnstrc.com/search/{quote_plus(query)}",
            params={
                "key": key,
                "i": str(uuid.uuid4()),
                "num_results_per_page": str(limit),
                "page": str(page),
                "c": "ciojs-client-2.55.0",
            },
            timeout=20.0,
        )
    except Exception as exc:
        logger.debug("Constructor search failed q=%r page=%d: %s", query, page, exc)
        return []

    if resp.status_code >= 400:
        return []

    try:
        payload = resp.json()
    except Exception:
        return []

    results = payload.get("response", {}).get("results", [])
    products: list[SephoraProduct] = []
    seen: set[str] = set()

    for result in results:
        data = result.get("data", {}) if isinstance(result, dict) else {}
        external_id = str(data.get("id") or "").strip()
        rel_url = str(data.get("url") or "").strip()
        if not external_id or not rel_url or external_id in seen:
            continue
        seen.add(external_id)

        name = str(result.get("value") or data.get("name") or "Product").strip()
        brand = str(data.get("brandName") or "Sephora").strip() or "Sephora"
        image_url = str(data.get("image_url") or "").strip() or None

        current_sku_raw = data.get("currentSku") or {}
        price = _parse_price(
            current_sku_raw.get("finalPriceFloat") or current_sku_raw.get("listPriceFloat")
        )

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

        products.append(SephoraProduct(
            external_id=external_id,
            name=name or "Product",
            brand=brand,
            url=urljoin(SEPHORA_BASE, rel_url),
            image_url=image_url,
            price=price,
            ingredients=None,
            variants=variants,
        ))

    return products


# ──────────────────────────────────────────────────────────────────────────────
# Stage 2 — Product detail API (ingredients + image)
# ──────────────────────────────────────────────────────────────────────────────

async def _fetch_product_detail(
    client: ResilientClient,
    sp: SephoraProduct,
) -> SephoraProduct:
    """Call Sephora's internal JSON product API for ingredient + image enrichment."""
    try:
        resp = await client.get(
            f"{SEPHORA_BASE}/api/catalog/products/{sp.external_id}",
            headers=_API_HEADERS,
            params={"ch": "rwd"},
            timeout=25.0,
        )
    except Exception as exc:
        logger.debug("Product API failed %s: %s", sp.external_id, exc)
        return sp

    if resp.status_code >= 400:
        return sp

    try:
        body = resp.json()
    except Exception:
        return sp

    if not isinstance(body, dict):
        return sp

    product_node = body.get("currentProduct", body)

    # Ingredients
    ingredients = sp.ingredients
    raw_ing = str(product_node.get("ingredientDesc") or "").strip()
    if raw_ing and len(raw_ing) > 20:
        parsed = _parse_ingredient_string(raw_ing)
        if parsed:
            ingredients = parsed

    # Price from currentSku
    price = sp.price
    current_sku = product_node.get("currentSku") or {}
    if isinstance(current_sku, dict):
        p = _parse_price(current_sku.get("salePrice") or current_sku.get("listPrice"))
        if p is not None:
            price = p

    # Image — first Sephora CDN media URL wins
    image_url = sp.image_url
    extra_image_urls = list(sp.extra_image_urls)
    media = product_node.get("media") or []
    if isinstance(media, list):
        for item in media:
            if not isinstance(item, dict):
                continue
            url = str(item.get("mediaUrl") or item.get("imageUrl") or "").strip()
            if url:
                if not image_url:
                    image_url = url
                if url not in extra_image_urls:
                    extra_image_urls.append(url)

    # Additional variants from detail API
    existing_sku_ids = {v.external_sku_id for v in sp.variants}
    variants = list(sp.variants)
    for i, s in enumerate(product_node.get("skus") or []):
        if isinstance(s, dict):
            v = _parse_sku(s, i)
            if v and v.external_sku_id not in existing_sku_ids:
                variants.append(v)
                existing_sku_ids.add(v.external_sku_id)

    return SephoraProduct(
        external_id=sp.external_id,
        name=sp.name,
        brand=sp.brand,
        url=sp.url,
        image_url=image_url,
        price=price,
        ingredients=ingredients,
        extra_image_urls=extra_image_urls,
        variants=variants,
    )


# ──────────────────────────────────────────────────────────────────────────────
# DB helpers
# ──────────────────────────────────────────────────────────────────────────────

def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


async def _get_or_create_brand(
    db: AsyncSession, name: str, cache: dict[str, int]
) -> int:
    cleaned = name.split(",")[0].strip() or "Unknown"
    key = _normalize(cleaned)
    if key in cache:
        return cache[key]

    result = await db.execute(select(Brand).where(func.lower(Brand.name) == key))
    brand = result.scalar_one_or_none()
    if not brand:
        slug = re.sub(r"[^a-z0-9]+", "-", key).strip("-")
        slug_check = await db.execute(select(Brand).where(Brand.slug == slug))
        if slug_check.scalar_one_or_none():
            slug = slug + "-" + re.sub(r"[^a-z0-9]", "", key)[:8]
        brand = Brand(name=cleaned, slug=slug)
        db.add(brand)
        await db.flush()

    cache[key] = brand.id
    return brand.id


async def _get_or_create_retailer(db: AsyncSession) -> int:
    result = await db.execute(select(Retailer).where(Retailer.slug == "sephora"))
    retailer = result.scalar_one_or_none()
    if not retailer:
        retailer = Retailer(name="Sephora", slug="sephora", base_url=SEPHORA_BASE)
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
    now = datetime.now(UTC)
    source_name = "sephora_scrape"

    # Lookup: source+source_id → sephora_product_id → brand+name
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
        norm = _normalize(sp.name)
        result = await db.execute(
            select(Product).where(
                Product.brand_id == brand_id,
                func.lower(Product.name) == norm,
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
        logger.info(f"New product added: {product.name} ({product.id})")
        return product.id, True

    # Update existing
    product.last_seen_at = now
    product.source = source_name
    product.source_id = sp.external_id
    product.sephora_product_id = sp.external_id
    if sp.extra_image_urls:
        product.extra_image_urls = sp.extra_image_urls
    # Ingredients: only fill in if missing
    if sp.ingredients and not product.inci_ingredients:
        product.inci_ingredients = sp.ingredients
    # Image: always prefer Sephora CDN; never regress to placeholder
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

    if price_row is None:
        db.add(ProductPrice(
            product_id=product_id,
            retailer_id=retailer_id,
            source="sephora",
            price=sp.price or 0.0,
            currency="USD",
            url=sp.url,
            in_stock=has_price,
            availability="in_stock" if has_price else "unknown",
            fetched_at=now,
        ))
    else:
        if has_price:
            price_row.price = sp.price
            price_row.in_stock = True
            price_row.availability = "in_stock"
        price_row.url = sp.url
        price_row.fetched_at = now


async def _upsert_variants(
    db: AsyncSession,
    product_id: str,
    variants: list[SephoraVariant],
) -> int:
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


# ──────────────────────────────────────────────────────────────────────────────
# Main ingestion loop
# ──────────────────────────────────────────────────────────────────────────────

async def ingest_sephora_discover(db: AsyncSession) -> dict[str, Any]:
    """Stage 1: discover products via Constructor.io search."""
    max_pages = max(1, settings.sephora_max_pages_per_category)

    stats: dict[str, Any] = {
        "products_created": 0,
        "products_updated": 0,
        "variants_created": 0,
        "pages_fetched": 0,
        "api_errors": 0,
        "categories_processed": 0,
    }

    brand_cache: dict[str, int] = {}

    async with ResilientClient() as client:
        constructor_key = await _get_constructor_key(client)
        if not constructor_key:
            logger.warning("Could not extract Constructor.io key; aborting")
            return stats

        retailer_id = await _get_or_create_retailer(db)

        for cat_key, query in SEPHORA_CATEGORIES.items():
            logger.info("[sephora_discover] category=%s", cat_key)
            seen_ids: set[str] = set()
            products_found: list[SephoraProduct] = []

            for page in range(1, max_pages + 1):
                page_products = await _search_constructor(client, query, page, constructor_key)
                stats["pages_fetched"] += 1
                if not page_products:
                    break
                for sp in page_products:
                    if sp.external_id not in seen_ids:
                        seen_ids.add(sp.external_id)
                        products_found.append(sp)

            for sp in products_found:
                try:
                    async with db.begin_nested():
                        brand_id = await _get_or_create_brand(db, sp.brand, brand_cache)
                        product_id, created = await _upsert_product(
                            db, sp, retailer_id, brand_id, cat_key
                        )
                        await _upsert_price(db, product_id, retailer_id, sp)
                        new_variants = await _upsert_variants(db, product_id, sp.variants)
                        stats["variants_created"] += new_variants
                        await save_filters(db, product_id, cat_key, sp.name, None)
                        if created:
                            stats["products_created"] += 1
                        else:
                            stats["products_updated"] += 1
                except Exception as exc:
                    logger.debug("Skipping sephora product %s: %s", sp.external_id, exc)
                    stats["api_errors"] += 1

            stats["categories_processed"] += 1

    await db.commit()
    return stats


async def ingest_sephora_detail(db: AsyncSession) -> dict[str, Any]:
    """Stage 2: enrich new/ingredient-missing Sephora products with detail API."""
    enrich_limit = max(0, settings.sephora_detail_enrich_limit)

    stats: dict[str, Any] = {
        "enriched": 0,
        "ingredients_found": 0,
        "images_updated": 0,
        "errors": 0,
    }

    # Products from sephora_scrape that lack ingredients
    result = await db.execute(
        select(Product).where(
            Product.source == "sephora_scrape",
            Product.inci_ingredients.is_(None),
            Product.is_active == True,  # noqa: E712
        ).limit(enrich_limit)
    )
    products = result.scalars().all()

    async with ResilientClient() as client:
        for product in products:
            if not product.source_id:
                continue
            await asyncio.sleep(1.0)  # polite delay

            sp = SephoraProduct(
                external_id=product.source_id,
                name=product.name,
                brand="",
                url=product.image_url or "",
                image_url=product.image_url,
                price=None,
                ingredients=None,
            )

            try:
                enriched = await _fetch_product_detail(client, sp)
            except Exception as exc:
                logger.debug("Detail fetch failed %s: %s", product.source_id, exc)
                stats["errors"] += 1
                continue

            if enriched.ingredients and not product.inci_ingredients:
                product.inci_ingredients = enriched.ingredients
                stats["ingredients_found"] += 1

            # Prefer Sephora CDN image; never regress to placeholder
            if enriched.image_url and enriched.image_url != product.image_url:
                if not _is_placeholder(product.image_url):
                    pass  # keep existing non-placeholder
                else:
                    product.image_url = enriched.image_url
                    stats["images_updated"] += 1

            stats["enriched"] += 1

    await db.commit()
    return stats


def _is_placeholder(url: str | None) -> bool:
    if not url:
        return True
    return "/placeholder-product.jpg" in url or "openfoodfacts.org" in url


async def run_sephora_discover() -> None:
    await run_job(
        job_name="sephora_discover",
        source="sephora_scrape",
        job_fn=ingest_sephora_discover,
        parameters={"categories": list(SEPHORA_CATEGORIES.keys())},
    )


async def run_sephora_detail() -> None:
    await run_job(
        job_name="sephora_detail",
        source="sephora_scrape",
        job_fn=ingest_sephora_detail,
        parameters={"enrich_limit": settings.sephora_detail_enrich_limit},
    )
