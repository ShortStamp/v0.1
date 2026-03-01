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
            "chemist_pass_traces": output.pass_traces,
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
        return {
            "artist_results": output.results,
            "artist_pass_traces": output.pass_traces,
            "has_physical_failure": output.has_physical_failure,
            "errors": errors,
        }
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
        return {
            "trend_results": output.results,
            "trend_pass_traces": output.pass_traces,
            "errors": errors,
        }
    except Exception as exc:
        logger.error("Trend agent failed: %s", exc)
        return {"errors": [*state.errors, f"trend: {exc}"]}


def _build_recipe_card(
    state: AgentState, 
    compatibility_map: dict[str, OrchestratorOutput.CompatibilityResponse], 
    score: float, 
    fingerprint: str
) -> OrchestratorOutput.MakeupRecipeCard:
    """
    Constructs the sophisticated summary card from agent results.
    """
    from app.schemas.compatibility import BlueprintStep, ArtistNote, SafetyCheck, MakeupRecipeCard

    # 1. Status & Stability
    status_label = "Compatible"
    if state.has_physical_failure:
        status_label = "Incompatible: Physical Failure"
    elif any(r.severity == "error" for r in compatibility_map.values()):
        status_label = "Warning: Texture Clash" # Or keep "Compatible" if warnings only
    elif any(r.severity == "warning" for r in compatibility_map.values()):
        status_label = "Warning: Texture Clash"

    # 2. Application Blueprint
    blueprint = []
    # Map category names for better display
    cat_map = {p.id: p.category for p in state.products}
    for step in state.application_order:
        blueprint.append(BlueprintStep(
            step_number=step.step,
            category=cat_map.get(step.product_id, "unknown"),
            product_id=step.product_id,
            product_name=step.product_name,
            insight=step.note or "Apply as directed by formula analysis."
        ))

    # 3. Artist Notes (Aesthetic insights)
    artist_notes = []
    
    # Glow / Texture check
    glow_issues = [r for pid, r in state.artist_results.items() if any(k in r.reason for k in ["Glow", "Texture", "Surface"])]
    if glow_issues:
        artist_notes.append(ArtistNote(
            title="Texture Harmony",
            content=glow_issues[0].reason,
            severity="warning"
        ))
    else:
        artist_notes.append(ArtistNote(
            title="Texture Harmony",
            content="Your selected products share compatible finishes for a balanced, natural glow.",
            severity="success"
        ))

    # Tone / Undertone check
    tone_issues = [r for pid, r in state.artist_results.items() if any(k in r.reason for k in ["Tone", "Color", "Undertone", "Match"])]
    if tone_issues:
        artist_notes.append(ArtistNote(
            title="Tone Harmony",
            content=tone_issues[0].reason,
            severity="warning"
        ))
    else:
        artist_notes.append(ArtistNote(
            title="Tone Harmony",
            content="The color palette across your selections is visually stable and flattering.",
            severity="success"
        ))

    # 4. Safety Audit (Chemical insights)
    safety_audit = []
    
    # Pilling / Adhesion
    pilling_risk = any(any(k in r.reason.lower() for k in ["pill", "silicone", "separation"]) for r in state.chemist_results.values())
    safety_audit.append(SafetyCheck(
        label="No Pilling",
        description="Layering order optimized for Silicone/Water compatibility." if not pilling_risk else "Adhesion risks detected; follow application order strictly.",
        passed=not pilling_risk
    ))

    # Skin Barrier
    barrier_risk = any(any(k in r.reason.lower() for k in ["irritation", "sensitive", "redness", "burning"]) for r in state.chemist_results.values())
    safety_audit.append(SafetyCheck(
        label="Barrier Safe",
        description="No harsh concentrations found for your skin type." if not barrier_risk else "Potentially irritating actives detected; monitor for sensitivity.",
        passed=not barrier_risk
    ))

    # 5. Missing Links
    # We'll consider all categories in the "Base" group plus anything else common
    # but specifically focus on completing the face logic.
    core_categories = ["primer", "foundation", "concealer", "powder", "setting-spray"]
    present_categories = {p.category for p in state.products}
    missing_category_keys = [c for c in core_categories if c not in present_categories]
    
    missing_links = []
    if "primer" in missing_category_keys:
        skin_type = (state.beauty_profile.skin_type or "").lower() if state.beauty_profile else ""
        if skin_type == "oily":
            missing_links.append("Missing Primer: Your 'Oily' skin needs a mattifying base to keep this set stable for 8+ hours.")
        else:
            missing_links.append("Missing Primer: A base layer would improve the longevity and adhesion of your foundation.")
    
    if "foundation" in missing_category_keys:
        missing_links.append("Missing Foundation: The centerpiece of your build is missing. We can suggest a formula that bridges your primer and powder.")

    if "powder" in missing_category_keys:
        missing_links.append("Missing Powder: A setting step is recommended to prevent 'mudding' or product migration.")
    
    if "concealer" in missing_category_keys:
        missing_links.append("Missing Concealer: For targeted coverage that matches your build's texture and tone.")

    if not missing_links and missing_category_keys:
        # Generic message for other missing core items like setting spray
        first_missing = missing_category_keys[0].replace("-", " ").title()
        missing_links.append(f"Complete the Set: You're missing a {first_missing} to fully round out your routine.")

    return MakeupRecipeCard(
        stability_index=score,
        status_label=status_label,
        blueprint=blueprint,
        artist_notes=artist_notes,
        safety_audit=safety_audit,
        missing_links=missing_links,
        missing_category_keys=missing_category_keys,
        share_fingerprint=fingerprint
    )


async def aggregate_node(state: AgentState) -> dict:
    """
    Merge all agent results, compute overall score, persist cache rows, and
    build the final OrchestratorOutput.
    """
    from app.models.compatibility import CompatibilityResult
    from app.schemas.compatibility import CompatibilityReason

    # Merge results from all agents
    compatibility_map: dict[str, OrchestratorOutput.CompatibilityResponse] = {}

    def merge_resp(pid: str, new_resp: OrchestratorOutput.CompatibilityResponse):
        # Ensure new_resp has its own reason in its reasons list if not already there
        if not new_resp.reasons:
            new_resp.reasons = [CompatibilityReason(
                agent=new_resp.source_agent,
                text=new_resp.reason,
                severity=new_resp.severity
            )]

        if pid not in compatibility_map:
            compatibility_map[pid] = new_resp
            return

        existing = compatibility_map[pid]
        
        # Merge reasons
        merged_reasons = list(existing.reasons)
        for nr in new_resp.reasons:
            if not any(r.text == nr.text for r in merged_reasons):
                merged_reasons.append(nr)
        
        # Determine highest severity
        severity_rank = {"error": 3, "warning": 2, "info": 1}
        existing_rank = severity_rank.get(existing.severity, 0)
        new_rank = severity_rank.get(new_resp.severity, 0)
        
        final_severity = existing.severity
        if new_rank > existing_rank:
            final_severity = new_resp.severity
        
        # Chemist formulation conflicts usually take priority for the main 'reason' string (legacy support)
        # unless artist physical error occurs.
        is_artist_physical_error = (
            new_resp.source_agent == "artist" 
            and new_resp.severity == "error"
            and ("Texture Conflict" in new_resp.reason or "Powder Sandwich" in new_resp.reason)
        )

        final_reason = existing.reason
        final_source = existing.source_agent
        
        if is_artist_physical_error or (new_rank > existing_rank):
            final_reason = new_resp.reason
            final_source = new_resp.source_agent
        elif existing.source_agent != "chemist" and new_resp.source_agent == "chemist" and new_rank >= existing_rank:
            final_reason = new_resp.reason
            final_source = new_resp.source_agent

        # Merge conflicting IDs
        merged_conflicts = list(set(existing.conflicting_product_ids + new_resp.conflicting_product_ids))
        
        # Merge traces
        merged_trace = list(existing.debug_trace) + [f"ORCHESTRATOR: Merged {new_resp.source_agent} results"] + list(new_resp.debug_trace)

        compatibility_map[pid] = existing.model_copy(update={
            "reason": final_reason,
            "reasons": merged_reasons,
            "severity": final_severity, # type: ignore[arg-type]
            "source_agent": final_source,
            "conflicting_product_ids": merged_conflicts,
            "debug_trace": merged_trace
        })

    # Process each agent's results
    for pid, resp in state.chemist_results.items():
        merge_resp(pid, resp)
    for pid, resp in state.artist_results.items():
        merge_resp(pid, resp)
    for pid, resp in state.trend_results.items():
        merge_resp(pid, resp)

    # Compute overall score
    has_physical_failure = state.has_physical_failure
    num_errors = sum(1 for r in compatibility_map.values() if r.severity == "error")
    num_warnings = sum(1 for r in compatibility_map.values() if r.severity == "warning")
    # 'info' does not penalize score
    base_score = max(0.0, 1.0 - (num_errors * 0.30 + num_warnings * 0.10))
    # Physical failures cap the score at 0.1
    score = min(base_score, 0.1) if has_physical_failure else base_score

    now = datetime.now(timezone.utc)

    # Build all_traces: merge pass traces for compatible products from all agents.
    # Incompatible products already carry their conflict trace in compatibility_map[pid].debug_trace.
    all_traces: dict[str, list[str]] = {}
    for source_traces in (
        state.chemist_pass_traces,
        state.artist_pass_traces,
        state.trend_pass_traces,
    ):
        for pid, trace in source_traces.items():
            if pid not in compatibility_map:
                all_traces.setdefault(pid, []).extend(trace)

    # Compute fingerprint for cache keying & shareable link
    fingerprint = hashlib.sha256(
        ",".join(sorted(state.product_ids)).encode()
    ).hexdigest()

    recipe_card = _build_recipe_card(state, compatibility_map, score, fingerprint)

    output = OrchestratorOutput(
        build_id=state.build_id,
        compatibility_map=compatibility_map,
        application_order=state.application_order,
        evaluated_at=now,
        overall_compatibility_score=round(score, 4),
        has_physical_failure=has_physical_failure,
        recipe_card=recipe_card,
        errors=list(dict.fromkeys(state.errors)),  # deduplicate while preserving order
        all_traces=all_traces,
    )

    # Persist each conflict verdict as a CompatibilityResult cache row.
    # Wrapped in try/except so a DB failure (e.g. FK violation for
    # "local-build") never prevents results from reaching the user.
    try:
        async with async_session() as db:
            for product_id, compat in compatibility_map.items():
                row = CompatibilityResult(
                    build_id=state.build_id,
                    product_id=product_id,
                    is_compatible=compat.is_compatible,
                    reason=compat.reason,
                    reasons=[r.model_dump() for r in (compat.reasons or [])],
                    severity=compat.severity,
                    source_agent=compat.source_agent,
                    conflicting_product_ids=compat.conflicting_product_ids,
                    evaluated_at=now,
                    build_fingerprint=fingerprint,
                )
                db.add(row)
            await db.commit()
    except Exception as exc:
        logger.warning("Failed to cache compatibility results: %s", exc)

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
