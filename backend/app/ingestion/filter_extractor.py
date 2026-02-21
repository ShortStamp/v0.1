"""Filter value extraction from product names and descriptions.

Parses unstructured text to extract filter values like finish, coverage, type, etc.
"""

import re
from typing import Any


# Keyword patterns for each filter type with their corresponding values
# Each pattern maps to a specific filter value
FILTER_PATTERNS: dict[str, dict[str, list[str]]] = {
    "finish": {
        "Matte": [r"\bmatte\b", r"\bvelvet\b", r"\bflat\b"],
        "Dewy": [r"\bdewy\b", r"\bglow", r"\bluminous\b", r"\bradiant\b", r"\bshine\b", r"\bhd\b"],
        "Satin": [r"\bsatin\b", r"\bnatural\b", r"\bsoft\b"],
        "Glossy": [r"\bglossy\b", r"\bgloss\b", r"\bshiny\b"],
        "Shimmer": [r"\bshimmer", r"\bmetallic\b", r"\bpearlescent\b"],
        "Glitter": [r"\bglitter", r"\bsparkle"],
        "Luminous": [r"\bluminous\b", r"\bglow"],
    },
    "coverage": {
        "Light": [r"\blight\b", r"\bsheer\b", r"\btint", r"\bnatural\b"],
        "Medium": [r"\bmedium\b", r"\bbuildable\b"],
        "Full": [r"\bfull\b", r"\bheavy\b", r"\bopaque\b", r"\bhd\b", r"\bflawless\b"],
    },
    "skinType": {
        "Oily": [r"\boily\b"],
        "Dry": [r"\bdry\b", r"\bhydrat"],
        "Combination": [r"\bcombination\b"],
        "Normal": [r"\bnormal\b", r"\ball skin"],
    },
    "type": {
        # Primer types
        "Hydrating": [r"\bhydrat", r"\bmoistur", r"\bnourish"],
        "Mattifying": [r"\bmattify", r"\boil.control", r"\bpore.minimiz"],
        "Pore-Filling": [r"\bpore.fill", r"\bsmooth", r"\bblur"],
        "Color-Correcting": [r"\bcolor.correct", r"\bredness", r"\bbrighten"],
        # Powder types
        "Pressed": [r"\bpressed\b", r"\bcompact\b"],
        "Loose": [r"\bloose\b"],
        # Liner types
        "Pencil": [r"\bpencil\b"],
        "Liquid": [r"\bliquid\b", r"\bfluid\b"],
        "Gel": [r"\bgel\b"],
        "Felt-tip": [r"\bfelt.tip", r"\bmarker\b"],
        # Lipstick types
        "Bullet": [r"\bbullet\b", r"\bstick\b"],
    },
    "formula": {
        "Powder": [r"\bpowder\b"],
        "Cream": [r"\bcream", r"\bmousse\b"],
        "Liquid": [r"\bliquid\b", r"\bserum\b"],
        "Stick": [r"\bstick\b"],
    },
    "undertone": {
        "Warm": [r"\bwarm\b", r"\bgolden\b", r"\byellow\b"],
        "Cool": [r"\bcool\b", r"\bpink\b", r"\brosy\b"],
        "Neutral": [r"\bneutral\b", r"\bbeige\b"],
    },
    "waterproof": {
        "Yes": [r"\bwaterproof\b", r"\bwater.resistant", r"\blong.wear", r"\blong.last"],
        "No": [],  # Default if not mentioned
    },
    "effect": {
        "Volume": [r"\bvolume", r"\bvolumiz", r"\bfull", r"\bthick"],
        "Length": [r"\blength", r"\blong", r"\bextend"],
        "Curl": [r"\bcurl", r"\blift"],
    },
    "shimmer": {
        "Yes": [r"\bshimmer", r"\bglitter", r"\bmetallic", r"\bpearlescent"],
        "No": [r"\bmatte\b"],
    },
    "intensity": {
        "Subtle": [r"\bsubtle\b", r"\bsoft\b", r"\bnatural\b"],
        "Blinding": [r"\bblinding\b", r"\bintense\b", r"\bmetallic\b", r"\bextreme\b"],
    },
    "longWear": {
        "Yes": [r"\blong.wear", r"\blong.last", r"\ball.day", r"\b24.hour", r"\b16.hour"],
        "No": [],
    },
    "tinted": {
        "Yes": [r"\btinted\b", r"\bcolor"],
        "No": [r"\bclear\b", r"\btransparent\b"],
    },
    "plumping": {
        "Yes": [r"\bplump", r"\bfull", r"\bvolume"],
        "No": [],
    },
    "hold": {
        "Light": [r"\blight\b", r"\bsoft\b"],
        "Strong": [r"\bstrong\b", r"\bextreme\b", r"\bmaximum\b"],
    },
    "tipType": {
        "Ultra-fine": [r"\bultra.fine", r"\bprecise\b", r"\bmicro\b"],
        "Angled": [r"\bangle", r"\bslant"],
    },
    "spoolie": {
        "Yes": [r"\bspoolie\b", r"\bbrush\b"],
        "No": [],
    },
    "retractable": {
        "Yes": [r"\bretractable\b", r"\bautomatic\b"],
        "No": [r"\bsharpener\b"],
    },
    "paletteSize": {
        "Single": [r"\bsingle\b", r"\bmono\b"],
        "Quad": [r"\bquad\b", r"\b4.shade"],
        "6+": [r"\b6.shade", r"\b8.shade"],
        "12+": [r"\b12.shade", r"\bpalette\b"],
    },
    "colorFamily": {
        "Neutral": [r"\bneutral\b", r"\bnude\b", r"\bbeige\b", r"\bbrown\b"],
        "Warm": [r"\bwarm\b", r"\bgold", r"\bcopper\b", r"\borange\b"],
        "Cool": [r"\bcool\b", r"\bsilver\b", r"\bblue\b", r"\bpurple\b"],
        "Colorful": [r"\bcolorful\b", r"\bbright\b", r"\bvibrant\b"],
    },
}


# Category-specific filter keys
CATEGORY_FILTERS: dict[str, list[str]] = {
    "foundation": ["finish", "coverage", "skinType"],
    "concealer": ["coverage", "finish", "undertone"],
    "primer": ["type"],
    "powder": ["type", "finish"],
    "setting-spray": ["finish", "longWear"],
    "eyeshadow": ["finish", "paletteSize", "colorFamily"],
    "eyeliner": ["type", "waterproof"],
    "mascara": ["effect", "waterproof"],
    "false-lashes": [],  # Harder to extract from text
    "brow-pencil": ["tipType", "spoolie"],
    "brow-gel": ["tinted", "hold"],
    "contour": ["formula"],
    "bronzer": ["formula", "shimmer"],
    "blush": ["formula", "finish"],
    "highlighter": ["formula", "intensity"],
    "lip-liner": ["finish", "retractable"],
    "lipstick": ["finish", "type", "longWear"],
    "lip-gloss": ["finish", "tinted", "plumping"],
}


def extract_filters(
    category_key: str,
    product_name: str,
    description: str | None = None,
) -> dict[str, str]:
    """Extract filter values from product name and description.
    
    Args:
        category_key: Product category (e.g., 'foundation', 'mascara')
        product_name: Product name to parse
        description: Optional product description
        
    Returns:
        Dict of filter_key -> value (e.g., {'finish': 'Matte', 'coverage': 'Full'})
    """
    # Get relevant filter keys for this category
    relevant_filters = CATEGORY_FILTERS.get(category_key, [])
    if not relevant_filters:
        return {}
    
    # Combine text fields for analysis
    text = product_name.lower()
    if description:
        text += " " + description.lower()
    
    extracted: dict[str, str] = {}
    
    for filter_key in relevant_filters:
        if filter_key not in FILTER_PATTERNS:
            continue
            
        # Check each possible value for this filter
        for value, patterns in FILTER_PATTERNS[filter_key].items():
            # Skip empty pattern lists (used for negative defaults)
            if not patterns:
                continue
                
            # Check if any pattern matches
            for pattern in patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    extracted[filter_key] = value
                    break  # Found a match, move to next filter
            
            if filter_key in extracted:
                break  # Already found a value for this filter
    
    return extracted


def extract_filters_from_obf_product(
    category_key: str,
    obf_product: dict[str, Any],
) -> dict[str, str]:
    """Extract filters from Open Beauty Facts product data.
    
    Args:
        category_key: Product category
        obf_product: OBF API product dict
        
    Returns:
        Dict of filter_key -> value
    """
    name = obf_product.get("product_name", "")
    generic_name = obf_product.get("generic_name", "")
    description = generic_name if generic_name else None
    
    return extract_filters(category_key, name, description)
