"""
Trend Agent — flags products associated with declining makeup trends.

Analysis pipeline:
  1. Rule pass: products linked to a declining trend get a 'warning'.
  2. LLM pass: Gemini identifies any additional trend-relevance issues.
  3. Merge: LLM can only raise severity, never lower it.

Trend verdicts use severity "warning" only — trend issues are advisory,
never hard blockers like formulation conflicts.
"""
from __future__ import annotations

import logging
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.agents.base_agent import get_llm
from app.agents.chemist_agent import QuotaExceededError, _is_quota_error
from app.schemas.compatibility import (
    CompatibilityResponse,
    ProductSnapshot,
    TrendOutput,
    TrendSnapshot,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# LLM structured output schema
# ---------------------------------------------------------------------------

class _TrendVerdict(BaseModel):
    product_id: str
    is_compatible: bool
    reason: str
    severity: Literal["warning"]  # Trend issues are always advisory
    conflicting_product_ids: list[str] = Field(default_factory=list)

    @field_validator("reason", mode="before")
    @classmethod
    def truncate_reason(cls, v: str) -> str:
        return v[:300] if isinstance(v, str) else v


class _TrendLLMOutput(BaseModel):
    verdicts: list[_TrendVerdict] = Field(
        default_factory=list,
        description=(
            "List of trend-relevance verdicts. Only include products associated with "
            "declining or outdated trends. Products with no trend issues should be omitted."
        ),
    )


# ---------------------------------------------------------------------------
# Rule pass
# ---------------------------------------------------------------------------

def _run_rule_pass(
    products: list[ProductSnapshot],
    active_trends: list[TrendSnapshot],
) -> dict[str, CompatibilityResponse]:
    """
    Flag products that are associated with a declining trend.
    Returns per-product CompatibilityResponse for flagged products only.
    """
    declining_trends = [t for t in active_trends if t.direction == "declining"]
    if not declining_trends:
        return {}

    # product_id → list of declining trend names
    product_to_declining: dict[str, list[str]] = {}
    for trend in declining_trends:
        for pid in trend.associated_product_ids:
            product_to_declining.setdefault(pid, []).append(trend.name)

    results: dict[str, CompatibilityResponse] = {}
    for product in products:
        if product.id in product_to_declining:
            trend_names = product_to_declining[product.id]
            names_str = ", ".join(f'"{n}"' for n in trend_names)
            results[product.id] = CompatibilityResponse(
                is_compatible=True,
                reason=(
                    f"Trend note: This product is part of the {names_str} trend, "
                    "which is fading. You might want to check out newer alternatives!"
                ),
                severity="warning",
                source_agent="trend",
                conflicting_product_ids=[],
            )

    return results


# ---------------------------------------------------------------------------
# LLM pass
# ---------------------------------------------------------------------------

async def _run_llm_pass(
    products: list[ProductSnapshot],
    active_trends: list[TrendSnapshot],
    rule_findings: dict[str, CompatibilityResponse],
) -> dict[str, CompatibilityResponse]:
    """
    Call Gemini for nuanced trend relevance analysis beyond the rule pass.
    Returns merged results where LLM can only raise severity, never lower it.
    """
    product_summaries = []
    for p in products:
        product_summaries.append(
            f"Product ID: {p.id}\n"
            f"Name: {p.name} by {p.brand}\n"
            f"Category: {p.category}"
        )

    trend_summaries = []
    for t in active_trends:
        trend_summaries.append(
            f"- Trend: {t.name!r} | Direction: {t.direction} | "
            f"Description: {t.description} | Associated products: {t.associated_product_ids}"
        )

    products_text = "\n\n".join(product_summaries)
    trends_text = "\n".join(trend_summaries) if trend_summaries else "No active trends."

    if rule_findings:
        rule_summary = "\n".join(
            f"- Product {pid}: {resp.reason}"
            for pid, resp in rule_findings.items()
        )
    else:
        rule_summary = "No rule-based trend issues detected."

    # Build a set of product IDs whose only trend associations are non-declining.
    # The LLM must not flag these as trend-declining — the rule pass is authoritative
    # on trend direction (it has the actual direction field; the LLM only has names).
    stable_or_rising_only_pids: set[str] = set()
    all_associated: dict[str, list[str]] = {}  # pid → list of directions
    for t in active_trends:
        for pid in t.associated_product_ids:
            all_associated.setdefault(pid, []).append(t.direction)
    for pid, directions in all_associated.items():
        if all(d != "declining" for d in directions):
            stable_or_rising_only_pids.add(pid)

    prompt = f"""You are a makeup industry trend analyst reviewing a user's makeup build for trend relevance.

PRODUCTS IN BUILD:
{products_text}

ACTIVE TRENDS:
{trends_text}

RULE-BASED FINDINGS (already detected):
{rule_summary}

TASK: Identify any additional trend-relevance issues NOT already captured above.
Focus on:
- Products associated with declining or outdated trends
- Combinations that clash with current beauty aesthetics
- Product formulas or finishes going out of style

STRICT RULES:
- Only flag genuine trend concerns — not personal preference or styling choices.
- Always use severity "warning" — trend issues are advisory, never hard blockers.
- Do NOT flag products whose associated trend direction is "stable" or "rising" as declining.
  The trend direction field is authoritative — if it says "rising", the product is current.
- If a product already appears in rule findings above, do not add it again.
- If no additional trend issues exist, return an empty verdicts list."""

    try:
        llm = get_llm()
        structured_llm = llm.with_structured_output(_TrendLLMOutput)
        llm_output: _TrendLLMOutput = await structured_llm.ainvoke(prompt)  # type: ignore[assignment]
    except Exception as exc:
        if _is_quota_error(exc):
            logger.warning("Gemini API quota exceeded (429): %s", exc)
            raise QuotaExceededError(str(exc)) from exc
        logger.warning("Trend LLM call failed: %s", exc)
        return rule_findings

    # Merge: LLM can add new products, but cannot change existing entries.
    # Post-LLM guard: reject verdicts for products whose only trend associations
    # are stable/rising — the rule pass is authoritative on direction.
    merged = dict(rule_findings)
    valid_product_ids = {p.id for p in products}

    for verdict in llm_output.verdicts:
        pid = verdict.product_id

        # Guard 0: reject hallucinated product IDs not in the build
        if pid not in valid_product_ids:
            logger.warning(
                "Trend LLM hallucinated unknown product ID %s — stripped",
                pid[:8],
            )
            continue

        # Guard: reject trend-declining hallucination for stable/rising products
        if pid in stable_or_rising_only_pids:
            logger.debug(
                "Trend LLM guard: stripped declining verdict on stable/rising product %s: %s",
                pid[:8], verdict.reason[:60],
            )
            if pid in merged:
                merged[pid].debug_trace.append(
                    f"LLM STRIPPED: trend-direction guard — product is stable/rising ({verdict.reason[:50]})"
                )
            continue

        llm_resp = CompatibilityResponse(
            is_compatible=verdict.is_compatible,
            reason=verdict.reason,
            severity="warning",  # trend verdicts are always advisory
            source_agent="trend",
            conflicting_product_ids=verdict.conflicting_product_ids,
            debug_trace=[f"LLM ADDED: trend warning — {verdict.reason[:60]}"],
        )

        if pid not in merged:
            merged[pid] = llm_resp
        else:
            # Keep existing entry; only extend conflicting_product_ids if new
            existing = merged[pid]
            new_ids = list({*existing.conflicting_product_ids, *verdict.conflicting_product_ids})
            merged[pid] = existing.model_copy(update={
                "conflicting_product_ids": new_ids,
                "debug_trace": existing.debug_trace + [f"LLM ADDED: trend warning — {verdict.reason[:60]}"],
            })

    return merged


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def run_trend_analysis(
    products: list[ProductSnapshot],
    active_trends: list[TrendSnapshot],
) -> TrendOutput:
    """
    Run the full Trend Agent pipeline:
    1. Rule pass: flag products in declining trends.
    2. LLM pass: Gemini fills any nuanced gap-filling.

    Returns an empty TrendOutput when there are no active trends or no products.
    """
    if not products or not active_trends:
        # No trends to check — emit a pass trace for every product
        pass_traces = {
            p.id: ["TREND PASS: no active trends in the system to evaluate against"]
            for p in products
        }
        return TrendOutput(results={}, pass_traces=pass_traces)

    rule_findings = _run_rule_pass(products, active_trends)

    try:
        merged = await _run_llm_pass(products, active_trends, rule_findings)
    except QuotaExceededError:
        pass_traces = _build_trend_pass_traces(products, rule_findings, active_trends, quota_exceeded=True)
        return TrendOutput(results=rule_findings, quota_exceeded=True, pass_traces=pass_traces)

    pass_traces = _build_trend_pass_traces(products, merged, active_trends)
    return TrendOutput(results=merged, pass_traces=pass_traces)


def _build_trend_pass_traces(
    products: list["ProductSnapshot"],
    results: dict,
    active_trends: list["TrendSnapshot"],
    *,
    quota_exceeded: bool = False,
) -> dict[str, list[str]]:
    """Build debug traces for products that passed all trend checks."""
    pass_traces: dict[str, list[str]] = {}
    for p in products:
        if p.id in results:
            continue
        associated = [t for t in active_trends if p.id in t.associated_product_ids]
        if associated:
            directions = ", ".join(f"{t.name} ({t.direction})" for t in associated)
            trace = [f"TREND PASS: associated with {directions} — direction not declining"]
        else:
            trend_count = len(active_trends)
            trace = [f"TREND PASS: checked {trend_count} active trend(s) — not associated with any"]
        if quota_exceeded:
            trace.append("TREND PASS: LLM review skipped — quota exceeded")
        pass_traces[p.id] = trace
    return pass_traces
