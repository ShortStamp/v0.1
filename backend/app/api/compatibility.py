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
    CompatibilityResponse,
    OrchestratorInput,
    OrchestratorOutput,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/compatibility", tags=["compatibility"])

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

    # Check DB cache
    cached = await _load_cache(db, fingerprint)
    if cached is not None:
        logger.debug("Returning cached compatibility result for fingerprint %s", fingerprint[:8])
        return cached

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
