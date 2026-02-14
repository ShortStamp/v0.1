"""Ingestion pipeline models: run tracking, score history, and job locking."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class IngestionRun(Base):
    """Tracks every ingestion job execution."""

    __tablename__ = "ingestion_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_uuid)
    job_name: Mapped[str] = mapped_column(String(100), index=True)
    source: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="STARTED")
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stats: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_stack: Mapped[str | None] = mapped_column(Text, nullable=True)
    parameters: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    attempt: Mapped[int] = mapped_column(Integer, default=1)


class StampScoreHistory(Base):
    """Audit trail of StampScore changes."""

    __tablename__ = "stamp_score_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_uuid)
    product_id: Mapped[str] = mapped_column(String(36), index=True)
    old_score: Mapped[int] = mapped_column(Integer)
    new_score: Mapped[int] = mapped_column(Integer)
    score_version: Mapped[str] = mapped_column(String(20), default="v0")
    components: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    weights: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class IngestionLock(Base):
    """Simple lock table to prevent overlapping runs of the same job."""

    __tablename__ = "ingestion_locks"

    job_name: Mapped[str] = mapped_column(String(100), primary_key=True)
    locked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    locked_by: Mapped[str] = mapped_column(String(200))
