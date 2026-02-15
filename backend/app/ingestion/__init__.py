"""Ingestion pipeline core: job runner with DB-based locking, timing, and run recording.

Every ingestion job should be executed through `run_job()` which provides:
- Mutual exclusion via the `ingestion_locks` table (no duplicate schedulers)
- Automatic IngestionRun creation with STARTED / SUCCESS / FAILED / SKIPPED status
- Duration tracking
- Truncated error stack capture
- Structured logging with run_id and job_name
"""

import logging
import os
import socket
import traceback
from datetime import UTC, datetime, timedelta
from typing import Any, Callable, Coroutine

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.ingestion import IngestionLock, IngestionRun

# Import all models so SQLAlchemy can resolve ForeignKey references (e.g. products.category_key -> categories.key)
import app.models.category  # noqa: F401
import app.models.product  # noqa: F401
import app.models.user  # noqa: F401
import app.models.build  # noqa: F401
import app.models.trend  # noqa: F401

logger = logging.getLogger(__name__)

LOCK_TIMEOUT = timedelta(hours=2)
LOCK_OWNER = f"{socket.gethostname()}:{os.getpid()}"

# Type alias for job functions: async (db) -> stats dict
JobFn = Callable[[AsyncSession], Coroutine[Any, Any, dict[str, Any]]]


async def _try_acquire_lock(db: AsyncSession, job_name: str) -> bool:
    """Try to acquire a job lock using INSERT ... ON CONFLICT DO NOTHING.

    Automatically cleans up stale locks older than LOCK_TIMEOUT first.
    Returns True if the lock was acquired.
    """
    now = datetime.now(UTC)
    cutoff = now - LOCK_TIMEOUT

    # Clean up stale locks (e.g. from a crashed process)
    await db.execute(
        text(
            "DELETE FROM ingestion_locks "
            "WHERE job_name = :name AND locked_at < :cutoff"
        ),
        {"name": job_name, "cutoff": cutoff},
    )

    # Atomic insert-or-skip
    result = await db.execute(
        text(
            "INSERT INTO ingestion_locks (job_name, locked_at, locked_by) "
            "VALUES (:name, :now, :owner) "
            "ON CONFLICT (job_name) DO NOTHING"
        ),
        {"name": job_name, "now": now, "owner": LOCK_OWNER},
    )
    await db.commit()
    return result.rowcount == 1


async def _release_lock(db: AsyncSession, job_name: str) -> None:
    """Release a job lock."""
    await db.execute(
        delete(IngestionLock).where(IngestionLock.job_name == job_name)
    )
    await db.commit()


async def run_job(
    job_name: str,
    source: str,
    job_fn: JobFn,
    parameters: dict | None = None,
) -> IngestionRun:
    """Execute an ingestion job with locking, timing, and error recording.

    Args:
        job_name: Unique job identifier (e.g. "obf_ingest").
        source: Data source name for the run record (e.g. "open_beauty_facts").
        job_fn: Async callable(db: AsyncSession) -> dict of stats.
                The function receives a committed-ready session and must call
                db.commit() for its own work.  Stats dict is stored in the run.
        parameters: Optional dict of job parameters to record.

    Returns:
        The IngestionRun record (detached from session).
    """
    # --- Lock acquisition ---
    async with async_session() as lock_db:
        acquired = await _try_acquire_lock(lock_db, job_name)

    if not acquired:
        logger.info("[%s] Skipped: lock busy", job_name)
        async with async_session() as db:
            run = IngestionRun(
                job_name=job_name,
                source=source,
                status="SKIPPED",
                started_at=datetime.now(UTC),
                finished_at=datetime.now(UTC),
                duration_ms=0,
                error_message="lock busy",
                stats={},
                parameters=parameters or {},
            )
            db.add(run)
            await db.commit()
            return run

    # --- Record STARTED ---
    started = datetime.now(UTC)
    status = "FAILED"
    stats: dict[str, Any] = {}
    error_msg: str | None = None
    error_stack_str: str | None = None
    run_id: str | None = None

    try:
        async with async_session() as db:
            run = IngestionRun(
                job_name=job_name,
                source=source,
                status="STARTED",
                started_at=started,
                stats={},
                parameters=parameters or {},
            )
            db.add(run)
            await db.commit()
            run_id = run.id

        logger.info("[%s] run_id=%s STARTED", job_name, run_id)

        # --- Execute job ---
        async with async_session() as work_db:
            stats = await job_fn(work_db)

        status = "SUCCESS"
        logger.info("[%s] run_id=%s SUCCESS stats=%s", job_name, run_id, stats)

    except Exception as exc:
        logger.exception("[%s] run_id=%s FAILED", job_name, run_id)
        error_msg = str(exc)[:2000]
        error_stack_str = traceback.format_exc()[:4000]

    finally:
        finished = datetime.now(UTC)
        duration = int((finished - started).total_seconds() * 1000)

        # Update the run record
        async with async_session() as db:
            if run_id:
                result = await db.execute(
                    select(IngestionRun).where(IngestionRun.id == run_id)
                )
                run = result.scalar_one()
                run.status = status
                run.finished_at = finished
                run.duration_ms = duration
                run.stats = stats or {}
                run.error_message = error_msg
                run.error_stack = error_stack_str
            else:
                # STARTED record creation itself failed
                run = IngestionRun(
                    job_name=job_name,
                    source=source,
                    status=status,
                    started_at=started,
                    finished_at=finished,
                    duration_ms=duration,
                    stats=stats or {},
                    error_message=error_msg,
                    error_stack=error_stack_str,
                    parameters=parameters or {},
                )
                db.add(run)
            await db.commit()

        # Release lock
        async with async_session() as db:
            await _release_lock(db, job_name)

    return run
