"""Ingestion microservice entry point.

Starts the APScheduler with all 8 ingestion jobs and keeps the process alive.
Run: python -m ingestion.main
"""

import asyncio
import logging
import signal
import sys

from ingestion.config import settings
from ingestion.pipeline.jobs import build_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


async def main() -> None:
    scheduler = build_scheduler()
    scheduler.start()
    logger.info(
        "Ingestion scheduler started — %d jobs registered",
        len(scheduler.get_jobs()),
    )

    stop_event = asyncio.Event()

    def _handle_signal(*_):
        logger.info("Shutdown signal received")
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, _handle_signal)

    await stop_event.wait()

    scheduler.shutdown(wait=False)
    logger.info("Ingestion scheduler stopped")


if __name__ == "__main__":
    asyncio.run(main())
