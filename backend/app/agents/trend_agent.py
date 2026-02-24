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

from pydantic import BaseModel, Field

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
    reason: str = Field(..., max_length=300)
    severity: Literal["warning"]  # Trend issues are always advisory
    conflicting_product_ids: list[str] = Field(default_factory=list)


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
                    f"Associated with a declining trend ({names_str}). "
                    "Consider more current alternatives."
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

Rules:
- Only flag genuine trend concerns — not personal preference or styling choices.
- Always use severity "warning" — trend issues are advisory, never hard blockers.
- If a product already appears in rule findings, do not repeat it unless you have new information.
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

    # Merge: LLM can add new products, but cannot change existing entries
    merged = dict(rule_findings)

    for verdict in llm_output.verdicts:
        pid = verdict.product_id
        llm_resp = CompatibilityResponse(
            is_compatible=verdict.is_compatible,
            reason=verdict.reason,
            severity="warning",  # trend verdicts are always advisory
            source_agent="trend",
            conflicting_product_ids=verdict.conflicting_product_ids,
        )

        if pid not in merged:
            merged[pid] = llm_resp
        else:
            # Keep existing entry; only extend conflicting_product_ids if new
            existing = merged[pid]
            new_ids = list({*existing.conflicting_product_ids, *verdict.conflicting_product_ids})
            merged[pid] = existing.model_copy(update={"conflicting_product_ids": new_ids})

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
        return TrendOutput(results={})

    rule_findings = _run_rule_pass(products, active_trends)

    try:
        merged = await _run_llm_pass(products, active_trends, rule_findings)
    except QuotaExceededError:
        return TrendOutput(results=rule_findings, quota_exceeded=True)

    return TrendOutput(results=merged)
