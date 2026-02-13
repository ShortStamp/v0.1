import logging

from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models.ingestion import IngestionRun
from app.models.product import Product, ProductPrice, Retailer

logger = logging.getLogger(__name__)


async def ingest_amazon_prices():
    """Fetch current prices from Amazon PA-API 5.0 for products with ASINs.

    Requires AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY, and AMAZON_PARTNER_TAG
    to be configured. Skips if not configured.
    """
    if not settings.amazon_access_key:
        logger.info("Amazon PA-API not configured, skipping")
        return

    async with async_session() as db:
        run = IngestionRun(source="amazon_paapi")
        db.add(run)
        await db.flush()

        prices_updated = 0

        try:
            # Get Amazon retailer
            result = await db.execute(
                select(Retailer).where(Retailer.slug == "amazon")
            )
            retailer = result.scalar_one_or_none()
            if not retailer:
                retailer = Retailer(name="Amazon", slug="amazon", base_url="https://amazon.com")
                db.add(retailer)
                await db.flush()

            # Get all products with ASINs
            result = await db.execute(
                select(Product).where(Product.amazon_asin.isnot(None))
            )
            products = result.scalars().all()

            # Process in batches of 10 (PA-API limit)
            for i in range(0, len(products), 10):
                batch = products[i : i + 10]
                asins = [p.amazon_asin for p in batch]

                # PA-API 5.0 GetItems request would go here
                # For now, log the intent
                logger.info(f"Would fetch prices for ASINs: {asins}")

                # TODO: Implement actual PA-API request using HMAC-signed requests
                # See: https://webservices.amazon.com/paapi5/documentation/
                # response = await _get_items(asins)
                # for item in response:
                #     _update_price(db, retailer, item)
                #     prices_updated += 1

            run.status = "completed"
            run.prices_updated = prices_updated

        except Exception as e:
            run.status = "failed"
            run.error_message = str(e)
            logger.error(f"Amazon PA-API ingestion failed: {e}")

        await db.commit()
        logger.info(f"Amazon ingestion: {prices_updated} prices updated")
