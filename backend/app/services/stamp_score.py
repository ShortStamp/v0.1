from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ingestion import StampScoreHistory
from app.models.product import Product, ProductReview


async def calculate_product_score(db: AsyncSession, product_id: str) -> int:
    """Calculate StampScore (0-100) for a product.

    Components:
    - Review score (30%): (avg_rating / 5) * 100 * min(1, count / 50)
    - Popularity score (25%): based on trend inclusion + build frequency
    - Ingredient score (20%): from Open Beauty Facts (default 70)
    - Value score (25%): price-to-quality ratio
    """
    # Review score
    result = await db.execute(
        select(
            func.avg(ProductReview.rating),
            func.count(ProductReview.id),
        ).where(ProductReview.product_id == product_id)
    )
    row = result.one()
    avg_rating = row[0] or 0
    review_count = row[1] or 0
    confidence = min(1.0, review_count / 50)
    review_score = (avg_rating / 5.0) * 100 * confidence

    # Popularity — placeholder until trend/build data is richer
    popularity_score = 50

    # Ingredient score — default until Open Beauty Facts data is ingested
    ingredient_score = 70

    # Value score — placeholder
    value_score = 60

    total = int(
        review_score * 0.30
        + popularity_score * 0.25
        + ingredient_score * 0.20
        + value_score * 0.25
    )
    return max(0, min(100, total))


async def recalculate_all_scores(db: AsyncSession) -> int:
    """Recalculate StampScores for all active products. Returns count updated."""
    result = await db.execute(
        select(Product).where(Product.is_active == True)  # noqa: E712
    )
    count = 0
    for product in result.scalars():
        old_score = product.stamp_score
        new_score = await calculate_product_score(db, product.id)
        if new_score != old_score:
            product.stamp_score = new_score
            db.add(
                StampScoreHistory(
                    product_id=product.id,
                    old_score=old_score,
                    new_score=new_score,
                    components={
                        "review": 0.30,
                        "popularity": 0.25,
                        "ingredient": 0.20,
                        "value": 0.25,
                    },
                )
            )
            count += 1
    await db.commit()
    return count
