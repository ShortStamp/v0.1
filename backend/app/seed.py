"""Seed script: populates the database with data from the frontend's data.ts.

Run: python -m app.seed
"""
import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session, engine
from app.models.base import Base
from app.models.build import Build, BuildSlot  # noqa: F401
from app.models.category import Category, CategoryFilter, CategoryGroup
from app.models.ingestion import IngestionRun, StampScoreHistory  # noqa: F401
from app.models.product import (
    Brand,
    PriceHistory,  # noqa: F401
    Product,
    ProductFilterValue,
    ProductPrice,
    ProductReview,  # noqa: F401
    Retailer,
)
from app.models.trend import Trend, TrendArticle, TrendProduct, TrendVideo  # noqa: F401
from app.models.user import (  # noqa: F401
    BeautyProfile,
    RefreshToken,
    User,
    UserNotificationSettings,
    UserStylePreference,
)

# ---- Category Groups ----
GROUPS = [
    {"key": "base", "label": "Base", "sort_order": 0,
     "categories": ["foundation", "concealer", "primer", "powder", "setting-spray"]},
    {"key": "eyes", "label": "Eyes", "sort_order": 1,
     "categories": ["eyeshadow", "eyeliner", "mascara", "false-lashes"]},
    {"key": "brows", "label": "Brows", "sort_order": 2,
     "categories": ["brow-pencil", "brow-gel"]},
    {"key": "cheeks", "label": "Cheeks", "sort_order": 3,
     "categories": ["contour", "bronzer", "blush", "highlighter"]},
    {"key": "lips", "label": "Lips", "sort_order": 4,
     "categories": ["lip-liner", "lipstick", "lip-gloss"]},
]

# ---- Categories with filters ----
CATEGORIES = [
    {"key": "foundation", "label": "Foundation", "group_key": "base", "sort_order": 0,
     "filters": [
         {"filter_key": "brand", "label": "Brand", "filter_type": "checkbox", "options": ["Giorgio Armani", "Maybelline", "NARS"]},
         {"filter_key": "priceRange", "label": "Price Range", "filter_type": "range", "options": None},
         {"filter_key": "finish", "label": "Finish", "filter_type": "checkbox", "options": ["Matte", "Dewy", "Satin"]},
         {"filter_key": "coverage", "label": "Coverage", "filter_type": "checkbox", "options": ["Light", "Medium", "Full"]},
         {"filter_key": "skinType", "label": "Skin Type", "filter_type": "checkbox", "options": ["Oily", "Dry", "Combination", "Normal"]},
     ]},
    {"key": "concealer", "label": "Concealer", "group_key": "base", "sort_order": 1,
     "filters": [
         {"filter_key": "brand", "label": "Brand", "filter_type": "checkbox", "options": ["NARS", "Tarte", "Maybelline"]},
         {"filter_key": "priceRange", "label": "Price Range", "filter_type": "range", "options": None},
         {"filter_key": "coverage", "label": "Coverage", "filter_type": "checkbox", "options": ["Light", "Medium", "Full"]},
         {"filter_key": "finish", "label": "Finish", "filter_type": "checkbox", "options": ["Matte", "Dewy", "Natural"]},
         {"filter_key": "undertone", "label": "Undertone", "filter_type": "checkbox", "options": ["Warm", "Cool", "Neutral"]},
     ]},
    {"key": "primer", "label": "Primer", "group_key": "base", "sort_order": 2,
     "filters": [
         {"filter_key": "brand", "label": "Brand", "filter_type": "checkbox", "options": ["Tatcha", "Smashbox", "e.l.f."]},
         {"filter_key": "priceRange", "label": "Price Range", "filter_type": "range", "options": None},
         {"filter_key": "type", "label": "Type", "filter_type": "checkbox", "options": ["Hydrating", "Mattifying", "Pore-Filling", "Color-Correcting"]},
     ]},
    {"key": "powder", "label": "Powder", "group_key": "base", "sort_order": 3,
     "filters": [
         {"filter_key": "brand", "label": "Brand", "filter_type": "checkbox", "options": ["Laura Mercier", "Maybelline", "Charlotte Tilbury"]},
         {"filter_key": "priceRange", "label": "Price Range", "filter_type": "range", "options": None},
         {"filter_key": "type", "label": "Type", "filter_type": "checkbox", "options": ["Pressed", "Loose"]},
         {"filter_key": "finish", "label": "Finish", "filter_type": "checkbox", "options": ["Matte", "Luminous"]},
     ]},
    {"key": "blush", "label": "Blush", "group_key": "cheeks", "sort_order": 0,
     "filters": [
         {"filter_key": "brand", "label": "Brand", "filter_type": "checkbox", "options": ["Glossier", "NARS", "Rare Beauty"]},
         {"filter_key": "priceRange", "label": "Price Range", "filter_type": "range", "options": None},
         {"filter_key": "formula", "label": "Formula", "filter_type": "checkbox", "options": ["Powder", "Cream", "Liquid"]},
         {"filter_key": "finish", "label": "Finish", "filter_type": "checkbox", "options": ["Matte", "Shimmer", "Satin"]},
     ]},
    {"key": "bronzer", "label": "Bronzer", "group_key": "cheeks", "sort_order": 1,
     "filters": [
         {"filter_key": "brand", "label": "Brand", "filter_type": "checkbox", "options": ["Benefit", "Physician's Formula", "Too Faced"]},
         {"filter_key": "priceRange", "label": "Price Range", "filter_type": "range", "options": None},
         {"filter_key": "formula", "label": "Formula", "filter_type": "checkbox", "options": ["Powder", "Cream"]},
         {"filter_key": "shimmer", "label": "Shimmer", "filter_type": "checkbox", "options": ["Yes", "No"]},
     ]},
    {"key": "highlighter", "label": "Highlighter", "group_key": "cheeks", "sort_order": 2,
     "filters": [
         {"filter_key": "brand", "label": "Brand", "filter_type": "checkbox", "options": ["Fenty Beauty", "Becca", "Dior"]},
         {"filter_key": "priceRange", "label": "Price Range", "filter_type": "range", "options": None},
         {"filter_key": "formula", "label": "Formula", "filter_type": "checkbox", "options": ["Powder", "Cream", "Liquid"]},
         {"filter_key": "intensity", "label": "Intensity", "filter_type": "checkbox", "options": ["Subtle", "Blinding"]},
     ]},
    {"key": "contour", "label": "Contour", "group_key": "cheeks", "sort_order": 3,
     "filters": [
         {"filter_key": "brand", "label": "Brand", "filter_type": "checkbox", "options": ["Fenty Beauty", "KVD Vegan Beauty", "NYX"]},
         {"filter_key": "priceRange", "label": "Price Range", "filter_type": "range", "options": None},
         {"filter_key": "formula", "label": "Formula", "filter_type": "checkbox", "options": ["Powder", "Cream", "Stick"]},
     ]},
    {"key": "eyeshadow", "label": "Eyeshadow", "group_key": "eyes", "sort_order": 0,
     "filters": [
         {"filter_key": "brand", "label": "Brand", "filter_type": "checkbox", "options": ["Urban Decay", "Anastasia Beverly Hills", "Natasha Denona"]},
         {"filter_key": "priceRange", "label": "Price Range", "filter_type": "range", "options": None},
         {"filter_key": "finish", "label": "Finish", "filter_type": "checkbox", "options": ["Matte", "Shimmer", "Glitter"]},
         {"filter_key": "paletteSize", "label": "Palette Size", "filter_type": "checkbox", "options": ["Single", "Quad", "6+", "12+"]},
         {"filter_key": "colorFamily", "label": "Color Family", "filter_type": "checkbox", "options": ["Neutral", "Warm", "Cool", "Colorful"]},
     ]},
    {"key": "eyeliner", "label": "Eyeliner", "group_key": "eyes", "sort_order": 1,
     "filters": [
         {"filter_key": "brand", "label": "Brand", "filter_type": "checkbox", "options": ["Stila", "NYX", "Maybelline"]},
         {"filter_key": "priceRange", "label": "Price Range", "filter_type": "range", "options": None},
         {"filter_key": "type", "label": "Type", "filter_type": "checkbox", "options": ["Pencil", "Liquid", "Gel", "Felt-tip"]},
         {"filter_key": "waterproof", "label": "Waterproof", "filter_type": "checkbox", "options": ["Yes", "No"]},
     ]},
    {"key": "mascara", "label": "Mascara", "group_key": "eyes", "sort_order": 2,
     "filters": [
         {"filter_key": "brand", "label": "Brand", "filter_type": "checkbox", "options": ["Maybelline", "Too Faced", "Lancôme"]},
         {"filter_key": "priceRange", "label": "Price Range", "filter_type": "range", "options": None},
         {"filter_key": "effect", "label": "Effect", "filter_type": "checkbox", "options": ["Volume", "Length", "Curl"]},
         {"filter_key": "waterproof", "label": "Waterproof", "filter_type": "checkbox", "options": ["Yes", "No"]},
     ]},
    {"key": "false-lashes", "label": "False Lashes", "group_key": "eyes", "sort_order": 3,
     "filters": [
         {"filter_key": "brand", "label": "Brand", "filter_type": "checkbox", "options": ["Ardell", "Lilly Lashes", "Kiss"]},
         {"filter_key": "priceRange", "label": "Price Range", "filter_type": "range", "options": None},
         {"filter_key": "style", "label": "Style", "filter_type": "checkbox", "options": ["Natural", "Dramatic", "Wispy"]},
         {"filter_key": "material", "label": "Material", "filter_type": "checkbox", "options": ["Synthetic", "Mink", "Silk"]},
     ]},
    {"key": "brow-pencil", "label": "Brow Pencil", "group_key": "brows", "sort_order": 0,
     "filters": [
         {"filter_key": "brand", "label": "Brand", "filter_type": "checkbox", "options": ["Anastasia Beverly Hills", "Benefit", "NYX"]},
         {"filter_key": "priceRange", "label": "Price Range", "filter_type": "range", "options": None},
         {"filter_key": "tipType", "label": "Tip Type", "filter_type": "checkbox", "options": ["Ultra-fine", "Angled"]},
         {"filter_key": "spoolie", "label": "Spoolie", "filter_type": "checkbox", "options": ["Yes", "No"]},
     ]},
    {"key": "brow-gel", "label": "Brow Gel", "group_key": "brows", "sort_order": 1,
     "filters": [
         {"filter_key": "brand", "label": "Brand", "filter_type": "checkbox", "options": ["Glossier", "Benefit", "Got2b"]},
         {"filter_key": "priceRange", "label": "Price Range", "filter_type": "range", "options": None},
         {"filter_key": "tinted", "label": "Tinted", "filter_type": "checkbox", "options": ["Yes", "No"]},
         {"filter_key": "hold", "label": "Hold", "filter_type": "checkbox", "options": ["Light", "Strong"]},
     ]},
    {"key": "lipstick", "label": "Lipstick", "group_key": "lips", "sort_order": 0,
     "filters": [
         {"filter_key": "brand", "label": "Brand", "filter_type": "checkbox", "options": ["MAC", "Charlotte Tilbury", "Maybelline"]},
         {"filter_key": "priceRange", "label": "Price Range", "filter_type": "range", "options": None},
         {"filter_key": "finish", "label": "Finish", "filter_type": "checkbox", "options": ["Matte", "Satin", "Glossy"]},
         {"filter_key": "type", "label": "Type", "filter_type": "checkbox", "options": ["Bullet", "Liquid"]},
         {"filter_key": "longWear", "label": "Long-wear", "filter_type": "checkbox", "options": ["Yes", "No"]},
     ]},
    {"key": "lip-gloss", "label": "Lip Gloss", "group_key": "lips", "sort_order": 1,
     "filters": [
         {"filter_key": "brand", "label": "Brand", "filter_type": "checkbox", "options": ["Dior", "Fenty Beauty", "NYX"]},
         {"filter_key": "priceRange", "label": "Price Range", "filter_type": "range", "options": None},
         {"filter_key": "finish", "label": "Finish", "filter_type": "checkbox", "options": ["Shimmer", "Clear", "Cream"]},
         {"filter_key": "tinted", "label": "Tinted", "filter_type": "checkbox", "options": ["Yes", "No"]},
         {"filter_key": "plumping", "label": "Plumping", "filter_type": "checkbox", "options": ["Yes", "No"]},
     ]},
    {"key": "lip-liner", "label": "Lip Liner", "group_key": "lips", "sort_order": 2,
     "filters": [
         {"filter_key": "brand", "label": "Brand", "filter_type": "checkbox", "options": ["Charlotte Tilbury", "MAC", "NYX"]},
         {"filter_key": "priceRange", "label": "Price Range", "filter_type": "range", "options": None},
         {"filter_key": "finish", "label": "Finish", "filter_type": "checkbox", "options": ["Matte", "Creamy"]},
         {"filter_key": "retractable", "label": "Retractable", "filter_type": "checkbox", "options": ["Yes", "No"]},
     ]},
    {"key": "setting-spray", "label": "Setting Spray", "group_key": "base", "sort_order": 4,
     "filters": [
         {"filter_key": "brand", "label": "Brand", "filter_type": "checkbox", "options": ["Urban Decay", "NYX", "Charlotte Tilbury"]},
         {"filter_key": "priceRange", "label": "Price Range", "filter_type": "range", "options": None},
         {"filter_key": "finish", "label": "Finish", "filter_type": "checkbox", "options": ["Matte", "Dewy", "Natural"]},
         {"filter_key": "longWear", "label": "Long-wear", "filter_type": "checkbox", "options": ["Yes", "No"]},
     ]},
]

# ---- Products (mirrors sampleProducts from data.ts) ----
PRODUCTS = [
    {"id": "1", "name": "Luminous Silk Foundation", "brand": "Giorgio Armani", "category": "foundation", "stamp_score": 94,
     "description": "An award-winning lightweight foundation that delivers buildable, luminous coverage.",
     "specs": ["Micro-fil technology", "40 shades", "Oil-free"],
     "filters": {"finish": "Satin", "coverage": "Medium", "skinType": "Normal"},
     "prices": [("Sephora", 65.0), ("Nordstrom", 65.0), ("Amazon", 59.0)]},
    {"id": "2", "name": "Fit Me Matte + Poreless", "brand": "Maybelline", "category": "foundation", "stamp_score": 82,
     "description": "A lightweight foundation that mattifies and refines pores for a natural finish.",
     "filters": {"finish": "Matte", "coverage": "Medium", "skinType": "Oily"},
     "prices": [("Ulta Beauty", 9.49), ("Amazon", 7.99)]},
    {"id": "3", "name": "Radiant Creamy Concealer", "brand": "NARS", "category": "concealer", "stamp_score": 91,
     "description": "A multi-action concealer that corrects, contours, highlights, and perfects.",
     "filters": {"coverage": "Medium", "finish": "Dewy", "undertone": "Neutral"},
     "prices": [("Sephora", 32.0), ("Nordstrom", 32.0)]},
    {"id": "4", "name": "Shape Tape Concealer", "brand": "Tarte", "category": "concealer", "stamp_score": 88,
     "description": "Full-coverage concealer with a matte finish for a flawless look.",
     "filters": {"coverage": "Full", "finish": "Matte", "undertone": "Warm"},
     "prices": [("Ulta Beauty", 30.0), ("Tarte.com", 30.0)]},
    {"id": "5", "name": "The Silk Canvas", "brand": "Tatcha", "category": "primer", "stamp_score": 90,
     "description": "A velvety primer balm that fills pores and smooths skin.",
     "filters": {"type": "Pore-Filling"},
     "prices": [("Sephora", 52.0), ("Tatcha.com", 52.0)]},
    {"id": "6", "name": "Photo Finish Primer", "brand": "Smashbox", "category": "primer", "stamp_score": 84,
     "description": "A lightweight, oil-free primer that smooths and blurs for a photo-ready finish.",
     "filters": {"type": "Pore-Filling"},
     "prices": [("Sephora", 39.0), ("Ulta Beauty", 39.0)]},
    {"id": "7", "name": "Translucent Loose Setting Powder", "brand": "Laura Mercier", "category": "powder", "stamp_score": 93,
     "description": "A lightweight, silky powder that sets makeup for up to 16 hours.",
     "filters": {"type": "Loose", "finish": "Matte"},
     "prices": [("Sephora", 43.0), ("Nordstrom", 43.0)]},
    {"id": "8", "name": "Airspun Loose Face Powder", "brand": "Coty", "category": "powder", "stamp_score": 78,
     "description": "A classic loose powder that provides a flawless, soft finish.",
     "filters": {"type": "Loose", "finish": "Matte"},
     "prices": [("Amazon", 8.97), ("Walmart", 7.97)]},
    {"id": "9", "name": "Cloud Paint", "brand": "Glossier", "category": "blush", "stamp_score": 88,
     "description": "A seamless, buildable gel-cream blush that gives a natural flush of color.",
     "filters": {"formula": "Cream", "finish": "Satin"},
     "prices": [("Glossier.com", 20.0), ("Sephora", 20.0)]},
    {"id": "10", "name": "Soft Pinch Liquid Blush", "brand": "Rare Beauty", "category": "blush", "stamp_score": 95,
     "description": "A weightless, long-lasting liquid blush with a soft, healthy flush.",
     "filters": {"formula": "Liquid", "finish": "Matte"},
     "prices": [("Sephora", 23.0), ("RareBeauty.com", 23.0)]},
    {"id": "11", "name": "Hoola Matte Bronzer", "brand": "Benefit", "category": "bronzer", "stamp_score": 86,
     "description": "A matte bronzing powder for a natural sun-kissed glow.",
     "filters": {"formula": "Powder", "shimmer": "No"},
     "prices": [("Sephora", 30.0), ("Ulta Beauty", 30.0)]},
    {"id": "12", "name": "Butter Bronzer", "brand": "Physician's Formula", "category": "bronzer", "stamp_score": 83,
     "description": "A creamy, Brazilian butter-infused bronzer with a radiant glow.",
     "filters": {"formula": "Powder", "shimmer": "Yes"},
     "prices": [("Ulta Beauty", 16.49), ("Amazon", 12.99)]},
    {"id": "13", "name": "Killawatt Highlighter", "brand": "Fenty Beauty", "category": "highlighter", "stamp_score": 92,
     "description": "A weightless, longwear cream-powder hybrid highlighter.",
     "filters": {"formula": "Powder", "intensity": "Blinding"},
     "prices": [("Sephora", 38.0), ("FentyBeauty.com", 38.0)]},
    {"id": "14", "name": "Backstage Glow Face Palette", "brand": "Dior", "category": "highlighter", "stamp_score": 89,
     "description": "A multi-use highlighting palette with buildable, blendable shades.",
     "filters": {"formula": "Powder", "intensity": "Subtle"},
     "prices": [("Sephora", 45.0), ("Dior.com", 45.0)]},
    {"id": "15", "name": "Match Stix Contour Skinstick", "brand": "Fenty Beauty", "category": "contour", "stamp_score": 87,
     "description": "A creamy, blendable contour stick for precise sculpting.",
     "filters": {"formula": "Stick"},
     "prices": [("Sephora", 28.0), ("FentyBeauty.com", 28.0)]},
    {"id": "16", "name": "Sculpt Contour Powder", "brand": "NYX", "category": "contour", "stamp_score": 79,
     "description": "A lightweight pressed powder for easy, natural-looking contour.",
     "filters": {"formula": "Powder"},
     "prices": [("Ulta Beauty", 10.0), ("Amazon", 8.49)]},
    {"id": "17", "name": "Soft Matte Eyeshadow Palette", "brand": "Urban Decay", "category": "eyeshadow", "stamp_score": 92,
     "description": "A versatile palette with 12 highly pigmented shades.",
     "specs": ["12 shades", "Matte & shimmer finishes", "Vegan formula"],
     "filters": {"finish": "Matte", "paletteSize": "12+", "colorFamily": "Neutral"},
     "prices": [("Sephora", 54.0), ("Ulta Beauty", 52.0), ("Amazon", 48.99)]},
    {"id": "18", "name": "Modern Renaissance Palette", "brand": "Anastasia Beverly Hills", "category": "eyeshadow", "stamp_score": 96,
     "description": "An iconic palette featuring 14 shades in warm berry and neutral tones.",
     "filters": {"finish": "Shimmer", "paletteSize": "12+", "colorFamily": "Warm"},
     "prices": [("Sephora", 45.0), ("Ulta Beauty", 45.0)]},
    {"id": "19", "name": "Stay All Day Waterproof Liner", "brand": "Stila", "category": "eyeliner", "stamp_score": 90,
     "description": "A felt-tip liquid liner for precise, smudge-proof lines.",
     "filters": {"type": "Felt-tip", "waterproof": "Yes"},
     "prices": [("Sephora", 23.0), ("Ulta Beauty", 23.0)]},
    {"id": "20", "name": "Epic Ink Liner", "brand": "NYX", "category": "eyeliner", "stamp_score": 85,
     "description": "A waterproof liquid liner with a flexible brush tip.",
     "filters": {"type": "Liquid", "waterproof": "Yes"},
     "prices": [("Ulta Beauty", 9.0), ("Amazon", 7.49)]},
    {"id": "21", "name": "Lash Sensational Mascara", "brand": "Maybelline", "category": "mascara", "stamp_score": 80,
     "description": "A fan-effect mascara for volume, length, and a full-fan effect.",
     "filters": {"effect": "Volume", "waterproof": "No"},
     "prices": [("Ulta Beauty", 9.99), ("Amazon", 7.98)]},
    {"id": "22", "name": "Better Than Sex Mascara", "brand": "Too Faced", "category": "mascara", "stamp_score": 89,
     "description": "A volumizing mascara for dramatic, full lashes.",
     "filters": {"effect": "Volume", "waterproof": "No"},
     "prices": [("Sephora", 29.0), ("Ulta Beauty", 29.0)]},
    {"id": "23", "name": "Demi Wispies", "brand": "Ardell", "category": "false-lashes", "stamp_score": 84,
     "description": "A natural-looking, wispy false lash for everyday wear.",
     "filters": {"style": "Wispy", "material": "Synthetic"},
     "prices": [("Ulta Beauty", 4.99), ("Amazon", 3.49)]},
    {"id": "24", "name": "Miami Lashes", "brand": "Lilly Lashes", "category": "false-lashes", "stamp_score": 91,
     "description": "A dramatic 3D mink lash for bold, glamorous looks.",
     "filters": {"style": "Dramatic", "material": "Mink"},
     "prices": [("Sephora", 30.0), ("LillyLashes.com", 30.0)]},
    {"id": "25", "name": "Brow Wiz", "brand": "Anastasia Beverly Hills", "category": "brow-pencil", "stamp_score": 85,
     "description": "An ultra-slim, retractable pencil for precise, hair-like strokes.",
     "specs": ["Ultra-fine tip", "Built-in spoolie", "12 shades"],
     "filters": {"tipType": "Ultra-fine", "spoolie": "Yes"},
     "prices": [("Sephora", 25.0), ("Ulta Beauty", 25.0), ("Amazon", 22.5)]},
    {"id": "26", "name": "Precisely, My Brow Pencil", "brand": "Benefit", "category": "brow-pencil", "stamp_score": 87,
     "description": "An ultra-fine brow pencil for natural-looking, defined brows.",
     "filters": {"tipType": "Ultra-fine", "spoolie": "Yes"},
     "prices": [("Sephora", 26.0), ("Ulta Beauty", 26.0)]},
    {"id": "27", "name": "Boy Brow", "brand": "Glossier", "category": "brow-gel", "stamp_score": 86,
     "description": "A conditioning brow gel that thickens and shapes brows.",
     "filters": {"tinted": "Yes", "hold": "Light"},
     "prices": [("Glossier.com", 17.0), ("Sephora", 17.0)]},
    {"id": "28", "name": "Gimme Brow+", "brand": "Benefit", "category": "brow-gel", "stamp_score": 84,
     "description": "A tinted volumizing brow gel with micro-fibers.",
     "filters": {"tinted": "Yes", "hold": "Strong"},
     "prices": [("Sephora", 26.0), ("Ulta Beauty", 26.0)]},
    {"id": "29", "name": "Matte Lipstick", "brand": "MAC", "category": "lipstick", "stamp_score": 90,
     "description": "An iconic matte lipstick with rich, long-lasting color.",
     "filters": {"finish": "Matte", "type": "Bullet", "longWear": "Yes"},
     "prices": [("MAC.com", 23.0), ("Nordstrom", 23.0)]},
    {"id": "30", "name": "Pillow Talk Lipstick", "brand": "Charlotte Tilbury", "category": "lipstick", "stamp_score": 93,
     "description": "A dreamy nude-pink lipstick with a satin, kissable finish.",
     "filters": {"finish": "Satin", "type": "Bullet", "longWear": "No"},
     "prices": [("Sephora", 35.0), ("Nordstrom", 35.0)]},
    {"id": "31", "name": "Lip Glow Oil", "brand": "Dior", "category": "lip-gloss", "stamp_score": 97,
     "description": "A nourishing lip oil that enhances natural lip color with a glossy finish.",
     "filters": {"finish": "Clear", "tinted": "Yes", "plumping": "No"},
     "prices": [("Sephora", 40.0), ("Dior.com", 40.0)]},
    {"id": "32", "name": "Gloss Bomb", "brand": "Fenty Beauty", "category": "lip-gloss", "stamp_score": 91,
     "description": "A universally flattering lip luminizer with explosive shine.",
     "filters": {"finish": "Shimmer", "tinted": "Yes", "plumping": "No"},
     "prices": [("Sephora", 21.0), ("FentyBeauty.com", 21.0)]},
    {"id": "33", "name": "Lip Cheat Liner", "brand": "Charlotte Tilbury", "category": "lip-liner", "stamp_score": 89,
     "description": "A smooth lip liner that defines, reshapes, and perfects lips.",
     "filters": {"finish": "Matte", "retractable": "Yes"},
     "prices": [("Sephora", 25.0), ("Nordstrom", 25.0)]},
    {"id": "34", "name": "Suede Matte Lip Liner", "brand": "NYX", "category": "lip-liner", "stamp_score": 81,
     "description": "A creamy, matte lip liner with rich pigmentation.",
     "filters": {"finish": "Matte", "retractable": "No"},
     "prices": [("Ulta Beauty", 5.0), ("Amazon", 4.49)]},
    {"id": "35", "name": "All Nighter Setting Spray", "brand": "Urban Decay", "category": "setting-spray", "stamp_score": 92,
     "description": "A long-lasting setting spray that keeps makeup in place for up to 16 hours.",
     "filters": {"finish": "Natural", "longWear": "Yes"},
     "prices": [("Sephora", 36.0), ("Ulta Beauty", 36.0)]},
    {"id": "36", "name": "Matte Finish Setting Spray", "brand": "NYX", "category": "setting-spray", "stamp_score": 80,
     "description": "A lightweight matte setting spray that controls shine all day.",
     "filters": {"finish": "Matte", "longWear": "Yes"},
     "prices": [("Ulta Beauty", 9.5), ("Amazon", 7.99)]},
]

# ---- Trends (mirrors sampleTrends) ----
# Product indices reference the PRODUCTS list above (0-indexed)
TRENDS = [
    {"id": "1", "name": "Clean Girl Aesthetic", "slug": "clean-girl-aesthetic", "stamp_score": 95,
     "description": "A minimalist, fresh-faced look emphasizing dewy skin, brushed brows, and subtle lip color.",
     "direction": "rising", "product_ids": ["9", "31", "1"]},
    {"id": "2", "name": "Soft Glam", "slug": "soft-glam", "stamp_score": 89,
     "description": "Warm-toned eyeshadows, defined brows, and nude lips for an elevated everyday look.",
     "direction": "stable", "product_ids": ["17", "25", "31"]},
    {"id": "3", "name": "Glass Skin", "slug": "glass-skin", "stamp_score": 91,
     "description": "Ultra-dewy, translucent skin that looks like glass — achieved with hydrating primers and luminous foundations.",
     "direction": "rising", "product_ids": ["1", "9"]},
]


async def get_or_create_brand(db: AsyncSession, name: str) -> Brand:
    result = await db.execute(select(Brand).where(Brand.name == name))
    brand = result.scalar_one_or_none()
    if brand:
        return brand
    brand = Brand(name=name, slug=name.lower().replace("'", "").replace(".", "").replace(" ", "-"))
    db.add(brand)
    await db.flush()
    return brand


async def get_or_create_retailer(db: AsyncSession, name: str) -> Retailer:
    result = await db.execute(select(Retailer).where(Retailer.name == name))
    retailer = result.scalar_one_or_none()
    if retailer:
        return retailer
    retailer = Retailer(name=name, slug=name.lower().replace("'", "").replace(".", "").replace(" ", "-"))
    db.add(retailer)
    await db.flush()
    return retailer


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # Check if already seeded
        result = await db.execute(select(CategoryGroup))
        if result.first():
            print("Database already seeded, skipping.")
            return

        # 1. Category Groups
        for g in GROUPS:
            db.add(CategoryGroup(key=g["key"], label=g["label"], sort_order=g["sort_order"]))
        await db.flush()

        # 2. Categories + Filters
        for cat in CATEGORIES:
            db.add(Category(
                key=cat["key"], label=cat["label"],
                group_key=cat["group_key"], sort_order=cat["sort_order"]
            ))
            await db.flush()
            for i, f in enumerate(cat["filters"]):
                db.add(CategoryFilter(
                    category_key=cat["key"],
                    filter_key=f["filter_key"],
                    label=f["label"],
                    filter_type=f["filter_type"],
                    options=f["options"],
                    sort_order=i,
                ))
        await db.flush()

        # 3. Products (with brands, prices, filter values)
        for prod in PRODUCTS:
            brand = await get_or_create_brand(db, prod["brand"])
            product = Product(
                id=prod["id"],
                name=prod["name"],
                brand_id=brand.id,
                category_key=prod["category"],
                stamp_score=prod["stamp_score"],
                description=prod.get("description"),
                specs=prod.get("specs"),
            )
            db.add(product)
            await db.flush()

            # Filter values
            for key, value in prod.get("filters", {}).items():
                db.add(ProductFilterValue(
                    product_id=product.id,
                    filter_key=key,
                    value=str(value),
                ))

            # Prices
            for retailer_name, price in prod.get("prices", []):
                retailer = await get_or_create_retailer(db, retailer_name)
                db.add(ProductPrice(
                    product_id=product.id,
                    retailer_id=retailer.id,
                    price=price,
                    url="#",
                    in_stock=True,
                ))

        await db.flush()

        # 4. Trends
        for t in TRENDS:
            trend = Trend(
                id=t["id"],
                name=t["name"],
                slug=t["slug"],
                stamp_score=t["stamp_score"],
                description=t["description"],
                direction=t["direction"],
            )
            db.add(trend)
            await db.flush()

            for i, pid in enumerate(t["product_ids"]):
                db.add(TrendProduct(
                    trend_id=trend.id,
                    product_id=pid,
                    sort_order=i,
                ))

        await db.commit()
        print("Seed completed: 5 groups, 18 categories, 36 products, 3 trends")


if __name__ == "__main__":
    asyncio.run(seed())
