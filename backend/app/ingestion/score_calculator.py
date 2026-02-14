"""StampScore recalculation job.

Iterates all active products and recomputes their StampScore using the
weighted component formula in app.services.stamp_score.

Run manually:
    python -m app.ingestion.score_calculator
"""

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.ingestion import run_job
from app.services.stamp_score import recalculate_all_scores

logger = logging.getLogger(__name__)


async def recalculate_scores(db: AsyncSession) -> dict[str, Any]:
    """Core recalculation logic. Called by run_job() with a live session."""
    updated, stats = await recalculate_all_scores(db)
    logger.info("Recalculated scores: %d changed out of %d", updated, stats.get("total_products", 0))
    return stats


# ---------------------------------------------------------------------------
# Entrypoints
# ---------------------------------------------------------------------------

async def run_ingestion() -> None:
    """Wrapper that runs the job through the standard run_job infrastructure."""
    await run_job(
        job_name="score_recalc",
        source="stamp_score",
        job_fn=recalculate_scores,
    )


if __name__ == "__main__":
    import asyncio

    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_ingestion())
