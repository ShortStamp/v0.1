"""
LangGraph orchestrator for the compatibility analysis pipeline.

Phase 3 graph — Chemist + Artist + Trend Agents in parallel:
  START → fetch_data → [chemist, artist, trend] → aggregate → END
"""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from langgraph.graph import END, START, StateGraph

from app.agents.artist_agent import run_artist_analysis
from app.agents.chemist_agent import run_chemist_analysis
from app.agents.trend_agent import run_trend_analysis
from app.database import async_session
from app.schemas.compatibility import (
    AgentState,
    BeautyProfileSnapshot,
    OrchestratorInput,
    OrchestratorOutput,
    ProductSnapshot,
    TrendSnapshot,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

async def fetch_data_node(state: AgentState) -> dict:
    """
    Load ProductSnapshot list, BeautyProfileSnapshot, and active TrendSnapshots from the DB.
    Agents must not hit the DB directly — this node provides all data they need.
    """
    from app.models.product import Product, ProductFilterValue  # noqa: F401
    from app.models.trend import Trend, TrendProduct
    from app.models.user import BeautyProfile

    products: list[ProductSnapshot] = []
    beauty_profile: BeautyProfileSnapshot | None = None
    active_trends: list[TrendSnapshot] = []

    async with async_session() as db:
        # Load products with filter values (selectin avoids N+1)
        result = await db.execute(
            select(Product)
            .where(Product.id.in_(state.product_ids))
            .options(selectinload(Product.filter_values))
            .options(selectinload(Product.brand))
        )
        product_rows = result.scalars().all()

        for p in product_rows:
            filters: dict[str, str | bool | float] = {
                fv.filter_key: fv.value for fv in p.filter_values
            }
            products.append(
                ProductSnapshot(
                    id=p.id,
                    name=p.name,
                    brand=p.brand.name if p.brand else "",
                    category=p.category_key,
                    inci_ingredients=p.inci_ingredients or [],
                    specs=p.specs or [],
                    filters=filters,
                )
            )

        # Load beauty profile for the user (Artist Agent input).
        # If an inline profile was passed in the request, use it directly
        # so guest / unauthenticated users still get Artist Agent analysis.
        if state.beauty_profile is not None:
            beauty_profile = state.beauty_profile
        else:
            bp_result = await db.execute(
                select(BeautyProfile).where(BeautyProfile.user_id == state.user_id)
            )
            bp = bp_result.scalar_one_or_none()
            if bp:
                beauty_profile = BeautyProfileSnapshot(
                    skin_tone=getattr(bp, "skin_tone", None),
                    undertone=getattr(bp, "undertone", None),
                    skin_type=getattr(bp, "skin_type", None),
                    coverage=getattr(bp, "coverage", None),
                    finish=getattr(bp, "finish", None),
                    budget=getattr(bp, "budget", None),
                )

        # Load all active trends with their associated product IDs (Trend Agent input)
        trend_result = await db.execute(
            select(Trend)
            .where(Trend.is_active == True)  # noqa: E712
            .options(selectinload(Trend.products))
        )
        trend_rows = trend_result.scalars().all()

        # Only include trends that have at least one product in the current build
        product_id_set = set(state.product_ids)
        for t in trend_rows:
            associated = [tp.product_id for tp in t.products]
            # Include trend if any of its products are in the build
            if any(pid in product_id_set for pid in associated):
                active_trends.append(
                    TrendSnapshot(
                        id=t.id,
                        name=t.name,
                        description=t.description or "",
                        direction=t.direction,  # type: ignore[arg-type]
                        associated_product_ids=associated,
                    )
                )

    return {"products": products, "beauty_profile": beauty_profile, "active_trends": active_trends}


async def chemist_node(state: AgentState) -> dict:
    """Run INCI formulation conflict analysis."""
    try:
        output = await run_chemist_analysis(state.products, state.beauty_profile)
        errors = list(state.errors)
        if output.quota_exceeded:
            errors.append("quota_exceeded")
        return {
            "chemist_results": output.results,
            "application_order": output.application_order,
            "errors": errors,
        }
    except Exception as exc:
        logger.error("Chemist agent failed: %s", exc)
        return {"errors": [*state.errors, f"chemist: {exc}"]}


async def artist_node(state: AgentState) -> dict:
    """Run aesthetic harmony analysis against the user's beauty profile."""
    try:
        output = await run_artist_analysis(state.products, state.beauty_profile)
        errors = list(state.errors)
        if output.quota_exceeded:
            errors.append("quota_exceeded")
        return {"artist_results": output.results, "errors": errors}
    except Exception as exc:
        logger.error("Artist agent failed: %s", exc)
        return {"errors": [*state.errors, f"artist: {exc}"]}


async def trend_node(state: AgentState) -> dict:
    """Run trend relevance analysis against active declining trends."""
    try:
        output = await run_trend_analysis(state.products, state.active_trends)
        errors = list(state.errors)
        if output.quota_exceeded:
            errors.append("quota_exceeded")
        return {"trend_results": output.results, "errors": errors}
    except Exception as exc:
        logger.error("Trend agent failed: %s", exc)
        return {"errors": [*state.errors, f"trend: {exc}"]}


async def aggregate_node(state: AgentState) -> dict:
    """
    Merge all agent results, compute overall score, persist cache rows, and
    build the final OrchestratorOutput.
    """
    from app.models.compatibility import CompatibilityResult

    # Merge results from all agents (trend is empty dict in Phase 2)
    compatibility_map: dict = {}
    compatibility_map.update(state.chemist_results)
    # Artist results fill in products not already flagged by chemist;
    # if both agents flag the same product, chemist (formulation conflict) wins.
    for pid, resp in state.artist_results.items():
        if pid not in compatibility_map:
            compatibility_map[pid] = resp
        else:
            # Escalate to error if artist found a harder conflict on a warned product
            existing = compatibility_map[pid]
            if resp.severity == "error" and existing.severity == "warning":
                compatibility_map[pid] = resp
    compatibility_map.update(state.trend_results)

    # Compute overall score
    # Each error deducts 0.30, each warning deducts 0.10; floor at 0.0
    num_errors = sum(1 for r in compatibility_map.values() if r.severity == "error")
    num_warnings = sum(1 for r in compatibility_map.values() if r.severity == "warning")
    score = max(0.0, 1.0 - (num_errors * 0.30 + num_warnings * 0.10))

    now = datetime.now(timezone.utc)

    output = OrchestratorOutput(
        build_id=state.build_id,
        compatibility_map=compatibility_map,
        application_order=state.application_order,
        evaluated_at=now,
        overall_compatibility_score=round(score, 4),
        errors=list(dict.fromkeys(state.errors)),  # deduplicate while preserving order
    )

    # Compute fingerprint for cache keying
    fingerprint = hashlib.sha256(
        ",".join(sorted(state.product_ids)).encode()
    ).hexdigest()

    # Persist each conflict verdict as a CompatibilityResult cache row
    async with async_session() as db:
        for product_id, compat in compatibility_map.items():
            row = CompatibilityResult(
                build_id=state.build_id,
                product_id=product_id,
                is_compatible=compat.is_compatible,
                reason=compat.reason,
                severity=compat.severity,
                source_agent=compat.source_agent,
                conflicting_product_ids=compat.conflicting_product_ids,
                evaluated_at=now,
                build_fingerprint=fingerprint,
            )
            db.add(row)
        await db.commit()

    return {"final_output": output}


# ---------------------------------------------------------------------------
# Graph definition — compiled once at module load, reused across requests
# ---------------------------------------------------------------------------

_builder = StateGraph(AgentState)

_builder.add_node("fetch_data", fetch_data_node)
_builder.add_node("chemist", chemist_node)
_builder.add_node("artist", artist_node)
_builder.add_node("trend", trend_node)
_builder.add_node("aggregate", aggregate_node)

# Phase 3 parallel graph:
#   START → fetch_data → [chemist, artist, trend] → aggregate → END
_builder.add_edge(START, "fetch_data")
_builder.add_edge("fetch_data", "chemist")
_builder.add_edge("fetch_data", "artist")
_builder.add_edge("fetch_data", "trend")
_builder.add_edge("chemist", "aggregate")
_builder.add_edge("artist", "aggregate")
_builder.add_edge("trend", "aggregate")
_builder.add_edge("aggregate", END)

compatibility_graph = _builder.compile()
