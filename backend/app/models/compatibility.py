from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class CompatibilityResult(Base, TimestampMixin):
    """
    Cached result of the compatibility analysis graph for a product in a build.

    Keyed by build_fingerprint (SHA-256 of sorted product_id list).
    The API endpoint checks this table before invoking the LangGraph graph.
    """
    __tablename__ = "compatibility_results"
    __table_args__ = (
        Index("ix_compatibility_results_fingerprint", "build_fingerprint"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Plain string — no FK to builds.id so unauthenticated "local-build" IDs work
    build_id: Mapped[str | None] = mapped_column(
        String(100), index=True, nullable=True
    )
    product_id: Mapped[str] = mapped_column(
        ForeignKey("products.id"), index=True
    )
    is_compatible: Mapped[bool]
    reason: Mapped[str] = mapped_column(Text)
    reasons: Mapped[list[dict[str, str]]] = mapped_column(JSON, default=list)
    severity: Mapped[str] = mapped_column(String(10))   # 'warning' | 'error'
    source_agent: Mapped[str] = mapped_column(String(20))
    conflicting_product_ids: Mapped[list[str]] = mapped_column(JSON)
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    build_fingerprint: Mapped[str] = mapped_column(
        String(64),
        comment="SHA-256 of sorted product_ids; cache invalidation key",
    )

    # Read-only relationships (no back_populates to avoid modifying existing models)
    product: Mapped["Product"] = relationship(viewonly=True)  # noqa: F821


class ChemistKnownIngredient(Base, TimestampMixin):
    """
    Reference table of INCI ingredient names grouped by conflict category.

    Used by the chemist agent to identify which ingredients belong to each
    chemical family (silicone, AHA, BHA, retinoid, oxidizer, vitamin_c,
    copper_peptide, niacinamide) when evaluating product compatibility.
    Sourced from INCIDecoder, EU CosIng, and CosDNA.
    """
    __tablename__ = "chemist_known_ingredients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    inci_name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    conflict_category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
