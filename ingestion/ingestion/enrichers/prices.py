"""Price staleness refresh and is_active management.

- refresh_stale_prices: re-fetches prices older than STALE_HOURS from their
  original source (Sephora API, Walmart API) and updates is_active accordingly.
- update_active_status: called after every price write to set is_active based
  on whether the product has at least one valid, in-stock price link.
"""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ingestion.http.client import ResilientClient
from ingestion.models import Product, ProductPrice
from ingestion.pipeline.runner import run_job

logger = logging.getLogger(__name__)

STALE_HOURS = 4
SEPHORA_API_BASE = "https://www.sephora.com/api/catalog/products"
_SEPHORA_HEADERS = {
    "Accept": "application/json",
    "Referer": "https://www.sephora.com/",
    "x-requested-with": "XMLHttpRequest",
}


def _is_valid_url(url: str | None) -> bool:
    return bool(url and url not in ("#", "") and url.startswith("http"))


async def update_active_status(db: AsyncSession, product_id: str) -> None:
    """Set product.is_active based on presence of valid price links."""
    result = await db.execute(
        select(ProductPrice).where(ProductPrice.product_id == product_id)
    )
    prices = result.scalars().all()

    has_valid = any(
        _is_valid_url(p.url) and (p.in_stock or p.price > 0)
        for p in prices
    )

    prod_result = await db.execute(
        select(Product).where(Product.id == product_id)
    )
    product = prod_result.scalar_one_or_none()
    if product:
        product.is_active = has_valid


def _parse_price(raw: Any) -> float | None:
    if raw is None:
        return None
    try:
        cleaned = re.sub(r"[^\d.]", "", str(raw))
        return float(cleaned) if cleaned else None
    except (TypeError, ValueError):
        return None


async def _refresh_sephora_price(
    client: ResilientClient,
    db: AsyncSession,
    product: Product,
    price_row: ProductPrice,
) -> bool:
    """Re-fetch Sephora price for a product. Returns True if updated."""
    source_id = product.source_id or product.sephora_product_id
    if not source_id:
        return False

    try:
        resp = await client.get(
            f"{SEPHORA_API_BASE}/{source_id}",
            headers=_SEPHORA_HEADERS,
            params={"ch": "rwd"},
            timeout=20.0,
        )
    except Exception as exc:
        logger.debug("Sephora price refresh failed %s: %s", source_id, exc)
        return False

    if resp.status_code == 404:
        # Product removed — mark inactive
        price_row.in_stock = False
        price_row.availability = "discontinued"
        price_row.fetched_at = datetime.now(UTC)
        await update_active_status(db, product.id)
        return True

    if resp.status_code >= 400:
        return False

    try:
        body = resp.json()
    except Exception:
        return False

    product_node = body.get("currentProduct", body)
    current_sku = product_node.get("currentSku") or {}
    price = _parse_price(
        current_sku.get("salePrice") or current_sku.get("listPrice")
    )

    now = datetime.now(UTC)
    if price is not None and price > 0:
        price_row.price = price
        price_row.in_stock = True
        price_row.availability = "in_stock"
    else:
        price_row.in_stock = False
        price_row.availability = "out_of_stock"

    price_row.fetched_at = now
    await update_active_status(db, product.id)
    return True


async def refresh_stale_prices(db: AsyncSession) -> dict[str, Any]:
    """Refresh all ProductPrice rows older than STALE_HOURS."""
    cutoff = datetime.now(UTC) - timedelta(hours=STALE_HOURS)

    stats: dict[str, Any] = {
        "sephora_refreshed": 0,
        "sephora_errors": 0,
        "skipped": 0,
        "is_active_updated": 0,
    }

    # Find stale Sephora prices
    result = await db.execute(
        select(ProductPrice, Product)
        .join(Product, ProductPrice.product_id == Product.id)
        .where(
            ProductPrice.source == "sephora",
            ProductPrice.fetched_at < cutoff,
            Product.is_active == True,  # noqa: E712
        )
        .limit(500)
    )
    rows = result.all()

    async with ResilientClient() as client:
        for price_row, product in rows:
            success = await _refresh_sephora_price(client, db, product, price_row)
            if success:
                stats["sephora_refreshed"] += 1
            else:
                stats["sephora_errors"] += 1

    # Update is_active for products whose all prices are now invalid
    result2 = await db.execute(
        select(Product).where(Product.is_active == True)  # noqa: E712
    )
    products = result2.scalars().all()
    for product in products:
        price_res = await db.execute(
            select(ProductPrice).where(ProductPrice.product_id == product.id)
        )
        prices = price_res.scalars().all()
        has_valid = any(_is_valid_url(p.url) for p in prices)
        if not has_valid and product.is_active:
            product.is_active = False
            stats["is_active_updated"] += 1

    await db.commit()
    return stats


async def run_price_refresh() -> None:
    await run_job(
        job_name="price_refresh",
        source="price_enricher",
        job_fn=refresh_stale_prices,
    )
