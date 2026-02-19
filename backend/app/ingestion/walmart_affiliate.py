"""Walmart Affiliate Marketing API price enrichment.

Two matching stages:
1) Barcode lookup  — products with a UPC/barcode call Walmart Product Lookup.
2) Keyword fallback — if barcode lookup fails, search "brand + product name"
   and pick the best candidate via deterministic heuristic scoring.

Run manually:
    python -m app.ingestion.walmart_affiliate
"""

import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.ingestion import run_job
from app.models.product import Brand, Product, ProductPrice
from app.services.walmart_client import (
    MATCH_THRESHOLD,
    WalmartClient,
    WalmartItem,
    score_candidate,
)

logger = logging.getLogger(__name__)

# Products whose walmart price was fetched more recently than this are skipped.
STALE_HOURS = 6


def _to_utc(dt: datetime) -> datetime:
    """Normalize DB datetimes to timezone-aware UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _map_availability(stock: str) -> str:
    """Map Walmart stock string to our availability enum."""
    stock_lower = stock.lower()
    if "available" in stock_lower and "not" not in stock_lower:
        return "in_stock"
    if "not available" in stock_lower or "out" in stock_lower:
        return "out_of_stock"
    return "unknown"


async def _upsert_price(
    db: AsyncSession,
    product: Product,
    item: WalmartItem,
) -> bool:
    """Create or update a walmart price row for a product.

    Returns True if a price was written/updated.
    """
    price_val = item.sale_price or item.msrp
    if price_val is None:
        return False

    now = datetime.now(UTC)

    result = await db.execute(
        select(ProductPrice).where(
            ProductPrice.product_id == product.id,
            ProductPrice.source == "walmart",
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.price = price_val
        existing.availability = _map_availability(item.stock)
        existing.in_stock = _map_availability(item.stock) == "in_stock"
        existing.url = item.product_url or existing.url
        existing.fetched_at = now
    else:
        db.add(
            ProductPrice(
                product_id=product.id,
                source="walmart",
                price=price_val,
                currency="USD",
                availability=_map_availability(item.stock),
                in_stock=_map_availability(item.stock) == "in_stock",
                url=item.product_url or "#",
                fetched_at=now,
            )
        )

    # Store walmart_item_id on the product if not already set
    if not product.walmart_item_id:
        product.walmart_item_id = item.item_id

    return True


async def ingest_walmart_prices(db: AsyncSession) -> dict[str, Any]:
    """Core enrichment logic. Called by run_job() with a live session."""
    stats: dict[str, Any] = {
        "barcode_matched": 0,
        "barcode_missed": 0,
        "search_matched": 0,
        "search_missed": 0,
        "prices_written": 0,
        "skipped_fresh": 0,
        "errors": 0,
        "api_calls": 0,
    }

    # Get products that need pricing (no walmart_item_id or stale price)
    result = await db.execute(
        select(Product, Brand.name.label("brand_name"))
        .join(Brand, Product.brand_id == Brand.id)
        .where(
            Product.is_active == True,  # noqa: E712
            or_(
                Product.walmart_item_id.is_(None),
                Product.walmart_item_id == "",
            ),
        )
        .order_by(Product.created_at.desc())
    )
    unmatched = result.all()

    # Also get products WITH walmart_item_id but stale price
    cutoff = datetime.now(UTC)
    result2 = await db.execute(
        select(Product, Brand.name.label("brand_name"))
        .join(Brand, Product.brand_id == Brand.id)
        .where(
            Product.is_active == True,  # noqa: E712
            Product.walmart_item_id.isnot(None),
            Product.walmart_item_id != "",
        )
        .order_by(Product.created_at.desc())
    )
    matched_products = result2.all()

    async with WalmartClient(
        settings.walmart_api_key,
        private_key_path=settings.walmart_private_key_path,
        private_key_pem=settings.walmart_private_key_pem,
    ) as wm:
        # --- Stage 1: Barcode lookup for unmatched products ---
        for row in unmatched:
            product = row[0]
            brand_name = row[1] or ""

            if product.upc:
                try:
                    item = await wm.lookup_by_upc(product.upc)
                    stats["api_calls"] += 1

                    if item:
                        stats["barcode_matched"] += 1
                        if await _upsert_price(db, product, item):
                            stats["prices_written"] += 1
                        continue
                    else:
                        stats["barcode_missed"] += 1
                except Exception as exc:
                    logger.warning(
                        "Barcode lookup failed for product=%s upc=%s: %s",
                        product.id, product.upc, exc,
                    )
                    stats["errors"] += 1

            # --- Stage 2: Keyword search fallback ---
            query = f"{brand_name} {product.name}".strip()
            if not query:
                stats["search_missed"] += 1
                continue

            try:
                candidates = await wm.search(query)
                stats["api_calls"] += 1

                if not candidates:
                    stats["search_missed"] += 1
                    continue

                # Score all candidates and pick the best
                scored = [
                    (score_candidate(c, product.name, brand_name, product.upc), c)
                    for c in candidates
                ]
                scored.sort(key=lambda x: x[0], reverse=True)
                best_score, best_item = scored[0]

                if best_score >= MATCH_THRESHOLD:
                    stats["search_matched"] += 1
                    logger.info(
                        "Search match product=%s -> walmart_item=%s score=%.1f",
                        product.id, best_item.item_id, best_score,
                    )
                    if await _upsert_price(db, product, best_item):
                        stats["prices_written"] += 1
                else:
                    stats["search_missed"] += 1
                    logger.debug(
                        "No confident match for product=%s best_score=%.1f",
                        product.id, best_score,
                    )

            except Exception as exc:
                logger.warning(
                    "Search fallback failed for product=%s: %s",
                    product.id, exc,
                )
                stats["errors"] += 1

        # --- Stage 3: Refresh prices for already-matched products ---
        for row in matched_products:
            product = row[0]

            # Check if price is fresh enough
            price_result = await db.execute(
                select(ProductPrice.fetched_at).where(
                    ProductPrice.product_id == product.id,
                    ProductPrice.source == "walmart",
                )
            )
            last_fetched = price_result.scalar_one_or_none()
            if last_fetched and (cutoff - _to_utc(last_fetched)).total_seconds() < STALE_HOURS * 3600:
                stats["skipped_fresh"] += 1
                continue

            # Re-lookup by UPC if available
            if product.upc:
                try:
                    item = await wm.lookup_by_upc(product.upc)
                    stats["api_calls"] += 1
                    if item and await _upsert_price(db, product, item):
                        stats["prices_written"] += 1
                        continue
                except Exception as exc:
                    logger.warning(
                        "Price refresh failed for product=%s: %s", product.id, exc
                    )
                    stats["errors"] += 1

    await db.commit()
    return stats


# ---------------------------------------------------------------------------
# Entrypoints
# ---------------------------------------------------------------------------

async def run_ingestion() -> None:
    """Wrapper that runs the job through the standard run_job infrastructure."""
    has_key = settings.walmart_private_key_path or settings.walmart_private_key_pem
    if not settings.walmart_api_key or not has_key:
        logger.warning("WALMART_API_KEY or private key not configured")
        await run_job(
            job_name="walmart_prices",
            source="walmart",
            job_fn=_skip_no_key,
        )
        return

    await run_job(
        job_name="walmart_prices",
        source="walmart",
        job_fn=ingest_walmart_prices,
    )


async def _skip_no_key(db: AsyncSession) -> dict[str, Any]:
    """Return immediately with a note that the API key is missing."""
    raise RuntimeError("WALMART_API_KEY not configured — skipping Walmart enrichment")


if __name__ == "__main__":
    import asyncio

    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_ingestion())
