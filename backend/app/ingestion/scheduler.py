"""APScheduler configuration for the ingestion pipeline.

Schedule (all times UTC):
    - Open Beauty Facts catalog:  daily at 02:00
    - Walmart price enrichment:   every 6 hours
    - StampScore recalculation:   every 6 hours

SAFETY: The scheduler must run in exactly ONE process.  Guard activation
behind ENABLE_SCHEDULER=true and ensure only a single worker starts it
(see app/main.py lifespan).  Each job also acquires a DB lock before
executing, so even if two schedulers somehow start, only one will run.
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)

# Module-level singleton
_scheduler: AsyncIOScheduler | None = None


def _make_scheduler() -> AsyncIOScheduler:
    """Create and configure the scheduler with all ingestion jobs."""
    from app.ingestion.open_beauty_facts import run_ingestion as run_obf
    from app.ingestion.score_calculator import run_ingestion as run_scores
    from app.ingestion.walmart_affiliate import run_ingestion as run_walmart

    scheduler = AsyncIOScheduler(timezone="UTC")

    scheduler.add_job(
        run_obf,
        "cron",
        hour=2,
        minute=0,
        id="obf_ingest",
        name="Open Beauty Facts catalog ingestion",
        replace_existing=True,
    )

    scheduler.add_job(
        run_walmart,
        "interval",
        hours=6,
        id="walmart_prices",
        name="Walmart price enrichment",
        replace_existing=True,
    )

    scheduler.add_job(
        run_scores,
        "interval",
        hours=6,
        id="score_recalc",
        name="StampScore recalculation",
        replace_existing=True,
    )

    return scheduler


def start_scheduler() -> None:
    """Start the ingestion scheduler.

    Must be called at most once per process. Safe to call multiple times —
    subsequent calls are no-ops.
    """
    global _scheduler

    if _scheduler is not None and _scheduler.running:
        logger.warning("Scheduler already running — ignoring duplicate start")
        return

    _scheduler = _make_scheduler()
    _scheduler.start()
    logger.info("Ingestion scheduler started (3 jobs registered, timezone=UTC)")


def stop_scheduler() -> None:
    """Gracefully shut down the scheduler."""
    global _scheduler

    if _scheduler is None:
        return

    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Ingestion scheduler stopped")

    _scheduler = None
