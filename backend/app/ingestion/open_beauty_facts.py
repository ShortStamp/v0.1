import logging

import httpx
from sqlalchemy import select

from app.database import async_session
from app.models.ingestion import IngestionRun
from app.models.product import Brand, Product

logger = logging.getLogger(__name__)

BASE_URL = "https://world.openfoodfacts.org/cgi/search.pl"

# Beauty-related categories to search
SEARCH_TERMS = [
    "foundation", "concealer", "primer", "powder", "blush",
    "bronzer", "highlighter", "eyeshadow", "eyeliner", "mascara",
    "lipstick", "lip gloss", "lip liner", "setting spray",
    "brow pencil", "brow gel",
]


async def ingest_open_beauty_facts():
    """Fetch product data from Open Beauty Facts (CC-BY-SA licensed).

    This searches the Open Beauty Facts/Open Products Facts API for cosmetics,
    creating or updating product records and brand entries.
    """
    async with async_session() as db:
        run = IngestionRun(source="open_beauty_facts")
        db.add(run)
        await db.flush()

        added = 0
        updated = 0

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                for term in SEARCH_TERMS:
                    resp = await client.get(
                        BASE_URL,
                        params={
                            "search_terms": term,
                            "search_simple": 1,
                            "action": "process",
                            "json": 1,
                            "page_size": 10,
                            "tagtype_0": "categories",
                            "tag_contains_0": "contains",
                            "tag_0": "beauty",
                        },
                    )
                    if resp.status_code != 200:
                        logger.warning(f"OBF search failed for '{term}': {resp.status_code}")
                        continue

                    data = resp.json()
                    products = data.get("products", [])

                    for item in products:
                        barcode = item.get("code")
                        name = item.get("product_name", "").strip()
                        brand_name = item.get("brands", "").strip()

                        if not name or not barcode:
                            continue

                        # Check if product exists by barcode
                        existing = await db.execute(
                            select(Product).where(Product.upc == barcode)
                        )
                        if existing.scalar_one_or_none():
                            updated += 1
                            continue

                        # Get or create brand
                        brand = None
                        if brand_name:
                            result = await db.execute(
                                select(Brand).where(Brand.name == brand_name)
                            )
                            brand = result.scalar_one_or_none()
                            if not brand:
                                brand = Brand(
                                    name=brand_name,
                                    slug=brand_name.lower().replace(" ", "-"),
                                )
                                db.add(brand)
                                await db.flush()

                        if brand:
                            product = Product(
                                name=name,
                                brand_id=brand.id,
                                category_key=_map_category(term),
                                upc=barcode,
                                open_beauty_facts_id=barcode,
                                image_url=item.get("image_url", "/placeholder-product.jpg"),
                                description=item.get("generic_name", ""),
                            )
                            db.add(product)
                            added += 1

            run.status = "completed"
            run.products_added = added
            run.products_updated = updated

        except Exception as e:
            run.status = "failed"
            run.error_message = str(e)
            logger.error(f"Open Beauty Facts ingestion failed: {e}")

        await db.commit()
        logger.info(f"OBF ingestion: {added} added, {updated} updated")


def _map_category(search_term: str) -> str:
    """Map a search term to the closest category key."""
    mapping = {
        "foundation": "foundation",
        "concealer": "concealer",
        "primer": "primer",
        "powder": "powder",
        "blush": "blush",
        "bronzer": "bronzer",
        "highlighter": "highlighter",
        "eyeshadow": "eyeshadow",
        "eyeliner": "eyeliner",
        "mascara": "mascara",
        "lipstick": "lipstick",
        "lip gloss": "lip-gloss",
        "lip liner": "lip-liner",
        "setting spray": "setting-spray",
        "brow pencil": "brow-pencil",
        "brow gel": "brow-gel",
    }
    return mapping.get(search_term, "foundation")
