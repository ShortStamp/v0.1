"""
Artist Agent — detects aesthetic mismatches between products and the user's beauty profile,
plus horizontal (product-to-product) visual harmony checks.

Analysis pipeline:
  1. Requires beauty_profile — if None, returns empty results (quiz not taken).
  2. Rule pass: compare product finish/coverage/skin_type/undertone filters
     against the user's BeautyProfileSnapshot.
  3. Powder sandwich pass: cream/liquid over powder = physical failure (score cap 0.1).
  4. Glow check: cumulative luminosity > 12 across primer + foundation + highlighter.
  5. Under-eye check: matte concealer on dry/fine-line-prone skin without hydrating prep.
  6. Visual weight check: base load > 14 — multiple full-coverage layers → cakey finish.
  7. Color harmony check: warm + cool cheek products clash on the cheekbone.
  8. Flashback risk check: silica/zinc oxide/titanium dioxide in top-10 INCI → ghostly flash.
  9. Crease prediction check: hydrating formula without setting powder → migration.
  10. LLM pass: Gemini structured output for nuanced aesthetic gap-filling.
  11. Merge: LLM can only raise severity, never lower it.
"""
from __future__ import annotations

import logging
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.agents.base_agent import get_llm
from app.agents.chemist_agent import QuotaExceededError, _is_quota_error, _CATEGORY_STEP
from app.schemas.compatibility import (
    ArtistOutput,
    BeautyProfileSnapshot,
    CompatibilityResponse,
    ProductSnapshot,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Aesthetic mismatch rules
#
# Each entry: (profile_attr, profile_val_substr, filter_key, filter_val_substr, severity, reason)
#
# A rule fires for a product when:
#   - str(getattr(beauty_profile, profile_attr)).lower() contains profile_val_substr
#   - str(product.filters.get(filter_key, "")).lower() contains filter_val_substr
# ---------------------------------------------------------------------------

AESTHETIC_RULES: list[tuple[str, str, str, str, str, str]] = [
    # --- Finish vs skin type ---
    (
        "skin_type", "oily",
        "finish", "dewy",
        "warning",
        "Dewy finishes amplify shine on oily skin; a matte or natural finish will control oiliness better.",
    ),
    (
        "skin_type", "oily",
        "finish", "luminous",
        "warning",
        "Luminous finishes add shine; for oily skin a matte or satin finish provides better oil control.",
    ),
    (
        "skin_type", "dry",
        "finish", "matte",
        "warning",
        "Matte finishes can look dry and emphasize flakiness on dry skin; a dewy or satin finish is more flattering.",
    ),
    # --- Finish preference vs product finish ---
    (
        "finish", "matte",
        "finish", "dewy",
        "warning",
        "This product's dewy finish conflicts with your matte finish preference.",
    ),
    (
        "finish", "matte",
        "finish", "luminous",
        "warning",
        "This product's luminous finish conflicts with your matte finish preference.",
    ),
    (
        "finish", "dewy",
        "finish", "matte",
        "warning",
        "This product's matte finish conflicts with your preferred dewy finish.",
    ),
    (
        "finish", "natural",
        "finish", "glitter",
        "warning",
        "A glitter finish may be too bold for your natural finish preference.",
    ),
    # --- Coverage preference vs product coverage ---
    (
        "coverage", "light",
        "coverage", "full",
        "warning",
        "Full coverage exceeds your light coverage preference and may look heavy or cakey.",
    ),
    (
        "coverage", "full",
        "coverage", "sheer",
        "warning",
        "Sheer coverage won't meet your full coverage preference.",
    ),
    (
        "coverage", "full",
        "coverage", "light",
        "warning",
        "Light coverage won't meet your full coverage preference.",
    ),
    # --- Skin type targeted formula vs user skin type ---
    (
        "skin_type", "dry",
        "skin_type", "oily",
        "warning",
        "This formula targets oily skin and may be too mattifying or drying for your dry skin type.",
    ),
    (
        "skin_type", "oily",
        "skin_type", "dry",
        "warning",
        "This formula targets dry skin and may feel too rich or heavy on oily skin.",
    ),
    # --- Undertone mismatches (warning level — escalated to error for foundation/concealer below) ---
    (
        "undertone", "cool",
        "undertone", "warm",
        "warning",
        "This warm-toned formula may clash with your cool undertone; look for neutral or cool-toned shades.",
    ),
    (
        "undertone", "warm",
        "undertone", "cool",
        "warning",
        "This cool-toned formula may clash with your warm undertone; look for neutral or warm-toned shades.",
    ),
]

# Categories where undertone mismatches are escalated to error severity
_UNDERTONE_ERROR_CATEGORIES = frozenset({"foundation", "concealer"})


# ---------------------------------------------------------------------------
# Powder sandwich blocker — cream/liquid over powder = mud
# ---------------------------------------------------------------------------

# Categories that are always powder
_ALWAYS_POWDER = frozenset({"powder"})
# Categories that are inherently liquid/cream (no formula filter needed)
_INHERENTLY_LIQUID = frozenset({"concealer"})
# Categories that CAN be powder or cream/liquid based on formula filter
_FORMULA_VARIABLE = frozenset({"blush", "bronzer", "contour", "highlighter"})

# ---------------------------------------------------------------------------
# Visual weight check constants
# ---------------------------------------------------------------------------
_BASE_CATEGORIES = frozenset({"primer", "foundation", "concealer", "powder"})
_COVERAGE_WEIGHTS: dict[str, int] = {"sheer": 1, "light": 2, "medium": 3, "full": 5}
_PRIMER_DEFAULT_WEIGHT = 2
_POWDER_DEFAULT_WEIGHT = 1
_BASE_LOAD_THRESHOLD = 14

# Color harmony check constants
_CHEEK_CATEGORIES = frozenset({"blush", "bronzer", "highlighter", "contour"})

# Flashback risk check constants
_FLASHBACK_INGREDIENTS = frozenset({"silica", "zinc oxide", "titanium dioxide"})
_FLASHBACK_CATEGORIES = frozenset({"powder", "foundation"})
_FLASHBACK_TOP_N = 10

# Crease prediction check constants
_HYDRATING_FACE_CATEGORIES = frozenset({"foundation", "concealer", "primer"})


def _run_powder_sandwich_pass(
    products: list[ProductSnapshot],
) -> tuple[dict[str, CompatibilityResponse], bool]:
    """
    Detect cream/liquid products layered OVER powder products in the same zone.
    Returns (results_dict, has_physical_failure).
    """
    results: dict[str, CompatibilityResponse] = {}
    has_failure = False

    # Classify products as powder or liquid/cream
    powder_products: list[ProductSnapshot] = []
    liquid_products: list[ProductSnapshot] = []

    for p in products:
        formula = str(p.filters.get("formula", "")).lower()
        if p.category in _ALWAYS_POWDER or (p.category in _FORMULA_VARIABLE and formula == "powder"):
            powder_products.append(p)
        elif p.category in _INHERENTLY_LIQUID or (
            p.category in _FORMULA_VARIABLE and formula in ("cream", "liquid")
        ):
            liquid_products.append(p)

    # Check: liquid/cream product with higher step than a powder product
    from app.agents.chemist_agent import _CATEGORY_ZONE

    for liq in liquid_products:
        liq_step = _CATEGORY_STEP.get(liq.category, 500)
        liq_zone = _CATEGORY_ZONE.get(liq.category, "unknown")

        for pwd in powder_products:
            pwd_step = _CATEGORY_STEP.get(pwd.category, 500)
            pwd_zone = _CATEGORY_ZONE.get(pwd.category, "unknown")

            if liq_zone != pwd_zone or liq_step <= pwd_step:
                continue

            has_failure = True
            reason = (
                f"Texture Conflict: applying {liq.name} (cream/liquid) over "
                f"{pwd.name} (powder) creates mud — cream/liquid must go under powder."
            )[:300]
            if liq.id not in results:
                results[liq.id] = CompatibilityResponse(
                    is_compatible=False,
                    reason=reason,
                    severity="error",
                    source_agent="artist",
                    conflicting_product_ids=[pwd.id],
                )
            else:
                existing = results[liq.id]
                results[liq.id] = existing.model_copy(update={
                    "conflicting_product_ids": list({*existing.conflicting_product_ids, pwd.id}),
                })

    return results, has_failure


# ---------------------------------------------------------------------------
# Glow score — cumulative luminosity check
# ---------------------------------------------------------------------------

_GLOW_CATEGORIES = frozenset({"primer", "foundation", "highlighter"})


def _compute_glow_score(product: ProductSnapshot) -> int:
    """Compute a luminosity score (1-5) for a single product."""
    finish = str(product.filters.get("finish", "")).lower()
    intensity = str(product.filters.get("intensity", "")).lower()
    formula = str(product.filters.get("formula", "")).lower()
    cheek_cats = {"blush", "bronzer", "contour", "highlighter"}

    score = 1  # default

    if finish in ("dewy", "luminous"):
        score = 4
    elif finish == "satin":
        score = 3
    elif finish in ("shimmer", "glitter"):
        score = 5

    if intensity == "blinding":
        score = 5
    elif intensity == "intense":
        score = max(score, 4)
    elif intensity == "subtle":
        score = max(score, 2)

    if formula in ("cream", "liquid") and product.category in cheek_cats:
        score = min(score + 1, 5)

    return score


def _run_glow_check(
    products: list[ProductSnapshot],
) -> dict[str, CompatibilityResponse]:
    """
    Sum glow scores for primer + foundation + highlighter.
    If sum > 12 → flag all three with surface instability warning.
    """
    results: dict[str, CompatibilityResponse] = {}

    glow_products = [p for p in products if p.category in _GLOW_CATEGORIES]
    if not glow_products:
        return results

    total = sum(_compute_glow_score(p) for p in glow_products)

    if total > 12:
        all_ids = [p.id for p in glow_products]
        for p in glow_products:
            others = [pid for pid in all_ids if pid != p.id]
            results[p.id] = CompatibilityResponse(
                is_compatible=False,
                reason=(
                    f"Surface Instability: cumulative glow score {total}/15 — "
                    "excess luminosity causes grease migration and breakdown."
                ),
                severity="warning",
                source_agent="artist",
                conflicting_product_ids=others,
            )

    return results


# ---------------------------------------------------------------------------
# Under-eye aging check
# ---------------------------------------------------------------------------


def _run_under_eye_check(
    products: list[ProductSnapshot],
    profile: BeautyProfileSnapshot,
) -> dict[str, CompatibilityResponse]:
    """
    Flag full-coverage matte concealer on dry under-eyes without hydrating primer.
    Triggers when skin_type is dry OR concerns include dark_circles/dry_under_eye.
    """
    results: dict[str, CompatibilityResponse] = {}

    # Check trigger conditions
    concerns = [c.lower() for c in (profile.concerns or [])]
    skin_type = (profile.skin_type or "").lower()
    triggered = (
        skin_type == "dry"
        or "dark_circles" in concerns
        or "dry_under_eye" in concerns
        or "fine_lines" in concerns
    )
    if not triggered:
        return results

    # Find concealer with full coverage + matte finish
    concealers = [p for p in products if p.category == "concealer"]
    for conc in concealers:
        coverage = str(conc.filters.get("coverage", "")).lower()
        finish = str(conc.filters.get("finish", "")).lower()
        if coverage != "full" or finish != "matte":
            continue

        # Check if any primer has type=Hydrating
        has_hydrating_primer = any(
            p.category == "primer"
            and str(p.filters.get("type", "")).lower() == "hydrating"
            for p in products
        )
        if has_hydrating_primer:
            continue

        results[conc.id] = CompatibilityResponse(
            is_compatible=False,
            reason=(
                "Creasing/Aging Risk: full-coverage matte concealer on dry under-eyes "
                "without hydrating prep will settle into fine lines."
            ),
            severity="warning",
            source_agent="artist",
            conflicting_product_ids=[],
        )

    return results


# ---------------------------------------------------------------------------
# Visual weight balancer — detects cakey, mask-like base stacking
# ---------------------------------------------------------------------------


def _run_visual_weight_check(
    products: list[ProductSnapshot],
) -> dict[str, CompatibilityResponse]:
    """
    Assign coverage weight scores to base products and flag if total > 14.
    Prevents users from stacking multiple full-coverage base layers.
    """
    results: dict[str, CompatibilityResponse] = {}

    base_products = [p for p in products if p.category in _BASE_CATEGORIES]
    if not base_products:
        return results

    def _weight(p: ProductSnapshot) -> int:
        coverage = str(p.filters.get("coverage", "")).lower()
        if coverage in _COVERAGE_WEIGHTS:
            return _COVERAGE_WEIGHTS[coverage]
        # Fallback defaults by category
        if p.category == "primer":
            return _PRIMER_DEFAULT_WEIGHT
        if p.category == "powder":
            return _POWDER_DEFAULT_WEIGHT
        return 3  # medium fallback for foundation/concealer

    total = sum(_weight(p) for p in base_products)
    if total <= _BASE_LOAD_THRESHOLD:
        return results

    all_ids = [p.id for p in base_products]
    for p in base_products:
        others = [pid for pid in all_ids if pid != p.id]
        results[p.id] = CompatibilityResponse(
            is_compatible=False,
            reason=(
                f"Heavy Base Load: your base layer scores {total}/20 across "
                f"{len(base_products)} products. Stacking multiple full-coverage formulas "
                "creates a cakey, mask-like finish. Swap one product for a sheerer texture."
            )[:300],
            severity="warning",
            source_agent="artist",
            conflicting_product_ids=others,
        )

    return results


# ---------------------------------------------------------------------------
# Color harmony engine — warm/cool cheek clash detection
# ---------------------------------------------------------------------------


def _run_color_harmony_check(
    products: list[ProductSnapshot],
) -> dict[str, CompatibilityResponse]:
    """
    Flag warm-toned and cool-toned cheek products used together.
    Neutral undertone products are compatible with both.
    """
    results: dict[str, CompatibilityResponse] = {}

    cheek_products = [p for p in products if p.category in _CHEEK_CATEGORIES]
    if len(cheek_products) < 2:
        return results

    warm_products = [
        p for p in cheek_products
        if str(p.filters.get("undertone", "")).lower() == "warm"
    ]
    cool_products = [
        p for p in cheek_products
        if str(p.filters.get("undertone", "")).lower() == "cool"
    ]

    if not warm_products or not cool_products:
        return results

    # Both temperature families present — flag them against each other
    all_warm_ids = [p.id for p in warm_products]
    all_cool_ids = [p.id for p in cool_products]

    for p in warm_products:
        clash_name = cool_products[0].name
        results[p.id] = CompatibilityResponse(
            is_compatible=False,
            reason=(
                f"Color Harmony: mixing warm-toned {p.name} and cool-toned "
                f"{clash_name} on the cheekbone creates a muddy look. "
                "Stick to one color temperature family."
            )[:300],
            severity="warning",
            source_agent="artist",
            conflicting_product_ids=list(all_cool_ids),
        )

    for p in cool_products:
        clash_name = warm_products[0].name
        results[p.id] = CompatibilityResponse(
            is_compatible=False,
            reason=(
                f"Color Harmony: mixing warm-toned {clash_name} and cool-toned "
                f"{p.name} on the cheekbone creates a muddy look. "
                "Stick to one color temperature family."
            )[:300],
            severity="warning",
            source_agent="artist",
            conflicting_product_ids=list(all_warm_ids),
        )

    return results


# ---------------------------------------------------------------------------
# Flashback risk — high-concentration reflective ingredients in photos
# ---------------------------------------------------------------------------


def _run_flashback_risk_check(
    products: list[ProductSnapshot],
) -> dict[str, CompatibilityResponse]:
    """
    Flag powders and foundations whose top-10 INCI ingredients contain
    silica, zinc oxide, or titanium dioxide — these appear ghostly in flash.
    """
    results: dict[str, CompatibilityResponse] = {}

    target_products = [p for p in products if p.category in _FLASHBACK_CATEGORIES]
    for p in target_products:
        inci = p.inci_ingredients or []
        top_inci = [str(i).lower() for i in inci[:_FLASHBACK_TOP_N]]

        for ingredient in _FLASHBACK_INGREDIENTS:
            if any(ingredient in entry for entry in top_inci):
                results[p.id] = CompatibilityResponse(
                    is_compatible=False,
                    reason=(
                        f"Flashback Risk: {p.name} contains {ingredient} at high "
                        "concentration — this appears ghostly or white in flash photography."
                    )[:300],
                    severity="warning",
                    source_agent="artist",
                    conflicting_product_ids=[],
                )
                break  # one ingredient match is enough per product

    return results


# ---------------------------------------------------------------------------
# Crease/migration prediction — hydrating formula without setting powder
# ---------------------------------------------------------------------------


def _run_crease_prediction_check(
    products: list[ProductSnapshot],
) -> dict[str, CompatibilityResponse]:
    """
    Flag hydrating face formulas when no setting powder is in the build.
    Without a setter, hydrating formulas migrate into fine lines within hours.
    """
    results: dict[str, CompatibilityResponse] = {}

    has_powder = any(p.category == "powder" for p in products)
    if has_powder:
        return results

    face_products = [p for p in products if p.category in _HYDRATING_FACE_CATEGORIES]
    for p in face_products:
        product_type = str(p.filters.get("type", "")).lower()
        specs = str(p.filters.get("specs", "")).lower()
        formula = str(p.filters.get("formula", "")).lower()

        is_hydrating = product_type == "hydrating" or (
            "hydrating" in specs and formula in ("liquid", "cream")
        )
        if not is_hydrating:
            continue

        results[p.id] = CompatibilityResponse(
            is_compatible=False,
            reason=(
                f"Migration Risk: {p.name} is a hydrating (non-setting) formula. "
                "Without a setting powder in your build, it will migrate into fine "
                "lines and break down within 2–3 hours."
            )[:300],
            severity="warning",
            source_agent="artist",
            conflicting_product_ids=[],
        )

    return results


# ---------------------------------------------------------------------------
# LLM structured output schema
# ---------------------------------------------------------------------------

class _AestheticVerdict(BaseModel):
    product_id: str
    is_compatible: bool
    reason: str
    severity: Literal["warning", "error"]

    @field_validator("reason", mode="before")
    @classmethod
    def truncate_reason(cls, v: str) -> str:
        return v[:300] if isinstance(v, str) else v


class _ArtistLLMOutput(BaseModel):
    verdicts: list[_AestheticVerdict] = Field(
        default_factory=list,
        description=(
            "Aesthetic compatibility verdicts. Only include products with genuine mismatches "
            "against the user's beauty profile. Omit compatible products."
        ),
    )


# ---------------------------------------------------------------------------
# Rule pass
# ---------------------------------------------------------------------------

def _run_rule_pass(
    products: list[ProductSnapshot],
    profile: BeautyProfileSnapshot,
) -> dict[str, CompatibilityResponse]:
    """
    Check each product's filter attributes against the user's beauty profile.
    Returns product_id → CompatibilityResponse for mismatched products only.
    """
    results: dict[str, CompatibilityResponse] = {}

    for product in products:
        for (
            profile_attr,
            profile_substr,
            filter_key,
            filter_substr,
            severity,
            reason,
        ) in AESTHETIC_RULES:
            profile_val = str(getattr(profile, profile_attr, "") or "").lower()
            product_val = str(product.filters.get(filter_key, "") or "").lower()

            if profile_substr not in profile_val:
                continue
            if filter_substr not in product_val:
                continue

            # Escalate undertone mismatches to error for foundation/concealer
            effective_severity = severity
            effective_reason = reason
            if (
                filter_key == "undertone"
                and product.category in _UNDERTONE_ERROR_CATEGORIES
            ):
                effective_severity = "error"
                # Build a more specific reason for color integrity
                user_ut = profile_substr
                prod_ut = filter_substr
                effective_reason = (
                    f"Color Integrity Error: {prod_ut}-toned formula against your "
                    f"{user_ut} undertone creates visible color dissonance on the face."
                )

            # Rule fires — flag this product
            if product.id not in results:
                results[product.id] = CompatibilityResponse(
                    is_compatible=False,
                    reason=effective_reason,
                    severity=effective_severity,  # type: ignore[arg-type]
                    source_agent="artist",
                    conflicting_product_ids=[],
                )
            else:
                existing = results[product.id]
                new_severity = (
                    "error"
                    if effective_severity == "error" or existing.severity == "error"
                    else "warning"
                )
                # Keep the reason from the higher-severity rule
                keep_reason = (
                    effective_reason
                    if effective_severity == "error" and existing.severity != "error"
                    else existing.reason
                )
                results[product.id] = CompatibilityResponse(
                    is_compatible=False,
                    reason=keep_reason,
                    severity=new_severity,  # type: ignore[arg-type]
                    source_agent="artist",
                    conflicting_product_ids=[],
                )

    return results


# ---------------------------------------------------------------------------
# LLM pass
# ---------------------------------------------------------------------------

async def _run_llm_pass(
    products: list[ProductSnapshot],
    profile: BeautyProfileSnapshot,
    rule_findings: dict[str, CompatibilityResponse],
) -> dict[str, CompatibilityResponse]:
    """
    Call Gemini with structured output for nuanced aesthetic gap-filling.
    LLM can only raise severity, never lower it.
    """
    # Build a human-readable profile summary for the prompt
    profile_parts: list[str] = []
    if profile.skin_tone:
        profile_parts.append(f"Skin tone: {profile.skin_tone}")
    if profile.undertone:
        profile_parts.append(f"Undertone: {profile.undertone}")
    if profile.skin_type:
        profile_parts.append(f"Skin type: {profile.skin_type}")
    if profile.coverage:
        profile_parts.append(f"Coverage preference: {profile.coverage}")
    if profile.finish:
        profile_parts.append(f"Finish preference: {profile.finish}")
    if profile.budget:
        profile_parts.append(f"Budget: {profile.budget}")

    if not profile_parts:
        # No usable profile data — nothing for the LLM to evaluate against
        return rule_findings

    profile_summary = "\n".join(profile_parts)

    # Build product summaries
    product_summaries: list[str] = []
    for p in products:
        filter_text = (
            ", ".join(f"{k}: {v}" for k, v in p.filters.items() if v)
            or "No attribute data"
        )
        product_summaries.append(
            f"Product ID: {p.id}\n"
            f"Name: {p.name} by {p.brand}\n"
            f"Category: {p.category}\n"
            f"Attributes: {filter_text}"
        )

    rule_summary = (
        "\n".join(
            f"- Product {pid}: {resp.reason} (severity: {resp.severity})"
            for pid, resp in rule_findings.items()
        )
        if rule_findings
        else "No rule-based mismatches detected."
    )

    products_text = "\n\n".join(product_summaries)

    prompt = f"""You are a professional makeup artist and beauty consultant.
Analyze whether each product in this makeup build is aesthetically compatible with the user's beauty profile.

USER'S BEAUTY PROFILE:
{profile_summary}

PRODUCTS IN BUILD:
{products_text}

RULE-BASED FINDINGS (already detected, do not repeat):
{rule_summary}

TASK: Identify any additional aesthetic mismatches NOT already captured above.
Consider:
- Finish harmony: does the product finish suit the user's skin type and finish preference?
- Coverage alignment: does the coverage level match the user's stated preference?
- Color integrity: does the product's tone/undertone suit the user's skin tone and undertone? Undertone clashes on foundation/concealer are errors, not just warnings.
- Powder sandwich / texture layering violations (cream/liquid over powder = mud)
- Cumulative luminosity / grease risk from too many dewy/shimmer products
- Under-eye creasing from matte concealer over dry or fine-line-prone skin without hydrating prep
- Visual base load: multiple full-coverage base products creating a cakey, mask-like finish
- Color temperature: warm and cool-toned cheek products clashing on the cheekbone
- Flashback risk: high-concentration silica, zinc oxide, or titanium dioxide in powders
- Migration: hydrating (non-setting) formulas used without a setting powder
- Category-level aesthetics: e.g. heavy full-glam contouring over sheer base looks mismatched

STRICT EXCLUSIONS — do NOT flag these:
- Silicone-vs-water pilling, dimethicone, adhesion, layering physics — these are formulation
  chemistry and belong to the Chemist Agent. Do not add any pilling or silicone-related verdict.
- Conflicts already listed in RULE-BASED FINDINGS above — do not repeat or re-escalate them.
- Solid/wax/powder products for any layering reason — powders, pencils, mascaras do not pill.

Focus on genuine aesthetic incompatibilities against the user's profile. Be concise (max 250 chars per reason).
If no additional mismatches exist beyond the rule findings, return an empty verdicts list."""

    try:
        llm = get_llm()
        structured_llm = llm.with_structured_output(_ArtistLLMOutput)
        llm_output: _ArtistLLMOutput = await structured_llm.ainvoke(prompt)  # type: ignore[assignment]
    except Exception as exc:
        if _is_quota_error(exc):
            logger.warning("Gemini API quota exceeded (429) in Artist Agent: %s", exc)
            raise QuotaExceededError(str(exc)) from exc
        logger.warning("Artist LLM call failed, returning rule findings only: %s", exc)
        return rule_findings

    # Merge: LLM can only raise severity, never lower it.
    #
    # Post-LLM guards (three layers):
    # 1. Reject layering/pilling verdicts on ANY product — formulation is chemist territory.
    # 2. Reject layering/pilling verdicts on fixed-form categories (belt-and-suspenders).
    # 3. Reject escalation from warning→error if the existing warning came from a
    #    physical-texture rule pass (powder sandwich, glow, etc.) — the artist LLM
    #    is not permitted to override what the deterministic physical checks already decided.
    from app.agents.chemist_agent import _FIXED_FORM_CATEGORIES

    _LAYERING_KEYWORDS = frozenset({
        "silicone", "pilling", "pill", "water-based", "adhesion",
        "separation", "dimethicone", "cyclopentasiloxane", "cyclomethicone",
        "layering", "repel",
    })
    # Physical texture prefixes written by the artist physical passes into debug_trace
    _PHYSICAL_TRACE_PREFIXES = ("ARTIST PHYSICAL", "PHYSICAL")

    merged = dict(rule_findings)
    product_by_id = {p.id: p for p in products}

    for verdict in llm_output.verdicts:
        pid = verdict.product_id

        # Guard 0: reject hallucinated product IDs not in the build
        if pid not in product_by_id:
            logger.warning(
                "Artist LLM hallucinated unknown product ID %s — stripped",
                pid[:8],
            )
            continue

        product = product_by_id.get(pid)
        reason_lower = verdict.reason.lower()
        is_layering_verdict = any(kw in reason_lower for kw in _LAYERING_KEYWORDS)

        # Guard 1: layering/pilling is always the chemist's domain — strip from artist LLM
        if is_layering_verdict:
            logger.debug(
                "Artist LLM guard: stripped layering/pilling verdict on %s — chemist domain",
                pid[:8],
            )
            if pid in merged:
                merged[pid].debug_trace.append(
                    f"LLM STRIPPED: layering/pilling is chemist domain — {verdict.reason[:50]}"
                )
            continue

        # Guard 2: belt-and-suspenders for fixed-form categories
        if product and product.category in _FIXED_FORM_CATEGORIES:
            logger.debug(
                "Artist LLM guard: stripped verdict on fixed-form %s (%s)",
                product.category, product.name,
            )
            if pid in merged:
                merged[pid].debug_trace.append(
                    f"LLM STRIPPED: fixed-form guard — {verdict.reason[:50]}"
                )
            continue

        # Guard 3: block escalation of physical-texture rule verdicts
        if pid in merged and verdict.severity == "error" and merged[pid].severity == "warning":
            existing = merged[pid]
            if any(
                any(line.startswith(prefix) for prefix in _PHYSICAL_TRACE_PREFIXES)
                for line in existing.debug_trace
            ):
                logger.debug(
                    "Artist LLM guard: blocked escalation of physical-texture warning on %s",
                    pid[:8],
                )
                merged[pid].debug_trace.append(
                    f"LLM STRIPPED: physical-texture escalation blocked — rule pass verdict is authoritative ({verdict.reason[:50]})"
                )
                continue

        llm_resp = CompatibilityResponse(
            is_compatible=verdict.is_compatible,
            reason=verdict.reason,
            severity=verdict.severity,
            source_agent="artist",
            conflicting_product_ids=[],
        )

        if pid not in merged:
            merged[pid] = llm_resp
        else:
            existing = merged[pid]
            if verdict.severity == "error" and existing.severity == "warning":
                # LLM escalated to error — accept the upgrade (non-physical verdict)
                merged[pid] = CompatibilityResponse(
                    is_compatible=False,
                    reason=verdict.reason,
                    severity="error",
                    source_agent="artist",
                    conflicting_product_ids=existing.conflicting_product_ids,
                    debug_trace=existing.debug_trace + [f"LLM ADDED: escalated to error — {verdict.reason[:60]}"],
                )
                continue
            # Otherwise keep existing (same or higher severity already)
            merged[pid].debug_trace.append(f"LLM ADDED: {verdict.severity} — {verdict.reason[:60]}")

    return merged


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def run_artist_analysis(
    products: list[ProductSnapshot],
    beauty_profile: BeautyProfileSnapshot | None,
) -> ArtistOutput:
    """
    Run the full Artist Agent pipeline:
    1. Skip entirely if no beauty_profile (user hasn't taken the quiz).
    2. Rule pass against AESTHETIC_RULES.
    3. LLM pass (Gemini) to fill aesthetic gaps the rules miss.
    4. Merge results (LLM can only raise severity).

    Degrades gracefully when beauty_profile fields are sparse.
    """
    if not products:
        return ArtistOutput(results={})

    if beauty_profile is None:
        logger.debug("Artist Agent skipped: no beauty profile")
        pass_traces = {
            p.id: ["ARTIST PASS: skipped — no beauty profile (take the quiz for personalized aesthetic analysis)"]
            for p in products
        }
        return ArtistOutput(results={}, pass_traces=pass_traces)

    rule_findings = _run_rule_pass(products, beauty_profile)
    # Add trace for artist rule hits
    for pid, resp in rule_findings.items():
        resp.debug_trace.append(f"ARTIST RULE: {resp.reason[:70]}")

    # Physical interaction passes
    powder_results, has_physical_failure = _run_powder_sandwich_pass(products)
    glow_results = _run_glow_check(products)
    under_eye_results = _run_under_eye_check(products, beauty_profile)
    visual_weight_results = _run_visual_weight_check(products)
    color_harmony_results = _run_color_harmony_check(products)
    flashback_risk_results = _run_flashback_risk_check(products)
    crease_prediction_results = _run_crease_prediction_check(products)

    # Merge physical results into rule findings (higher severity wins)
    combined = dict(rule_findings)
    pass_labels = [
        "powder_sandwich", "glow_check", "under_eye",
        "visual_weight", "color_harmony", "flashback_risk", "crease_prediction",
    ]
    all_pass_results = [
        powder_results, glow_results, under_eye_results,
        visual_weight_results, color_harmony_results, flashback_risk_results,
        crease_prediction_results,
    ]
    for label, physical in zip(pass_labels, all_pass_results):
        for pid, resp in physical.items():
            resp.debug_trace.append(f"ARTIST PHYSICAL ({label}): {resp.reason[:60]}")
            if pid not in combined:
                combined[pid] = resp
            else:
                existing = combined[pid]
                if resp.severity == "error" and existing.severity == "warning":
                    resp.debug_trace = existing.debug_trace + resp.debug_trace
                    combined[pid] = resp
                elif resp.severity == existing.severity:
                    combined[pid] = existing.model_copy(update={
                        "conflicting_product_ids": list(
                            {*existing.conflicting_product_ids, *resp.conflicting_product_ids}
                        ),
                        "debug_trace": existing.debug_trace + resp.debug_trace,
                    })

    try:
        merged = await _run_llm_pass(products, beauty_profile, combined)
    except QuotaExceededError:
        pass_traces = _build_artist_pass_traces(products, combined, beauty_profile, quota_exceeded=True)
        return ArtistOutput(
            results=combined,
            has_physical_failure=has_physical_failure,
            quota_exceeded=True,
            pass_traces=pass_traces,
        )

    pass_traces = _build_artist_pass_traces(products, merged, beauty_profile)
    return ArtistOutput(results=merged, has_physical_failure=has_physical_failure, pass_traces=pass_traces)


def _build_artist_pass_traces(
    products: list[ProductSnapshot],
    results: dict[str, CompatibilityResponse],
    profile: BeautyProfileSnapshot | None,
    *,
    quota_exceeded: bool = False,
) -> dict[str, list[str]]:
    """
    Build debug traces for products that passed all artist checks (for frontend debug mode).
    """
    pass_traces: dict[str, list[str]] = {}
    for p in products:
        if p.id in results:
            continue
        trace = [
            "ARTIST PASS: aesthetic profile rules — no mismatches against beauty profile",
            "ARTIST PASS: physical checks — powder sandwich OK · glow OK · under-eye OK",
            "ARTIST PASS: visual weight — base load within threshold",
            "ARTIST PASS: color harmony — cheek temperature consistent",
            "ARTIST PASS: flashback risk — no high-concentration reflective ingredients in top INCI",
            "ARTIST PASS: crease prediction — formula/setter combination OK",
        ]
        if profile is None:
            trace.append("ARTIST PASS: LLM review skipped — no beauty profile")
        elif quota_exceeded:
            trace.append("ARTIST PASS: LLM review skipped — quota exceeded")
        else:
            trace.append("ARTIST PASS: LLM aesthetic review — no additional issues found")
        pass_traces[p.id] = trace
    return pass_traces
