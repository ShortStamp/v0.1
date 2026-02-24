"""Scheduled job: recalculate StampScore for all active products.

Delegates to the backend's recalculate_all_scores service via shared sys.path.
"""

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ingestion.pipeline.runner import run_job

logger = logging.getLogger(__name__)


async def _recalculate(db: AsyncSession) -> dict[str, Any]:
    try:
        from app.services.stamp_score import recalculate_all_scores
    except ImportError:
        logger.error("Cannot import stamp_score service — is /backend on PYTHONPATH?")
        return {"error": "stamp_score not available"}

    updated, stats = await recalculate_all_scores(db)
    logger.info("Recalculated scores: %d changed", updated)
    return stats


async def run_score_recalc() -> None:
    await run_job(
        job_name="score_recalc",
        source="stamp_score",
        job_fn=_recalculate,
    )
