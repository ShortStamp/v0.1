from __future__ import annotations

import operator
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Core output type — returned to the frontend
# ---------------------------------------------------------------------------

class CompatibilityResponse(BaseModel):
    """
    The canonical compatibility verdict for a single product within a build.
    Returned by any agent and aggregated by the Orchestrator.
    """
    is_compatible: bool
    reason: str = Field(
        ...,
        description="Human-readable explanation shown to the user",
        max_length=300,
    )
    severity: Literal["warning", "error"] = Field(
        ...,
        description=(
            "'error' = strong formulation conflict (e.g. silicone over water-based). "
            "'warning' = soft mismatch (e.g. dewy finish over oily skin)."
        ),
    )
    source_agent: Literal["chemist", "artist", "trend", "orchestrator"]
    conflicting_product_ids: list[str] = Field(
        default_factory=list,
        description="Other product IDs in the build that caused this conflict",
    )


# ---------------------------------------------------------------------------
# Orchestrator — top-level I/O
# ---------------------------------------------------------------------------

class OrchestratorInput(BaseModel):
    """Passed to the LangGraph entry node."""
    build_id: str
    user_id: str
    # Full list of product IDs currently in the build (including the new one)
    product_ids: list[str]
    # The product that was just added (triggers re-evaluation of this product only)
    trigger_product_id: str | None = None
    # Optional inline beauty profile — when provided, skips the DB lookup so
    # unauthenticated / guest users still get Artist Agent analysis.
    beauty_profile: BeautyProfileSnapshot | None = None


class OrchestratorOutput(BaseModel):
    """Emitted by the LangGraph terminal node."""
    build_id: str
    # Keyed by product_id. Only products with issues are included.
    compatibility_map: dict[str, CompatibilityResponse]
    evaluated_at: datetime
    overall_compatibility_score: float = Field(
        ge=0.0, le=1.0,
        description="1.0 = fully compatible, 0.0 = severe conflicts",
    )
    # Agent-level error tags — e.g. "quota_exceeded" when Gemini returns 429
    errors: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Data snapshots — lightweight read models passed into agents
# (agents must not hit the DB directly; data-fetch node provides these)
# ---------------------------------------------------------------------------

class ProductSnapshot(BaseModel):
    """Minimal product data needed by all three agents."""
    id: str
    name: str
    brand: str
    category: str
    inci_ingredients: list[str] = Field(
        default_factory=list,
        description="INCI ingredient list from Open Beauty Facts",
    )
    specs: list[str] = Field(default_factory=list)
    filters: dict[str, str | bool | float] = Field(default_factory=dict)


class BeautyProfileSnapshot(BaseModel):
    """User's quiz-derived profile, passed to Artist Agent."""
    skin_tone: str | None = None
    undertone: str | None = None
    skin_type: str | None = None    # oily | dry | combination | normal
    coverage: str | None = None     # light | medium | full
    finish: str | None = None       # matte | dewy | natural | satin
    budget: str | None = None


class TrendSnapshot(BaseModel):
    """A current trend with catalog-mapped products, passed to Trend Agent."""
    id: str
    name: str
    description: str
    direction: Literal["rising", "stable", "declining"]
    associated_product_ids: list[str]


# ---------------------------------------------------------------------------
# LangGraph shared state (passed between nodes)
# ---------------------------------------------------------------------------

class AgentState(BaseModel):
    """
    The shared mutable state object flowing through the LangGraph pipeline.
    Each agent node reads what it needs and writes its results back.
    """
    # Input
    build_id: str
    user_id: str
    product_ids: list[str]
    trigger_product_id: str | None = None

    # Populated by the data-fetch node before agents run
    products: list[ProductSnapshot] = Field(default_factory=list)
    beauty_profile: BeautyProfileSnapshot | None = None
    active_trends: list[TrendSnapshot] = Field(default_factory=list)

    # Agent outputs (written by each agent node, read by orchestrator aggregator)
    chemist_results: dict[str, CompatibilityResponse] = Field(default_factory=dict)
    artist_results: dict[str, CompatibilityResponse] = Field(default_factory=dict)
    trend_results: dict[str, CompatibilityResponse] = Field(default_factory=dict)

    # Final merged output — set by aggregate_node, read by API endpoint
    final_output: OrchestratorOutput | None = None

    # Error tracking — Annotated with operator.add so parallel nodes can each append
    # without triggering LangGraph's INVALID_CONCURRENT_GRAPH_UPDATE error.
    errors: Annotated[list[str], operator.add] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Chemist Agent I/O
# ---------------------------------------------------------------------------

class ChemistInput(BaseModel):
    """
    Subset of AgentState passed to the Chemist Agent tool call.
    The agent receives only what it needs for ingredient analysis.
    """
    products: list[ProductSnapshot]
    known_conflict_pairs: list[tuple[str, str]] = Field(
        default_factory=list,
        description="Pre-loaded rule pairs from the vector store (e.g. 'retinol','aha')",
    )


class ChemistOutput(BaseModel):
    """Per-product conflict verdicts from the Chemist Agent."""
    results: dict[str, CompatibilityResponse]
    rag_queries_used: list[str] = Field(
        default_factory=list,
        description="Vector store queries fired during analysis (for observability)",
    )
    quota_exceeded: bool = Field(
        default=False,
        description="True when the LLM call failed with a 429 quota/rate-limit error",
    )


# ---------------------------------------------------------------------------
# Artist Agent I/O (stubs — implemented in Phase 4)
# ---------------------------------------------------------------------------

class ArtistInput(BaseModel):
    products: list[ProductSnapshot]
    beauty_profile: BeautyProfileSnapshot


class ArtistOutput(BaseModel):
    results: dict[str, CompatibilityResponse]
    quota_exceeded: bool = Field(
        default=False,
        description="True when the LLM call failed with a 429 quota/rate-limit error",
    )


# ---------------------------------------------------------------------------
# Trend Agent I/O (stubs — implemented in Phase 4)
# ---------------------------------------------------------------------------

class TrendInput(BaseModel):
    products: list[ProductSnapshot]
    active_trends: list[TrendSnapshot]
    trend_window_days: int = 30


class TrendOutput(BaseModel):
    results: dict[str, CompatibilityResponse]
    trending_product_ids: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# SSE event payloads (sent over the wire to the frontend)
# ---------------------------------------------------------------------------

class CompatibilitySSEEvent(BaseModel):
    """Streamed to the client via SSE as agent results arrive."""
    event: Literal["partial", "complete", "error"]
    build_id: str
    # For 'partial': a single product's result
    product_id: str | None = None
    compatibility: CompatibilityResponse | None = None
    # For 'complete': the full orchestrator output
    summary: OrchestratorOutput | None = None
    error_message: str | None = None


# ---------------------------------------------------------------------------
# DB-cached result (stored in compatibility_results table)
# ---------------------------------------------------------------------------

class CompatibilityResultSchema(BaseModel):
    id: int
    build_id: str
    product_id: str
    is_compatible: bool
    reason: str
    severity: Literal["warning", "error"]
    source_agent: str
    conflicting_product_ids: list[str]
    evaluated_at: datetime
    build_fingerprint: str = Field(
        ...,
        description="SHA-256 hash of sorted product_ids; used to detect stale cache",
    )
