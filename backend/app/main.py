import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    _maybe_start_scheduler()
    yield
    # --- Shutdown ---
    _stop_scheduler()


def _maybe_start_scheduler() -> None:
    """Start the ingestion scheduler if ENABLE_SCHEDULER=true.

    IMPORTANT — SINGLE-PROCESS GUARD
    The scheduler MUST run in exactly one process.  When running with multiple
    workers (e.g. uvicorn --workers 4, or gunicorn), each worker forks its own
    process and this lifespan runs in each one.  To prevent duplicate schedulers:

    1. Set ENABLE_SCHEDULER=true only on a single dedicated worker, OR
    2. When WEB_CONCURRENCY > 1, the scheduler is NOT started unless
       SINGLE_SCHEDULER_PROCESS=true is explicitly set.

    The DB-level job locks (ingestion_locks table) provide a second safety net:
    even if two schedulers fire the same job simultaneously, only one acquires
    the lock and runs; the other records a SKIPPED run.
    """
    if not settings.enable_scheduler:
        logger.info("Scheduler disabled (ENABLE_SCHEDULER != true)")
        return

    web_concurrency = int(os.environ.get("WEB_CONCURRENCY", "1"))
    single_ok = os.environ.get("SINGLE_SCHEDULER_PROCESS", "").lower() == "true"

    if web_concurrency > 1 and not single_ok:
        logger.warning(
            "WEB_CONCURRENCY=%d but SINGLE_SCHEDULER_PROCESS is not 'true'. "
            "Scheduler will NOT start to avoid duplicate jobs. "
            "Set SINGLE_SCHEDULER_PROCESS=true on exactly one worker, "
            "or run the scheduler in a separate process.",
            web_concurrency,
        )
        return

    from app.ingestion.scheduler import start_scheduler

    start_scheduler()


def _stop_scheduler() -> None:
    """Gracefully stop the scheduler if it was started."""
    try:
        from app.ingestion.scheduler import stop_scheduler

        stop_scheduler()
    except Exception:
        pass


app = FastAPI(
    title="ShortStamp Makeup API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
