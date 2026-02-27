"""Ulta Beauty price link enrichment.

Lightweight source — only for products already sourced from Ulta.
Fetches individual product pages to extract current price + URL from JSON-LD,
and ingredient lists if missing.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ingestion.http.client import ResilientClient
from ingestion.models import Product, ProductPrice
from ingestion.pipeline.runner import run_job

logger = logging.getLogger(__name__)

ULTA_BASE = "https://www.ulta.com"


def _extract_json_ld(html: str) -> dict[str, Any] | None:
    """Extract first Product JSON-LD block from page HTML."""
    for match in re.finditer(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        re.DOTALL | re.IGNORECASE,
    ):
        try:
            data = json.loads(match.group(1))
            if isinstance(data, list):
                data = data[0]
            if isinstance(data, dict) and data.get("@type") == "Product":
                return data
        except (json.JSONDecodeError, IndexError):
            continue
    return None


def _extract_price(json_ld: dict[str, Any]) -> float | None:
    offers = json_ld.get("offers") or {}
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    price_raw = offers.get("price") or offers.get("lowPrice")
    if price_raw is None:
        return None
    try:
        return float(re.sub(r"[^\d.]", "", str(price_raw)))
    except ValueError:
        return None


def _extract_ingredients(json_ld: dict[str, Any], html: str) -> list[str] | None:
    # Try itemIngredients in JSON-LD
    raw = json_ld.get("itemIngredients") or json_ld.get("ingredients")
    if raw and isinstance(raw, str):
        parts = [p.strip() for p in raw.split(",") if p.strip()]
        if parts:
            return parts

    # Fallback: look for ingredient section in HTML
    match = re.search(
        r'(?:Ingredients?|INCI)[:\s]*</[^>]+>\s*<[^>]+>([^<]{40,})',
        html,
        re.IGNORECASE,
    )
    if match:
        parts = [p.strip() for p in match.group(1).split(",") if p.strip()]
        return parts or None

    return None


async def _upsert_ulta_price(
    db: AsyncSession,
    product: Product,
    price: float,
    url: str,
    in_stock: bool,
) -> None:
    now = datetime.now(UTC)
    result = await db.execute(
        select(ProductPrice).where(
            ProductPrice.product_id == product.id,
            ProductPrice.source == "ulta",
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.price = price
        existing.url = url
        existing.in_stock = in_stock
        existing.availability = "in_stock" if in_stock else "out_of_stock"
        existing.fetched_at = now
    else:
        db.add(ProductPrice(
            product_id=product.id,
            source="ulta",
            price=price,
            currency="USD",
            url=url,
            in_stock=in_stock,
            availability="in_stock" if in_stock else "out_of_stock",
            fetched_at=now,
        ))


async def ingest_ulta_prices(db: AsyncSession) -> dict[str, Any]:
    """Refresh price links for Ulta-sourced products."""
    stats: dict[str, Any] = {
        "processed": 0,
        "prices_updated": 0,
        "ingredients_found": 0,
        "errors": 0,
    }

    result = await db.execute(
        select(Product).where(
            Product.source == "ulta_scrape",
            Product.is_active == True,  # noqa: E712
        ).limit(200)
    )
    products = result.scalars().all()

    async with ResilientClient() as client:
        for product in products:
            # Derive Ulta URL from source_id or existing price link
            price_result = await db.execute(
                select(ProductPrice).where(
                    ProductPrice.product_id == product.id,
                    ProductPrice.source == "ulta",
                )
            )
            price_row = price_result.scalar_one_or_none()
            url = (price_row.url if price_row and price_row.url and price_row.url != "#" else None)

            if not url:
                logger.debug("No Ulta URL for product %s — skipping", product.id)
                continue

            try:
                resp = await client.get(url, timeout=20.0)
            except Exception as exc:
                logger.debug("Ulta fetch failed %s: %s", url, exc)
                stats["errors"] += 1
                continue

            if resp.status_code >= 400:
                stats["errors"] += 1
                continue

            html = resp.text
            json_ld = _extract_json_ld(html)
            if not json_ld:
                stats["errors"] += 1
                continue

            price = _extract_price(json_ld)
            if price is None:
                stats["errors"] += 1
                continue

            offers = json_ld.get("offers") or {}
            if isinstance(offers, list):
                offers = offers[0] if offers else {}
            availability = str(offers.get("availability") or "").lower()
            in_stock = "instock" in availability or "instock" in availability.replace(" ", "")

            await _upsert_ulta_price(db, product, price, url, in_stock)
            stats["prices_updated"] += 1

            if not product.inci_ingredients:
                inci = _extract_ingredients(json_ld, html)
                if inci:
                    product.inci_ingredients = inci
                    stats["ingredients_found"] += 1

            stats["processed"] += 1

    await db.commit()
    return stats


async def run_ingestion() -> None:
    await run_job(
        job_name="ulta_prices",
        source="ulta",
        job_fn=ingest_ulta_prices,
    )
