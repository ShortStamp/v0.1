import asyncio
import logging

from sqlalchemy import delete
from app.database import async_session
from app.models.category import Category, CategoryGroup
from app.models.product import Brand, Product

logger = logging.getLogger(__name__)

async def seed_products():
    """Seed the database with sample products."""
    async with async_session() as db:
        # Clear existing data
        await db.execute(delete(Product))
        await db.execute(delete(Brand))
        await db.execute(delete(Category))
        await db.execute(delete(CategoryGroup))
        await db.commit()

        # Seed Category Groups
        category_groups = [
            CategoryGroup(key="face", label="Face"),
            CategoryGroup(key="eyes", label="Eyes"),
            CategoryGroup(key="lips", label="Lips"),
        ]
        db.add_all(category_groups)
        await db.commit()

        # Seed Categories
        categories = [
            Category(key="foundation", label="Foundation", group_key="face"),
            Category(key="blush", label="Blush", group_key="face"),
            Category(key="lipstick", label="Lipstick", group_key="lips"),
        ]
        db.add_all(categories)
        await db.commit()

        brands = [
            Brand(name="Fenty Beauty", slug="fenty-beauty"),
            Brand(name="Glossier", slug="glossier"),
            Brand(name="MAC Cosmetics", slug="mac-cosmetics"),
        ]
        db.add_all(brands)
        await db.flush()

        products = [
            Product(
                name="Pro Filt'r Soft Matte Longwear Foundation",
                brand_id=brands[0].id,
                category_key="foundation",
                upc="816657022415",
                image_url="https://www.fentybeauty.com/dw/image/v2/BDSF_PRD/on/demandware.static/-/Sites-fenty-master-catalog/default/dw1f3d3b9e/images/hi-res/FB30001_FB0001.jpg",
                description="A soft matte, long-wear foundation with buildable, medium to full coverage.",
            ),
            Product(
                name="Cloud Paint",
                brand_id=brands[1].id,
                category_key="blush",
                upc="810004120021",
                image_url="https://glossier-prod.imgix.net/products/glossier-cloudpaint-new-carousel-01.jpg",
                description="A seamless, buildable gel-cream blush that's fun to apply and easy to wear.",
            ),
            Product(
                name="Matte Lipstick",
                brand_id=brands[2].id,
                category_key="lipstick",
                upc="773602048482",
                image_url="https://m.media-amazon.com/images/I/61Z0gq4rJtL._SY355_.jpg",
                description="A creamy rich lipstick formula with high colour payoff in a no-shine matte finish.",
            ),
        ]
        db.add_all(products)
        await db.commit()
        logger.info("Seeded database with sample products.")

if __name__ == "__main__":
    asyncio.run(seed_products())
