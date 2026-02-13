from datetime import datetime

from sqlalchemy import DateTime, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class IngestionRun(Base):
    __tablename__ = "ingestion_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="running")
    products_added: Mapped[int] = mapped_column(Integer, default=0)
    products_updated: Mapped[int] = mapped_column(Integer, default=0)
    prices_updated: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class StampScoreHistory(Base):
    __tablename__ = "stamp_score_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[str] = mapped_column(String(36), index=True)
    old_score: Mapped[int] = mapped_column(Integer)
    new_score: Mapped[int] = mapped_column(Integer)
    components: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
