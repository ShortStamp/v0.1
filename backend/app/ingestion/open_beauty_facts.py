"""Open Beauty Facts product catalog ingestion.

Searches the public OBF API for cosmetics/makeup products, upserting brands and
products into the local database.  Idempotent: re-running will not create
duplicates thanks to barcode uniqueness and (brand_id, normalized_name) fallback.

Run manually:
    python -m app.ingestion.open_beauty_facts
"""

import logging
import re
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.ingestion import run_job
from app.ingestion.filter_extractor import extract_filters_from_obf_product
from app.models.product import Brand, Product, ProductFilterValue
from app.services.obf_client import search_products

import httpx

logger = logging.getLogger(__name__)

# Makeup search terms — covers the 5 face areas (Base, Eyes, Brows, Cheeks, Lips)
SEARCH_TERMS = [
    "foundation", "concealer", "primer", "powder",
    "blush", "bronzer", "highlighter",
    "eyeshadow", "eyeliner", "mascara",
    "lipstick", "lip gloss", "lip liner",
    "setting spray",
    "brow pencil", "brow gel",
]

# Search term -> category_key mapping
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


def _normalize_name(name: str) -> str:
    """Lowercase, collapse whitespace, strip."""
    return re.sub(r"\s+", " ", name.strip().lower())


def _clean_brand_name(raw: str) -> str:
    """OBF often returns comma-separated brand lists. Take the first one."""
    first = raw.split(",")[0].strip()
    return first


async def _get_or_create_brand(
    db: AsyncSession, raw_name: str, brand_cache: dict[str, int]
) -> int | None:
    """Return brand_id for a given raw brand name, creating if needed.

    Uses an in-memory cache to avoid repeated DB lookups within a single run.
    """
    cleaned = _clean_brand_name(raw_name)
    if not cleaned:
        return None

    normalized = _normalize_name(cleaned)
    if normalized in brand_cache:
        return brand_cache[normalized]

    # Case-insensitive lookup
    result = await db.execute(
        select(Brand).where(func.lower(Brand.name) == normalized)
    )
    brand = result.scalar_one_or_none()

    if not brand:
        slug = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
        # Check for slug collision
        slug_exists = await db.execute(select(Brand).where(Brand.slug == slug))
        if slug_exists.scalar_one_or_none():
            slug = slug + "-" + re.sub(r"[^a-z0-9]", "", normalized)[:8]
        brand = Brand(name=cleaned, slug=slug)
        db.add(brand)
        await db.flush()

    brand_cache[normalized] = brand.id
    return brand.id


async def _upsert_product(
    db: AsyncSession,
    *,
    barcode: str | None,
    name: str,
    brand_id: int,
    category_key: str,
    image_url: str | None,
    description: str | None,
    source_id: str | None,
    filters: dict[str, str] | None = None,
) -> str:
    """Upsert a product by barcode (preferred) or (brand_id + normalized name).
    
    Also upserts filter values if provided.

    Returns: "created", "updated", or "skipped" (no meaningful change).
    """
    now = datetime.now(UTC)
    existing: Product | None = None

    # Strategy 1: match by barcode
    if barcode:
        result = await db.execute(
            select(Product).where(Product.upc == barcode)
        )
        existing = result.scalar_one_or_none()

    # Strategy 2: match by (brand_id + normalized name)
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
        # Fill in barcode if we didn't have it before
        if barcode and not existing.upc:
            existing.upc = barcode
        if image_url and existing.image_url == "/placeholder-product.jpg":
            existing.image_url = image_url
        
        # Update filter values if provided
        if filters:
            await _upsert_filter_values(db, existing.id, filters)
        
        return "updated"

    # Create new product
    product = Product(
        name=name.strip(),
        brand_id=brand_id,
        category_key=category_key,
        upc=barcode or None,
        image_url=image_url or "/placeholder-product.jpg",
        description=description,
        source="open_beauty_facts",
        source_id=source_id,
        last_seen_at=now,
    )
    db.add(product)
    await db.flush()  # Get product ID
    
    # Create filter values if provided
    if filters:
        await _upsert_filter_values(db, product.id, filters)
    
    return "created"


async def _upsert_filter_values(
    db: AsyncSession, product_id: str, filters: dict[str, str]
) -> None:
    """Upsert filter values for a product.
    
    Replaces existing filter values with new ones.
    """
    # Delete existing filter values for this product
    await db.execute(
        select(ProductFilterValue).where(ProductFilterValue.product_id == product_id)
    )
    result = await db.execute(
        select(ProductFilterValue).where(ProductFilterValue.product_id == product_id)
    )
    existing_filters = result.scalars().all()
    for fv in existing_filters:
        await db.delete(fv)
    
    # Create new filter values
    for filter_key, value in filters.items():
        filter_value = ProductFilterValue(
            product_id=product_id,
            filter_key=filter_key,
            value=value,
        )
        db.add(filter_value)


async def ingest_open_beauty_facts(db: AsyncSession) -> dict[str, Any]:
    """Core ingestion logic.  Called by run_job() with a live session."""
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
    term_errors: list[str] = []
    brand_cache: dict[str, int] = {}

    async with httpx.AsyncClient(
        timeout=60, headers={"User-Agent": "ShortStamp/1.0"}
    ) as http_client:
        for term in SEARCH_TERMS:
            category_key = CATEGORY_MAP.get(term, "foundation")
            try:
                for page in range(1, max_pages + 1):
                    data = await search_products(
                        term, page=page, page_size=page_size, client=http_client
                    )
                    stats["api_calls"] += 1
                    products = data.get("products", [])

                    if not products:
                        break

                    for item in products:
                        barcode = item.get("code", "").strip() or None
                        name = (item.get("product_name") or "").strip()
                        brand_name = (item.get("brands") or "").strip()

                        if not name:
                            stats["skipped"] += 1
                            continue

                        try:
                            async with db.begin_nested():
                                brand_id = await _get_or_create_brand(
                                    db, brand_name, brand_cache
                                )
                                if brand_id is None:
                                    stats["skipped"] += 1
                                    continue

                                # Extract filter values from product name/description
                                filters = extract_filters_from_obf_product(
                                    category_key, item
                                )

                                outcome = await _upsert_product(
                                    db,
                                    barcode=barcode,
                                    name=name,
                                    brand_id=brand_id,
                                    category_key=category_key,
                                    image_url=item.get("image_url"),
                                    description=item.get("generic_name", "").strip() or None,
                                    source_id=barcode,
                                    filters=filters,
                                )
                                stats[outcome] += 1
                        except Exception as exc:
                            logger.debug(
                                "Skipping product %s: %s", barcode or name[:30], exc
                            )
                            stats["skipped"] += 1

                    # If fewer results than page_size, no more pages
                    # OBF may return "count" as either int or numeric string.
                    raw_total = data.get("count", 0)
                    try:
                        total = int(raw_total)
                    except (TypeError, ValueError):
                        total = 0
                    if page * page_size >= total:
                        break

                stats["terms_processed"] += 1

            except Exception as exc:
                logger.error(
                    "Error processing term '%s': %s", term, exc, exc_info=True
                )
                stats["errors"] += 1
                term_errors.append(f"{term}: {exc}")
                # Continue with next term — partial failure is acceptable

    await db.commit()

    if term_errors:
        stats["term_errors"] = term_errors

    return stats


# ---------------------------------------------------------------------------
# Entrypoints
# ---------------------------------------------------------------------------

async def run_ingestion() -> None:
    """Wrapper that runs the job through the standard run_job infrastructure."""
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


if __name__ == "__main__":
    import asyncio

    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_ingestion())
