"""
Backfill retailer product ingredients.

Sephora: hits www.sephora.com/api/catalog/products/{productId}?fields=ingredientDesc
         — structured JSON, no HTML scraping needed.
Ulta:    fetches the product page HTML and extracts via _extract_ulta_ingredients.

Usage:
    python -m app.ingestion.backfill_retailer_ingredients
    python -m app.ingestion.backfill_retailer_ingredients --retailer sephora --limit 200
"""
from __future__ import annotations

import argparse
import asyncio
import logging

import re
from html import unescape

from curl_cffi.requests import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import async_session
from app.models.product import Product


def _parse_ingredient_string(text: str) -> list[str]:
    """Strip HTML, split on commas, return cleaned ingredient list."""
    cleaned = re.sub(r"<[^>]+>", " ", text)
    cleaned = unescape(cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    parts = [p.strip().rstrip(".") for p in cleaned.split(",")]
    return [p for p in parts if p and len(p) > 1]


def _extract_ulta_ingredients(html: str) -> list[str] | None:
    """Extract ingredient list from Ulta product page HTML."""
    match = re.search(
        r'"ingredients"\s*:\s*"([^"]{20,})"', html, re.IGNORECASE
    ) or re.search(
        r'Ingredients?[^:]*:\s*</[^>]+>\s*<[^>]+>([^<]{20,})', html, re.IGNORECASE
    )
    if not match:
        return None
    return _parse_ingredient_string(match.group(1)) or None

logger = logging.getLogger(__name__)

_FETCH_DELAY = 1.2   # seconds between page fetches
_BATCH_SIZE = 25     # products committed per DB transaction

_SOURCE_MAP = {
    "sephora": "sephora_scrape",
    "ulta": "ulta_scrape",
}

_SEPHORA_API = "https://www.sephora.com/api/catalog/products/{product_id}"

_SEPHORA_HEADERS = {
    "Accept": "application/json",
    "Referer": "https://www.sephora.com/",
    "x-requested-with": "XMLHttpRequest",
    "Origin": "https://www.sephora.com",
}


async def _fetch_sephora_api(
    session: AsyncSession,
    product_id: str,
) -> tuple[list[str] | None, str]:
    url = _SEPHORA_API.format(product_id=product_id)
    try:
        resp = await session.get(url, headers=_SEPHORA_HEADERS, params={"ch": "rwd"}, timeout=25)
    except Exception as exc:
        return None, f"network ({exc})"

    if resp.status_code >= 400:
        return None, f"http_{resp.status_code}"

    try:
        data = resp.json()
    except Exception:
        return None, f"json_parse_error (body={resp.text[:120]!r})"

    # Unwrap currentProduct wrapper if present
    node = data.get("currentProduct", data)
    # Try top-level field first, then nested under currentSku
    raw = (
        node.get("ingredientDesc")
        or (node.get("currentSku") or {}).get("ingredientDesc")
        or ""
    )
    if not raw:
        return None, f"no_ingredientDesc (keys={list(data.keys())[:8]})"

    result = _parse_ingredient_string(raw)
    if result:
        return result, "ok"
    return None, f"parse_failed (raw={raw[:80]!r})"


async def _fetch_ulta_html(
    session: AsyncSession,
    url: str,
) -> tuple[list[str] | None, str]:
    try:
        resp = await session.get(url, headers={"Referer": "https://www.ulta.com/"})
    except Exception as exc:
        return None, f"network ({exc})"

    if resp.status_code >= 400:
        return None, f"http_{resp.status_code}"

    result = _extract_ulta_ingredients(resp.text)
    if result:
        return result, "ok"
    return None, f"no_match (page len={len(resp.text)})"


async def backfill(
    limit: int | None = None,
    retailer: str | None = None,
) -> None:
    if retailer:
        slug = retailer.lower()
        if slug not in _SOURCE_MAP:
            raise ValueError(f"Unknown retailer '{retailer}'. Choose from: {', '.join(_SOURCE_MAP)}")
        sources = [_SOURCE_MAP[slug]]
    else:
        sources = list(_SOURCE_MAP.values())

    async with async_session() as db:
        q = (
            select(Product)
            .where(
                Product.source.in_(sources),
                Product.inci_ingredients.is_(None),
            )
            .options(selectinload(Product.prices))
            .order_by(Product.created_at.desc())
        )
        if limit:
            q = q.limit(limit)

        result = await db.execute(q)
        products = list(result.scalars().all())

        product_meta: dict[str, dict] = {}
        for product in products:
            url = next(
                (p.url for p in product.prices if p.url and p.url != "#"),
                None,
            )
            product_meta[product.id] = {
                "source": product.source,
                "source_id": product.source_id or "",
                "name": product.name,
                "url": url,
            }

    total = len(products)
    logger.info("Found %d products without ingredients (sources: %s)", total, ", ".join(sources))
    if not total:
        return

    updated = 0
    skipped = 0
    no_url = 0

    async with AsyncSession(impersonate="chrome120") as session:
        # Warm up cookies for each retailer
        for source in sources:
            warmup = "https://www.sephora.com" if source == "sephora_scrape" else "https://www.ulta.com"
            try:
                await session.get(warmup)
                logger.info("Warmed up: %s", warmup)
                await asyncio.sleep(1.5)
            except Exception as exc:
                logger.warning("Warm-up failed for %s: %s", warmup, exc)

        for batch_start in range(0, total, _BATCH_SIZE):
            batch = products[batch_start : batch_start + _BATCH_SIZE]

            async with async_session() as db:
                for product in batch:
                    meta = product_meta[product.id]
                    source = meta["source"]
                    n = batch_start + updated + skipped + no_url + 1

                    if source == "sephora_scrape":
                        ingredients, reason = await _fetch_sephora_api(session, meta["source_id"])
                    else:
                        url = meta["url"]
                        if not url:
                            no_url += 1
                            logger.warning("[%d/%d] NO_URL %s", n, total, meta["name"][:60])
                            continue
                        ingredients, reason = await _fetch_ulta_html(session, url)

                    if ingredients:
                        result = await db.execute(select(Product).where(Product.id == product.id))
                        row = result.scalar_one_or_none()
                        if row and not row.inci_ingredients:
                            row.inci_ingredients = ingredients
                            updated += 1
                            logger.info("[%d/%d] OK   %s → %d ingredients", n, total, meta["name"][:60], len(ingredients))
                    else:
                        skipped += 1
                        logger.warning("[%d/%d] SKIP %s | %s", n, total, meta["name"][:50], reason)

                    await asyncio.sleep(_FETCH_DELAY)

                await db.commit()

            logger.info(
                "Batch %d–%d done — updated: %d, skipped: %d, no_url: %d",
                batch_start + 1,
                min(batch_start + _BATCH_SIZE, total),
                updated, skipped, no_url,
            )

    logger.info(
        "Backfill complete — updated: %d / %d, skipped: %d, no_url: %d",
        updated, total, skipped, no_url,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill retailer product ingredients")
    parser.add_argument("--limit", type=int, default=None, help="Max products to process")
    parser.add_argument("--retailer", type=str, default=None, choices=list(_SOURCE_MAP.keys()))
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(backfill(limit=args.limit, retailer=args.retailer))
