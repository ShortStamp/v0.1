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
from app.schemas.compatibility import (
    ApplicationStep,
    BeautyProfileSnapshot,
    CompatibilityResponse,
    ProductSnapshot,
)

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
# Application-zone mapping for product categories.
#
# Layering conflicts (silicone/oil over water-based) only matter when two
# products are applied to the SAME area of the face.  Mascara + blush, for
# example, never physically layer, so silicone/water rules must not fire
# across zones.
# ---------------------------------------------------------------------------

_CATEGORY_ZONE: dict[str, str] = {
    # Face base + complexion
    "foundation": "face", "concealer": "face", "primer": "face",
    "powder": "face", "setting-spray": "face",
    # Cheeks / contouring (still the face canvas)
    "blush": "face", "bronzer": "face", "highlighter": "face", "contour": "face",
    # Eye area
    "eyeshadow": "eye", "eyeliner": "eye", "mascara": "eye", "false-lashes": "eye",
    # Brow area
    "brow-pencil": "brow", "brow-gel": "brow",
    # Lip area
    "lipstick": "lip", "lip-gloss": "lip", "lip-liner": "lip",
}

# Patterns whose conflicts are about physical LAYERING ORDER.
# These should only fire when both products sit in the same application zone.
# Active-ingredient conflicts (retinol, AHAs, etc.) are systemic — they fire
# regardless of zone because skin absorbs them from any applied area.
_LAYERING_PATTERNS: frozenset[str] = frozenset({
    "dimethicone", "cyclopentasiloxane", "cyclomethicone",
    "mineral oil", "isopropyl myristate",
})


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
# Skin-type safety rules
# Each entry: (pattern, severity, reason)
# Matched against top-15 INCI ingredients (lowercase substring).
# ---------------------------------------------------------------------------

SKIN_TYPE_RULES: dict[str, list[tuple[str, str, str]]] = {
    "sensitive": [
        ("glycolic acid",    "warning", "Glycolic acid (AHA) can cause redness and stinging on sensitive skin — patch test first."),
        ("lactic acid",      "warning", "Lactic acid (AHA) may irritate sensitive skin."),
        ("mandelic acid",    "warning", "Mandelic acid (AHA) can irritate sensitive skin."),
        ("salicylic acid",   "warning", "Salicylic acid (BHA) can cause redness and flaking on sensitive skin."),
        ("retinol",          "warning", "Retinol is a potent active that may be too irritating for sensitive skin."),
        ("benzoyl peroxide", "error",   "Benzoyl peroxide commonly causes severe burning on sensitive skin."),
        ("alcohol denat",    "warning", "Denatured alcohol strips the skin barrier — avoid on sensitive skin."),
        ("sd alcohol",       "warning", "SD alcohol is drying and irritating for sensitive skin."),
        ("fragrance",        "warning", "Fragrance is a leading contact allergen — high risk for sensitive skin."),
        ("parfum",           "warning", "Parfum (fragrance) is a common irritant for sensitive skin."),
    ],
    "dry": [
        ("alcohol denat",    "warning", "Denatured alcohol strips moisture — worsens dry skin."),
        ("sd alcohol",       "warning", "SD alcohol has a drying effect that can aggravate dry skin."),
        ("salicylic acid",   "warning", "Salicylic acid's keratolytic action can over-dry already dry skin."),
    ],
    "oily": [
        ("mineral oil",         "warning", "Mineral oil is a heavy occlusive that can feel greasy and clog pores on oily skin."),
        ("petrolatum",          "warning", "Petrolatum is highly occlusive — may cause congestion on oily skin."),
        ("lanolin",             "warning", "Lanolin is a rich wax — may cause congestion on oily skin."),
        ("isopropyl myristate", "warning", "Isopropyl myristate is comedogenic — avoid on oily/acne-prone skin."),
        ("isopropyl palmitate", "warning", "Isopropyl palmitate has comedogenic potential — avoid on oily skin."),
    ],
}


def _ingredient_position(pattern: str, inci_list: list[str]) -> int:
    """Return 0-based index of the first INCI ingredient matching pattern, or 999."""
    for i, ing in enumerate(inci_list):
        if pattern in ing.lower():
            return i
    return 999


def _run_skin_type_pass(
    products: list[ProductSnapshot], skin_type: str | None
) -> dict[str, CompatibilityResponse]:
    """
    Scan each product's top-15 INCI ingredients for skin-type-specific risks.
    Returns per-product CompatibilityResponse with empty conflicting_product_ids.
    One warning per product — highest severity wins among all matches.
    """
    if not skin_type or skin_type not in SKIN_TYPE_RULES:
        return {}

    rules = SKIN_TYPE_RULES[skin_type]
    results: dict[str, CompatibilityResponse] = {}

    for product in products:
        top15 = [ing.lower() for ing in (product.inci_ingredients or [])[:15]]
        best_severity: str | None = None
        best_reason: str | None = None

        for pattern, severity, reason in rules:
            if any(pattern in ing for ing in top15):
                # error beats warning
                if best_severity is None or (severity == "error" and best_severity == "warning"):
                    best_severity = severity
                    best_reason = reason

        if best_severity is not None:
            results[product.id] = CompatibilityResponse(
                is_compatible=False,
                reason=best_reason,  # type: ignore[arg-type]
                severity=best_severity,  # type: ignore[arg-type]
                source_agent="chemist",
                conflicting_product_ids=[],
            )

    return results


# ---------------------------------------------------------------------------
# Formula type helper + application order builder
# ---------------------------------------------------------------------------

def _formula_type(product: ProductSnapshot) -> str:
    """Classify a product's base formula from its top-5 INCI ingredients."""
    top5 = [ing.lower() for ing in (product.inci_ingredients or [])[:5]]
    water_markers = ("aqua", "water", "eau")
    silicone_markers = ("dimethicone", "cyclopentasiloxane", "cyclomethicone", "trimethylsiloxysilicate")
    if any(m in ing for ing in top5 for m in water_markers):
        return "water"
    if any(m in ing for ing in top5 for m in silicone_markers):
        return "silicone"
    return "other"


_CATEGORY_STEP: dict[str, int] = {
    "primer": 10, "concealer": 30, "foundation": 40, "powder": 70,
    "blush": 80, "bronzer": 80, "contour": 80, "highlighter": 90,
    "eyeshadow": 50, "eyeliner": 60, "mascara": 70,
    "brow-pencil": 40, "brow-gel": 50,
    "lip-liner": 40, "lipstick": 50, "lip-gloss": 60,
    "setting-spray": 1000,
}
_FORMULA_OFFSET: dict[str, int] = {"water": 0, "other": 1, "silicone": 2}
_FORMULA_NOTES: dict[str, str] = {
    "water": "Apply first — water-based formula",
    "silicone": "Apply after water-based products — silicone-based formula",
}


def _build_application_order(products: list[ProductSnapshot]) -> list[ApplicationStep]:
    """
    Return a deterministic step-by-step application order for the build.
    Sorts by category step (setting-spray always last) then formula offset.
    """
    def _sort_key(p: ProductSnapshot) -> int:
        base = _CATEGORY_STEP.get(p.category, 500)
        offset = _FORMULA_OFFSET[_formula_type(p)]
        return base + offset

    sorted_products = sorted(products, key=_sort_key)

    steps: list[ApplicationStep] = []
    for idx, product in enumerate(sorted_products, start=1):
        formula = _formula_type(product)
        note = _FORMULA_NOTES.get(formula)
        steps.append(ApplicationStep(
            product_id=product.id,
            product_name=product.name,
            step=idx,
            note=note,
        ))
    return steps


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

                # Layering conflicts are only meaningful when both products are
                # applied to the same area of the face.  Skip cross-zone pairs.
                if pattern_a in _LAYERING_PATTERNS or pattern_b in _LAYERING_PATTERNS:
                    zone_a = _CATEGORY_ZONE.get(prod_a.category, "unknown")
                    zone_b = _CATEGORY_ZONE.get(prod_b.category, "unknown")
                    if zone_a != zone_b:
                        continue

                # Concentration check — if both triggering patterns appear at
                # position ≥ 15 in their respective INCI lists (trace level),
                # downgrade error → warning and annotate the reason.
                effective_severity = severity
                effective_reason = reason
                pos_a = min(
                    _ingredient_position(pattern_a, prod_a.inci_ingredients),
                    _ingredient_position(pattern_b, prod_a.inci_ingredients),
                )
                pos_b = min(
                    _ingredient_position(pattern_a, prod_b.inci_ingredients),
                    _ingredient_position(pattern_b, prod_b.inci_ingredients),
                )
                if severity == "error" and pos_a >= 15 and pos_b >= 15:
                    effective_severity = "warning"
                    effective_reason = reason + " (trace concentrations — lower risk)"

                # Flag both products in the pair
                for flagged_id, conflict_id in [
                    (prod_a.id, prod_b.id),
                    (prod_b.id, prod_a.id),
                ]:
                    if flagged_id not in results:
                        results[flagged_id] = CompatibilityResponse(
                            is_compatible=False,
                            reason=effective_reason,
                            severity=effective_severity,  # type: ignore[arg-type]
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
                            if effective_severity == "error" or existing.severity == "error"
                            else "warning"
                        )
                        results[flagged_id] = CompatibilityResponse(
                            is_compatible=False,
                            reason=existing.reason if existing.severity == new_severity else effective_reason,
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
    skin_type: str | None = None,
) -> dict[str, CompatibilityResponse]:
    """
    Call Gemini with structured output for nuanced gap-filling.
    Returns merged results where LLM can only raise severity, never lower it.
    """
    has_inci_data = any(p.inci_ingredients for p in products)

    # Build the ingredient summary for each product (with positional index for LLM context)
    product_summaries = []
    for p in products:
        if p.inci_ingredients:
            indexed_ings = ", ".join(
                f"{i + 1}. {ing}" for i, ing in enumerate(p.inci_ingredients[:30])
            )
            data_quality = "INCI ingredient list available"
        else:
            indexed_ings = ", ".join(p.specs or []) or "No ingredient data available"
            data_quality = "No INCI data — specs/description only"

        product_summaries.append(
            f"Product ID: {p.id}\n"
            f"Name: {p.name} by {p.brand}\n"
            f"Category: {p.category}\n"
            f"Data quality: {data_quality}\n"
            f"Ingredients/specs: {indexed_ings}"
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

    skin_type_section = (
        f"\nUSER SKIN TYPE: {skin_type}\n"
        "Flag any additional skin-type-specific risks not already captured above "
        "(e.g. heavy occlusives on oily skin, astringents on dry skin, irritants on sensitive skin)."
        if skin_type else ""
    )

    prompt = f"""You are a cosmetic chemist analyzing ingredient compatibility for a makeup build.

PRODUCTS IN BUILD:
{products_text}

RULE-BASED FINDINGS (already detected):
{rule_summary}
{data_warning}{skin_type_section}

TASK: Identify any additional formulation conflicts NOT already captured above.
Focus on:
- Silicone-based vs water-based layering order issues
- pH-sensitive actives (AHAs, BHAs, vitamin C, retinoids)
- Oxidizing agents conflicting with antioxidants or retinoids
- Oil-based vs water-based incompatibilities
- Finish conflicts (e.g. high-shine gloss over matte foundation)

Ingredient list positions are provided (1 = highest concentration). Ingredients at position ≥ 15
are present at trace levels — note this context when assessing severity.

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

async def run_chemist_analysis(
    products: list[ProductSnapshot],
    beauty_profile: BeautyProfileSnapshot | None = None,
) -> "ChemistOutput":
    """
    Run the full Chemist Agent pipeline:
    1. Rule pass against KNOWN_CONFLICTS (with concentration downgrade).
    2. Skin-type pass against SKIN_TYPE_RULES (if profile provided).
    3. LLM pass (Gemini) to fill gaps the rules miss.
    4. Build deterministic application order.

    Degrades gracefully when inci_ingredients is empty.
    """
    from app.schemas.compatibility import ChemistOutput  # local import to avoid circular

    if not products:
        return ChemistOutput(results={})

    skin_type = beauty_profile.skin_type if beauty_profile else None

    rule_findings = _run_rule_pass(products)

    if not rule_findings:
        logger.debug("No rule-based conflicts. Proceeding to LLM pass.")

    # Skin-type pass — rule findings take precedence on conflict
    skin_findings = _run_skin_type_pass(products, skin_type)
    combined: dict[str, CompatibilityResponse] = {**skin_findings}
    combined.update(rule_findings)

    try:
        merged = await _run_llm_pass(products, combined, skin_type=skin_type)
    except QuotaExceededError:
        # Return deterministic findings only; flag quota error for the frontend
        order = _build_application_order(products)
        return ChemistOutput(results=combined, quota_exceeded=True, application_order=order)

    order = _build_application_order(products)
    return ChemistOutput(results=merged, application_order=order)
