"""StampScore calculation engine.

Score = weighted sum of four components (0-100 each), clamped to [0, 100].

Weights (v0):
    review       30%
    popularity   25%
    ingredient   20%
    value        25%
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ingestion import StampScoreHistory
from app.models.product import Product, ProductPrice, ProductReview

SCORE_VERSION = "v0"

WEIGHTS = {
    "review": 0.30,
    "popularity": 0.25,
    "ingredient": 0.20,
    "value": 0.25,
}


async def calculate_product_score(db: AsyncSession, product: Product) -> tuple[int, dict]:
    """Calculate StampScore (0-100) for a product.

    Returns:
        (total_score, components_dict) where components_dict has raw 0-100 values.
    """
    # --- Review score (30%) ---
    result = await db.execute(
        select(
            func.avg(ProductReview.rating),
            func.count(ProductReview.id),
        ).where(ProductReview.product_id == product.id)
    )
    row = result.one()
    avg_rating = row[0] or 0
    review_count = row[1] or 0
    # Confidence ramps linearly from 0 to 1 as review count goes from 0 to 50.
    # With zero reviews, score settles to neutral 50.
    confidence = min(1.0, review_count / 50)
    review_score = (avg_rating / 5.0) * 100 * confidence + 50 * (1 - confidence)

    # --- Popularity score (25%) --- placeholder until trend/build data is richer
    popularity_score = 50.0

    # --- Ingredient score (20%) --- placeholder until OBF ingredient data parsed
    ingredient_score = 70.0

    # --- Value score (25%) --- derived from Walmart price if available, else 60
    value_score = 60.0
    price_result = await db.execute(
        select(ProductPrice.price).where(
            ProductPrice.product_id == product.id,
            ProductPrice.source == "walmart",
        )
    )
    walmart_price = price_result.scalar_one_or_none()
    if walmart_price is not None and walmart_price > 0:
        # Heuristic: products under $15 get higher value scores, over $50 get lower.
        # Linear mapping: $0 -> 100, $50 -> 50, $100+ -> 20
        value_score = max(20.0, min(100.0, 100 - (walmart_price - 0) * 0.8))

    components = {
        "review": round(review_score, 1),
        "popularity": round(popularity_score, 1),
        "ingredient": round(ingredient_score, 1),
        "value": round(value_score, 1),
    }

    total = int(
        review_score * WEIGHTS["review"]
        + popularity_score * WEIGHTS["popularity"]
        + ingredient_score * WEIGHTS["ingredient"]
        + value_score * WEIGHTS["value"]
    )
    return max(0, min(100, total)), components


async def recalculate_all_scores(db: AsyncSession) -> tuple[int, dict]:
    """Recalculate StampScores for all active products.

    Returns:
        (count_updated, stats_dict)
    """
    result = await db.execute(
        select(Product).where(Product.is_active == True)  # noqa: E712
    )
    updated = 0
    total = 0
    for product in result.scalars():
        total += 1
        old_score = product.stamp_score
        new_score, components = await calculate_product_score(db, product)
        if new_score != old_score:
            product.stamp_score = new_score
            db.add(
                StampScoreHistory(
                    product_id=product.id,
                    old_score=old_score,
                    new_score=new_score,
                    score_version=SCORE_VERSION,
                    components=components,
                    weights=WEIGHTS,
                )
            )
            updated += 1
    await db.commit()
    return updated, {"total_products": total, "scores_changed": updated}
