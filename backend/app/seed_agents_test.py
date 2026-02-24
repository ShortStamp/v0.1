"""
Additive seed — Agent Test Dataset
===================================
Populates all 18 product categories with curated products and real INCI data.
Also creates one declining trend (for Trend Agent) and one beauty profile (for Artist Agent).

Designed conflicts:
  Chemist  → Silicone primer (Cyclopentasiloxane) + water-based foundation (Aqua) = ERROR
  Artist   → Dewy-finish foundation + oily skin-type profile = WARNING
  Trend    → "Heavy Contouring" declining trend, associated with the contour product

Run from the repo root (backend as CWD):
    PYTHONPATH=. python app/seed_agents_test.py [--dry-run]

The seed is idempotent: it checks source_id="agent_test:<slug>" before inserting.
"""
from __future__ import annotations

import asyncio
import sys

sys.path.insert(0, ".")

# Import all models so SQLAlchemy can resolve relationships
import app.models.build  # noqa: F401
import app.models.category  # noqa: F401
import app.models.compatibility  # noqa: F401
import app.models.trend  # noqa: F401
import app.models.user  # noqa: F401

from sqlalchemy import func, select

from app.database import async_session
from app.models.product import Brand, Product, ProductFilterValue, ProductPrice
from app.models.trend import Trend, TrendProduct
from app.models.user import BeautyProfile, User

DRY_RUN = "--dry-run" in sys.argv

# ---------------------------------------------------------------------------
# Seed data — one product per category, two+ for categories with conflicts
# ---------------------------------------------------------------------------

# Format: dict with keys matching Product columns + extra "filters" and "price"
SEED_PRODUCTS: list[dict] = [
    # -------------------------------------------------------------------------
    # BASE
    # -------------------------------------------------------------------------

    # primer — SILICONE-BASED (triggers chemist conflict with water-based foundation)
    {
        "source_id": "agent_test:primer-silicone",
        "name": "Photo Finish Foundation Primer",
        "brand": "Smashbox",
        "category_key": "primer",
        "image_url": "/placeholder-product.jpg",
        "description": "Silicone-based smoothing primer that blurs pores and extends wear.",
        "inci_ingredients": [
            "Cyclopentasiloxane",
            "Dimethicone",
            "Dimethicone Crosspolymer",
            "Dimethicone/Vinyl Dimethicone Crosspolymer",
            "Trimethylsiloxysilicate",
            "Silica",
            "Phenyl Trimethicone",
            "PEG/PPG-18/18 Dimethicone",
            "Sodium Chloride",
            "Tocopheryl Acetate",
        ],
        "filters": {"finish": "matte", "skin_type": "all"},
        "price": 39.00,
    },

    # foundation — WATER-BASED + DEWY (triggers chemist conflict with silicone primer;
    #               also triggers artist conflict for oily skin)
    {
        "source_id": "agent_test:foundation-water-dewy",
        "name": "Fit Me Dewy + Smooth Foundation",
        "brand": "Maybelline",
        "category_key": "foundation",
        "image_url": "/placeholder-product.jpg",
        "description": "Lightweight water-based foundation with a dewy, luminous finish.",
        "inci_ingredients": [
            "Aqua",
            "Glycerin",
            "Propylene Glycol",
            "Niacinamide",
            "Alcohol Denat",
            "Titanium Dioxide",
            "Cetyl Alcohol",
            "Stearyl Alcohol",
            "PEG-100 Stearate",
            "Glyceryl Stearate",
            "Dimethicone",          # minor silicone — not primary
            "Phenoxyethanol",
            "Ethylhexylglycerin",
            "Sodium Hyaluronate",
            "Fragrance",
        ],
        "filters": {"finish": "dewy", "coverage": "medium", "skin_type": "normal"},
        "price": 12.99,
    },

    # second foundation — MATTE water-based (no chemist conflict when used alone)
    {
        "source_id": "agent_test:foundation-matte",
        "name": "Pro Filt'r Soft Matte Longwear Foundation",
        "brand": "Fenty Beauty",
        "category_key": "foundation",
        "image_url": "/placeholder-product.jpg",
        "description": "Full-coverage matte foundation with 24-hour wear.",
        "inci_ingredients": [
            "Aqua",
            "Dimethicone",
            "Isododecane",
            "Glycerin",
            "Niacinamide",
            "Butylene Glycol",
            "Silica",
            "Phenyl Trimethicone",
            "Isohexadecane",
            "Polymethyl Methacrylate",
            "Phenoxyethanol",
            "Titanium Dioxide",
            "Ethylhexylglycerin",
            "Sodium Hyaluronate",
            "Tocopheryl Acetate",
        ],
        "filters": {"finish": "matte", "coverage": "full", "skin_type": "oily"},
        "price": 38.00,
    },

    # concealer
    {
        "source_id": "agent_test:concealer",
        "name": "Shape Tape Full Coverage Concealer",
        "brand": "Tarte",
        "category_key": "concealer",
        "image_url": "/placeholder-product.jpg",
        "description": "Creamy full-coverage concealer that brightens and conceals.",
        "inci_ingredients": [
            "Aqua",
            "Cyclopentasiloxane",
            "Dimethicone",
            "Butylene Glycol",
            "Glycerin",
            "Kaolin",
            "Magnesium Sulfate",
            "Phenoxyethanol",
            "Acrylates Copolymer",
            "Niacinamide",
            "Titanium Dioxide",
            "Ethylhexylglycerin",
            "Tocopheryl Acetate",
        ],
        "filters": {"coverage": "full", "skin_type": "all"},
        "price": 29.00,
    },

    # powder
    {
        "source_id": "agent_test:powder",
        "name": "Loose Setting Powder",
        "brand": "Laura Mercier",
        "category_key": "powder",
        "image_url": "/placeholder-product.jpg",
        "description": "Translucent loose setting powder for a flawless, velvety finish.",
        "inci_ingredients": [
            "Talc",
            "Silica",
            "Dimethicone",
            "Polymethyl Methacrylate",
            "Phenyl Trimethicone",
            "Magnesium Myristate",
            "Lauroyl Lysine",
            "Triethoxycaprylylsilane",
            "Tocopheryl Acetate",
        ],
        "filters": {"finish": "matte", "skin_type": "all"},
        "price": 40.00,
    },

    # setting-spray
    {
        "source_id": "agent_test:setting-spray",
        "name": "All Nighter Long Lasting Makeup Setting Spray",
        "brand": "Urban Decay",
        "category_key": "setting-spray",
        "image_url": "/placeholder-product.jpg",
        "description": "Setting spray that locks in makeup for up to 16 hours.",
        "inci_ingredients": [
            "Aqua",
            "SD Alcohol 40-B",
            "Dimethyl Imidazolidinone",
            "PVP",
            "Polyacrylate-33",
            "Ethylhexylglycerin",
            "Phenoxyethanol",
            "Disodium EDTA",
            "Potassium Phosphate",
            "Dipotassium Phosphate",
        ],
        "filters": {"finish": "natural", "skin_type": "all"},
        "price": 33.00,
    },

    # -------------------------------------------------------------------------
    # EYES
    # -------------------------------------------------------------------------

    # eyeshadow
    {
        "source_id": "agent_test:eyeshadow",
        "name": "Modern Renaissance Eye Shadow Palette",
        "brand": "Anastasia Beverly Hills",
        "category_key": "eyeshadow",
        "image_url": "/placeholder-product.jpg",
        "description": "14-shade warm-tone palette with mattes and shimmers.",
        "inci_ingredients": [
            "Mica",
            "Talc",
            "Calcium Sodium Borosilicate",
            "Magnesium Stearate",
            "Dimethicone",
            "Octyldodecyl Stearoyl Stearate",
            "Ethylhexyl Palmitate",
            "Phenoxyethanol",
            "Tocopheryl Acetate",
            "Caprylyl Glycol",
        ],
        "filters": {"finish": "shimmer", "skin_type": "all"},
        "price": 42.00,
    },

    # eyeliner
    {
        "source_id": "agent_test:eyeliner",
        "name": "Retractable Waterproof Eyeliner",
        "brand": "NYX Professional Makeup",
        "category_key": "eyeliner",
        "image_url": "/placeholder-product.jpg",
        "description": "Smudge-proof retractable eyeliner with intense pigment.",
        "inci_ingredients": [
            "Cyclopentasiloxane",
            "Isododecane",
            "Dimethicone",
            "Polyethylene",
            "Ozokerite",
            "Trimethylsiloxysilicate",
            "Phenyl Trimethicone",
            "Paraffin",
            "Synthetic Beeswax",
            "Phenoxyethanol",
        ],
        "filters": {"finish": "matte", "skin_type": "all"},
        "price": 10.00,
    },

    # mascara
    {
        "source_id": "agent_test:mascara",
        "name": "Better Than Sex Mascara",
        "brand": "Too Faced",
        "category_key": "mascara",
        "image_url": "/placeholder-product.jpg",
        "description": "Volumizing mascara with a unique hourglass-shaped brush.",
        "inci_ingredients": [
            "Aqua",
            "Synthetic Beeswax",
            "Ozokerite",
            "Stearic Acid",
            "Triethanolamine",
            "Acacia Senegal Gum",
            "Shellac",
            "Glycerin",
            "Phenoxyethanol",
            "Benzyl Alcohol",
        ],
        "filters": {"finish": "matte", "skin_type": "all"},
        "price": 27.00,
    },

    # false-lashes
    {
        "source_id": "agent_test:false-lashes",
        "name": "Wispies False Lashes",
        "brand": "Ardell",
        "category_key": "false-lashes",
        "image_url": "/placeholder-product.jpg",
        "description": "Natural-looking wispy false lashes with an invisible band.",
        "inci_ingredients": [],          # no INCI — purely physical product
        "specs": ["Synthetic fiber", "Latex-free band", "Reusable up to 25x"],
        "filters": {"skin_type": "all"},
        "price": 8.99,
    },

    # -------------------------------------------------------------------------
    # BROWS
    # -------------------------------------------------------------------------

    # brow-pencil
    {
        "source_id": "agent_test:brow-pencil",
        "name": "Micro Precision Brow Pencil",
        "brand": "Anastasia Beverly Hills",
        "category_key": "brow-pencil",
        "image_url": "/placeholder-product.jpg",
        "description": "Ultra-fine tip brow pencil for precise, hair-like strokes.",
        "inci_ingredients": [
            "Hydrogenated Vegetable Oil",
            "Synthetic Wax",
            "Ceresin",
            "Microcrystalline Wax",
            "Copernicia Cerifera Cera",
            "Kaolin",
            "Phenoxyethanol",
            "Tocopherol",
        ],
        "filters": {"skin_type": "all"},
        "price": 23.00,
    },

    # brow-gel
    {
        "source_id": "agent_test:brow-gel",
        "name": "Boy Brow Grooming Pomade",
        "brand": "Glossier",
        "category_key": "brow-gel",
        "image_url": "/placeholder-product.jpg",
        "description": "Lightweight pomade that gives brows a fuller, brushed-up look.",
        "inci_ingredients": [
            "Aqua",
            "PVP",
            "Glycerin",
            "Carbomer",
            "Triethanolamine",
            "Phenoxyethanol",
            "Disodium EDTA",
            "Caprylyl Glycol",
        ],
        "filters": {"finish": "natural", "skin_type": "all"},
        "price": 16.00,
    },

    # -------------------------------------------------------------------------
    # CHEEKS
    # -------------------------------------------------------------------------

    # contour — ASSOCIATED WITH DECLINING TREND "Heavy Contouring"
    {
        "source_id": "agent_test:contour",
        "name": "Cream Contour Stick",
        "brand": "NYX Professional Makeup",
        "category_key": "contour",
        "image_url": "/placeholder-product.jpg",
        "description": "Heavily pigmented cream contour for dramatic sculpting.",
        "inci_ingredients": [
            "Isononyl Isononanoate",
            "Ozokerite",
            "Synthetic Beeswax",
            "Microcrystalline Wax",
            "Mineral Oil",
            "Copernicia Cerifera Cera",
            "Lanolin",
            "Phenoxyethanol",
            "Tocopheryl Acetate",
        ],
        "filters": {"finish": "matte", "skin_type": "all"},
        "price": 14.00,
    },

    # bronzer
    {
        "source_id": "agent_test:bronzer",
        "name": "Hoola Matte Bronzer",
        "brand": "Benefit",
        "category_key": "bronzer",
        "image_url": "/placeholder-product.jpg",
        "description": "Cult-favorite natural matte bronzer for a sun-kissed glow.",
        "inci_ingredients": [
            "Talc",
            "Mica",
            "Silica",
            "Dimethicone",
            "Magnesium Stearate",
            "Phenoxyethanol",
            "Ethylhexylglycerin",
            "Zinc Stearate",
            "Tocopheryl Acetate",
        ],
        "filters": {"finish": "matte", "skin_type": "all"},
        "price": 35.00,
    },

    # blush
    {
        "source_id": "agent_test:blush",
        "name": "Ambient Lighting Blush",
        "brand": "Hourglass",
        "category_key": "blush",
        "image_url": "/placeholder-product.jpg",
        "description": "Diffused-light blush with ambient lighting powder for a natural flush.",
        "inci_ingredients": [
            "Mica",
            "Talc",
            "Boron Nitride",
            "Dimethicone",
            "Silica",
            "Lauroyl Lysine",
            "Octyldodecyl Stearoyl Stearate",
            "Phenoxyethanol",
            "Ethylhexylglycerin",
            "Tocopheryl Acetate",
        ],
        "filters": {"finish": "shimmer", "skin_type": "all"},
        "price": 54.00,
    },

    # highlighter
    {
        "source_id": "agent_test:highlighter",
        "name": "Killawatt Freestyle Highlighter",
        "brand": "Fenty Beauty",
        "category_key": "highlighter",
        "image_url": "/placeholder-product.jpg",
        "description": "Multi-use powder highlighter for face, eyes, and body.",
        "inci_ingredients": [
            "Mica",
            "Silica",
            "Dimethicone",
            "Zinc Stearate",
            "Phenyl Trimethicone",
            "Lauroyl Lysine",
            "Caprylyl Glycol",
            "Phenoxyethanol",
            "Tocopheryl Acetate",
        ],
        "filters": {"finish": "shimmer", "skin_type": "all"},
        "price": 34.00,
    },

    # -------------------------------------------------------------------------
    # LIPS
    # -------------------------------------------------------------------------

    # lip-liner
    {
        "source_id": "agent_test:lip-liner",
        "name": "Lip Liner Pencil",
        "brand": "Charlotte Tilbury",
        "category_key": "lip-liner",
        "image_url": "/placeholder-product.jpg",
        "description": "Long-lasting lip liner with a creamy formula.",
        "inci_ingredients": [
            "Synthetic Wax",
            "Ozokerite",
            "Microcrystalline Wax",
            "Hydrogenated Vegetable Oil",
            "Copernicia Cerifera Cera",
            "Tocopheryl Acetate",
            "Phenoxyethanol",
            "Caprylyl Glycol",
        ],
        "filters": {"finish": "matte", "skin_type": "all"},
        "price": 26.00,
    },

    # lipstick
    {
        "source_id": "agent_test:lipstick",
        "name": "Powder Kiss Liquid Lipcolor",
        "brand": "MAC Cosmetics",
        "category_key": "lipstick",
        "image_url": "/placeholder-product.jpg",
        "description": "Velvet-matte liquid lipstick with whipped powder texture.",
        "inci_ingredients": [
            "Isododecane",
            "Dimethicone",
            "Trimethylsiloxysilicate",
            "Cyclopentasiloxane",
            "Phenyl Trimethicone",
            "Polymethyl Methacrylate",
            "Silica",
            "Phenoxyethanol",
            "Tocopheryl Acetate",
            "Caprylyl Glycol",
        ],
        "filters": {"finish": "matte", "skin_type": "all"},
        "price": 22.00,
    },

    # lip-gloss
    {
        "source_id": "agent_test:lip-gloss",
        "name": "Lip Gloss",
        "brand": "Fenty Beauty",
        "category_key": "lip-gloss",
        "image_url": "/placeholder-product.jpg",
        "description": "Plumping high-shine gloss with a non-sticky formula.",
        "inci_ingredients": [
            "Hydrogenated Polyisobutene",
            "Polybutene",
            "Trioctyldodecyl Citrate",
            "Synthetic Fluorphlogopite",
            "Mica",
            "Silica",
            "Ethylhexyl Methoxycinnamate",
            "Tocopheryl Acetate",
            "Phenoxyethanol",
            "Caprylyl Glycol",
        ],
        "filters": {"finish": "glossy", "skin_type": "all"},
        "price": 19.00,
    },
]

# ---------------------------------------------------------------------------
# Trend seed — "Heavy Contouring" declining trend
# ---------------------------------------------------------------------------
SEED_TREND = {
    "source_id": "agent_test:trend-heavy-contouring",
    "name": "Heavy Contouring",
    "slug": "heavy-contouring-agent-test",
    "description": (
        "Dramatic sculpting with heavy cream contour products was a dominant trend "
        "in the 2010s, popularized by reality TV. Modern aesthetics favor softer, "
        "more natural-looking contouring techniques."
    ),
    "direction": "declining",
    # associated_product source_id (resolved to real IDs at runtime)
    "associated_source_ids": ["agent_test:contour"],
}

# ---------------------------------------------------------------------------
# Beauty profile seed — oily skin + dewy preference (triggers artist conflict)
# ---------------------------------------------------------------------------
SEED_BEAUTY_PROFILE_EMAIL = "agent_test_user@shortstamp.test"
SEED_BEAUTY_PROFILE = {
    "skin_tone": "medium",
    "undertone": "neutral",
    "skin_type": "oily",
    "coverage": "medium",
    "finish": "dewy",   # clashes with oily skin (artist agent fires)
    "budget": "mid",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_or_create_brand(db, name: str, cache: dict[str, int]) -> int:
    import re
    key = name.lower()
    if key in cache:
        return cache[key]
    result = await db.execute(select(Brand).where(func.lower(Brand.name) == key))
    brand = result.scalar_one_or_none()
    if not brand:
        slug = re.sub(r"[^a-z0-9]+", "-", key).strip("-")
        slug_check = await db.execute(select(Brand).where(Brand.slug == slug))
        if slug_check.scalar_one_or_none():
            slug = slug + "-seed"
        brand = Brand(name=name, slug=slug)
        db.add(brand)
        await db.flush()
        print(f"  [new brand] {name!r}")
    cache[key] = brand.id
    return brand.id


# ---------------------------------------------------------------------------
# Main seed logic
# ---------------------------------------------------------------------------

async def run(dry_run: bool) -> None:
    stats = {"created": 0, "skipped": 0, "trends": 0, "profiles": 0}
    brand_cache: dict[str, int] = {}

    # Map source_id → product.id (populated after inserts; needed for trend links)
    source_to_product_id: dict[str, str] = {}

    async with async_session() as db:

        # ------------------------------------------------------------------
        # Products
        # ------------------------------------------------------------------
        for pdata in SEED_PRODUCTS:
            source_id = pdata["source_id"]

            # Check if already seeded
            existing = await db.execute(
                select(Product).where(Product.source_id == source_id)
            )
            existing_product = existing.scalar_one_or_none()
            if existing_product:
                stats["skipped"] += 1
                source_to_product_id[source_id] = existing_product.id
                print(f"  [skip] {pdata['name']!r} already exists")
                continue

            brand_id = await _get_or_create_brand(db, pdata["brand"], brand_cache)

            filters = pdata.get("filters", {})
            price = pdata.get("price", 0.0)

            product = Product(
                name=pdata["name"],
                brand_id=brand_id,
                category_key=pdata["category_key"],
                image_url=pdata.get("image_url", "/placeholder-product.jpg"),
                description=pdata.get("description"),
                specs=pdata.get("specs"),
                inci_ingredients=pdata.get("inci_ingredients") or None,
                source="agent_test_seed",
                source_id=source_id,
                is_active=True,
                stamp_score=75,
            )

            if not dry_run:
                db.add(product)
                await db.flush()  # generate product.id

                # Filter values
                for fkey, fval in filters.items():
                    db.add(ProductFilterValue(
                        product_id=product.id,
                        filter_key=fkey,
                        value=str(fval),
                    ))

                # Price row (required for product to appear in search results)
                db.add(ProductPrice(
                    product_id=product.id,
                    source="agent_test_seed",
                    price=price,
                    currency="USD",
                    url="https://example.com/product",
                    in_stock=True,
                    availability="in_stock",
                ))

                source_to_product_id[source_id] = product.id
                stats["created"] += 1
                print(f"  [create] {pdata['name']!r} ({pdata['category_key']})")
            else:
                print(f"  DRY: would create {pdata['name']!r} ({pdata['category_key']})")
                stats["created"] += 1

        # ------------------------------------------------------------------
        # Trend
        # ------------------------------------------------------------------
        tdata = SEED_TREND
        trend_check = await db.execute(
            select(Trend).where(Trend.slug == tdata["slug"])
        )
        existing_trend = trend_check.scalar_one_or_none()

        if existing_trend:
            stats["skipped"] += 1
            trend_obj = existing_trend
            print(f"  [skip] trend {tdata['name']!r} already exists")
        elif not dry_run:
            trend_obj = Trend(
                name=tdata["name"],
                slug=tdata["slug"],
                description=tdata["description"],
                direction=tdata["direction"],
                is_active=True,
            )
            db.add(trend_obj)
            await db.flush()
            stats["trends"] += 1
            print(f"  [create] trend {tdata['name']!r}")

            # Associate products
            for associated_source_id in tdata["associated_source_ids"]:
                product_id = source_to_product_id.get(associated_source_id)
                if product_id:
                    db.add(TrendProduct(
                        trend_id=trend_obj.id,
                        product_id=product_id,
                        sort_order=0,
                    ))
                else:
                    print(f"    [warn] trend product {associated_source_id!r} not found — skipping link")
        else:
            print(f"  DRY: would create trend {tdata['name']!r}")
            stats["trends"] += 1

        # ------------------------------------------------------------------
        # Test beauty profile (for artist agent oily+dewy conflict)
        # ------------------------------------------------------------------
        user_result = await db.execute(
            select(User).where(User.email == SEED_BEAUTY_PROFILE_EMAIL)
        )
        test_user = user_result.scalar_one_or_none()

        if not test_user and not dry_run:
            import bcrypt
            pw_hash = bcrypt.hashpw(b"testpassword", bcrypt.gensalt()).decode()
            test_user = User(
                email=SEED_BEAUTY_PROFILE_EMAIL,
                password_hash=pw_hash,
                is_active=True,
                is_admin=False,
            )
            db.add(test_user)
            await db.flush()
            print(f"  [create] test user {SEED_BEAUTY_PROFILE_EMAIL!r}")

        if test_user and not dry_run:
            # Upsert beauty profile
            bp_result = await db.execute(
                select(BeautyProfile).where(BeautyProfile.user_id == test_user.id)
            )
            bp = bp_result.scalar_one_or_none()
            if not bp:
                bp = BeautyProfile(user_id=test_user.id)
                db.add(bp)
            for attr, val in SEED_BEAUTY_PROFILE.items():
                setattr(bp, attr, val)
            stats["profiles"] += 1
            print(f"  [upsert] beauty profile for {SEED_BEAUTY_PROFILE_EMAIL!r}")
        elif dry_run:
            print(f"  DRY: would create test user + beauty profile for {SEED_BEAUTY_PROFILE_EMAIL!r}")

        if not dry_run:
            await db.commit()

    print(f"\n{'DRY RUN — ' if dry_run else ''}Results:")
    print(f"  Products created:  {stats['created']}")
    print(f"  Products skipped:  {stats['skipped']}")
    print(f"  Trends created:    {stats['trends']}")
    print(f"  Profiles:          {stats['profiles']}")


if __name__ == "__main__":
    print(f"Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}\n")
    asyncio.run(run(DRY_RUN))
