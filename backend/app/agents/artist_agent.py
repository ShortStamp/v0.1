"""
Artist Agent — detects aesthetic mismatches between products and the user's beauty profile.

Analysis pipeline:
  1. Requires beauty_profile — if None, returns empty results (quiz not taken).
  2. Rule pass: compare product finish/coverage/skin_type/undertone filters
     against the user's BeautyProfileSnapshot.
  3. LLM pass: Gemini structured output for nuanced aesthetic gap-filling.
  4. Merge: LLM can only raise severity, never lower it.
"""
from __future__ import annotations

import logging
from typing import Literal

from pydantic import BaseModel, Field

from app.agents.base_agent import get_llm
from app.agents.chemist_agent import QuotaExceededError, _is_quota_error
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
    # --- Undertone mismatches ---
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


# ---------------------------------------------------------------------------
# LLM structured output schema
# ---------------------------------------------------------------------------

class _AestheticVerdict(BaseModel):
    product_id: str
    is_compatible: bool
    reason: str = Field(..., max_length=300)
    severity: Literal["warning", "error"]


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

            # Rule fires — flag this product
            if product.id not in results:
                results[product.id] = CompatibilityResponse(
                    is_compatible=False,
                    reason=reason,
                    severity=severity,  # type: ignore[arg-type]
                    source_agent="artist",
                    conflicting_product_ids=[],
                )
            else:
                existing = results[product.id]
                new_severity = (
                    "error"
                    if severity == "error" or existing.severity == "error"
                    else "warning"
                )
                # Keep the reason from the higher-severity rule
                keep_reason = (
                    reason
                    if severity == "error" and existing.severity != "error"
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
- Shade compatibility: does the product's tone/undertone suit the user's skin tone and undertone?
- Category-level aesthetics: e.g. heavy full-glam contouring over sheer base looks mismatched
- Product combinations that clash visually (e.g. bold glitter eye + heavy concealer for daytime)

Focus on genuine compatibility issues, not personal taste. Be concise (max 250 chars per reason).
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

    # Merge: LLM can only raise severity, never lower it
    merged = dict(rule_findings)

    for verdict in llm_output.verdicts:
        pid = verdict.product_id
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
                # LLM escalated to error — accept the upgrade
                merged[pid] = CompatibilityResponse(
                    is_compatible=False,
                    reason=verdict.reason,
                    severity="error",
                    source_agent="artist",
                    conflicting_product_ids=[],
                )
            # Otherwise keep existing (same or higher severity already)

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
    if not products or beauty_profile is None:
        logger.debug(
            "Artist Agent skipped: %s",
            "no products" if not products else "no beauty profile",
        )
        return ArtistOutput(results={})

    rule_findings = _run_rule_pass(products, beauty_profile)

    try:
        merged = await _run_llm_pass(products, beauty_profile, rule_findings)
    except QuotaExceededError:
        # Return rule-based findings only; propagate quota flag upward
        return ArtistOutput(results=rule_findings, quota_exceeded=True)

    return ArtistOutput(results=merged)
