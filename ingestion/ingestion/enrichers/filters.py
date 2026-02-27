"""Filter value extraction and persistence.

Parses product name + description to extract filter values (finish, coverage,
skin type, etc.) for all 18 categories, then saves them to product_filter_values.

Called immediately after every product upsert in all source scrapers.
"""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ingestion.models import Product, ProductFilterValue

# ──────────────────────────────────────────────────────────────────────────────
# Filter keyword patterns
# ──────────────────────────────────────────────────────────────────────────────

FILTER_PATTERNS: dict[str, dict[str, list[str]]] = {
    "finish": {
        "Matte":     [r"\bmatte\b", r"\bvelvet\b", r"\bflat\b"],
        "Dewy":      [r"\bdewy\b", r"\bglow", r"\bluminous\b", r"\bradiant\b", r"\bshine\b"],
        "Satin":     [r"\bsatin\b"],
        "Glossy":    [r"\bglossy\b", r"\bgloss\b", r"\bshiny\b"],
        "Shimmer":   [r"\bshimmer", r"\bmetallic\b", r"\bpearlescent\b"],
        "Glitter":   [r"\bglitter", r"\bsparkle"],
        "Luminous":  [r"\bluminous\b"],
    },
    "coverage": {
        "Light":  [r"\blight\b", r"\bsheer\b", r"\btint", r"\bnatural\b"],
        "Medium": [r"\bmedium\b", r"\bbuildable\b"],
        "Full":   [r"\bfull\b", r"\bheavy\b", r"\bopaque\b", r"\bhd\b", r"\bflawless\b"],
    },
    "skinType": {
        "Oily":        [r"\boily\b"],
        "Dry":         [r"\bdry\b", r"\bhydrat"],
        "Combination": [r"\bcombination\b"],
        "Normal":      [r"\bnormal\b", r"\ball skin"],
    },
    "type": {
        # Primer
        "Hydrating":       [r"\bhydrat", r"\bmoistur", r"\bnourish"],
        "Mattifying":      [r"\bmattify", r"\boil.control", r"\bpore.minimiz"],
        "Pore-Filling":    [r"\bpore.fill", r"\bsmooth", r"\bblur"],
        "Color-Correcting":[r"\bcolor.correct", r"\bredness", r"\bbrighten"],
        # Powder
        "Pressed":  [r"\bpressed\b", r"\bcompact\b"],
        "Loose":    [r"\bloose\b"],
        # Liner
        "Pencil":   [r"\bpencil\b"],
        "Liquid":   [r"\bliquid\b", r"\bfluid\b"],
        "Gel":      [r"\bgel\b"],
        "Felt-tip": [r"\bfelt.tip", r"\bmarker\b"],
        # Lipstick
        "Bullet":   [r"\bbullet\b", r"\bstick\b"],
    },
    "formula": {
        "Powder": [r"\bpowder\b"],
        "Cream":  [r"\bcream", r"\bmousse\b"],
        "Liquid": [r"\bliquid\b", r"\bserum\b"],
        "Stick":  [r"\bstick\b"],
    },
    "undertone": {
        "Warm":    [r"\bwarm\b", r"\bgolden\b", r"\byellow\b"],
        "Cool":    [r"\bcool\b", r"\bpink\b", r"\brosy\b"],
        "Neutral": [r"\bneutral\b", r"\bbeige\b"],
    },
    "waterproof": {
        "Yes": [r"\bwaterproof\b", r"\bwater.resistant", r"\blong.wear", r"\blong.last"],
    },
    "effect": {
        "Volume": [r"\bvolume", r"\bvolumiz", r"\bfull", r"\bthick"],
        "Length": [r"\blength", r"\blong", r"\bextend"],
        "Curl":   [r"\bcurl", r"\blift"],
    },
    "shimmer": {
        "Yes": [r"\bshimmer", r"\bglitter", r"\bmetallic", r"\bpearlescent"],
        "No":  [r"\bmatte\b"],
    },
    "intensity": {
        "Subtle":   [r"\bsubtle\b", r"\bsoft\b", r"\bnatural\b"],
        "Blinding": [r"\bblinding\b", r"\bintense\b", r"\bmetallic\b", r"\bextreme\b"],
        "Intense":  [r"\bintense\b", r"\bbold\b"],
    },
    "longWear": {
        "Yes": [r"\blong.wear", r"\blong.last", r"\ball.day", r"\b24.hour", r"\b16.hour"],
    },
    "tinted": {
        "Yes": [r"\btinted\b", r"\bcolor"],
        "No":  [r"\bclear\b", r"\btransparent\b"],
    },
    "plumping": {
        "Yes": [r"\bplump", r"\bvolume"],
    },
    "hold": {
        "Light":  [r"\blight\b", r"\bsoft\b"],
        "Strong": [r"\bstrong\b", r"\bextreme\b", r"\bmaximum\b"],
        "Flexible": [r"\bflexible\b"],
    },
    "tipType": {
        "Ultra-fine": [r"\bultra.fine", r"\bprecise\b", r"\bmicro\b"],
        "Angled":     [r"\bangle", r"\bslant"],
    },
    "spoolie": {
        "Yes": [r"\bspoolie\b", r"\bbrush\b"],
    },
    "retractable": {
        "Yes": [r"\bretractable\b", r"\bautomatic\b"],
        "No":  [r"\bsharpener\b"],
    },
    "paletteSize": {
        "Single": [r"\bsingle\b", r"\bmono\b"],
        "Quad":   [r"\bquad\b", r"\b4.shade"],
        "6+":     [r"\b6.shade", r"\b8.shade"],
        "12+":    [r"\b12.shade", r"\bpalette\b"],
    },
    "colorFamily": {
        "Neutral":  [r"\bneutral\b", r"\bnude\b", r"\bbeige\b", r"\bbrown\b"],
        "Warm":     [r"\bwarm\b", r"\bgold", r"\bcopper\b", r"\borange\b"],
        "Cool":     [r"\bcool\b", r"\bsilver\b", r"\bblue\b", r"\bpurple\b"],
        "Colorful": [r"\bcolorful\b", r"\bbright\b", r"\bvibrant\b"],
    },
    "material": {
        "Synthetic": [r"\bsynthetic\b"],
        "Mink":      [r"\bmink\b"],
        "Silk":      [r"\bsilk\b"],
    },
    "style": {
        "Natural":  [r"\bnatural\b"],
        "Dramatic": [r"\bdramatic\b"],
        "Wispy":    [r"\bwispy\b"],
    },
}

# Category → applicable filter keys
CATEGORY_FILTERS: dict[str, list[str]] = {
    "foundation":    ["finish", "coverage", "skinType"],
    "concealer":     ["coverage", "finish", "undertone"],
    "primer":        ["type"],
    "powder":        ["type", "finish"],
    "setting-spray": ["finish", "longWear"],
    "eyeshadow":     ["finish", "paletteSize", "colorFamily"],
    "eyeliner":      ["type", "waterproof"],
    "mascara":       ["effect", "waterproof"],
    "false-lashes":  ["style", "material"],
    "brow-pencil":   ["tipType", "spoolie"],
    "brow-gel":      ["tinted", "hold"],
    "contour":       ["formula"],
    "bronzer":       ["formula", "shimmer"],
    "blush":         ["formula", "finish"],
    "highlighter":   ["formula", "intensity"],
    "lip-liner":     ["finish", "retractable"],
    "lipstick":      ["finish", "type", "longWear"],
    "lip-gloss":     ["finish", "tinted", "plumping"],
}


def extract_filters(
    category_key: str,
    product_name: str,
    description: str | None = None,
) -> dict[str, str]:
    """Extract filter key→value pairs from product text."""
    relevant = CATEGORY_FILTERS.get(category_key, [])
    if not relevant:
        return {}

    text = product_name.lower()
    if description:
        text += " " + description.lower()

    extracted: dict[str, str] = {}
    for filter_key in relevant:
        patterns = FILTER_PATTERNS.get(filter_key, {})
        for value, regexes in patterns.items():
            if not regexes:
                continue
            for pattern in regexes:
                if re.search(pattern, text, re.IGNORECASE):
                    extracted[filter_key] = value
                    break
            if filter_key in extracted:
                break

    return extracted


async def extract_and_save(
    db: AsyncSession,
    product_id: str,
    category_key: str,
    product_name: str,
    description: str | None,
) -> None:
    """Extract filters and persist to product_filter_values. Replaces existing rows."""
    filters = extract_filters(category_key, product_name, description)
    if not filters:
        return

    # Delete existing filter values
    await db.execute(
        delete(ProductFilterValue).where(ProductFilterValue.product_id == product_id)
    )

    for key, value in filters.items():
        db.add(ProductFilterValue(
            product_id=product_id,
            filter_key=key,
            value=value,
        ))


async def backfill_missing_filters(db: AsyncSession) -> dict[str, Any]:
    """Batch job: extract filter values for all products that have none."""
    result = await db.execute(
        select(Product).where(
            Product.is_active == True,  # noqa: E712
        ).limit(2000)
    )
    products = result.scalars().all()

    processed = 0
    for product in products:
        existing = await db.execute(
            select(ProductFilterValue.product_id).where(
                ProductFilterValue.product_id == product.id
            ).limit(1)
        )
        if existing.scalar_one_or_none():
            continue  # Already has filter values

        await extract_and_save(
            db,
            product.id,
            product.category_key,
            product.name,
            product.description,
        )
        processed += 1

    await db.commit()
    return {"products_processed": processed}
