"""
Chemist Agent — detects formulation conflicts between makeup products.

Analysis pipeline:
  1. Rule pass: iterate all product pairs against KNOWN_CONFLICTS patterns.
  2. LLM pass: call Gemini with structured output for nuanced gap-filling.
  3. Merge: LLM can only raise severity, never lower it.
"""
from __future__ import annotations

import logging
from typing import Literal

from pydantic import BaseModel, Field

from app.agents.base_agent import get_llm
from app.schemas.compatibility import CompatibilityResponse, ProductSnapshot

logger = logging.getLogger(__name__)


class QuotaExceededError(Exception):
    """Raised when the Gemini API returns a 429 quota / rate-limit error."""


def _is_quota_error(exc: Exception) -> bool:
    """Heuristic check for 429 / quota-exhausted errors across provider SDKs."""
    text = str(exc).lower()
    return (
        "429" in text
        or "quota" in text
        or "resource exhausted" in text
        or "rate limit" in text
        or "rate_limit" in text
        or type(exc).__name__ in (
            "ResourceExhausted",
            "RateLimitError",
            "QuotaExceeded",
            "TooManyRequests",
        )
    )


# ---------------------------------------------------------------------------
# Known ingredient conflict rules
# Each entry: (pattern_a, pattern_b, severity, reason)
# Patterns are lowercase substrings matched against INCI ingredient names.
# A conflict fires when one product contains pattern_a AND another contains pattern_b.
# ---------------------------------------------------------------------------

KNOWN_CONFLICTS: list[tuple[str, str, str, str]] = [
    # Silicone-based formulas over water-based formulas
    (
        "dimethicone",
        "aqua",
        "error",
        "Silicone (dimethicone) applied over a water-based formula causes pilling and breaks down adhesion between layers.",
    ),
    (
        "cyclopentasiloxane",
        "aqua",
        "error",
        "Silicone (cyclopentasiloxane) does not blend with water-based formulas — expect separation and uneven coverage.",
    ),
    (
        "cyclomethicone",
        "aqua",
        "error",
        "Silicone (cyclomethicone) repels water-based products, causing the layers to separate and pill.",
    ),
    # AHA + retinol
    (
        "glycolic acid",
        "retinol",
        "error",
        "Glycolic acid (AHA) combined with retinol causes excessive irritation and compromises the skin barrier.",
    ),
    (
        "lactic acid",
        "retinol",
        "error",
        "Lactic acid (AHA) combined with retinol leads to over-exfoliation and heightened skin sensitivity.",
    ),
    (
        "mandelic acid",
        "retinol",
        "error",
        "Mandelic acid (AHA) combined with retinol risks over-exfoliation and redness.",
    ),
    # BHA + retinol
    (
        "salicylic acid",
        "retinol",
        "error",
        "Salicylic acid (BHA) combined with retinol leads to over-exfoliation and skin barrier damage.",
    ),
    # Benzoyl peroxide + retinol
    (
        "benzoyl peroxide",
        "retinol",
        "error",
        "Benzoyl peroxide oxidizes retinol on contact, deactivating it and reducing efficacy.",
    ),
    # Vitamin C + retinol
    (
        "ascorbic acid",
        "retinol",
        "warning",
        "Vitamin C (ascorbic acid) and retinol can destabilize each other at high concentrations; consider using at different times.",
    ),
    # Niacinamide + high-concentration Vitamin C
    (
        "niacinamide",
        "ascorbic acid",
        "warning",
        "High-concentration niacinamide can reduce vitamin C (ascorbic acid) efficacy; use in separate steps.",
    ),
    # Oil-based over water-based
    (
        "mineral oil",
        "aqua",
        "warning",
        "Oil-based products (mineral oil) applied over water-based formulas can cause pilling and uneven wear.",
    ),
    (
        "isopropyl myristate",
        "aqua",
        "warning",
        "Oil-ester formulas (isopropyl myristate) over water-based products may cause separation and reduce longevity.",
    ),
]


# ---------------------------------------------------------------------------
# LLM structured output schema
# ---------------------------------------------------------------------------

class _ConflictVerdict(BaseModel):
    product_id: str
    is_compatible: bool
    reason: str = Field(..., max_length=300)
    severity: Literal["warning", "error"]
    conflicting_product_ids: list[str] = Field(default_factory=list)


class _ChemistLLMOutput(BaseModel):
    verdicts: list[_ConflictVerdict] = Field(
        default_factory=list,
        description=(
            "List of compatibility verdicts. Only include products that have conflicts. "
            "Products with no detected issues should be omitted."
        ),
    )


# ---------------------------------------------------------------------------
# Rule pass
# ---------------------------------------------------------------------------

def _run_rule_pass(products: list[ProductSnapshot]) -> dict[str, CompatibilityResponse]:
    """
    Iterate all product pairs against KNOWN_CONFLICTS.
    Returns a dict of product_id → CompatibilityResponse for conflicting products only.
    """
    results: dict[str, CompatibilityResponse] = {}

    # Build normalized ingredient sets per product
    product_ingredients: dict[str, set[str]] = {}
    for product in products:
        ingredients: set[str] = set()
        for ing in (product.inci_ingredients or []):
            ingredients.add(ing.lower())
        for spec in (product.specs or []):
            ingredients.add(spec.lower())
        product_ingredients[product.id] = ingredients

    # Check all unique product pairs
    for i, prod_a in enumerate(products):
        for j, prod_b in enumerate(products):
            if i >= j:
                continue

            ings_a = product_ingredients[prod_a.id]
            ings_b = product_ingredients[prod_b.id]

            for pattern_a, pattern_b, severity, reason in KNOWN_CONFLICTS:
                a_has_a = any(pattern_a in ing for ing in ings_a)
                b_has_b = any(pattern_b in ing for ing in ings_b)
                a_has_b = any(pattern_b in ing for ing in ings_a)
                b_has_a = any(pattern_a in ing for ing in ings_b)

                if not ((a_has_a and b_has_b) or (a_has_b and b_has_a)):
                    continue

                # Flag both products in the pair
                for flagged_id, conflict_id in [
                    (prod_a.id, prod_b.id),
                    (prod_b.id, prod_a.id),
                ]:
                    if flagged_id not in results:
                        results[flagged_id] = CompatibilityResponse(
                            is_compatible=False,
                            reason=reason,
                            severity=severity,  # type: ignore[arg-type]
                            source_agent="chemist",
                            conflicting_product_ids=[conflict_id],
                        )
                    else:
                        existing = results[flagged_id]
                        new_conflicting = list(
                            {*existing.conflicting_product_ids, conflict_id}
                        )
                        # Escalate severity if new conflict is worse
                        new_severity = (
                            "error"
                            if severity == "error" or existing.severity == "error"
                            else "warning"
                        )
                        results[flagged_id] = CompatibilityResponse(
                            is_compatible=False,
                            reason=existing.reason if existing.severity == new_severity else reason,
                            severity=new_severity,  # type: ignore[arg-type]
                            source_agent="chemist",
                            conflicting_product_ids=new_conflicting,
                        )

    return results


# ---------------------------------------------------------------------------
# LLM pass
# ---------------------------------------------------------------------------

async def _run_llm_pass(
    products: list[ProductSnapshot],
    rule_findings: dict[str, CompatibilityResponse],
) -> dict[str, CompatibilityResponse]:
    """
    Call Gemini with structured output for nuanced gap-filling.
    Returns merged results where LLM can only raise severity, never lower it.
    """
    has_inci_data = any(p.inci_ingredients for p in products)

    # Build the ingredient summary for each product
    product_summaries = []
    for p in products:
        if p.inci_ingredients:
            ing_text = ", ".join(p.inci_ingredients[:30])  # Cap at 30 for prompt length
            data_quality = "INCI ingredient list available"
        else:
            ing_text = ", ".join(p.specs or []) or "No ingredient data available"
            data_quality = "No INCI data — specs/description only"

        product_summaries.append(
            f"Product ID: {p.id}\n"
            f"Name: {p.name} by {p.brand}\n"
            f"Category: {p.category}\n"
            f"Data quality: {data_quality}\n"
            f"Ingredients/specs: {ing_text}"
        )

    # Summarize existing rule findings
    if rule_findings:
        rule_summary = "\n".join(
            f"- Product {pid}: {resp.reason} (severity: {resp.severity}, conflicts with: {resp.conflicting_product_ids})"
            for pid, resp in rule_findings.items()
        )
    else:
        rule_summary = "No rule-based conflicts detected."

    products_text = "\n\n".join(product_summaries)
    data_warning = (
        "" if has_inci_data
        else "\nNOTE: INCI ingredient data is unavailable for all products. "
             "Base your analysis on specs, categories, and product names. "
             "If you cannot determine compatibility, note the limitation in your reason."
    )

    prompt = f"""You are a cosmetic chemist analyzing ingredient compatibility for a makeup build.

PRODUCTS IN BUILD:
{products_text}

RULE-BASED FINDINGS (already detected):
{rule_summary}
{data_warning}

TASK: Identify any additional formulation conflicts NOT already captured above.
Focus on:
- Silicone-based vs water-based layering order issues
- pH-sensitive actives (AHAs, BHAs, vitamin C, retinoids)
- Oxidizing agents conflicting with antioxidants or retinoids
- Oil-based vs water-based incompatibilities
- Finish conflicts (e.g. high-shine gloss over matte foundation)

Only flag genuine chemical/formulation conflicts. Do not flag stylistic preferences.
If no additional conflicts exist beyond the rule findings, return an empty verdicts list.
If INCI data is missing, note "Limited analysis: no INCI data available" in the reason."""

    try:
        llm = get_llm()
        structured_llm = llm.with_structured_output(_ChemistLLMOutput)
        llm_output: _ChemistLLMOutput = await structured_llm.ainvoke(prompt)  # type: ignore[assignment]
    except Exception as exc:
        if _is_quota_error(exc):
            logger.warning("Gemini API quota exceeded (429): %s", exc)
            raise QuotaExceededError(str(exc)) from exc
        logger.warning("Chemist LLM call failed: %s", exc)
        return rule_findings

    # Merge LLM results with rule findings (LLM can only raise severity)
    merged = dict(rule_findings)

    for verdict in llm_output.verdicts:
        pid = verdict.product_id
        llm_resp = CompatibilityResponse(
            is_compatible=verdict.is_compatible,
            reason=verdict.reason,
            severity=verdict.severity,
            source_agent="chemist",
            conflicting_product_ids=verdict.conflicting_product_ids,
        )

        if pid not in merged:
            merged[pid] = llm_resp
        else:
            existing = merged[pid]
            # LLM can only raise severity, never lower
            if verdict.severity == "error" and existing.severity == "warning":
                merged[pid] = CompatibilityResponse(
                    is_compatible=False,
                    reason=verdict.reason,
                    severity="error",
                    source_agent="chemist",
                    conflicting_product_ids=list(
                        {*existing.conflicting_product_ids, *verdict.conflicting_product_ids}
                    ),
                )
            else:
                # Keep existing severity, add any new conflicting IDs from LLM
                new_ids = list(
                    {*existing.conflicting_product_ids, *verdict.conflicting_product_ids}
                )
                merged[pid] = existing.model_copy(
                    update={"conflicting_product_ids": new_ids}
                )

    return merged


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def run_chemist_analysis(products: list[ProductSnapshot]) -> "ChemistOutput":
    """
    Run the full Chemist Agent pipeline:
    1. Rule pass against KNOWN_CONFLICTS.
    2. LLM pass (Gemini) to fill gaps the rules miss.
    3. Merge results (LLM can only raise severity).

    Degrades gracefully when inci_ingredients is empty.
    """
    from app.schemas.compatibility import ChemistOutput  # local import to avoid circular

    if not products:
        return ChemistOutput(results={})

    rule_findings = _run_rule_pass(products)

    if not rule_findings:
        logger.debug("No rule-based conflicts. Proceeding to LLM pass.")

    try:
        merged = await _run_llm_pass(products, rule_findings)
    except QuotaExceededError:
        # Return rule-based findings only; flag quota error for the frontend
        return ChemistOutput(results=rule_findings, quota_exceeded=True)

    return ChemistOutput(results=merged)
