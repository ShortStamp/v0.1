"""Image URL enrichment — priority chain and placeholder replacement.

Priority chain (highest to lowest):
1. Sephora CDN (sephora.com/productimages/) — guaranteed white bg, high res
2. Amazon high-res (upgraded from thumbnail to _SL1500_)
3. Ulta (media.ulta.com)
4. Any non-placeholder URL already on the product
5. Placeholder — only if nothing better exists

Weekly batch job scans all active products with placeholder images and
attempts to find a better image from the product's source data.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ingestion.http.client import ResilientClient
from ingestion.models import Product, ProductPrice
from ingestion.pipeline.runner import run_job

logger = logging.getLogger(__name__)

_PLACEHOLDER_PATTERNS = [
    "/placeholder-product.jpg",
    "openfoodfacts.org",
]

_SEPHORA_CDN_PATTERN = re.compile(r"sephora\.com", re.IGNORECASE)
_AMAZON_PATTERN = re.compile(r"amazon\.(com|ca|co\.uk)", re.IGNORECASE)
_ULTA_PATTERN = re.compile(r"media\.ulta\.com", re.IGNORECASE)

# Amazon thumbnail size tokens that should be replaced with high-res
_AMAZON_THUMB_PATTERNS = re.compile(
    r"\._(?:AC_UL\d+|AC_SR\d+,\d+|SL\d+|AC_US\d+|SX\d+|SY\d+)_",
    re.IGNORECASE,
)


def is_placeholder(url: str | None) -> bool:
    if not url:
        return True
    return any(p in url for p in _PLACEHOLDER_PATTERNS)


def _image_priority(url: str | None) -> int:
    """Lower number = higher priority."""
    if not url or is_placeholder(url):
        return 99
    if _SEPHORA_CDN_PATTERN.search(url):
        return 1
    if _AMAZON_PATTERN.search(url):
        return 2
    if _ULTA_PATTERN.search(url):
        return 3
    return 5


def upgrade_amazon_image_url(url: str) -> str:
    """Upgrade an Amazon image URL to the highest available resolution."""
    # Remove size tokens and replace with _SL1500_
    upgraded = _AMAZON_THUMB_PATTERNS.sub(".", url)
    # Ensure no double dots
    upgraded = re.sub(r"\.{2,}", ".", upgraded)
    # Insert _SL1500_ before the file extension
    upgraded = re.sub(r"(\.[a-zA-Z]{3,4})$", "._SL1500_\\1", upgraded)
    return upgraded


async def _try_sephora_image(
    client: ResilientClient,
    product: Product,
) -> str | None:
    """Hit Sephora product detail API to get CDN image URL."""
    source_id = product.source_id or product.sephora_product_id
    if not source_id:
        return None

    try:
        resp = await client.get(
            f"https://www.sephora.com/api/catalog/products/{source_id}",
            headers={
                "Accept": "application/json",
                "Referer": "https://www.sephora.com/",
                "x-requested-with": "XMLHttpRequest",
            },
            params={"ch": "rwd"},
            timeout=20.0,
        )
    except Exception as exc:
        logger.debug("Sephora image API failed %s: %s", source_id, exc)
        return None

    if resp.status_code >= 400:
        return None

    try:
        body = resp.json()
    except Exception:
        return None

    product_node = body.get("currentProduct", body)
    media = product_node.get("media") or []
    for item in media:
        if isinstance(item, dict):
            url = str(item.get("mediaUrl") or item.get("imageUrl") or "").strip()
            if url and _SEPHORA_CDN_PATTERN.search(url):
                return url

    return None


async def enrich_images(db: AsyncSession) -> dict[str, Any]:
    """Weekly batch: upgrade placeholder images across all active products."""
    stats: dict[str, Any] = {
        "scanned": 0,
        "upgraded_sephora": 0,
        "upgraded_amazon": 0,
        "still_placeholder": 0,
        "errors": 0,
    }

    # Get active products with placeholder images
    result = await db.execute(
        select(Product).where(
            Product.is_active == True,  # noqa: E712
        )
    )
    products = result.scalars().all()

    to_enrich = [p for p in products if is_placeholder(p.image_url)]
    stats["scanned"] = len(products)

    async with ResilientClient() as client:
        for product in to_enrich:
            upgraded = False

            # Strategy 1: Sephora source → hit detail API
            if product.source in ("sephora_scrape", "sephora_scraper") or product.sephora_product_id:
                try:
                    sephora_url = await _try_sephora_image(client, product)
                    if sephora_url:
                        product.image_url = sephora_url
                        stats["upgraded_sephora"] += 1
                        upgraded = True
                except Exception as exc:
                    logger.debug("Sephora image upgrade failed %s: %s", product.id, exc)
                    stats["errors"] += 1

            # Strategy 2: Amazon ASIN → construct high-res URL
            if not upgraded and product.amazon_asin:
                asin = product.amazon_asin
                candidate = f"https://images-na.ssl-images-amazon.com/images/I/{asin}._SL1500_.jpg"
                # We can't verify without fetching, just upgrade the pattern
                if product.image_url and _AMAZON_PATTERN.search(product.image_url):
                    upgraded_url = upgrade_amazon_image_url(product.image_url)
                    product.image_url = upgraded_url
                    stats["upgraded_amazon"] += 1
                    upgraded = True

            # Strategy 3: Existing price link may have an image via Sephora source_id
            if not upgraded:
                price_result = await db.execute(
                    select(ProductPrice).where(
                        ProductPrice.product_id == product.id,
                        ProductPrice.source == "sephora",
                    )
                )
                price_row = price_result.scalar_one_or_none()
                if price_row and product.sephora_product_id:
                    try:
                        sephora_url = await _try_sephora_image(client, product)
                        if sephora_url:
                            product.image_url = sephora_url
                            stats["upgraded_sephora"] += 1
                            upgraded = True
                    except Exception:
                        pass

            if not upgraded:
                stats["still_placeholder"] += 1

    await db.commit()
    return stats


async def run_image_enrichment() -> None:
    await run_job(
        job_name="image_enrich",
        source="image_enricher",
        job_fn=enrich_images,
    )
