import logging

from app.database import async_session
from app.services.stamp_score import recalculate_all_scores

logger = logging.getLogger(__name__)


async def recalculate_scores():
    """Recalculate StampScores for all active products."""
    async with async_session() as db:
        count = await recalculate_all_scores(db)
        logger.info(f"Recalculated {count} product scores")
