"""Retailer website scraping ingestion for product discovery and links.

Targets:
    - Amazon
    - Sephora
    - Ulta Beauty

The scraper uses a best-effort strategy:
1) Parse JSON-LD Product entries when present.
2) Fallback to retailer-specific product link extraction.

Run manually:
    python -m app.ingestion.retailer_scrape
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from html import unescape
from typing import Any
from urllib.parse import quote_plus, urljoin, urlparse

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.ingestion import run_job
from app.ingestion.open_beauty_facts import CATEGORY_MAP, SEARCH_TERMS
from app.models.product import Brand, Product, ProductPrice, Retailer

logger = logging.getLogger(__name__)

SCRAPER_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)


@dataclass(frozen=True)
class RetailerConfig:
    slug: str
    name: str
    base_url: str

    def search_url(self, term: str, page: int) -> str:
        q = quote_plus(term)
        if self.slug == "amazon":
            return f"https://www.amazon.com/s?k={q}&i=beauty&page={page}"
        if self.slug == "sephora":
            return f"https://www.sephora.com/search?keyword={q}&currentPage={page}"
        return f"https://www.ulta.com/search?search={q}&page={page}"


RETAILERS = [
    RetailerConfig(slug="amazon", name="Amazon", base_url="https://www.amazon.com"),
    RetailerConfig(slug="sephora", name="Sephora", base_url="https://www.sephora.com"),
    RetailerConfig(slug="ulta", name="Ulta Beauty", base_url="https://www.ulta.com"),
]


@dataclass
class ScrapedCandidate:
    external_id: str
    name: str
    brand: str
    url: str
    image_url: str | None
    price: float | None


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", _normalize(value)).strip("-")


def _clean_product_name(value: str) -> str:
    cleaned = unescape(value)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = re.sub(r"(?i)\b(ref|dp|p\d{3,})\b", " ", cleaned)
    cleaned = re.sub(r"(?i)=cs\s+sr\s+loc\s+\d+", " ", cleaned)
    cleaned = re.sub(r"[_-]+", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" -|:")
    return cleaned[:300]


def _parse_ingredient_string(raw: str) -> list[str] | None:
    """Parse a raw ingredient description string into a cleaned list.

    Handles comma-separated INCI lists, HTML tags, bullet characters, and
    parenthetical notes.  Returns None if fewer than 2 ingredients found.
    """
    # Strip HTML tags and decode entities
    cleaned = unescape(raw)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    # Replace common non-comma separators with commas
    cleaned = re.sub(r"[•·\n\r\t]+", ",", cleaned)
    parts = [p.strip().strip(".,;:•·") for p in cleaned.split(",")]
    ingredients = [p for p in parts if p and len(p) > 1]
    return ingredients if len(ingredients) >= 2 else None


def _looks_low_quality_name(name: str) -> bool:
    if not name:
        return True
    lowered = name.lower()
    if lowered in {"product", "amazon product", "sephora product", "ulta beauty product"}:
        return True
    return "cs sr loc" in lowered or len(name) < 4


def _extract_json_ld_blobs(html: str) -> list[str]:
    return re.findall(
        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        flags=re.IGNORECASE | re.DOTALL,
    )


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _extract_price(offers: Any) -> float | None:
    for offer in _as_list(offers):
        if not isinstance(offer, dict):
            continue
        raw = offer.get("price")
        if raw is None:
            continue
        try:
            return float(raw)
        except (TypeError, ValueError):
            continue
    return None


def _extract_offer_url(offers: Any) -> str | None:
    for offer in _as_list(offers):
        if isinstance(offer, dict) and offer.get("url"):
            return str(offer["url"])
    return None


def _external_id_from_url(retailer_slug: str, url: str) -> str | None:
    parsed = urlparse(url)
    path = parsed.path

    if retailer_slug == "amazon":
        m = re.search(r"/dp/([A-Z0-9]{10})", path, flags=re.IGNORECASE)
        return m.group(1).upper() if m else None
    if retailer_slug == "sephora":
        m = re.search(r"-P(\d+)", path, flags=re.IGNORECASE)
        return f"P{m.group(1)}" if m else None
    if retailer_slug == "ulta":
        m = re.search(r"/p/([^/?#]+)", path, flags=re.IGNORECASE)
        if m:
            return m.group(1).lower()

    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]
    return f"url-{digest}"


def _candidate_from_json_ld(
    item: dict[str, Any],
    retailer: RetailerConfig,
) -> ScrapedCandidate | None:
    type_field = item.get("@type")
    types = {type_field.lower()} if isinstance(type_field, str) else {
        str(t).lower() for t in _as_list(type_field)
    }
    if "product" not in types:
        return None

    name = _clean_product_name(str(item.get("name", "")).strip())
    if not name:
        return None

    brand_data = item.get("brand")
    if isinstance(brand_data, dict):
        brand = str(brand_data.get("name", "")).strip()
    else:
        brand = str(brand_data or "").strip()
    if not brand:
        brand = retailer.name

    offers = item.get("offers")
    raw_url = item.get("url") or _extract_offer_url(offers)
    if not raw_url:
        return None
    url = urljoin(retailer.base_url, str(raw_url).strip())

    external_id = _external_id_from_url(retailer.slug, url)
    if not external_id:
        return None

    image = item.get("image")
    image_url = None
    if isinstance(image, str):
        image_url = image
    elif isinstance(image, list) and image:
        image_url = str(image[0])

    return ScrapedCandidate(
        external_id=external_id,
        name=name,
        brand=brand,
        url=url,
        image_url=image_url,
        price=_extract_price(offers),
    )


def _parse_json_ld_candidates(html: str, retailer: RetailerConfig) -> list[ScrapedCandidate]:
    candidates: list[ScrapedCandidate] = []
    seen: set[str] = set()

    for blob in _extract_json_ld_blobs(html):
        blob_text = unescape(blob).strip()
        if not blob_text:
            continue

        try:
            payload = json.loads(blob_text)
        except json.JSONDecodeError:
            continue

        queue = _as_list(payload)
        while queue:
            node = queue.pop()
            if isinstance(node, list):
                queue.extend(node)
                continue
            if not isinstance(node, dict):
                continue
            if "@graph" in node:
                queue.extend(_as_list(node.get("@graph")))

            candidate = _candidate_from_json_ld(node, retailer)
            if not candidate:
                continue
            if candidate.external_id in seen:
                continue
            seen.add(candidate.external_id)
            candidates.append(candidate)

    return candidates


def _parse_link_candidates(html: str, retailer: RetailerConfig) -> list[ScrapedCandidate]:
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', html, flags=re.IGNORECASE)
    candidates: list[ScrapedCandidate] = []
    seen: set[str] = set()

    for href in hrefs:
        absolute = urljoin(retailer.base_url, href)
        parsed = urlparse(absolute)
        if not parsed.scheme.startswith("http"):
            continue

        if retailer.slug == "amazon" and not re.search(r"/dp/[A-Z0-9]{10}", parsed.path, re.I):
            continue
        if retailer.slug == "sephora" and "/product/" not in parsed.path:
            continue
        if retailer.slug == "ulta" and "/p/" not in parsed.path:
            continue

        external_id = _external_id_from_url(retailer.slug, absolute)
        if not external_id or external_id in seen:
            continue
        seen.add(external_id)

        name = _guess_name_from_url(absolute, retailer.slug)

        candidates.append(
            ScrapedCandidate(
                external_id=external_id,
                name=name,
                brand=retailer.name,
                url=absolute,
                image_url=None,
                price=None,
            )
        )

    return candidates


def _guess_name_from_url(url: str, retailer_slug: str) -> str:
    path = urlparse(url).path
    tail = path.rstrip("/").split("/")[-1]
    if retailer_slug == "amazon":
        # amazon urls often look like /Some-Product-Name/dp/ASIN
        tail = path.split("/dp/")[0].rstrip("/").split("/")[-1] or tail
    if retailer_slug == "sephora":
        # sephora product urls often end with slug-P12345
        tail = re.sub(r"-P\d+$", "", tail, flags=re.IGNORECASE)
    cleaned = _clean_product_name(re.sub(r"[-_]+", " ", tail))
    return cleaned.title() if cleaned else "Product"


def _amazon_fallback_candidates(html: str) -> list[ScrapedCandidate]:
    candidates: list[ScrapedCandidate] = []
    seen: set[str] = set()
    for asin in re.findall(r"/dp/([A-Z0-9]{10})", html, flags=re.IGNORECASE):
        asin = asin.upper()
        if asin in seen:
            continue
        seen.add(asin)
        url = f"https://www.amazon.com/dp/{asin}"
        candidates.append(
            ScrapedCandidate(
                external_id=asin,
                name=_guess_name_from_url(url, "amazon"),
                brand="Amazon",
                url=url,
                image_url=None,
                price=None,
            )
        )
    return candidates


def _amazon_bestseller_candidates(html: str) -> list[ScrapedCandidate]:
    candidates: list[ScrapedCandidate] = []
    seen: set[str] = set()
    anchor_pattern = re.compile(
        r'<a[^>]+href="(?P<href>[^"]*/dp/(?P<asin>[A-Z0-9]{10})[^"]*)"[^>]*>(?P<body>.*?)</a>',
        flags=re.IGNORECASE | re.DOTALL,
    )
    for match in anchor_pattern.finditer(html):
        asin = match.group("asin").upper()
        if asin in seen:
            continue
        body = match.group("body")
        href = unescape(match.group("href"))
        url = urljoin("https://www.amazon.com", href)

        # Extract name from img alt text (most reliable source in listing HTML)
        alt_match = re.search(r'<img[^>]+alt="(?P<alt>[^"]+)"', body, re.IGNORECASE | re.DOTALL)
        name = _clean_product_name(alt_match.group("alt")) if alt_match else _guess_name_from_url(url, "amazon")

        # Image: prefer data-a-dynamic-image JSON (largest size), fall back to data-src/src
        image_url: str | None = None
        dynamic_match = re.search(r'data-a-dynamic-image="([^"]+)"', body, re.IGNORECASE)
        if dynamic_match:
            try:
                img_dict: dict[str, list[int]] = json.loads(unescape(dynamic_match.group(1)))
                if img_dict:
                    image_url = max(img_dict.items(), key=lambda kv: kv[1][0] * kv[1][1])[0]
            except Exception:
                pass
        if not image_url:
            src_match = re.search(r'<img[^>]+(?:data-src|src)="(?P<src>https://[^"]+)"', body, re.IGNORECASE | re.DOTALL)
            if src_match:
                raw_src = src_match.group("src")
                # Upgrade thumbnail to larger size if possible
                image_url = _upgrade_amazon_image_url(raw_src)

        seen.add(asin)
        candidates.append(
            ScrapedCandidate(
                external_id=asin,
                name=name or "Product",
                brand="Amazon",
                url=url,
                image_url=image_url,
                price=None,
            )
        )
    return candidates


def _sephora_sitemap_candidates(xml_text: str, limit: int = 400) -> list[ScrapedCandidate]:
    # Fast regex extraction to avoid XML namespace parsing overhead for large sitemap.
    urls = re.findall(r"<loc>(https://www\.sephora\.com/product/[^<]+)</loc>", xml_text)
    candidates: list[ScrapedCandidate] = []
    seen: set[str] = set()
    for url in urls[:limit]:
        external_id = _external_id_from_url("sephora", url)
        if not external_id or external_id in seen:
            continue
        seen.add(external_id)
        candidates.append(
            ScrapedCandidate(
                external_id=external_id,
                name=_guess_name_from_url(url, "sephora"),
                brand="Sephora",
                url=url,
                image_url=None,
                price=None,
            )
        )
    return candidates


def _extract_sephora_constructor_key(html: str) -> str | None:
    match = re.search(r'"constructorAPIKeyUS"\s*:\s*"([^"]+)"', html)
    if match:
        return match.group(1)
    return None


async def _sephora_constructor_candidates(
    client: httpx.AsyncClient,
    term: str,
    page: int,
    key: str,
    limit: int = 100,
) -> list[ScrapedCandidate]:
    try:
        response = await client.get(
            f"https://ac.cnstrc.com/search/{quote_plus(term)}",
            params={
                "key": key,
                "i": str(uuid.uuid4()),
                "num_results_per_page": limit,
                "page": page,
                "c": "ciojs-client-2.55.0",
            },
        )
    except Exception:
        return []
    if response.status_code >= 400:
        return []
    try:
        payload = response.json()
    except Exception:
        return []

    results = payload.get("response", {}).get("results", [])
    candidates: list[ScrapedCandidate] = []
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
        current_sku = data.get("currentSku") or {}
        price = None
        for key_name in ("finalPriceFloat", "listPriceFloat"):
            raw = current_sku.get(key_name)
            try:
                if raw is not None:
                    price = float(raw)
                    break
            except (TypeError, ValueError):
                pass
        candidates.append(
            ScrapedCandidate(
                external_id=external_id,
                name=name or "Product",
                brand=brand,
                url=urljoin("https://www.sephora.com", rel_url),
                image_url=image_url,
                price=price,
            )
        )
    return candidates


def _extract_meta_content(html: str, key: str) -> str | None:
    patterns = [
        rf'<meta[^>]+property=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)["\']',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']{re.escape(key)}["\']',
        rf'<meta[^>]+name=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)["\']',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']{re.escape(key)}["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, flags=re.IGNORECASE)
        if match:
            return unescape(match.group(1).strip())
    return None


def _extract_title_text(html: str) -> str | None:
    match = re.search(r"<title[^>]*>(.*?)</title>", html, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return None
    title = unescape(match.group(1))
    title = re.sub(r"\s+", " ", title).strip()
    return title or None


def _is_amazon_bot_page(html: str) -> bool:
    lowered = html.lower()
    return (
        "to discuss automated access to amazon data" in lowered
        or "api-services-support@amazon.com" in lowered
        or "robot check" in lowered
    )


def _extract_amazon_image(html: str) -> str | None:
    """
    Extract the best-quality product image from an Amazon product page.

    Tries in order of quality:
    1. data-old-hires — direct high-res URL (e.g. ..._SL1500_.jpg)
    2. data-a-dynamic-image — JSON dict of {url: [w, h]}; pick the largest by area
    3. #landingImage src — the visible main image element
    4. og:image meta tag — final fallback
    """
    # 1. High-res direct URL
    m = re.search(r'data-old-hires="([^"]+)"', html, re.IGNORECASE)
    if m:
        url = unescape(m.group(1)).strip()
        if url:
            return url

    # 2. Dynamic image JSON — multiple sizes, pick largest
    m = re.search(r'data-a-dynamic-image="([^"]+)"', html, re.IGNORECASE)
    if m:
        try:
            img_dict: dict[str, list[int]] = json.loads(unescape(m.group(1)))
            if img_dict:
                best_url = max(img_dict.items(), key=lambda kv: kv[1][0] * kv[1][1])[0]
                return best_url.strip()
        except Exception:
            pass

    # 3. Main image element
    m = re.search(r'id=["\']landingImage["\'][^>]+src=["\']([^"\']+)["\']', html, re.IGNORECASE)
    if not m:
        m = re.search(r'id=["\']imgTagWrapperId["\'].*?<img[^>]+src=["\']([^"\']+)["\']', html, re.IGNORECASE | re.DOTALL)
    if m:
        url = unescape(m.group(1)).strip()
        if url and not url.startswith("data:"):
            return url

    return None


def _upgrade_amazon_image_url(url: str) -> str:
    """
    Promote a small Amazon CDN thumbnail to a larger size.
    Amazon encodes size in the URL as e.g. _AC_UL320_ or _SL75_.
    Replace with _SL1500_ for a higher-resolution image.
    """
    # Replace known small-size codes with SL1500
    upgraded = re.sub(r"\._[A-Z]{2}\d{2,4}_\.", "._SL1500_.", url)
    if upgraded != url:
        return upgraded
    # Also handle patterns like _SS40_ or _AC_SR38,50_
    upgraded = re.sub(r"\._[A-Z]+\d*(?:_[A-Z0-9,]+)?_\.", "._SL1500_.", url)
    return upgraded


async def _enrich_candidate_from_detail(
    client: httpx.AsyncClient,
    candidate: ScrapedCandidate,
    retailer_cfg: RetailerConfig,
) -> ScrapedCandidate:
    try:
        resp = await client.get(candidate.url)
    except Exception:
        return candidate

    if resp.status_code >= 400:
        return candidate

    html = resp.text
    if retailer_cfg.slug == "amazon" and _is_amazon_bot_page(html):
        return candidate

    parsed = _parse_json_ld_candidates(html, retailer_cfg)
    best = next((p for p in parsed if p.external_id == candidate.external_id), parsed[0]) if parsed else None

    name = candidate.name
    brand = candidate.brand
    image_url = candidate.image_url
    price = candidate.price
    url = candidate.url

    if best:
        if best.name and not _looks_low_quality_name(best.name):
            name = best.name
        if best.brand and best.brand.strip():
            brand = best.brand
        image_url = best.image_url or image_url
        if best.price is not None:
            price = best.price
        if best.url:
            url = best.url

    meta_title = _extract_title_text(html)
    if meta_title and _looks_low_quality_name(name):
        name = re.split(r"\s[-|]\s", meta_title)[0].strip()
    if not image_url:
        image_url = _extract_meta_content(html, "og:image")
    if not image_url and retailer_cfg.slug == "amazon":
        image_url = _extract_amazon_image(html)
    if image_url and retailer_cfg.slug == "amazon":
        image_url = _upgrade_amazon_image_url(image_url)
    if brand in {"Unknown", retailer_cfg.name}:
        meta_brand = _extract_meta_content(html, "product:brand") or _extract_meta_content(
            html, "twitter:data1"
        )
        if meta_brand:
            brand = meta_brand.strip()

    return ScrapedCandidate(
        external_id=candidate.external_id,
        name=_clean_product_name(name) or candidate.name,
        brand=brand or retailer_cfg.name,
        url=url,
        image_url=image_url,
        price=price,
    )


async def _get_or_create_retailer(
    db: AsyncSession,
    retailer_cfg: RetailerConfig,
    cache: dict[str, int],
) -> int:
    if retailer_cfg.slug in cache:
        return cache[retailer_cfg.slug]

    result = await db.execute(select(Retailer).where(Retailer.slug == retailer_cfg.slug))
    retailer = result.scalar_one_or_none()
    if not retailer:
        retailer = Retailer(
            name=retailer_cfg.name,
            slug=retailer_cfg.slug,
            base_url=retailer_cfg.base_url,
        )
        db.add(retailer)
        await db.flush()

    cache[retailer_cfg.slug] = retailer.id
    return retailer.id


async def _get_or_create_brand(
    db: AsyncSession,
    brand_name: str,
    cache: dict[str, int],
) -> int:
    cleaned = brand_name.strip() or "Unknown"
    normalized = _normalize(cleaned)
    if normalized in cache:
        return cache[normalized]

    result = await db.execute(select(Brand).where(func.lower(Brand.name) == normalized))
    brand = result.scalar_one_or_none()
    if not brand:
        slug = _slugify(cleaned) or "unknown"
        collision = await db.execute(select(Brand).where(Brand.slug == slug))
        if collision.scalar_one_or_none():
            slug = f"{slug}-{hashlib.sha1(normalized.encode('utf-8')).hexdigest()[:8]}"
        brand = Brand(name=cleaned, slug=slug)
        db.add(brand)
        await db.flush()

    cache[normalized] = brand.id
    return brand.id


async def _upsert_product_and_price(
    db: AsyncSession,
    *,
    candidate: ScrapedCandidate,
    retailer_cfg: RetailerConfig,
    retailer_id: int,
    brand_id: int,
    category_key: str,
) -> str:
    now = datetime.now(UTC)
    source_name = f"{retailer_cfg.slug}_scrape"
    clean_name = _clean_product_name(candidate.name) or candidate.name
    generic_brand_values = {"unknown", "amazon", "sephora", "ulta beauty"}

    result = await db.execute(
        select(Product).where(
            Product.source == source_name,
            Product.source_id == candidate.external_id,
        )
    )
    product = result.scalar_one_or_none()

    if product is None:
        normalized_name = _normalize(candidate.name)
        result = await db.execute(
            select(Product).where(
                Product.brand_id == brand_id,
                func.lower(Product.name) == normalized_name,
            )
        )
        product = result.scalar_one_or_none()

    created = False
    if product is None:
        product = Product(
            name=clean_name[:300],
            brand_id=brand_id,
            category_key=category_key,
            image_url=candidate.image_url or "/placeholder-product.jpg",
            source=source_name,
            source_id=candidate.external_id,
            last_seen_at=now,
            is_active=True,
        )
        if retailer_cfg.slug == "amazon":
            product.amazon_asin = candidate.external_id
        db.add(product)
        await db.flush()
        created = True
    else:
        product.last_seen_at = now
        if clean_name and (_looks_low_quality_name(product.name) or product.name != clean_name):
            product.name = clean_name[:300]
        candidate_brand_norm = (candidate.brand or "").strip().lower()
        if candidate_brand_norm and candidate_brand_norm not in generic_brand_values:
            product.brand_id = brand_id
        if candidate.image_url:
            # Always prioritize retailer image over any existing image
            product.image_url = candidate.image_url
        if not product.source_id:
            product.source = source_name
            product.source_id = candidate.external_id
        if retailer_cfg.slug == "amazon" and not product.amazon_asin:
            product.amazon_asin = candidate.external_id

    result = await db.execute(
        select(ProductPrice).where(
            ProductPrice.product_id == product.id,
            ProductPrice.source == retailer_cfg.slug,
        )
    )
    price = result.scalar_one_or_none()
    has_new_price = candidate.price is not None and candidate.price > 0
    price_value = candidate.price if has_new_price else 0.0
    in_stock = has_new_price

    if price is None:
        db.add(
            ProductPrice(
                product_id=product.id,
                retailer_id=retailer_id,
                source=retailer_cfg.slug,
                price=price_value,
                currency="USD",
                url=candidate.url,
                in_stock=in_stock,
                availability="in_stock" if in_stock else "unknown",
                fetched_at=now,
            )
        )
    else:
        price.retailer_id = retailer_id
        if has_new_price:
            price.price = price_value
        price.url = candidate.url
        if has_new_price:
            price.in_stock = in_stock
            price.availability = "in_stock" if in_stock else "unknown"
        price.fetched_at = now

    return "created" if created else "updated"


def _active_terms() -> list[str]:
    configured = [term.strip() for term in settings.retailer_scrape_terms.split(",") if term.strip()]
    if configured:
        return configured
    return SEARCH_TERMS


async def ingest_retailer_scrape(db: AsyncSession) -> dict[str, Any]:
    terms = _active_terms()
    max_pages = max(1, settings.retailer_scrape_max_pages_per_term)

    stats: dict[str, Any] = {
        "products_created": 0,
        "products_updated": 0,
        "prices_written": 0,
        "candidates_seen": 0,
        "pages_fetched": 0,
        "api_errors": 0,
        "terms_processed": 0,
    }
    brand_cache: dict[str, int] = {}
    retailer_cache: dict[str, int] = {}
    fallback_loaded: set[str] = set()
    detail_enrich_remaining: dict[str, int] = {
        retailer.slug: max(0, settings.retailer_scrape_detail_enrich_per_retailer)
        for retailer in RETAILERS
    }

    async with httpx.AsyncClient(
        timeout=30.0,
        follow_redirects=True,
        headers={
            "User-Agent": SCRAPER_USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
        },
    ) as client:
        for term in terms:
            category_key = CATEGORY_MAP.get(term, "foundation")

            for retailer_cfg in RETAILERS:
                retailer_id = await _get_or_create_retailer(db, retailer_cfg, retailer_cache)

                for page in range(1, max_pages + 1):
                    url = retailer_cfg.search_url(term, page)
                    try:
                        response = await client.get(url)
                        stats["pages_fetched"] += 1
                    except Exception as exc:
                        logger.warning("Retailer fetch failed %s (%s): %s", retailer_cfg.slug, url, exc)
                        stats["api_errors"] += 1
                        continue

                    if response.status_code >= 400:
                        logger.debug(
                            "Retailer fetch non-200 %s %s status=%d",
                            retailer_cfg.slug,
                            url,
                            response.status_code,
                        )
                        stats["api_errors"] += 1
                        if retailer_cfg.slug != "amazon" or "amazon" in fallback_loaded:
                            continue
                        # Amazon frequently blocks search pages; still attempt bestseller fallback.
                        candidates = []
                        for fallback_url in (
                            "https://www.amazon.com/gp/bestsellers/beauty",
                            "https://www.amazon.com/gp/new-releases/beauty",
                        ):
                            try:
                                fb = await client.get(fallback_url)
                                stats["pages_fetched"] += 1
                                richer = _amazon_bestseller_candidates(fb.text)
                                candidates.extend(richer if richer else _amazon_fallback_candidates(fb.text))
                            except Exception as exc:
                                logger.debug("Amazon fallback fetch failed %s: %s", fallback_url, exc)
                                stats["api_errors"] += 1
                        fallback_loaded.add("amazon")
                    else:
                        candidates = []

                    html = response.text
                    if not candidates:
                        candidates = []

                    if retailer_cfg.slug == "sephora" and not candidates:
                        sephora_key = _extract_sephora_constructor_key(html)
                        if sephora_key:
                            candidates = await _sephora_constructor_candidates(
                                client,
                                term=term,
                                page=page,
                                key=sephora_key,
                            )

                    if not candidates:
                        candidates = _parse_json_ld_candidates(html, retailer_cfg)
                    if not candidates:
                        candidates = _parse_link_candidates(html, retailer_cfg)

                    # Retailer-specific fallbacks for anti-bot or no-result pages.
                    if not candidates and retailer_cfg.slug == "amazon" and "amazon" not in fallback_loaded:
                        for fallback_url in (
                            "https://www.amazon.com/gp/bestsellers/beauty",
                            "https://www.amazon.com/gp/new-releases/beauty",
                        ):
                            try:
                                fb = await client.get(fallback_url)
                                stats["pages_fetched"] += 1
                                richer = _amazon_bestseller_candidates(fb.text)
                                candidates.extend(richer if richer else _amazon_fallback_candidates(fb.text))
                            except Exception as exc:
                                logger.debug("Amazon fallback fetch failed %s: %s", fallback_url, exc)
                                stats["api_errors"] += 1
                        fallback_loaded.add("amazon")

                    if not candidates and retailer_cfg.slug == "sephora" and "sephora" not in fallback_loaded:
                        try:
                            sitemap = await client.get("https://www.sephora.com/sitemaps/products-sitemap.xml")
                            stats["pages_fetched"] += 1
                            candidates.extend(_sephora_sitemap_candidates(sitemap.text))
                        except Exception as exc:
                            logger.debug("Sephora sitemap fallback failed: %s", exc)
                            stats["api_errors"] += 1
                        fallback_loaded.add("sephora")

                    if not candidates:
                        continue

                    for candidate in candidates:
                        stats["candidates_seen"] += 1
                        if (
                            detail_enrich_remaining.get(retailer_cfg.slug, 0) > 0
                            and (
                                candidate.brand == "Unknown"
                                or candidate.image_url is None
                                or candidate.price is None
                                or _looks_low_quality_name(candidate.name)
                            )
                        ):
                            candidate = await _enrich_candidate_from_detail(client, candidate, retailer_cfg)
                            detail_enrich_remaining[retailer_cfg.slug] -= 1

                        try:
                            async with db.begin_nested():
                                brand_id = await _get_or_create_brand(db, candidate.brand, brand_cache)
                                result = await _upsert_product_and_price(
                                    db,
                                    candidate=candidate,
                                    retailer_cfg=retailer_cfg,
                                    retailer_id=retailer_id,
                                    brand_id=brand_id,
                                    category_key=category_key,
                                )
                                if result == "created":
                                    stats["products_created"] += 1
                                else:
                                    stats["products_updated"] += 1
                                stats["prices_written"] += 1
                        except Exception as exc:
                            logger.debug(
                                "Skipping candidate retailer=%s id=%s error=%s",
                                retailer_cfg.slug,
                                candidate.external_id,
                                exc,
                            )
                            stats["api_errors"] += 1

            stats["terms_processed"] += 1

    await db.commit()
    return stats


async def _skip_disabled(db: AsyncSession) -> dict[str, Any]:
    return {"skipped": "disabled"}


async def run_ingestion() -> None:
    if not settings.enable_retailer_scraper:
        logger.info("Retailer scraping disabled (ENABLE_RETAILER_SCRAPER != true)")
        await run_job(
            job_name="retailer_scrape",
            source="retailer_scrape",
            job_fn=_skip_disabled,
        )
        return

    await run_job(
        job_name="retailer_scrape",
        source="retailer_scrape",
        job_fn=ingest_retailer_scrape,
        parameters={
            "retailers": [r.slug for r in RETAILERS],
            "terms": _active_terms(),
            "max_pages_per_term": max(1, settings.retailer_scrape_max_pages_per_term),
            "detail_enrich_per_retailer": max(0, settings.retailer_scrape_detail_enrich_per_retailer),
        },
    )


if __name__ == "__main__":
    import asyncio

    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_ingestion())
