"""Open Beauty Facts catalog ingestion — ingredients only, no images.

Key differences from the backend version:
1. Never writes image_url from OBF (images are user-submitted, low quality).
2. Only updates inci_ingredients if the product currently has none (no regression).
3. Uses ResilientClient instead of plain httpx.
"""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ingestion.config import settings
from ingestion.enrichers.filters import extract_and_save as save_filters
from ingestion.models import Brand, Product, ProductFilterValue
from ingestion.pipeline.runner import run_job

logger = logging.getLogger(__name__)

SEARCH_TERMS = [
    "foundation", "concealer", "primer", "powder",
    "blush", "bronzer", "highlighter",
    "eyeshadow", "eyeliner", "mascara",
    "lipstick", "lip gloss", "lip liner",
    "setting spray",
    "brow pencil", "brow gel",
]

CATEGORY_MAP = {
    "foundation": "foundation",
    "concealer": "concealer",
    "primer": "primer",
    "powder": "powder",
    "blush": "blush",
    "bronzer": "bronzer",
    "highlighter": "highlighter",
    "eyeshadow": "eyeshadow",
    "eyeliner": "eyeliner",
    "mascara": "mascara",
    "lipstick": "lipstick",
    "lip gloss": "lip-gloss",
    "lip liner": "lip-liner",
    "setting spray": "setting-spray",
    "brow pencil": "brow-pencil",
    "brow gel": "brow-gel",
}

OBF_BASE = "https://world.openbeautyfacts.org/cgi/search.pl"


def _normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


def _clean_brand_name(raw: str) -> str:
    return raw.split(",")[0].strip()


async def _get_or_create_brand(
    db: AsyncSession, raw_name: str, brand_cache: dict[str, int]
) -> int | None:
    cleaned = _clean_brand_name(raw_name)
    if not cleaned:
        return None
    normalized = _normalize_name(cleaned)
    if normalized in brand_cache:
        return brand_cache[normalized]

    result = await db.execute(select(Brand).where(func.lower(Brand.name) == normalized))
    brand = result.scalar_one_or_none()
    if not brand:
        slug = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
        slug_check = await db.execute(select(Brand).where(Brand.slug == slug))
        if slug_check.scalar_one_or_none():
            slug = slug + "-" + re.sub(r"[^a-z0-9]", "", normalized)[:8]
        brand = Brand(name=cleaned, slug=slug)
        db.add(brand)
        await db.flush()

    brand_cache[normalized] = brand.id
    return brand.id


async def _search_obf(
    client: httpx.AsyncClient,
    term: str,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    """Call OBF search API (plain httpx is fine — no bot protection)."""
    params = {
        "search_terms": term,
        "search_simple": "1",
        "action": "process",
        "json": "1",
        "page": str(page),
        "page_size": str(page_size),
    }
    resp = await client.get(OBF_BASE, params=params, timeout=60.0)
    resp.raise_for_status()
    return resp.json()


async def _upsert_product(
    db: AsyncSession,
    *,
    barcode: str | None,
    name: str,
    brand_id: int,
    category_key: str,
    description: str | None,
    source_id: str | None,
    inci_ingredients: list[str] | None,
) -> tuple[Product | None, bool]:
    """Upsert by barcode or (brand_id + normalized name). Returns (product, created)."""
    now = datetime.now(UTC)
    existing: Product | None = None

    if barcode:
        result = await db.execute(select(Product).where(Product.upc == barcode))
        existing = result.scalar_one_or_none()

    if existing is None:
        norm = _normalize_name(name)
        result = await db.execute(
            select(Product).where(
                Product.brand_id == brand_id,
                func.lower(Product.name) == norm,
            )
        )
        existing = result.scalar_one_or_none()

    if existing:
        existing.last_seen_at = now
        if barcode and not existing.upc:
            existing.upc = barcode
        # Ingredient-first: only update if product has none
        if inci_ingredients and not existing.inci_ingredients:
            existing.inci_ingredients = inci_ingredients
        # Never write image from OBF
        return existing, False

    product = Product(
        name=name.strip(),
        brand_id=brand_id,
        category_key=category_key,
        upc=barcode or None,
        image_url="/placeholder-product.jpg",  # OBF images never used
        description=description,
        source="open_beauty_facts",
        source_id=source_id,
        last_seen_at=now,
        inci_ingredients=inci_ingredients,
    )
    db.add(product)
    await db.flush()
    return product, True


async def ingest_open_beauty_facts(db: AsyncSession) -> dict[str, Any]:
    """Core OBF ingestion — ingredients only, no images."""
    max_pages = settings.max_pages_per_term
    page_size = settings.page_size

    stats: dict[str, Any] = {
        "created": 0,
        "updated": 0,
        "skipped": 0,
        "errors": 0,
        "api_calls": 0,
        "terms_processed": 0,
    }
    brand_cache: dict[str, int] = {}

    async with httpx.AsyncClient(
        headers={"User-Agent": "ShortStamp-Ingestion/1.0"},
        follow_redirects=True,
    ) as http_client:
        for term in SEARCH_TERMS:
            category_key = CATEGORY_MAP.get(term, "foundation")
            try:
                for page in range(1, max_pages + 1):
                    data = await _search_obf(http_client, term, page, page_size)
                    stats["api_calls"] += 1
                    products = data.get("products", [])
                    if not products:
                        break

                    for item in products:
                        barcode = (item.get("code") or "").strip() or None
                        name = (item.get("product_name") or "").strip()
                        brand_name = (item.get("brands") or "").strip()

                        if not name:
                            stats["skipped"] += 1
                            continue

                        try:
                            async with db.begin_nested():
                                brand_id = await _get_or_create_brand(db, brand_name, brand_cache)
                                if brand_id is None:
                                    stats["skipped"] += 1
                                    continue

                                ingredients_raw = (
                                    item.get("ingredients_text_en")
                                    or item.get("ingredients_text")
                                    or ""
                                )
                                if ingredients_raw:
                                    inci = [
                                        i.strip()
                                        for i in ingredients_raw.split(",")
                                        if i.strip()
                                    ]
                                else:
                                    inci = None

                                product, created = await _upsert_product(
                                    db,
                                    barcode=barcode,
                                    name=name,
                                    brand_id=brand_id,
                                    category_key=category_key,
                                    description=(item.get("generic_name") or "").strip() or None,
                                    source_id=barcode,
                                    inci_ingredients=inci,
                                )

                                if created:
                                    stats["created"] += 1
                                    if product:
                                        logger.info(f"New product added: {product.name} ({product.id})")
                                else:
                                    stats["updated"] += 1


                        except Exception as exc:
                            logger.debug("Skipping OBF %s: %s", barcode or name[:30], exc)
                            stats["skipped"] += 1

                    # Pagination stop
                    raw_total = data.get("count", 0)
                    try:
                        total = int(raw_total)
                    except (TypeError, ValueError):
                        total = 0
                    if page * page_size >= total:
                        break

                stats["terms_processed"] += 1

            except Exception as exc:
                logger.error("Error processing OBF term '%s': %s", term, exc, exc_info=True)
                stats["errors"] += 1

    await db.commit()
    return stats


async def run_ingestion() -> None:
    await run_job(
        job_name="obf_ingest",
        source="open_beauty_facts",
        job_fn=ingest_open_beauty_facts,
        parameters={
            "terms": SEARCH_TERMS,
            "max_pages_per_term": settings.max_pages_per_term,
            "page_size": settings.page_size,
        },
    )
