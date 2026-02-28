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

from pydantic import BaseModel, Field, field_validator

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
#
# Zone Isolation (critical):
#   - "lash" is its own zone.  Mascara adheres to hair/keratin cuticles,
#     NOT to skin.  It never physically layers with eyeliner or eyeshadow,
#     so silicone-in-mascara + water-in-liner is a ZERO interaction.
#   - "eye" covers products applied to the lid skin (shadow, liner).
#   - False lashes are adhesive-mounted, separate from both.
# ---------------------------------------------------------------------------

_CATEGORY_ZONE: dict[str, str] = {
    # Face base + complexion
    "foundation": "face", "concealer": "face", "primer": "face",
    "powder": "face", "setting-spray": "face",
    # Cheeks / contouring (still the face canvas)
    "blush": "face", "bronzer": "face", "highlighter": "face", "contour": "face",
    # Eye area — lid skin only
    "eyeshadow": "eye", "eyeliner": "eye",
    # Lash zone — adheres to hair, not skin
    "mascara": "lash", "false-lashes": "lash",
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
# Fixed-form (solid/wax) categories — exempt from silicone-vs-water pilling.
#
# Pilling happens when two liquid/cream films try to "knit" together on skin.
# Wax pencils, pressed/loose powders, and mascara are solid-state or
# wax-emulsion products that sit ON TOP of a film — they smudge or flake,
# but they do not pill.  Flagging dimethicone in an eyeliner pencil as a
# "pilling risk" against a water-based eyeshadow is technically wrong and
# makes the app look unreliable.
# ---------------------------------------------------------------------------

_FIXED_FORM_CATEGORIES: frozenset[str] = frozenset({
    "mascara", "eyeliner", "eyeshadow",
    "brow-pencil", "brow-gel",
    "powder",
    "lip-liner",
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


def _top5_contains(product: ProductSnapshot, markers: tuple[str, ...]) -> bool:
    """Check if any of the markers appear in the product's top-5 INCI ingredients."""
    top5 = [ing.lower() for ing in (product.inci_ingredients or [])[:5]]
    return any(m in ing for ing in top5 for m in markers)


# ---------------------------------------------------------------------------
# Solvency check — alcohol/solvent lifting risk
# ---------------------------------------------------------------------------

_SOLVENT_MARKERS = ("alcohol denat", "propanediol")
_SOLVENCY_TARGET_CATEGORIES = frozenset({"foundation", "concealer", "primer"})


def _run_solvency_pass(products: list[ProductSnapshot]) -> dict[str, CompatibilityResponse]:
    """
    For each product pair where B is in a later application step than A:
    If B's top-5 INCI contains a solvent AND A is a base category → flag A with lifting risk.
    """
    results: dict[str, CompatibilityResponse] = {}

    for prod_a in products:
        if prod_a.category not in _SOLVENCY_TARGET_CATEGORIES:
            continue
        step_a = _CATEGORY_STEP.get(prod_a.category, 500)

        for prod_b in products:
            if prod_b.id == prod_a.id:
                continue
            # Fixed-form products (pencils, powders, mascara) don't deliver
            # solvents to the skin film — skip them as a solvent source.
            if prod_b.category in _FIXED_FORM_CATEGORIES:
                continue
            step_b = _CATEGORY_STEP.get(prod_b.category, 500)
            if step_b <= step_a:
                continue

            if not _top5_contains(prod_b, _SOLVENT_MARKERS):
                continue

            # Flag prod_a — the base layer at risk of being dissolved
            reason = (
                f"Lifting Risk: {prod_b.name} contains solvent "
                f"(alcohol denat/propanediol) that can dissolve {prod_a.name} underneath."
            )[:300]
            if prod_a.id not in results:
                results[prod_a.id] = CompatibilityResponse(
                    is_compatible=False,
                    reason=reason,
                    severity="warning",
                    source_agent="chemist",
                    conflicting_product_ids=[prod_b.id],
                )
            else:
                existing = results[prod_a.id]
                results[prod_a.id] = existing.model_copy(update={
                    "conflicting_product_ids": list({*existing.conflicting_product_ids, prod_b.id}),
                })

    return results


# ---------------------------------------------------------------------------
# SPF anchor — oil-heavy SPF over water-based primer
# ---------------------------------------------------------------------------

_UV_FILTER_INCI = (
    "ethylhexyl methoxycinnamate", "zinc oxide", "titanium dioxide",
    "avobenzone", "homosalate", "octinoxate", "octocrylene",
)
_OIL_HEAVY_MARKERS = (
    "mineral oil", "caprylic/capric triglyceride", "isopropyl myristate",
    "ethylhexyl palmitate", "squalane",
)


def _run_spf_anchor_pass(products: list[ProductSnapshot]) -> dict[str, CompatibilityResponse]:
    """
    Detect oil-heavy SPF products. If a water-based primer exists in the build,
    flag the primer with a sliding risk error.
    """
    results: dict[str, CompatibilityResponse] = {}

    # Find SPF products (by INCI or name)
    spf_products: list[ProductSnapshot] = []
    for p in products:
        name_lower = p.name.lower()
        specs_lower = " ".join(p.specs or []).lower()
        has_uv_inci = _top5_contains(p, _UV_FILTER_INCI)
        has_spf_name = "spf" in name_lower or "spf" in specs_lower
        if has_uv_inci or has_spf_name:
            spf_products.append(p)

    # Check if any SPF product is oil-heavy
    oil_heavy_spf = [p for p in spf_products if _top5_contains(p, _OIL_HEAVY_MARKERS)]
    if not oil_heavy_spf:
        return results

    # Find water-based or hybrid primers in the build
    # (hybrid primers still have a water phase that won't adhere to oil)
    water_primers = [
        p for p in products
        if p.category == "primer" and _formula_type(p) in ("water", "hybrid")
    ]

    for primer in water_primers:
        for spf in oil_heavy_spf:
            reason = (
                f"Sliding Risk: water-based primer over oil-heavy SPF ({spf.name}) "
                "will not adhere — expect migration and breakdown."
            )[:300]
            if primer.id not in results:
                results[primer.id] = CompatibilityResponse(
                    is_compatible=False,
                    reason=reason,
                    severity="error",
                    source_agent="chemist",
                    conflicting_product_ids=[spf.id],
                )
            else:
                existing = results[primer.id]
                results[primer.id] = existing.model_copy(update={
                    "conflicting_product_ids": list({*existing.conflicting_product_ids, spf.id}),
                    "severity": "error",
                })

    return results


# ---------------------------------------------------------------------------
# Drying speed pilling — fast-drying over slow-drying in same zone
# ---------------------------------------------------------------------------

_FAST_DRY_MARKERS = ("alcohol denat", "sd alcohol", "isopropyl alcohol")
_SLOW_DRY_MARKERS = ("mineral oil", "petrolatum", "lanolin", "caprylic/capric triglyceride")


def _run_drying_speed_pass(products: list[ProductSnapshot]) -> dict[str, CompatibilityResponse]:
    """
    If a fast-drying product layers over a slow-drying product (same zone,
    later step) → flag with rolling/pilling risk.
    Skips fixed-form categories (pencils, powders, mascara) — they don't pill.
    """
    results: dict[str, CompatibilityResponse] = {}

    for slow_prod in products:
        if slow_prod.category in _FIXED_FORM_CATEGORIES:
            continue
        if not _top5_contains(slow_prod, _SLOW_DRY_MARKERS):
            continue
        slow_step = _CATEGORY_STEP.get(slow_prod.category, 500)
        slow_zone = _CATEGORY_ZONE.get(slow_prod.category, "unknown")

        for fast_prod in products:
            if fast_prod.id == slow_prod.id:
                continue
            if fast_prod.category in _FIXED_FORM_CATEGORIES:
                continue
            if not _top5_contains(fast_prod, _FAST_DRY_MARKERS):
                continue
            fast_step = _CATEGORY_STEP.get(fast_prod.category, 500)
            fast_zone = _CATEGORY_ZONE.get(fast_prod.category, "unknown")

            # Must be same zone and fast product applied later
            if fast_zone != slow_zone or fast_step <= slow_step:
                continue

            reason = (
                f"Rolling/Pilling Risk: fast-drying alcohol formula ({fast_prod.name}) "
                f"over slow-drying oil-rich cream ({slow_prod.name}) causes balling."
            )[:300]
            if fast_prod.id not in results:
                results[fast_prod.id] = CompatibilityResponse(
                    is_compatible=False,
                    reason=reason,
                    severity="warning",
                    source_agent="chemist",
                    conflicting_product_ids=[slow_prod.id],
                )
            else:
                existing = results[fast_prod.id]
                results[fast_prod.id] = existing.model_copy(update={
                    "conflicting_product_ids": list({*existing.conflicting_product_ids, slow_prod.id}),
                })

    return results


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
# Weighted formula classification — Polar vs Non-Polar
#
# INCI lists are ordered by concentration (highest first).  We compute a
# weighted score across two axes:
#
#   Weight(index) = 1.0 - (index * 0.2)      [index 0..4]
#
#     Position 0 → 1.0  (base of the formula)
#     Position 1 → 0.8
#     Position 2 → 0.6
#     Position 3 → 0.4
#     Position 4 → 0.2
#
# Polar score  — water / humectant phase
# Non-Polar score — silicones + heavy oils + esters + waxes (the "lipid" phase)
#
# The real conflict is Polar vs Non-Polar.  Silicone-vs-water is the most
# cited, but "Water + Oils" vs "Water + Silicones" pills just as badly.
# Grouping all non-polar film-formers into a single score catches the full
# range of incompatibilities.
#
# If the scores are within a 0.4 margin, the product is "hybrid" — a W/Si
# emulsion intentionally designed to bridge both phases.  Most modern
# foundations have water at #1 simply to keep the formula pourable, with
# the functional base being silicone/oil at positions 2-3.  A 0.4 gap
# accounts for this market reality.
# ---------------------------------------------------------------------------

_POLAR_MARKERS: tuple[str, ...] = ("aqua", "water", "eau")
_NONPOLAR_MARKERS: tuple[str, ...] = (
    # Silicones
    "dimethicone", "cyclopentasiloxane", "cyclomethicone", "trimethylsiloxysilicate",
    "cyclotetrasiloxane", "phenyl trimethicone", "caprylyl methicone",
    # Silicone-like volatile solvents
    "isododecane",
    # Heavy oils / esters / waxes that form a non-polar film
    "mineral oil", "paraffinum liquidum", "petrolatum",
    "isopropyl myristate", "isopropyl palmitate",
    "cetyl ethylhexanoate", "ethylhexyl palmitate",
    "caprylic/capric triglyceride",
    "isostearyl neopentanoate", "octyldodecanol",
)

_HYBRID_MARGIN = 0.4    # scores within this margin → candidate for hybrid
_HYBRID_MAX_RATIO = 2.0 # if dominant phase is ≥ 2× the other, it's NOT a hybrid
                        # regardless of the gap (e.g. polar=0.4 nonpolar=0.8 → silicone)


class FormulaProfile:
    """Weighted formula analysis for a single product."""
    __slots__ = ("polar_score", "nonpolar_score", "base_type")

    def __init__(self, product: ProductSnapshot) -> None:
        top5 = [ing.lower() for ing in (product.inci_ingredients or [])[:5]]
        p_score = 0.0
        np_score = 0.0
        for idx, ing in enumerate(top5):
            weight = 1.0 - (idx * 0.2)
            if any(m in ing for m in _POLAR_MARKERS):
                p_score += weight
            if any(m in ing for m in _NONPOLAR_MARKERS):
                np_score += weight
        self.polar_score = round(p_score, 2)
        self.nonpolar_score = round(np_score, 2)

        diff = abs(self.polar_score - self.nonpolar_score)
        if self.polar_score == 0.0 and self.nonpolar_score == 0.0:
            self.base_type: Literal["water", "silicone", "hybrid", "other"] = "other"
        elif diff <= _HYBRID_MARGIN and self.polar_score > 0 and self.nonpolar_score > 0:
            # Gap is within hybrid range — but also check the ratio.
            # If one phase is ≥ 2× the other the formula is phase-dominant, not a true
            # W/Si emulsion bridge.  e.g. polar=0.4 nonpolar=0.8 → silicone, not hybrid.
            ratio = max(self.nonpolar_score, self.polar_score) / min(self.nonpolar_score, self.polar_score)
            if ratio >= _HYBRID_MAX_RATIO:
                self.base_type = "silicone" if self.nonpolar_score > self.polar_score else "water"
            else:
                self.base_type = "hybrid"
        elif self.polar_score > self.nonpolar_score:
            self.base_type = "water"
        elif self.nonpolar_score > self.polar_score:
            self.base_type = "silicone"
        else:
            self.base_type = "hybrid"  # exact tie with both > 0

    @property
    def is_hybrid(self) -> bool:
        return self.base_type == "hybrid"

    # Back-compat aliases used in reason strings and LLM summaries
    @property
    def water_score(self) -> float:
        return self.polar_score

    @property
    def silicone_score(self) -> float:
        return self.nonpolar_score


def _formula_type(product: ProductSnapshot) -> str:
    """Classify a product's base formula using weighted INCI scoring."""
    return FormulaProfile(product).base_type


_CATEGORY_STEP: dict[str, int] = {
    "primer": 10, "concealer": 30, "foundation": 40, "powder": 70,
    "blush": 80, "bronzer": 80, "contour": 80, "highlighter": 90,
    "eyeshadow": 50, "eyeliner": 60, "mascara": 70,
    "brow-pencil": 40, "brow-gel": 50,
    "lip-liner": 40, "lipstick": 50, "lip-gloss": 60,
    "setting-spray": 1000,
}
# Hybrid sorts between water and silicone in application order
_FORMULA_OFFSET: dict[str, int] = {"water": 0, "hybrid": 1, "other": 2, "silicone": 3}
_FORMULA_NOTES: dict[str, str] = {
    "water": "Apply first — water-based formula",
    "hybrid": "Hybrid formula — compatible with both water and silicone layers",
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
        fp = FormulaProfile(product)
        note = _FORMULA_NOTES.get(fp.base_type)
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
    reason: str
    severity: Literal["warning", "error"]
    conflicting_product_ids: list[str] = Field(default_factory=list)

    @field_validator("reason", mode="before")
    @classmethod
    def truncate_reason(cls, v: str) -> str:
        return v[:300] if isinstance(v, str) else v


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

def _run_rule_pass(
    products: list[ProductSnapshot],
) -> tuple[dict[str, CompatibilityResponse], set[frozenset[str]]]:
    """
    Iterate all product pairs against KNOWN_CONFLICTS.

    Returns:
        (results, killed_pairs)
        - results      : product_id → CompatibilityResponse for flagged products only
        - killed_pairs : frozenset pairs where the rule pass made a definitive decision
                         (buffer-killed, hybrid-downgraded, or concentration-downgraded).
                         The LLM pass must not resurrect layering conflicts for these pairs.
    """
    results: dict[str, CompatibilityResponse] = {}
    # Pairs where the rule pass already issued a definitive verdict — LLM may not override.
    killed_pairs: set[frozenset[str]] = set()
    # Per-product trace accumulator — collects lines even across multiple pair checks
    traces: dict[str, list[str]] = {}

    # Pre-compute formula profiles for all products (used in traces + logic)
    profiles: dict[str, FormulaProfile] = {p.id: FormulaProfile(p) for p in products}

    # Log formula classification for every product
    for p in products:
        fp = profiles[p.id]
        traces.setdefault(p.id, []).append(
            f"FORMULA: {fp.base_type} — polar={fp.polar_score} nonpolar={fp.nonpolar_score} "
            f"(zone={_CATEGORY_ZONE.get(p.category, '?')}, "
            f"fixed_form={p.category in _FIXED_FORM_CATEGORIES})"
        )
        if p.inci_ingredients:
            top5 = [ing[:35] for ing in p.inci_ingredients[:5]]
            traces[p.id].append(f"INCI top-5: {top5}")

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
            fp_a = profiles[prod_a.id]
            fp_b = profiles[prod_b.id]

            for pattern_a, pattern_b, severity, reason in KNOWN_CONFLICTS:
                a_has_a = any(pattern_a in ing for ing in ings_a)
                b_has_b = any(pattern_b in ing for ing in ings_b)
                a_has_b = any(pattern_b in ing for ing in ings_a)
                b_has_a = any(pattern_a in ing for ing in ings_b)

                if not ((a_has_a and b_has_b) or (a_has_b and b_has_a)):
                    continue

                pair_label = f"{prod_a.name[:25]}×{prod_b.name[:25]}"

                # ── Gate: fixed-form + zone checks for layering patterns ──
                if pattern_a in _LAYERING_PATTERNS or pattern_b in _LAYERING_PATTERNS:
                    if (
                        prod_a.category in _FIXED_FORM_CATEGORIES
                        or prod_b.category in _FIXED_FORM_CATEGORIES
                    ):
                        msg = f"SKIP fixed-form: {pair_label} — {pattern_a}/{pattern_b} ignored (wax/powder/pencil)"
                        traces.setdefault(prod_a.id, []).append(msg)
                        traces.setdefault(prod_b.id, []).append(msg)
                        continue
                    zone_a = _CATEGORY_ZONE.get(prod_a.category, "unknown")
                    zone_b = _CATEGORY_ZONE.get(prod_b.category, "unknown")
                    if zone_a != zone_b:
                        msg = f"SKIP cross-zone: {pair_label} — zone {zone_a}≠{zone_b}"
                        traces.setdefault(prod_a.id, []).append(msg)
                        traces.setdefault(prod_b.id, []).append(msg)
                        continue

                # Pattern matched — start building the trace
                effective_severity = severity
                effective_reason = reason

                # Pre-compute is_layering here so all downgrade/kill logic can reference it
                is_layering = pattern_a in _LAYERING_PATTERNS or pattern_b in _LAYERING_PATTERNS

                traces.setdefault(prod_a.id, []).append(
                    f"MATCH: {pattern_a}+{pattern_b} → initial severity={severity}"
                )
                traces.setdefault(prod_b.id, []).append(
                    f"MATCH: {pattern_a}+{pattern_b} → initial severity={severity}"
                )

                # ── Concentration downgrade ──
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
                    msg = f"DOWNGRADE trace-conc: pos_a={pos_a} pos_b={pos_b} → warning"
                    traces[prod_a.id].append(msg)
                    traces[prod_b.id].append(msg)
                    # Rule pass made a definitive call — LLM cannot re-escalate this layering pair
                    if is_layering:
                        killed_pairs.add(frozenset({prod_a.id, prod_b.id}))

                # ── Hybrid de-escalation ──
                if effective_severity == "error" and is_layering:
                    if fp_a.is_hybrid or fp_b.is_hybrid:
                        effective_severity = "warning"
                        hybrid_name = prod_a.name if fp_a.is_hybrid else prod_b.name
                        fp_h = fp_a if fp_a.is_hybrid else fp_b
                        effective_reason = (
                            f"Reduced pilling risk: {hybrid_name} is a hybrid formula "
                            f"(polar {fp_h.polar_score}/non-polar {fp_h.nonpolar_score}) "
                            f"designed to bridge both base types — monitor but not critical."
                        )[:300]
                        _gap_h = abs(fp_h.polar_score - fp_h.nonpolar_score)
                        _ratio_h = (
                            max(fp_h.nonpolar_score, fp_h.polar_score)
                            / max(min(fp_h.nonpolar_score, fp_h.polar_score), 0.001)
                        )
                        msg = (
                            f"DOWNGRADE hybrid: {hybrid_name[:30]} is hybrid "
                            f"(polar={fp_h.polar_score}, nonpolar={fp_h.nonpolar_score}, "
                            f"gap={_gap_h:.2f}≤{_HYBRID_MARGIN}, ratio={_ratio_h:.1f}<{_HYBRID_MAX_RATIO}) → warning"
                        )
                        traces[prod_a.id].append(msg)
                        traces[prod_b.id].append(msg)
                        # Rule pass made a definitive call — LLM cannot re-escalate this layering pair
                        killed_pairs.add(frozenset({prod_a.id, prod_b.id}))

                # ── Protective Buffer ──
                if is_layering and effective_severity in ("error", "warning"):
                    step_a = _CATEGORY_STEP.get(prod_a.category, 500)
                    step_b = _CATEGORY_STEP.get(prod_b.category, 500)
                    lo_step, hi_step = min(step_a, step_b), max(step_a, step_b)
                    buffer_product = None
                    for p in products:
                        if p.id == prod_a.id or p.id == prod_b.id:
                            continue
                        p_step = _CATEGORY_STEP.get(p.category, 500)
                        if lo_step < p_step < hi_step and profiles[p.id].is_hybrid:
                            buffer_product = p
                            break
                    if buffer_product:
                        msg = (
                            f"KILLED by buffer: {buffer_product.name[:30]} (hybrid) sits between "
                            f"step {lo_step}..{hi_step} — conflict eliminated"
                        )
                        traces[prod_a.id].append(msg)
                        traces[prod_b.id].append(msg)
                        # Rule pass explicitly eliminated this conflict — LLM may not resurrect it
                        killed_pairs.add(frozenset({prod_a.id, prod_b.id}))
                        continue  # skip this conflict entirely

                # ── Final verdict trace ──
                msg = f"VERDICT: {effective_severity} — {effective_reason[:80]}"
                traces[prod_a.id].append(msg)
                traces[prod_b.id].append(msg)

                # Flag both products in the pair
                for flagged_id, conflict_id in [
                    (prod_a.id, prod_b.id),
                    (prod_b.id, prod_a.id),
                ]:
                    trace = traces.get(flagged_id, [])
                    if flagged_id not in results:
                        results[flagged_id] = CompatibilityResponse(
                            is_compatible=False,
                            reason=effective_reason,
                            severity=effective_severity,  # type: ignore[arg-type]
                            source_agent="chemist",
                            conflicting_product_ids=[conflict_id],
                            debug_trace=list(trace),
                        )
                    else:
                        existing = results[flagged_id]
                        new_conflicting = list(
                            {*existing.conflicting_product_ids, conflict_id}
                        )
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
                            debug_trace=list(trace),
                        )

    return results, killed_pairs


# ---------------------------------------------------------------------------
# LLM pass
# ---------------------------------------------------------------------------

async def _run_llm_pass(
    products: list[ProductSnapshot],
    rule_findings: dict[str, CompatibilityResponse],
    skin_type: str | None = None,
    killed_pairs: set[frozenset[str]] | None = None,
) -> dict[str, CompatibilityResponse]:
    """
    Call Gemini with structured output for nuanced gap-filling.
    Returns merged results where LLM can only raise severity, never lower it.

    killed_pairs: frozenset pairs where the rule pass made a definitive decision
    (buffer-killed, hybrid-downgraded, concentration-downgraded).  The LLM is
    not permitted to add or escalate layering conflicts for these pairs.
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

        fp = FormulaProfile(p)
        product_summaries.append(
            f"Product ID: {p.id}\n"
            f"Name: {p.name} by {p.brand}\n"
            f"Category: {p.category}\n"
            f"Formula base: {fp.base_type} (polar={fp.polar_score}, non-polar={fp.nonpolar_score})\n"
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
- Silicone-based vs water-based layering order issues (COMPLEXION ONLY — see exclusions below)
- pH-sensitive actives (AHAs, BHAs, vitamin C, retinoids)
- Oxidizing agents conflicting with antioxidants or retinoids
- Oil-based vs water-based incompatibilities (liquid/cream products on skin only)
- Solvency / lifting risks from alcohol-heavy products over base layers
- SPF + primer layering physics (oil-heavy sunscreen under water-based primer)
- Drying speed mismatches causing pilling (fast-drying alcohol over slow-drying oil)
- Application order impossibilities

FORMULA CLASSIFICATION: Each product has a polar (water) and non-polar (silicone/oil/ester) score.
- "water" = polar-dominant. "silicone" = non-polar-dominant. "hybrid" = balanced (gap ≤ 0.4).
- Hybrid formulas are W/Si emulsions designed to bridge both phases.
- Do NOT flag hybrid products for pilling as an error — at most a warning.
- If a hybrid product sits BETWEEN a water and silicone product in application order,
  it acts as a chemical bridge — do NOT flag ANY pilling conflict in that sequence.

CRITICAL EXCLUSIONS — do NOT flag these as conflicts:
- Mascara vs eyeliner: these are in separate interaction zones (lash vs lid skin).
  Mascara adheres to hair/keratin cuticles, not to eyeliner. Dimethicone in liner
  is a waterproofing benefit, not a conflict with mascara.
- Silicone/water pilling for SOLID-STATE products: pencils, powders, mascaras, and
  wax-based products do NOT form liquid films that can pill or separate. Only flag
  silicone-vs-water conflicts between liquid/cream products that must knit together
  on skin (primer, foundation, concealer, liquid blush, etc.).
- Any "conflict" between products that never physically touch each other on the face.
- LOCKED pairs (de-escalated or killed by the rule pass): if a product pair appears
  in the RULE-BASED FINDINGS above with a "KILLED by buffer", "DOWNGRADE hybrid",
  or "DOWNGRADE trace-conc" annotation, do NOT add a pilling/silicone/layering error
  for that pair. The rule engine already made a definitive physics-based judgment.
  You may flag entirely different categories of conflict (pH, actives, etc.) if warranted.

Ingredient list positions are provided (1 = highest concentration). Ingredients at position ≥ 15
are present at trace levels — note this context when assessing severity.

Only flag genuine chemical/formulation conflicts between products that physically layer.
Do not flag stylistic preferences. Do not flag solid/wax products for pilling.
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

    # Merge LLM results with rule findings (LLM can only raise severity).
    #
    # CRITICAL: The LLM sometimes ignores prompt instructions and flags
    # layering conflicts on fixed-form or cross-zone products anyway.
    # We hard-filter those out here so hallucinated verdicts never reach
    # the user.  Prompt compliance is aspirational; code is authoritative.
    merged = dict(rule_findings)

    # Build lookup for post-LLM filtering
    product_by_id = {p.id: p for p in products}

    # Layering-related keywords that should ONLY apply to liquid/cream
    # complexion products in the same zone — never to fixed-form categories.
    _LAYERING_KEYWORDS = frozenset({
        "silicone", "pilling", "pill", "water-based", "adhesion",
        "separation", "dimethicone", "cyclopentasiloxane", "cyclomethicone",
        "layering", "repel",
    })

    for verdict in llm_output.verdicts:
        pid = verdict.product_id

        # ── Guard 0: reject hallucinated product IDs not in the build ──
        if pid not in product_by_id:
            logger.warning(
                "Chemist LLM hallucinated unknown product ID %s — stripped",
                pid[:8],
            )
            continue

        product = product_by_id.get(pid)

        # ── Post-LLM guard: reject layering verdicts on fixed-form products ──
        if product and product.category in _FIXED_FORM_CATEGORIES:
            reason_lower = verdict.reason.lower()
            if any(kw in reason_lower for kw in _LAYERING_KEYWORDS):
                logger.debug(
                    "LLM guard: stripped layering verdict on fixed-form %s (%s): %s",
                    product.category, product.name, verdict.reason[:80],
                )
                if pid in merged:
                    merged[pid].debug_trace.append(
                        f"LLM STRIPPED: fixed-form guard blocked — {verdict.reason[:60]}"
                    )
                continue

        # ── Post-LLM guard: reject cross-zone layering verdicts ──
        if product and verdict.conflicting_product_ids:
            product_zone = _CATEGORY_ZONE.get(product.category, "unknown")
            reason_lower = verdict.reason.lower()
            is_layering_reason = any(kw in reason_lower for kw in _LAYERING_KEYWORDS)
            if is_layering_reason:
                all_cross_zone = all(
                    _CATEGORY_ZONE.get(
                        product_by_id[cid].category, "unknown"
                    ) != product_zone
                    for cid in verdict.conflicting_product_ids
                    if cid in product_by_id
                )
                if all_cross_zone:
                    logger.debug(
                        "LLM guard: stripped cross-zone layering verdict on %s (%s): %s",
                        product.category, product.name, verdict.reason[:80],
                    )
                    if pid in merged:
                        merged[pid].debug_trace.append(
                            f"LLM STRIPPED: cross-zone guard blocked — {verdict.reason[:60]}"
                        )
                    continue

        # ── Post-LLM guard: reject resurrection of rule-pass killed/de-escalated pairs ──
        # The rule pass records pairs it explicitly killed (buffer) or de-escalated
        # (hybrid formula, trace concentration).  The LLM must not add a new layering
        # error for these pairs — it already overrode what the rules decided.
        if killed_pairs and verdict.conflicting_product_ids:
            reason_lower = verdict.reason.lower()
            is_layering_reason = any(kw in reason_lower for kw in _LAYERING_KEYWORDS)
            if is_layering_reason:
                blocked_by = next(
                    (
                        cid for cid in verdict.conflicting_product_ids
                        if frozenset({pid, cid}) in killed_pairs
                    ),
                    None,
                )
                if blocked_by is not None:
                    logger.debug(
                        "LLM guard: stripped resurrection of killed pair (%s↔%s): %s",
                        pid[:8], blocked_by[:8], verdict.reason[:80],
                    )
                    if pid in merged:
                        merged[pid].debug_trace.append(
                            f"LLM STRIPPED: resurrection guard — rule pass already decided this pair ({verdict.reason[:50]})"
                        )
                    continue

        # Build LLM trace entry
        llm_trace = f"LLM ADDED: {verdict.severity} — {verdict.reason[:80]}"

        # Preserve existing debug_trace from rule pass
        existing_trace = list(merged[pid].debug_trace) if pid in merged else []
        existing_trace.append(llm_trace)

        llm_resp = CompatibilityResponse(
            is_compatible=verdict.is_compatible,
            reason=verdict.reason,
            severity=verdict.severity,
            source_agent="chemist",
            conflicting_product_ids=verdict.conflicting_product_ids,
            debug_trace=existing_trace,
        )

        if pid not in merged:
            merged[pid] = llm_resp
        else:
            existing = merged[pid]
            if verdict.severity == "error" and existing.severity == "warning":
                merged[pid] = CompatibilityResponse(
                    is_compatible=False,
                    reason=verdict.reason,
                    severity="error",
                    source_agent="chemist",
                    conflicting_product_ids=list(
                        {*existing.conflicting_product_ids, *verdict.conflicting_product_ids}
                    ),
                    debug_trace=existing_trace,
                )
            else:
                new_ids = list(
                    {*existing.conflicting_product_ids, *verdict.conflicting_product_ids}
                )
                merged[pid] = existing.model_copy(
                    update={"conflicting_product_ids": new_ids, "debug_trace": existing_trace}
                )

    return merged


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def _build_pass_traces(
    products: list[ProductSnapshot],
    results: dict[str, CompatibilityResponse],
    base_traces: dict[str, list[str]],
    *,
    quota_exceeded: bool = False,
) -> dict[str, list[str]]:
    """
    Build debug traces for products that passed all chemist checks.
    Each entry prepends the formula/INCI base trace, then appends a pass summary.
    """
    pass_traces: dict[str, list[str]] = {}
    n_products = len(products)
    for p in products:
        if p.id in results:
            continue
        trace = list(base_traces.get(p.id, []))
        pair_count = max(n_products - 1, 0)
        if quota_exceeded:
            trace.append(
                f"CHEMIST PASS: {pair_count} product pair(s) checked (rule pass only — LLM quota exceeded) — no conflicts"
            )
        else:
            trace.append(
                f"CHEMIST PASS: {pair_count} product pair(s) checked (rule + LLM) — no conflicts detected"
            )
        pass_traces[p.id] = trace
    return pass_traces


def _build_base_traces(products: list[ProductSnapshot]) -> dict[str, list[str]]:
    """
    Pre-compute formula profile trace lines for every product in the build.
    These are prepended to every CompatibilityResponse so the debug panel
    always shows what the system "sees" for each product regardless of
    which pass ultimately flags it.
    """
    traces: dict[str, list[str]] = {}
    for p in products:
        fp = FormulaProfile(p)
        lines: list[str] = [
            f"FORMULA: {fp.base_type} — polar={fp.polar_score} nonpolar={fp.nonpolar_score} "
            f"(zone={_CATEGORY_ZONE.get(p.category, '?')}, "
            f"fixed_form={p.category in _FIXED_FORM_CATEGORIES})",
        ]
        if p.inci_ingredients:
            top5 = [ing[:35] for ing in p.inci_ingredients[:5]]
            lines.append(f"INCI top-5: {top5}")
        else:
            lines.append("INCI: no data")
        traces[p.id] = lines
    return traces


def _inject_base_traces(
    results: dict[str, CompatibilityResponse],
    base_traces: dict[str, list[str]],
) -> dict[str, CompatibilityResponse]:
    """
    Prepend base formula traces to every result.  If a response already has
    traces from the rule pass, the base lines go first (deduped).
    """
    for pid, resp in results.items():
        base = base_traces.get(pid, [])
        if not base:
            continue
        # Dedupe: if the rule pass already logged these, skip them
        existing_set = set(resp.debug_trace)
        new_trace = [line for line in base if line not in existing_set]
        if new_trace:
            results[pid] = resp.model_copy(
                update={"debug_trace": new_trace + list(resp.debug_trace)}
            )
    return results


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

    # Pre-compute base traces for every product (formula profile + INCI top-5)
    base_traces = _build_base_traces(products)

    rule_findings, killed_pairs = _run_rule_pass(products)

    if not rule_findings:
        logger.debug("No rule-based conflicts. Proceeding to LLM pass.")

    # Skin-type pass — rule findings take precedence on conflict
    skin_findings = _run_skin_type_pass(products, skin_type)
    # Add trace for skin-type hits
    for pid, resp in skin_findings.items():
        resp.debug_trace.append(f"SKIN-TYPE: {skin_type} → {resp.reason[:60]}")

    combined: dict[str, CompatibilityResponse] = {**skin_findings}
    combined.update(rule_findings)

    # Physical interaction passes — merge into combined (higher severity wins)
    pass_names = ["solvency", "spf_anchor", "drying_speed"]
    for pass_name, physical_results in zip(pass_names, [
        _run_solvency_pass(products),
        _run_spf_anchor_pass(products),
        _run_drying_speed_pass(products),
    ]):
        for pid, resp in physical_results.items():
            # Tag the result with which pass created it
            resp.debug_trace.append(f"PHYSICAL ({pass_name}): {resp.reason[:60]}")
            if pid not in combined:
                combined[pid] = resp
            else:
                existing = combined[pid]
                if resp.severity == "error" and existing.severity == "warning":
                    # Carry forward existing traces when overwriting
                    resp.debug_trace = existing.debug_trace + resp.debug_trace
                    combined[pid] = resp
                elif resp.severity == existing.severity and resp.severity == "warning":
                    combined[pid] = existing.model_copy(update={
                        "conflicting_product_ids": list(
                            {*existing.conflicting_product_ids, *resp.conflicting_product_ids}
                        ),
                        "debug_trace": existing.debug_trace + resp.debug_trace,
                    })

    try:
        merged = await _run_llm_pass(products, combined, skin_type=skin_type, killed_pairs=killed_pairs)
    except QuotaExceededError:
        order = _build_application_order(products)
        combined = _inject_base_traces(combined, base_traces)
        pass_traces = _build_pass_traces(products, combined, base_traces, quota_exceeded=True)
        return ChemistOutput(results=combined, quota_exceeded=True, application_order=order, pass_traces=pass_traces)

    # Inject base formula traces into every final result
    merged = _inject_base_traces(merged, base_traces)

    # Build pass traces for compatible products (used by frontend debug mode)
    pass_traces = _build_pass_traces(products, merged, base_traces)

    order = _build_application_order(products)
    return ChemistOutput(results=merged, application_order=order, pass_traces=pass_traces)
