import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.ingestion.open_beauty_facts import ingest_open_beauty_facts
from app.ingestion.amazon_paapi import ingest_amazon_prices
from app.ingestion.affiliate_feeds import ingest_affiliate_feeds
from app.ingestion.score_calculator import recalculate_scores

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def start_scheduler():
    # Daily: ingest product catalog from Open Beauty Facts
    scheduler.add_job(ingest_open_beauty_facts, "cron", hour=2, minute=0, id="obf_ingest")

    # Every 6 hours: fetch Amazon prices
    scheduler.add_job(ingest_amazon_prices, "interval", hours=6, id="amazon_prices")

    # Every 12 hours: parse affiliate feeds
    scheduler.add_job(ingest_affiliate_feeds, "interval", hours=12, id="affiliate_feeds")

    # Every 6 hours: recalculate StampScores
    scheduler.add_job(recalculate_scores, "interval", hours=6, id="recalc_scores")

    scheduler.start()
    logger.info("Ingestion scheduler started")


def stop_scheduler():
    scheduler.shutdown()
    logger.info("Ingestion scheduler stopped")
