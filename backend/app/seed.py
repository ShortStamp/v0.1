"""Comprehensive seed script for ShortStamp Makeup.

Seeds:
  - 5 category groups (Base, Eyes, Brows, Cheeks, Lips)
  - 18 categories with filters
  - Brands
  - 36 sample products with prices, filter values
  - 5 retailers
  - 3 trends with associated products, videos, articles
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete

from app.database import async_session
from app.models.category import Category, CategoryFilter, CategoryGroup
from app.models.product import (
    Brand,
    PriceHistory,
    Product,
    ProductFilterValue,
    ProductPrice,
    ProductReview,
    Retailer,
)
from app.models.trend import Trend, TrendArticle, TrendProduct, TrendVideo

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Category definitions
# ---------------------------------------------------------------------------

GROUPS = [
    {"key": "base", "label": "Base", "sort_order": 0},
    {"key": "eyes", "label": "Eyes", "sort_order": 1},
    {"key": "brows", "label": "Brows", "sort_order": 2},
    {"key": "cheeks", "label": "Cheeks", "sort_order": 3},
    {"key": "lips", "label": "Lips", "sort_order": 4},
]

CATEGORIES = [
    # Base
    {"key": "foundation", "label": "Foundation", "group_key": "base", "sort_order": 0},
    {"key": "concealer", "label": "Concealer", "group_key": "base", "sort_order": 1},
    {"key": "primer", "label": "Primer", "group_key": "base", "sort_order": 2},
    {"key": "powder", "label": "Powder", "group_key": "base", "sort_order": 3},
    {"key": "setting-spray", "label": "Setting Spray", "group_key": "base", "sort_order": 4},
    # Eyes
    {"key": "eyeshadow", "label": "Eyeshadow", "group_key": "eyes", "sort_order": 0},
    {"key": "eyeliner", "label": "Eyeliner", "group_key": "eyes", "sort_order": 1},
    {"key": "mascara", "label": "Mascara", "group_key": "eyes", "sort_order": 2},
    {"key": "false-lashes", "label": "False Lashes", "group_key": "eyes", "sort_order": 3},
    # Brows
    {"key": "brow-pencil", "label": "Brow Pencil", "group_key": "brows", "sort_order": 0},
    {"key": "brow-gel", "label": "Brow Gel", "group_key": "brows", "sort_order": 1},
    # Cheeks
    {"key": "contour", "label": "Contour", "group_key": "cheeks", "sort_order": 0},
    {"key": "bronzer", "label": "Bronzer", "group_key": "cheeks", "sort_order": 1},
    {"key": "blush", "label": "Blush", "group_key": "cheeks", "sort_order": 2},
    {"key": "highlighter", "label": "Highlighter", "group_key": "cheeks", "sort_order": 3},
    # Lips
    {"key": "lip-liner", "label": "Lip Liner", "group_key": "lips", "sort_order": 0},
    {"key": "lipstick", "label": "Lipstick", "group_key": "lips", "sort_order": 1},
    {"key": "lip-gloss", "label": "Lip Gloss", "group_key": "lips", "sort_order": 2},
]

CATEGORY_FILTERS: dict[str, list[dict]] = {
    "foundation": [
        {"filter_key": "finish", "label": "Finish", "filter_type": "checkbox", "options": ["Matte", "Dewy", "Satin"]},
        {"filter_key": "coverage", "label": "Coverage", "filter_type": "checkbox", "options": ["Light", "Medium", "Full"]},
        {"filter_key": "skinType", "label": "Skin Type", "filter_type": "checkbox", "options": ["Oily", "Dry", "Combination", "Normal"]},
    ],
    "concealer": [
        {"filter_key": "coverage", "label": "Coverage", "filter_type": "checkbox", "options": ["Light", "Medium", "Full"]},
        {"filter_key": "finish", "label": "Finish", "filter_type": "checkbox", "options": ["Matte", "Dewy", "Natural"]},
        {"filter_key": "undertone", "label": "Undertone", "filter_type": "checkbox", "options": ["Warm", "Cool", "Neutral"]},
    ],
    "primer": [
        {"filter_key": "type", "label": "Type", "filter_type": "checkbox", "options": ["Hydrating", "Mattifying", "Pore-Filling", "Color-Correcting"]},
    ],
    "powder": [
        {"filter_key": "type", "label": "Type", "filter_type": "checkbox", "options": ["Pressed", "Loose"]},
        {"filter_key": "finish", "label": "Finish", "filter_type": "checkbox", "options": ["Matte", "Luminous"]},
    ],
    "setting-spray": [
        {"filter_key": "finish", "label": "Finish", "filter_type": "checkbox", "options": ["Matte", "Dewy", "Natural"]},
        {"filter_key": "longWear", "label": "Long-wear", "filter_type": "checkbox", "options": ["Yes", "No"]},
    ],
    "eyeshadow": [
        {"filter_key": "finish", "label": "Finish", "filter_type": "checkbox", "options": ["Matte", "Shimmer", "Glitter"]},
        {"filter_key": "paletteSize", "label": "Palette Size", "filter_type": "checkbox", "options": ["Single", "Quad", "6+", "12+"]},
        {"filter_key": "colorFamily", "label": "Color Family", "filter_type": "checkbox", "options": ["Neutral", "Warm", "Cool", "Colorful"]},
    ],
    "eyeliner": [
        {"filter_key": "type", "label": "Type", "filter_type": "checkbox", "options": ["Pencil", "Liquid", "Gel", "Felt-tip"]},
        {"filter_key": "waterproof", "label": "Waterproof", "filter_type": "checkbox", "options": ["Yes", "No"]},
    ],
    "mascara": [
        {"filter_key": "effect", "label": "Effect", "filter_type": "checkbox", "options": ["Volume", "Length", "Curl"]},
        {"filter_key": "waterproof", "label": "Waterproof", "filter_type": "checkbox", "options": ["Yes", "No"]},
    ],
    "false-lashes": [
        {"filter_key": "style", "label": "Style", "filter_type": "checkbox", "options": ["Natural", "Dramatic", "Wispy"]},
        {"filter_key": "material", "label": "Material", "filter_type": "checkbox", "options": ["Synthetic", "Mink", "Silk"]},
    ],
    "brow-pencil": [
        {"filter_key": "tipType", "label": "Tip Type", "filter_type": "checkbox", "options": ["Ultra-fine", "Angled"]},
        {"filter_key": "spoolie", "label": "Spoolie", "filter_type": "checkbox", "options": ["Yes", "No"]},
    ],
    "brow-gel": [
        {"filter_key": "tinted", "label": "Tinted", "filter_type": "checkbox", "options": ["Yes", "No"]},
        {"filter_key": "hold", "label": "Hold", "filter_type": "checkbox", "options": ["Light", "Strong"]},
    ],
    "contour": [
        {"filter_key": "formula", "label": "Formula", "filter_type": "checkbox", "options": ["Powder", "Cream", "Stick"]},
    ],
    "bronzer": [
        {"filter_key": "formula", "label": "Formula", "filter_type": "checkbox", "options": ["Powder", "Cream"]},
        {"filter_key": "shimmer", "label": "Shimmer", "filter_type": "checkbox", "options": ["Yes", "No"]},
    ],
    "blush": [
        {"filter_key": "formula", "label": "Formula", "filter_type": "checkbox", "options": ["Powder", "Cream", "Liquid"]},
        {"filter_key": "finish", "label": "Finish", "filter_type": "checkbox", "options": ["Matte", "Shimmer", "Satin"]},
    ],
    "highlighter": [
        {"filter_key": "formula", "label": "Formula", "filter_type": "checkbox", "options": ["Powder", "Cream", "Liquid"]},
        {"filter_key": "intensity", "label": "Intensity", "filter_type": "checkbox", "options": ["Subtle", "Blinding"]},
    ],
    "lip-liner": [
        {"filter_key": "finish", "label": "Finish", "filter_type": "checkbox", "options": ["Matte", "Creamy"]},
        {"filter_key": "retractable", "label": "Retractable", "filter_type": "checkbox", "options": ["Yes", "No"]},
    ],
    "lipstick": [
        {"filter_key": "finish", "label": "Finish", "filter_type": "checkbox", "options": ["Matte", "Satin", "Glossy"]},
        {"filter_key": "type", "label": "Type", "filter_type": "checkbox", "options": ["Bullet", "Liquid"]},
        {"filter_key": "longWear", "label": "Long-wear", "filter_type": "checkbox", "options": ["Yes", "No"]},
    ],
    "lip-gloss": [
        {"filter_key": "finish", "label": "Finish", "filter_type": "checkbox", "options": ["Shimmer", "Clear", "Cream"]},
        {"filter_key": "tinted", "label": "Tinted", "filter_type": "checkbox", "options": ["Yes", "No"]},
        {"filter_key": "plumping", "label": "Plumping", "filter_type": "checkbox", "options": ["Yes", "No"]},
    ],
}

# ---------------------------------------------------------------------------
# Brand definitions
# ---------------------------------------------------------------------------

BRANDS = [
    {"name": "Giorgio Armani", "slug": "giorgio-armani"},
    {"name": "Maybelline", "slug": "maybelline"},
    {"name": "NARS", "slug": "nars"},
    {"name": "Tarte", "slug": "tarte"},
    {"name": "Tatcha", "slug": "tatcha"},
    {"name": "Smashbox", "slug": "smashbox"},
    {"name": "Laura Mercier", "slug": "laura-mercier"},
    {"name": "Coty", "slug": "coty"},
    {"name": "Glossier", "slug": "glossier"},
    {"name": "Rare Beauty", "slug": "rare-beauty"},
    {"name": "Benefit", "slug": "benefit"},
    {"name": "Physician's Formula", "slug": "physicians-formula"},
    {"name": "Fenty Beauty", "slug": "fenty-beauty"},
    {"name": "Dior", "slug": "dior"},
    {"name": "NYX", "slug": "nyx"},
    {"name": "Urban Decay", "slug": "urban-decay"},
    {"name": "Anastasia Beverly Hills", "slug": "anastasia-beverly-hills"},
    {"name": "Stila", "slug": "stila"},
    {"name": "Too Faced", "slug": "too-faced"},
    {"name": "Ardell", "slug": "ardell"},
    {"name": "Lilly Lashes", "slug": "lilly-lashes"},
    {"name": "MAC Cosmetics", "slug": "mac-cosmetics"},
    {"name": "Charlotte Tilbury", "slug": "charlotte-tilbury"},
    {"name": "e.l.f.", "slug": "elf"},
    {"name": "KVD Vegan Beauty", "slug": "kvd-vegan-beauty"},
    {"name": "Natasha Denona", "slug": "natasha-denona"},
    {"name": "Lancôme", "slug": "lancome"},
    {"name": "Kiss", "slug": "kiss"},
    {"name": "Got2b", "slug": "got2b"},
]

# ---------------------------------------------------------------------------
# Retailer definitions
# ---------------------------------------------------------------------------

RETAILERS = [
    {"name": "Sephora", "slug": "sephora", "base_url": "https://www.sephora.com"},
    {"name": "Ulta Beauty", "slug": "ulta-beauty", "base_url": "https://www.ulta.com"},
    {"name": "Amazon", "slug": "amazon", "base_url": "https://www.amazon.com"},
    {"name": "Nordstrom", "slug": "nordstrom", "base_url": "https://www.nordstrom.com"},
    {"name": "Walmart", "slug": "walmart", "base_url": "https://www.walmart.com"},
]

# ---------------------------------------------------------------------------
# Product definitions — 2 per category = 36 products
# ---------------------------------------------------------------------------

SEED_PRODUCTS = [
    # Foundation
    {"name": "Luminous Silk Foundation", "brand": "Giorgio Armani", "category": "foundation", "stamp_score": 94,
     "description": "Award-winning lightweight foundation with buildable, luminous coverage.",
     "specs": ["Micro-fil technology", "40 shades", "Oil-free"],
     "filters": {"finish": "Satin", "coverage": "Medium", "skinType": "Normal"},
     "prices": [("Sephora", 65.00), ("Nordstrom", 65.00), ("Amazon", 59.00)]},
    {"name": "Fit Me Matte + Poreless", "brand": "Maybelline", "category": "foundation", "stamp_score": 82,
     "description": "Lightweight foundation that mattifies and refines pores for a natural finish.",
     "filters": {"finish": "Matte", "coverage": "Medium", "skinType": "Oily"},
     "prices": [("Ulta Beauty", 9.49), ("Amazon", 7.99), ("Walmart", 7.97)]},
    # Concealer
    {"name": "Radiant Creamy Concealer", "brand": "NARS", "category": "concealer", "stamp_score": 91,
     "description": "Multi-action concealer that corrects, contours, highlights, and perfects.",
     "filters": {"coverage": "Medium", "finish": "Dewy", "undertone": "Neutral"},
     "prices": [("Sephora", 32.00), ("Nordstrom", 32.00)]},
    {"name": "Shape Tape Concealer", "brand": "Tarte", "category": "concealer", "stamp_score": 88,
     "description": "Full-coverage concealer with a matte finish for a flawless look.",
     "filters": {"coverage": "Full", "finish": "Matte", "undertone": "Warm"},
     "prices": [("Ulta Beauty", 30.00), ("Sephora", 30.00)]},
    # Primer
    {"name": "The Silk Canvas", "brand": "Tatcha", "category": "primer", "stamp_score": 90,
     "description": "Velvety primer balm that fills pores and smooths skin.",
     "filters": {"type": "Pore-Filling"},
     "prices": [("Sephora", 52.00)]},
    {"name": "Photo Finish Primer", "brand": "Smashbox", "category": "primer", "stamp_score": 84,
     "description": "Lightweight, oil-free primer that smooths and blurs for a photo-ready finish.",
     "filters": {"type": "Pore-Filling"},
     "prices": [("Sephora", 39.00), ("Ulta Beauty", 39.00)]},
    # Powder
    {"name": "Translucent Loose Setting Powder", "brand": "Laura Mercier", "category": "powder", "stamp_score": 93,
     "description": "Lightweight, silky powder that sets makeup for up to 16 hours.",
     "filters": {"type": "Loose", "finish": "Matte"},
     "prices": [("Sephora", 43.00), ("Nordstrom", 43.00)]},
    {"name": "Airspun Loose Face Powder", "brand": "Coty", "category": "powder", "stamp_score": 78,
     "description": "Classic loose powder that provides a flawless, soft finish.",
     "filters": {"type": "Loose", "finish": "Matte"},
     "prices": [("Amazon", 8.97), ("Walmart", 7.97)]},
    # Setting Spray
    {"name": "All Nighter Setting Spray", "brand": "Urban Decay", "category": "setting-spray", "stamp_score": 92,
     "description": "Long-lasting setting spray that keeps makeup in place for up to 16 hours.",
     "filters": {"finish": "Natural", "longWear": "Yes"},
     "prices": [("Sephora", 36.00), ("Ulta Beauty", 36.00)]},
    {"name": "Matte Finish Setting Spray", "brand": "NYX", "category": "setting-spray", "stamp_score": 80,
     "description": "Lightweight matte setting spray that controls shine all day.",
     "filters": {"finish": "Matte", "longWear": "Yes"},
     "prices": [("Ulta Beauty", 9.50), ("Amazon", 7.99)]},
    # Eyeshadow
    {"name": "Soft Matte Eyeshadow Palette", "brand": "Urban Decay", "category": "eyeshadow", "stamp_score": 92,
     "description": "Versatile palette with 12 highly pigmented shades.",
     "specs": ["12 shades", "Matte & shimmer finishes", "Vegan formula"],
     "filters": {"finish": "Matte", "paletteSize": "12+", "colorFamily": "Neutral"},
     "prices": [("Sephora", 54.00), ("Ulta Beauty", 52.00), ("Amazon", 48.99)]},
    {"name": "Modern Renaissance Palette", "brand": "Anastasia Beverly Hills", "category": "eyeshadow", "stamp_score": 96,
     "description": "Iconic palette featuring 14 shades in warm berry and neutral tones.",
     "filters": {"finish": "Shimmer", "paletteSize": "12+", "colorFamily": "Warm"},
     "prices": [("Sephora", 45.00), ("Ulta Beauty", 45.00)]},
    # Eyeliner
    {"name": "Stay All Day Waterproof Liner", "brand": "Stila", "category": "eyeliner", "stamp_score": 90,
     "description": "Felt-tip liquid liner for precise, smudge-proof lines.",
     "filters": {"type": "Felt-tip", "waterproof": "Yes"},
     "prices": [("Sephora", 23.00), ("Ulta Beauty", 23.00)]},
    {"name": "Epic Ink Liner", "brand": "NYX", "category": "eyeliner", "stamp_score": 85,
     "description": "Waterproof liquid liner with a flexible brush tip.",
     "filters": {"type": "Liquid", "waterproof": "Yes"},
     "prices": [("Ulta Beauty", 9.00), ("Amazon", 7.49)]},
    # Mascara
    {"name": "Lash Sensational Mascara", "brand": "Maybelline", "category": "mascara", "stamp_score": 80,
     "description": "Fan-effect mascara for volume, length, and a full-fan effect.",
     "filters": {"effect": "Volume", "waterproof": "No"},
     "prices": [("Ulta Beauty", 9.99), ("Amazon", 7.98)]},
    {"name": "Better Than Sex Mascara", "brand": "Too Faced", "category": "mascara", "stamp_score": 89,
     "description": "Volumizing mascara for dramatic, full lashes.",
     "filters": {"effect": "Volume", "waterproof": "No"},
     "prices": [("Sephora", 29.00), ("Ulta Beauty", 29.00)]},
    # False Lashes
    {"name": "Demi Wispies", "brand": "Ardell", "category": "false-lashes", "stamp_score": 84,
     "description": "Natural-looking, wispy false lash for everyday wear.",
     "filters": {"style": "Wispy", "material": "Synthetic"},
     "prices": [("Ulta Beauty", 4.99), ("Amazon", 3.49)]},
    {"name": "Miami Lashes", "brand": "Lilly Lashes", "category": "false-lashes", "stamp_score": 91,
     "description": "Dramatic 3D mink lash for bold, glamorous looks.",
     "filters": {"style": "Dramatic", "material": "Mink"},
     "prices": [("Sephora", 30.00)]},
    # Brow Pencil
    {"name": "Brow Wiz", "brand": "Anastasia Beverly Hills", "category": "brow-pencil", "stamp_score": 85,
     "description": "Ultra-slim, retractable pencil for precise, hair-like strokes.",
     "specs": ["Ultra-fine tip", "Built-in spoolie", "12 shades"],
     "filters": {"tipType": "Ultra-fine", "spoolie": "Yes"},
     "prices": [("Sephora", 25.00), ("Ulta Beauty", 25.00), ("Amazon", 22.50)]},
    {"name": "Precisely, My Brow Pencil", "brand": "Benefit", "category": "brow-pencil", "stamp_score": 87,
     "description": "Ultra-fine brow pencil for natural-looking, defined brows.",
     "filters": {"tipType": "Ultra-fine", "spoolie": "Yes"},
     "prices": [("Sephora", 26.00), ("Ulta Beauty", 26.00)]},
    # Brow Gel
    {"name": "Boy Brow", "brand": "Glossier", "category": "brow-gel", "stamp_score": 86,
     "description": "Conditioning brow gel that thickens and shapes brows.",
     "filters": {"tinted": "Yes", "hold": "Light"},
     "prices": [("Sephora", 17.00)]},
    {"name": "Gimme Brow+", "brand": "Benefit", "category": "brow-gel", "stamp_score": 84,
     "description": "Tinted volumizing brow gel with micro-fibers.",
     "filters": {"tinted": "Yes", "hold": "Strong"},
     "prices": [("Sephora", 26.00), ("Ulta Beauty", 26.00)]},
    # Contour
    {"name": "Match Stix Contour Skinstick", "brand": "Fenty Beauty", "category": "contour", "stamp_score": 87,
     "description": "Creamy, blendable contour stick for precise sculpting.",
     "filters": {"formula": "Stick"},
     "prices": [("Sephora", 28.00)]},
    {"name": "Sculpt Contour Powder", "brand": "NYX", "category": "contour", "stamp_score": 79,
     "description": "Lightweight pressed powder for easy, natural-looking contour.",
     "filters": {"formula": "Powder"},
     "prices": [("Ulta Beauty", 10.00), ("Amazon", 8.49)]},
    # Bronzer
    {"name": "Hoola Matte Bronzer", "brand": "Benefit", "category": "bronzer", "stamp_score": 86,
     "description": "Matte bronzing powder for a natural sun-kissed glow.",
     "filters": {"formula": "Powder", "shimmer": "No"},
     "prices": [("Sephora", 30.00), ("Ulta Beauty", 30.00)]},
    {"name": "Butter Bronzer", "brand": "Physician's Formula", "category": "bronzer", "stamp_score": 83,
     "description": "Creamy, Brazilian butter-infused bronzer with a radiant glow.",
     "filters": {"formula": "Powder", "shimmer": "Yes"},
     "prices": [("Ulta Beauty", 16.49), ("Amazon", 12.99)]},
    # Blush
    {"name": "Cloud Paint", "brand": "Glossier", "category": "blush", "stamp_score": 88,
     "description": "Seamless, buildable gel-cream blush that gives a natural flush of color.",
     "filters": {"formula": "Cream", "finish": "Satin"},
     "prices": [("Sephora", 20.00)]},
    {"name": "Soft Pinch Liquid Blush", "brand": "Rare Beauty", "category": "blush", "stamp_score": 95,
     "description": "Weightless, long-lasting liquid blush with a soft, healthy flush.",
     "filters": {"formula": "Liquid", "finish": "Matte"},
     "prices": [("Sephora", 23.00)]},
    # Highlighter
    {"name": "Killawatt Highlighter", "brand": "Fenty Beauty", "category": "highlighter", "stamp_score": 92,
     "description": "Weightless, longwear cream-powder hybrid highlighter.",
     "filters": {"formula": "Powder", "intensity": "Blinding"},
     "prices": [("Sephora", 38.00)]},
    {"name": "Backstage Glow Face Palette", "brand": "Dior", "category": "highlighter", "stamp_score": 89,
     "description": "Multi-use highlighting palette with buildable, blendable shades.",
     "filters": {"formula": "Powder", "intensity": "Subtle"},
     "prices": [("Sephora", 45.00), ("Nordstrom", 45.00)]},
    # Lip Liner
    {"name": "Lip Cheat Liner", "brand": "Charlotte Tilbury", "category": "lip-liner", "stamp_score": 89,
     "description": "Smooth lip liner that defines, reshapes, and perfects lips.",
     "filters": {"finish": "Matte", "retractable": "Yes"},
     "prices": [("Sephora", 25.00), ("Nordstrom", 25.00)]},
    {"name": "Suede Matte Lip Liner", "brand": "NYX", "category": "lip-liner", "stamp_score": 81,
     "description": "Creamy, matte lip liner with rich pigmentation.",
     "filters": {"finish": "Matte", "retractable": "No"},
     "prices": [("Ulta Beauty", 5.00), ("Amazon", 4.49)]},
    # Lipstick
    {"name": "Matte Lipstick", "brand": "MAC Cosmetics", "category": "lipstick", "stamp_score": 90,
     "description": "Iconic matte lipstick with rich, long-lasting color.",
     "filters": {"finish": "Matte", "type": "Bullet", "longWear": "Yes"},
     "prices": [("Nordstrom", 23.00), ("Ulta Beauty", 23.00)]},
    {"name": "Pillow Talk Lipstick", "brand": "Charlotte Tilbury", "category": "lipstick", "stamp_score": 93,
     "description": "Dreamy nude-pink lipstick with a satin, kissable finish.",
     "filters": {"finish": "Satin", "type": "Bullet", "longWear": "No"},
     "prices": [("Sephora", 35.00), ("Nordstrom", 35.00)]},
    # Lip Gloss
    {"name": "Lip Glow Oil", "brand": "Dior", "category": "lip-gloss", "stamp_score": 97,
     "description": "Nourishing lip oil that enhances natural lip color with a glossy finish.",
     "filters": {"finish": "Clear", "tinted": "Yes", "plumping": "No"},
     "prices": [("Sephora", 40.00), ("Nordstrom", 40.00)]},
    {"name": "Gloss Bomb", "brand": "Fenty Beauty", "category": "lip-gloss", "stamp_score": 91,
     "description": "Universally flattering lip luminizer with explosive shine.",
     "filters": {"finish": "Shimmer", "tinted": "Yes", "plumping": "No"},
     "prices": [("Sephora", 21.00)]},
]

# ---------------------------------------------------------------------------
# Trend definitions
# ---------------------------------------------------------------------------

SEED_TRENDS = [
    {
        "name": "Clean Girl Aesthetic",
        "slug": "clean-girl-aesthetic",
        "stamp_score": 95,
        "direction": "rising",
        "description": "A minimalist, fresh-faced look emphasizing dewy skin, brushed brows, and subtle lip color.",
        "products": ["Cloud Paint", "Pillow Talk Lipstick", "Luminous Silk Foundation"],
        "videos": [
            {"title": "Clean Girl Makeup Tutorial", "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
            {"title": "Get Ready With Me: Clean Girl", "url": "https://www.youtube.com/watch?v=jNQXAC9IVRw"},
        ],
        "articles": [
            {"title": "How to Master the Clean Girl Look", "url": "https://www.allure.com/story/clean-girl-aesthetic"},
            {"title": "Best Products for the Clean Girl Trend", "url": "https://www.byrdie.com/clean-girl-aesthetic"},
        ],
    },
    {
        "name": "Soft Glam",
        "slug": "soft-glam",
        "stamp_score": 89,
        "direction": "stable",
        "description": "Warm-toned eyeshadows, defined brows, and nude lips for an elevated everyday look.",
        "products": ["Modern Renaissance Palette", "Brow Wiz", "Pillow Talk Lipstick"],
        "videos": [
            {"title": "Soft Glam Makeup Look", "url": "https://www.youtube.com/watch?v=y6120QOlsfU"},
        ],
        "articles": [
            {"title": "Soft Glam: The Trend That Never Dies", "url": "https://www.cosmopolitan.com/soft-glam"},
        ],
    },
    {
        "name": "Glass Skin",
        "slug": "glass-skin",
        "stamp_score": 91,
        "direction": "rising",
        "description": "Ultra-dewy, translucent skin that looks like glass — achieved with hydrating primers and luminous foundations.",
        "products": ["Luminous Silk Foundation", "Cloud Paint", "Lip Glow Oil"],
        "videos": [
            {"title": "Glass Skin Routine", "url": "https://www.youtube.com/watch?v=aircAruvnKk"},
        ],
        "articles": [
            {"title": "How to Achieve Glass Skin", "url": "https://www.vogue.com/article/glass-skin"},
            {"title": "The Science Behind Glass Skin", "url": "https://www.elle.com/beauty/glass-skin-explained"},
        ],
    },
]


async def seed_all() -> None:
    """Seed the entire database with comprehensive sample data."""
    async with async_session() as db:
        logger.info("Clearing existing data...")
        # Delete in dependency order
        await db.execute(delete(PriceHistory))
        await db.execute(delete(TrendArticle))
        await db.execute(delete(TrendVideo))
        await db.execute(delete(TrendProduct))
        await db.execute(delete(Trend))
        await db.execute(delete(ProductReview))
        await db.execute(delete(ProductPrice))
        await db.execute(delete(ProductFilterValue))
        await db.execute(delete(Product))
        await db.execute(delete(Brand))
        await db.execute(delete(CategoryFilter))
        await db.execute(delete(Category))
        await db.execute(delete(CategoryGroup))
        await db.execute(delete(Retailer))
        await db.commit()

        # --- Category Groups ---
        logger.info("Seeding category groups...")
        for g in GROUPS:
            db.add(CategoryGroup(**g))
        await db.flush()

        # --- Categories ---
        logger.info("Seeding categories...")
        for c in CATEGORIES:
            db.add(Category(**c))
        await db.flush()

        # --- Category Filters ---
        logger.info("Seeding category filters...")
        for cat_key, filters in CATEGORY_FILTERS.items():
            for i, f in enumerate(filters):
                db.add(CategoryFilter(category_key=cat_key, sort_order=i, **f))
        await db.flush()

        # --- Retailers ---
        logger.info("Seeding retailers...")
        retailer_objs: dict[str, Retailer] = {}
        for r in RETAILERS:
            obj = Retailer(**r)
            db.add(obj)
            retailer_objs[r["name"]] = obj
        await db.flush()

        # --- Brands ---
        logger.info("Seeding brands...")
        brand_objs: dict[str, Brand] = {}
        for b in BRANDS:
            obj = Brand(**b)
            db.add(obj)
            brand_objs[b["name"]] = obj
        await db.flush()

        # --- Products ---
        logger.info("Seeding products...")
        product_objs: dict[str, Product] = {}
        for p in SEED_PRODUCTS:
            brand = brand_objs[p["brand"]]
            product = Product(
                name=p["name"],
                brand_id=brand.id,
                category_key=p["category"],
                stamp_score=p["stamp_score"],
                description=p.get("description", ""),
                specs=p.get("specs"),
                source="seed",
            )
            db.add(product)
            await db.flush()  # get the id
            product_objs[p["name"]] = product

            # Filter values
            for fk, fv in p.get("filters", {}).items():
                db.add(ProductFilterValue(
                    product_id=product.id,
                    filter_key=fk,
                    value=fv,
                ))

            # Prices
            for retailer_name, price in p.get("prices", []):
                retailer = retailer_objs.get(retailer_name)
                if not retailer:
                    continue
                db.add(ProductPrice(
                    product_id=product.id,
                    retailer_id=retailer.id,
                    source=retailer_name.lower().replace(" ", "_"),
                    price=price,
                    url=f"{retailer.base_url}/product/{product.id}",
                    in_stock=True,
                ))

        await db.flush()

        # --- Fake Price History (last 30 days, weekly for first retailer) ---
        logger.info("Seeding price history...")
        now = datetime.now(timezone.utc)
        for p in SEED_PRODUCTS:
            product = product_objs.get(p["name"])
            if not product or not p.get("prices"):
                continue
            retailer_name, base_price = p["prices"][0]
            retailer = retailer_objs.get(retailer_name)
            if not retailer:
                continue
            for week in range(4, -1, -1):
                # small variation
                delta = (week - 2) * 0.5
                db.add(PriceHistory(
                    product_id=product.id,
                    retailer_id=retailer.id,
                    price=round(base_price + delta, 2),
                    in_stock=True,
                    recorded_at=now - timedelta(weeks=week),
                ))
        await db.flush()

        # --- Trends ---
        logger.info("Seeding trends...")
        for t in SEED_TRENDS:
            trend = Trend(
                name=t["name"],
                slug=t["slug"],
                stamp_score=t["stamp_score"],
                direction=t["direction"],
                description=t["description"],
            )
            db.add(trend)
            await db.flush()

            for i, product_name in enumerate(t.get("products", [])):
                product = product_objs.get(product_name)
                if product:
                    db.add(TrendProduct(
                        trend_id=trend.id,
                        product_id=product.id,
                        sort_order=i,
                    ))

            for i, v in enumerate(t.get("videos", [])):
                db.add(TrendVideo(
                    trend_id=trend.id,
                    url=v["url"],
                    title=v.get("title"),
                    sort_order=i,
                ))

            for i, a in enumerate(t.get("articles", [])):
                db.add(TrendArticle(
                    trend_id=trend.id,
                    title=a["title"],
                    url=a["url"],
                    sort_order=i,
                ))

        await db.commit()
        logger.info(
            "Seed complete! %d products, %d trends seeded.",
            len(SEED_PRODUCTS),
            len(SEED_TRENDS),
        )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_all())
