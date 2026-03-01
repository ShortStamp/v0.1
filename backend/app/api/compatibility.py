"""
Compatibility analysis endpoint.

POST /api/v1/compatibility/analyze
  - Accepts OrchestratorInput (build_id, user_id, product_ids).
  - Returns OrchestratorOutput (compatibility_map, overall_score, evaluated_at).
  - Checks the DB cache (build_fingerprint) before running the LangGraph graph.
  - Auth is optional — accepts unauthenticated calls for easier testing.
"""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.orchestrator import compatibility_graph
from app.database import get_db
from app.models.compatibility import CompatibilityResult
from app.schemas.compatibility import (
    CompatibilityReason,
    CompatibilityResponse,
    OrchestratorInput,
    OrchestratorOutput,
    AutoFillInput,
    AutoFillOutput,
    AutoFillSuggestion,
)
from app.services import product_service
from app.agents.chemist_agent import run_chemist_analysis
from app.agents.artist_agent import run_artist_analysis

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/compatibility", tags=["compatibility"])


@router.post("/auto-fill", response_model=AutoFillOutput)
async def auto_fill_build(
    payload: AutoFillInput,
    db: AsyncSession = Depends(get_db),
):
    """
    Suggests the best-fit products for missing categories based on current build.
    """
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.product import Product
    from app.schemas.compatibility import ProductSnapshot

    # 1. Load current build products
    current_products: list[ProductSnapshot] = []
    if payload.current_product_ids:
        result = await db.execute(
            select(Product)
            .where(Product.id.in_(payload.current_product_ids))
            .options(selectinload(Product.filter_values))
        )
        rows = result.scalars().all()
        for p in rows:
            current_products.append(ProductSnapshot(
                id=p.id,
                name=p.name,
                brand=p.brand.name if p.brand else "",
                category=p.category_key,
                inci_ingredients=p.inci_ingredients or [],
                filters={fv.filter_key: fv.value for fv in p.filter_values}
            ))

    suggestions = []

    # 2. For each missing category, find candidates
    for cat_key in payload.missing_category_keys:
        # Get top 10 highest scored products in this category
        candidates_data = await product_service.list_products(
            db, category=cat_key, sort="stamp_score_desc", per_page=10
        )
        
        best_candidate = None
        best_reason = "Selected based on high stability and user profile match."

        for item in candidates_data.items:
            # Check compatibility of this candidate with existing build
            # We fetch full details for INCI
            full_p = await product_service.get_product(db, item.id)
            candidate_snap = ProductSnapshot(
                id=full_p.id,
                name=full_p.name,
                brand=full_p.brand,
                category=full_p.category,
                inci_ingredients=full_p.inci_ingredients or [],
                filters=full_p.filters
            )

            # Quick simulation: Run Chemist + Artist on (Current + This Candidate)
            test_set = current_products + [candidate_snap]
            
            # Simple heuristic: If it passes basic rules, it's a suggestion
            chemist_out = await run_chemist_analysis(test_set, payload.beauty_profile)
            artist_out = await run_artist_analysis(test_set, payload.beauty_profile)

            # If no errors for THIS product, pick it
            has_error = False
            if candidate_snap.id in chemist_out.results and chemist_out.results[candidate_snap.id].severity == "error":
                has_error = True
            if not has_error and candidate_snap.id in artist_out.results and artist_out.results[candidate_snap.id].severity == "error":
                has_error = True
            
            if not has_error:
                best_candidate = full_p
                # Try to find a nice reason
                skin_msg = f"matches your {payload.beauty_profile.skin_type} skin" if payload.beauty_profile and payload.beauty_profile.skin_type else "is a top-rated choice"
                best_reason = f"Perfect match: {full_p.brand} {full_p.name} is chemically stable with your set and {skin_msg}."
                break
        
        if best_candidate:
            suggestions.append(AutoFillSuggestion(
                category=cat_key,
                product_id=best_candidate.id,
                product_name=best_candidate.name,
                product_data=product_service._product_to_detail_dict(best_candidate),
                reason=best_reason
            ))

    return AutoFillOutput(suggestions=suggestions)


# Cache TTL — re-run the graph if the cached result is older than this
_CACHE_TTL_HOURS = 1


@router.post("/analyze", response_model=OrchestratorOutput)
async def analyze_compatibility(
    body: OrchestratorInput,
    db: AsyncSession = Depends(get_db),
) -> OrchestratorOutput:
    """
    Run the multi-agent compatibility graph for the given product set.

    The result is cached by build_fingerprint (SHA-256 of sorted product_ids).
    Cached results are returned immediately without re-running the graph.
    """
    if not body.product_ids:
        return OrchestratorOutput(
            build_id=body.build_id,
            compatibility_map={},
            evaluated_at=datetime.now(timezone.utc),
            overall_compatibility_score=1.0,
        )

    # Compute fingerprint for cache lookup
    fingerprint = hashlib.sha256(
        ",".join(sorted(body.product_ids)).encode()
    ).hexdigest()

    # Check DB cache — skip if debug traces are needed (cached rows don't
    # store trace data, so a cache hit would return empty debug_trace arrays).
    # TODO: Remove this bypass once debug traces are no longer needed, or
    # store traces in a separate cache-friendly format.
    # cached = await _load_cache(db, fingerprint)
    # if cached is not None:
    #     logger.debug("Returning cached compatibility result for fingerprint %s", fingerprint[:8])
    #     return cached

    # Run the LangGraph graph
    logger.info(
        "Running compatibility graph for build=%s products=%s",
        body.build_id,
        body.product_ids,
    )
    try:
        final_state = await compatibility_graph.ainvoke(
            {
                "build_id": body.build_id,
                "user_id": body.user_id,
                "product_ids": body.product_ids,
                "trigger_product_id": body.trigger_product_id,
                "beauty_profile": body.beauty_profile,
            }
        )
    except Exception as exc:
        logger.error("Compatibility graph failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Compatibility analysis failed: {exc}",
        ) from exc

    output: OrchestratorOutput | None = (
        final_state.get("final_output")
        if isinstance(final_state, dict)
        else getattr(final_state, "final_output", None)
    )

    if output is None:
        # Fallback: construct output from state fields if aggregate_node failed
        compatibility_map: dict[str, CompatibilityResponse] = {}
        chemist = (
            final_state.get("chemist_results", {})
            if isinstance(final_state, dict)
            else getattr(final_state, "chemist_results", {})
        )
        compatibility_map.update(chemist)
        output = OrchestratorOutput(
            build_id=body.build_id,
            compatibility_map=compatibility_map,
            evaluated_at=datetime.now(timezone.utc),
            overall_compatibility_score=1.0 if not compatibility_map else 0.5,
        )

    return output


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

async def _load_cache(
    db: AsyncSession, fingerprint: str
) -> OrchestratorOutput | None:
    """
    Return a cached OrchestratorOutput if one exists and is within TTL.
    Returns None if no valid cache entry is found.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=_CACHE_TTL_HOURS)

    result = await db.execute(
        select(CompatibilityResult).where(
            CompatibilityResult.build_fingerprint == fingerprint,
            CompatibilityResult.evaluated_at > cutoff,
        )
    )
    rows = result.scalars().all()

    if not rows:
        return None

    # Reconstruct OrchestratorOutput from cached rows
    compatibility_map: dict[str, CompatibilityResponse] = {}
    build_id = rows[0].build_id
    evaluated_at = rows[0].evaluated_at

    for row in rows:
        compatibility_map[row.product_id] = CompatibilityResponse(
            is_compatible=row.is_compatible,
            reason=row.reason,
            reasons=[
                CompatibilityReason(**r) 
                for r in (row.reasons or [])
            ],
            severity=row.severity,  # type: ignore[arg-type]
            source_agent=row.source_agent,  # type: ignore[arg-type]
            conflicting_product_ids=row.conflicting_product_ids or [],
        )

    # Recompute score from cached severities
    num_errors = sum(1 for r in compatibility_map.values() if r.severity == "error")
    num_warnings = sum(1 for r in compatibility_map.values() if r.severity == "warning")
    score = max(0.0, 1.0 - (num_errors * 0.30 + num_warnings * 0.10))

    return OrchestratorOutput(
        build_id=build_id,
        compatibility_map=compatibility_map,
        evaluated_at=evaluated_at,
        overall_compatibility_score=round(score, 4),
    )
