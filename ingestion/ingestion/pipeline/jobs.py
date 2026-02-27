"""All scheduled ingestion job definitions.

Schedule (UTC):
    sephora_discover  — daily 02:00     Sephora search, all 18 categories
    sephora_detail    — daily 03:30     Fetch detail for new/ingredient-missing products
    obf_ingest        — daily 05:00     OBF catalog (ingredients only, no images)
    price_refresh     — every 4 hours   Refresh stale prices, update is_active
    filter_extract    — every 6 hours   Extract filter values for products missing them
    image_enrich      — weekly Sun 01:00 Placeholder image upgrade batch
    score_recalc      — every 6 hours   Recalculate StampScore
    walmart_prices    — every 6 hours   Walmart affiliate price enrichment
    ingredient_agent  — weekly Sun 06:00 Gemini Search ingredient backfill (all sources)
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)


def build_scheduler() -> AsyncIOScheduler:
    """Build and return configured APScheduler instance (not yet started)."""
    from ingestion.sources.sephora import run_sephora_discover, run_sephora_detail
    from ingestion.sources.open_beauty_facts import run_ingestion as run_obf
    from ingestion.sources.walmart import run_ingestion as run_walmart
    from ingestion.sources.ingredient_agent import run_ingredient_agent
    from ingestion.enrichers.prices import run_price_refresh
    from ingestion.enrichers.images import run_image_enrichment
    from ingestion.pipeline.filter_job import run_filter_extraction
    from ingestion.pipeline.score_job import run_score_recalc

    scheduler = AsyncIOScheduler(timezone="UTC")

    scheduler.add_job(
        run_sephora_discover,
        "cron",
        hour=2, minute=0,
        id="sephora_discover",
        name="Sephora product discovery (Constructor.io)",
        replace_existing=True,
    )

    scheduler.add_job(
        run_sephora_detail,
        "cron",
        hour=3, minute=30,
        id="sephora_detail",
        name="Sephora detail enrichment (ingredients + images)",
        replace_existing=True,
    )

    scheduler.add_job(
        run_obf,
        "cron",
        hour=5, minute=0,
        id="obf_ingest",
        name="Open Beauty Facts catalog (ingredients only)",
        replace_existing=True,
    )

    scheduler.add_job(
        run_price_refresh,
        "interval",
        hours=4,
        id="price_refresh",
        name="Price staleness refresh + is_active update",
        replace_existing=True,
    )

    scheduler.add_job(
        run_filter_extraction,
        "interval",
        hours=6,
        id="filter_extract",
        name="Filter value extraction for products missing them",
        replace_existing=True,
    )

    scheduler.add_job(
        run_image_enrichment,
        "cron",
        day_of_week="sun",
        hour=1, minute=0,
        id="image_enrich",
        name="Placeholder image upgrade batch (weekly)",
        replace_existing=True,
    )

    scheduler.add_job(
        run_score_recalc,
        "interval",
        hours=6,
        id="score_recalc",
        name="StampScore recalculation",
        replace_existing=True,
    )

    scheduler.add_job(
        run_walmart,
        "interval",
        hours=6,
        id="walmart_prices",
        name="Walmart affiliate price enrichment",
        replace_existing=True,
    )

    scheduler.add_job(
        run_ingredient_agent,
        "cron",
        day_of_week="sun",
        hour=6, minute=0,
        id="ingredient_agent",
        name="Gemini Search ingredient backfill (all sources)",
        replace_existing=True,
    )

    logger.info("Scheduler configured with %d jobs", len(scheduler.get_jobs()))
    return scheduler
