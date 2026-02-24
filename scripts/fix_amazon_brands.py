"""
Fix products incorrectly assigned brand="Amazon".

For each such product:
  1. URL-decode the product name.
  2. Match the title prefix against BRAND_PREFIXES (longest first — greedy).
  3. Strip the matched brand prefix and clean trailing Amazon noise.
  4. Find or create the real brand in the DB; update product.brand_id and name.
  5. Products with no recognisable brand prefix are left untouched.

Run from the repo root:
    PYTHONPATH=backend python scripts/fix_amazon_brands.py [--dry-run]
"""
from __future__ import annotations

import asyncio
import re
import sys
from urllib.parse import unquote

# Ensure backend package is importable
sys.path.insert(0, "backend")

import app.models.build  # noqa: F401 — must import all models to resolve relationships
import app.models.category  # noqa: F401
import app.models.compatibility  # noqa: F401
import app.models.trend  # noqa: F401
import app.models.user  # noqa: F401

from sqlalchemy import func, select

from app.database import async_session
from app.models.product import Brand, Product

DRY_RUN = "--dry-run" in sys.argv

# ---------------------------------------------------------------------------
# Brand prefix → canonical name.  Sorted longest-first for greedy matching.
# ---------------------------------------------------------------------------
_RAW_BRAND_PREFIXES: dict[str, str] = {
    "Anastasia Beverly Hills": "Anastasia Beverly Hills",
    "Nyx Professional Makeup": "NYX Professional Makeup",
    "Markwins Beauty Brands": "Markwins",
    "Laura Geller New York": "Laura Geller",
    "Revitalash Cosmetics": "RevitaLash Cosmetics",
    "Maybelline New York": "Maybelline",
    "Physicians Formula": "Physicians Formula",
    "Kimchi Chic Beauty": "Kimchi Chic Beauty",
    "Loreal Highlighter": "L'Oréal Paris",
    "Charlotte Tilbury": "Charlotte Tilbury",
    "Makeup Revolution": "Makeup Revolution",
    "Revolution Beauty": "Revolution Beauty",
    "Benefit Cosmetics": "Benefit",
    "Lor%C3%A9Al Paris": "L'Oréal Paris",
    "Loreal True Match": "L'Oréal Paris",
    "Est%C3%A9E Lauder": "Estée Lauder",
    "Absolute New York": "Absolute New York",
    "Revlon Colorstay": "Revlon",
    "Grande Cosmetics": "Grande Cosmetics",
    "P%C3%9Cr Mineral": "PÜR",
    "First Aid Beauty": "First Aid Beauty",
    "Tower 28 Beauty": "Tower 28 Beauty",
    "Too Cool School": "Too Cool For School",
    "E L F Cosmetics": "e.l.f. Cosmetics",
    "Glo Skin Beauty": "Glo Skin Beauty",
    "Nature Republic": "Nature Republic",
    "Sungboon Editor": "SUNGBOON EDITOR",
    "Elizabeth Mott": "Elizabeth Mott",
    "Black Radiance": "Black Radiance",
    "Mineral Fusion": "Mineral Fusion",
    "Summer Fridays": "Summer Fridays",
    "Pinaud Clubman": "Pinaud Clubman",
    "Aoa Collection": "AOA Collection",
    "Thrive Mascara": "Thrive Causemetics",
    "Grace & Stella": "grace & stella",
    "Rimmel London": "Rimmel",
    "Amazon Basics": "Amazon Basics",
    "L F Cosmetics": "e.l.f. Cosmetics",
    "Bare Minerals": "bareMinerals",
    "Iconic London": "Iconic London",
    "Italia Deluxe": "Italia Deluxe",
    "Laura Mercier": "Laura Mercier",
    "Btartboxnails": "BTArtboxnails",
    "Luxe Research": "Luxe Research",
    "Colorescience": "Colorescience",
    "Magicminerals": "MagicMinerals",
    "Loreal Paris": "L'Oréal Paris",
    "Lanc%C3%B4Me": "Lancôme",
    "Estee Lauder": "Estée Lauder",
    "Jane Iredale": "Jane Iredale",
    "Juvias Place": "Juvia's Place",
    "Laura Geller": "Laura Geller",
    "Townley Girl": "Townley Girl",
    "Bareminerals": "bareMinerals",
    "City Beauty": "City Beauty",
    "Ruby Kisses": "Ruby Kisses",
    "Rare Beauty": "Rare Beauty",
    "Milk Makeup": "Milk Makeup",
    "Bobbi Brown": "Bobbi Brown",
    "Kiko Milano": "KIKO Milano",
    "Urban Decay": "Urban Decay",
    "Skindinavia": "Skindinavia",
    "Young Nails": "Young Nails",
    "Embryolisse": "Embryolisse",
    "Dermalogica": "Dermalogica",
    "Jlo Beauty": "JLo Beauty",
    "Burts Bees": "Burt's Bees",
    "Wonderskin": "Wonderskin",
    "Strivectin": "StriVectin",
    "Dermablend": "Dermablend",
    "Neutrogena": "Neutrogena",
    "Maybelline": "Maybelline",
    "Pur Beauty": "PÜR Beauty",
    "Wunderbrow": "Wunderbrow",
    "L A Colors": "L.A. Colors",
    "Too Faced": "Too Faced",
    "Gold Bond": "Gold Bond",
    "Glamnetic": "Glamnetic",
    "Colourpop": "ColourPop",
    "Covergirl": "CoverGirl",
    "Hourglass": "Hourglass",
    "Focallure": "Focallure",
    "Mary Kay": "Mary Kay",
    "Coco Eve": "Coco & Eve",
    "Smashbox": "Smashbox",
    "Clinique": "Clinique",
    "Glossier": "Glossier",
    "Pacifica": "Pacifica",
    "Palladio": "Palladio",
    "One Size": "One Size",
    "Markwins": "Markwins",
    "Airspun": "Airspun",
    "Clarins": "Clarins",
    "Catrice": "Catrice",
    "Essence": "essence",
    "Sheglam": "SHEGLAM",
    "Benefit": "Benefit",
    "Lancome": "Lancôme",
    "Laneige": "LANEIGE",
    "Thebalm": "theBalm",
    "Ammens": "Ammens",
    "Revlon": "Revlon",
    "Milani": "Milani",
    "Morphe": "Morphe",
    "Rimmel": "Rimmel",
    "Loreal": "L'Oréal Paris",
    "Ardell": "Ardell",
    "L Girl": "L.A. Girl",
    "Almay": "Almay",
    "Tarte": "Tarte",
    "Stila": "Stila",
    "Kosas": "Kosas",
    "Buxom": "Buxom",
    "Julep": "Julep",
    "E L F": "e.l.f. Cosmetics",
    "Nars": "NARS",
    "Dior": "Dior",
    "Ilia": "ILIA",
    "Saie": "Saie",
    "Refy": "REFY",
    "No7": "No7",
    "Mac": "MAC Cosmetics",
    "L F": "e.l.f. Cosmetics",
    "W7": "W7",
}

# Sort by prefix length descending so longest matches win
BRAND_PREFIXES: list[tuple[str, str]] = sorted(
    _RAW_BRAND_PREFIXES.items(), key=lambda x: len(x[0]), reverse=True
)

# Trailing noise patterns appended by Amazon (size, count, "Packaging", etc.)
_NOISE_RE = re.compile(
    r"""
    \s*
    (
        \d+(\.\d+)?\s*(fl\.?\s*oz|fluid\s+ounces?|ounces?|oz|ml|g|lb|lbs|count|ct|pack|pcs?|piece)s?
        | packaging
        | \d+\s*pack
        | \d+\s*piece
    )
    \s*$
    """,
    re.IGNORECASE | re.VERBOSE,
)


def _decode(s: str) -> str:
    """URL-decode a string and normalise whitespace."""
    return re.sub(r"\s+", " ", unquote(s)).strip()


def _match_brand(title_decoded: str) -> tuple[str, str] | None:
    """
    Try to match the start of the decoded title against BRAND_PREFIXES.
    Returns (matched_prefix_decoded, canonical_brand_name) or None.
    """
    title_lower = title_decoded.lower()
    for raw_prefix, canonical in BRAND_PREFIXES:
        prefix_decoded = _decode(raw_prefix).lower()
        if title_lower.startswith(prefix_decoded):
            # Make sure it's a whole-word match (next char is space or end)
            after = title_decoded[len(prefix_decoded):]
            if after == "" or after[0] == " ":
                return (_decode(raw_prefix), canonical)
    return None


def _clean_title(title_decoded: str, brand_prefix_decoded: str) -> str:
    """Strip brand prefix and trailing Amazon noise from a decoded title."""
    # Remove brand prefix (case-insensitive)
    without_brand = title_decoded[len(brand_prefix_decoded):].strip()
    # Strip trailing size/count/packaging noise
    cleaned = _NOISE_RE.sub("", without_brand).strip()
    return cleaned if cleaned else without_brand


async def _get_or_create_brand(db, name: str, cache: dict[str, int]) -> int:
    key = name.lower()
    if key in cache:
        return cache[key]
    result = await db.execute(select(Brand).where(func.lower(Brand.name) == key))
    brand = result.scalar_one_or_none()
    if not brand:
        slug = re.sub(r"[^a-z0-9]+", "-", key).strip("-")
        # Ensure slug uniqueness
        slug_check = await db.execute(select(Brand).where(Brand.slug == slug))
        if slug_check.scalar_one_or_none():
            slug = slug + "-2"
        brand = Brand(name=name, slug=slug)
        db.add(brand)
        await db.flush()
        print(f"  [new brand] {name!r}")
    cache[key] = brand.id
    return brand.id


async def run(dry_run: bool) -> None:
    stats = {
        "total": 0,
        "matched": 0,
        "unmatched": 0,
        "title_cleaned": 0,
    }
    brand_cache: dict[str, int] = {}

    async with async_session() as db:
        # Load Amazon brand id
        r = await db.execute(select(Brand).where(func.lower(Brand.name) == "amazon"))
        amazon_brand = r.scalar_one_or_none()
        if not amazon_brand:
            print("No brand named 'Amazon' found — nothing to do.")
            return

        # Load all Amazon-branded products
        r = await db.execute(
            select(Product).where(Product.brand_id == amazon_brand.id)
        )
        products = r.scalars().all()
        stats["total"] = len(products)
        print(f"Found {len(products)} products with brand='Amazon'\n")

        unmatched_titles: list[str] = []

        for product in products:
            decoded_name = _decode(product.name)
            match = _match_brand(decoded_name)

            if match is None:
                stats["unmatched"] += 1
                unmatched_titles.append(decoded_name)
                continue

            prefix_decoded, canonical_brand = match
            clean_name = _clean_title(decoded_name, prefix_decoded)

            stats["matched"] += 1
            if clean_name != product.name:
                stats["title_cleaned"] += 1

            if not dry_run:
                real_brand_id = await _get_or_create_brand(db, canonical_brand, brand_cache)
                product.brand_id = real_brand_id
                product.name = clean_name
            else:
                print(
                    f"  DRY: {product.name!r}\n"
                    f"    → brand={canonical_brand!r}, name={clean_name!r}"
                )

        if not dry_run:
            await db.commit()

    print(f"\n{'DRY RUN — ' if dry_run else ''}Results:")
    print(f"  Total Amazon-branded:  {stats['total']}")
    print(f"  Brand matched:         {stats['matched']}")
    print(f"  Title cleaned:         {stats['title_cleaned']}")
    print(f"  No match (unchanged):  {stats['unmatched']}")

    if unmatched_titles:
        print(f"\nUnmatched titles ({len(unmatched_titles)}) — brand left as 'Amazon':")
        for t in sorted(set(unmatched_titles))[:40]:
            print(f"  {t!r}")
        if len(unmatched_titles) > 40:
            print(f"  … and {len(unmatched_titles) - 40} more")


if __name__ == "__main__":
    print(f"Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}\n")
    asyncio.run(run(DRY_RUN))
