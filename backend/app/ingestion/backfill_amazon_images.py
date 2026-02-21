"""
Backfill Amazon product images.

Fetches the Amazon product page for every Product with:
  - source = 'amazon_scrape'
  - image_url = '/placeholder-product.jpg'
  - amazon_asin IS NOT NULL

Extracts the best-quality image via _extract_amazon_image() and writes it
back to the DB. Runs in small batches with a short sleep between requests
to stay under Amazon's bot-detection threshold.

Usage:
    python -m app.ingestion.backfill_amazon_images            # all placeholders
    python -m app.ingestion.backfill_amazon_images --limit 200  # first 200
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import time

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.ingestion.retailer_scrape import (
    SCRAPER_USER_AGENT,
    _extract_amazon_image,
    _extract_meta_content,
    _is_amazon_bot_page,
    _upgrade_amazon_image_url,
)
from app.models.product import Product

logger = logging.getLogger(__name__)

# Seconds between individual page fetches — stays polite without being too slow
_FETCH_DELAY = 0.8
# Commit to DB every N products
_BATCH_SIZE = 25


async def _fetch_image_for_asin(
    client: httpx.AsyncClient,
    asin: str,
) -> str | None:
    url = f"https://www.amazon.com/dp/{asin}"
    try:
        resp = await client.get(url)
    except Exception as exc:
        logger.debug("Fetch failed for ASIN %s: %s", asin, exc)
        return None

    if resp.status_code >= 400:
        logger.debug("HTTP %d for ASIN %s", resp.status_code, asin)
        return None

    html = resp.text
    if _is_amazon_bot_page(html):
        logger.warning("Bot-detection triggered for ASIN %s — slowing down", asin)
        await asyncio.sleep(5)
        return None

    image_url = _extract_amazon_image(html)
    if not image_url:
        image_url = _extract_meta_content(html, "og:image")
    if image_url:
        image_url = _upgrade_amazon_image_url(image_url)

    return image_url or None


async def backfill(limit: int | None = None) -> None:
    async with async_session() as db:
        q = (
            select(Product)
            .where(
                Product.source == "amazon_scrape",
                Product.image_url == "/placeholder-product.jpg",
                Product.amazon_asin.isnot(None),
            )
            .order_by(Product.created_at.desc())
        )
        if limit:
            q = q.limit(limit)

        result = await db.execute(q)
        products = list(result.scalars().all())

    total = len(products)
    logger.info("Found %d Amazon products with placeholder images", total)
    if not total:
        return

    updated = 0
    skipped = 0

    async with httpx.AsyncClient(
        timeout=20.0,
        follow_redirects=True,
        headers={
            "User-Agent": SCRAPER_USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
        },
    ) as client:
        # Process in batches so we commit progress incrementally
        for batch_start in range(0, total, _BATCH_SIZE):
            batch = products[batch_start : batch_start + _BATCH_SIZE]

            async with async_session() as db:
                for product in batch:
                    asin = product.amazon_asin
                    image_url = await _fetch_image_for_asin(client, asin)

                    if image_url:
                        # Re-fetch the row inside this session to update it
                        result = await db.execute(
                            select(Product).where(Product.id == product.id)
                        )
                        row = result.scalar_one_or_none()
                        if row:
                            row.image_url = image_url
                            updated += 1
                            logger.info(
                                "[%d/%d] ASIN %s → %s",
                                batch_start + updated + skipped,
                                total,
                                asin,
                                image_url[:60],
                            )
                    else:
                        skipped += 1
                        logger.debug("No image found for ASIN %s", asin)

                    await asyncio.sleep(_FETCH_DELAY)

                await db.commit()

            logger.info(
                "Batch %d–%d done — updated so far: %d, skipped: %d",
                batch_start + 1,
                min(batch_start + _BATCH_SIZE, total),
                updated,
                skipped,
            )

    logger.info(
        "Backfill complete — updated: %d / %d, skipped (no image found): %d",
        updated,
        total,
        skipped,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill Amazon product images")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Max number of products to process (default: all)",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    asyncio.run(backfill(limit=args.limit))
