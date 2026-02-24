"""Job runner with DB-based mutual exclusion, run recording, and timing.

Ported from backend/app/ingestion/__init__.py. Works identically but imports
from the ingestion microservice's database module instead of the backend's.
"""

import logging
import os
import socket
import traceback
from datetime import UTC, datetime, timedelta
from typing import Any, Callable, Coroutine

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ingestion.database import async_session
from ingestion.models import IngestionLock, IngestionRun

logger = logging.getLogger(__name__)

LOCK_TIMEOUT = timedelta(hours=2)
LOCK_OWNER = f"{socket.gethostname()}:{os.getpid()}"

JobFn = Callable[[AsyncSession], Coroutine[Any, Any, dict[str, Any]]]


async def _try_acquire_lock(db: AsyncSession, job_name: str) -> bool:
    now = datetime.now(UTC)
    cutoff = now - LOCK_TIMEOUT

    # Clean up stale locks from crashed processes
    await db.execute(
        text(
            "DELETE FROM ingestion_locks "
            "WHERE job_name = :name AND locked_at < :cutoff"
        ),
        {"name": job_name, "cutoff": cutoff},
    )

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
    """Execute an ingestion job with locking, timing, and error recording."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
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

        async with async_session() as db:
            await _release_lock(db, job_name)

    return run
