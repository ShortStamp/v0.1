import logging

from app.database import async_session
from app.models.ingestion import IngestionRun

logger = logging.getLogger(__name__)


async def ingest_affiliate_feeds():
    """Parse affiliate product feeds from Sephora (Rakuten) and Ulta (Impact).

    These feeds are CSV/XML files provided after joining each affiliate program.
    Feed URLs would be configured via environment variables.
    """
    async with async_session() as db:
        run = IngestionRun(source="affiliate_feeds")
        db.add(run)
        await db.flush()

        prices_updated = 0

        try:
            # TODO: Implement Sephora feed parsing via Rakuten
            # feed_url = settings.sephora_feed_url
            # async with httpx.AsyncClient() as client:
            #     resp = await client.get(feed_url)
            #     for row in parse_csv(resp.text):
            #         match_and_update_price(db, row)

            # TODO: Implement Ulta feed parsing via Impact
            # feed_url = settings.ulta_feed_url

            run.status = "completed"
            run.prices_updated = prices_updated
            logger.info("Affiliate feed ingestion: no feeds configured yet")

        except Exception as e:
            run.status = "failed"
            run.error_message = str(e)
            logger.error(f"Affiliate feed ingestion failed: {e}")

        await db.commit()
