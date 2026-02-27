"""Walmart Affiliate Marketing API price enrichment.

Ported from backend/app/ingestion/walmart_affiliate.py.
Uses ResilientClient for the Walmart API calls.
Two-stage matching: barcode lookup → keyword search fallback.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ingestion.config import settings
from ingestion.models import Brand, Product, ProductPrice
from ingestion.pipeline.runner import run_job

logger = logging.getLogger(__name__)

STALE_HOURS = 6
MATCH_THRESHOLD = 60.0  # minimum score to accept a keyword-search match


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _map_availability(stock: str) -> str:
    s = stock.lower()
    if "available" in s and "not" not in s:
        return "in_stock"
    if "not available" in s or "out" in s:
        return "out_of_stock"
    return "unknown"


def _score_candidate(
    name: str,
    candidate_name: str,
    brand: str,
    upc: str | None,
    candidate_upc: str | None,
) -> float:
    """Heuristic score (0–100) for how well a Walmart candidate matches our product."""
    score = 0.0
    if upc and candidate_upc and upc == candidate_upc:
        score += 60.0
    cn = candidate_name.lower()
    pn = name.lower()
    if pn in cn or cn in pn:
        score += 20.0
    if brand and brand.lower() in cn:
        score += 20.0
    return score


async def _upsert_price(
    db: AsyncSession,
    product: Product,
    item: dict[str, Any],
) -> bool:
    price_val = item.get("salePrice") or item.get("msrp")
    if price_val is None:
        return False

    now = datetime.now(UTC)
    stock = item.get("stock", "")
    avail = _map_availability(stock)

    # Prefer direct productUrl over tracking URLs containing |PUBID|
    raw_url = item.get("productUrl") or item.get("affiliateAddToCartUrl") or "#"
    if "|PUBID|" in raw_url or "goto.walmart.com" in raw_url:
        item_id = item.get("itemId")
        url = f"https://www.walmart.com/ip/{item_id}" if item_id else "#"
    else:
        url = raw_url

    result = await db.execute(
        select(ProductPrice).where(
            ProductPrice.product_id == product.id,
            ProductPrice.source == "walmart",
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.price = float(price_val)
        existing.availability = avail
        existing.in_stock = avail == "in_stock"
        existing.url = url
        existing.fetched_at = now
    else:
        db.add(ProductPrice(
            product_id=product.id,
            source="walmart",
            price=float(price_val),
            currency="USD",
            availability=avail,
            in_stock=avail == "in_stock",
            url=url,
            fetched_at=now,
        ))

    if not product.walmart_item_id:
        product.walmart_item_id = str(item.get("itemId") or "")

    return True


async def ingest_walmart_prices(db: AsyncSession) -> dict[str, Any]:
    """Walmart price enrichment. Requires backend WalmartClient via sys.path."""
    # Import WalmartClient from backend (mounted at /backend)
    try:
        from app.services.walmart_client import WalmartClient, score_candidate, MATCH_THRESHOLD as WM_THRESHOLD
    except ImportError:
        logger.error("Cannot import WalmartClient from backend — is /backend on PYTHONPATH?")
        return {"error": "WalmartClient not available"}

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

    now = datetime.now(UTC)
    cutoff_stale = now - timedelta(hours=STALE_HOURS)

    # Products without Walmart match yet
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

    # Already-matched products with stale prices
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
        # Stage 1: barcode + keyword matching for unmatched products
        for row in unmatched:
            product = row[0]
            brand_name = row[1] or ""

            if product.upc:
                try:
                    item = await wm.lookup_by_upc(product.upc)
                    stats["api_calls"] += 1
                    if item:
                        stats["barcode_matched"] += 1
                        if await _upsert_price(db, product, item.__dict__):
                            stats["prices_written"] += 1
                        continue
                    stats["barcode_missed"] += 1
                except Exception as exc:
                    logger.warning("Barcode lookup failed product=%s: %s", product.id, exc)
                    stats["errors"] += 1

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

                scored = [
                    (score_candidate(c, product.name, brand_name, product.upc), c)
                    for c in candidates
                ]
                scored.sort(key=lambda x: x[0], reverse=True)
                best_score, best_item = scored[0]

                if best_score >= WM_THRESHOLD:
                    stats["search_matched"] += 1
                    if await _upsert_price(db, product, best_item.__dict__):
                        stats["prices_written"] += 1
                else:
                    stats["search_missed"] += 1
            except Exception as exc:
                logger.warning("Walmart search failed product=%s: %s", product.id, exc)
                stats["errors"] += 1

        # Stage 2: refresh stale prices for already-matched products
        for row in matched_products:
            product = row[0]

            price_result = await db.execute(
                select(ProductPrice.fetched_at).where(
                    ProductPrice.product_id == product.id,
                    ProductPrice.source == "walmart",
                )
            )
            last_fetched = price_result.scalar_one_or_none()
            if last_fetched and _to_utc(last_fetched) > cutoff_stale:
                stats["skipped_fresh"] += 1
                continue

            if product.upc:
                try:
                    item = await wm.lookup_by_upc(product.upc)
                    stats["api_calls"] += 1
                    if item and await _upsert_price(db, product, item.__dict__):
                        stats["prices_written"] += 1
                except Exception as exc:
                    logger.warning("Price refresh failed product=%s: %s", product.id, exc)
                    stats["errors"] += 1

    await db.commit()
    return stats


async def _skip_no_key(db: AsyncSession) -> dict[str, Any]:
    raise RuntimeError("WALMART_API_KEY not configured — skipping Walmart enrichment")


async def run_ingestion() -> None:
    has_key = settings.walmart_private_key_path or settings.walmart_private_key_pem
    if not settings.walmart_api_key or not has_key:
        logger.warning("Walmart API key not configured — skipping")
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
