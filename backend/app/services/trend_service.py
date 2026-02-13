from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.product import Product, ProductFilterValue, ProductPrice
from app.models.trend import Trend, TrendProduct
from app.schemas.product import ProductListItem, RetailerPriceSchema
from app.schemas.trend import TrendDetail, TrendListItem
from app.utils.exceptions import NotFoundError


async def list_trends(db: AsyncSession) -> list[TrendListItem]:
    result = await db.execute(
        select(Trend)
        .where(Trend.is_active == True)  # noqa: E712
        .order_by(Trend.stamp_score.desc())
    )
    return [
        TrendListItem(
            id=t.id,
            name=t.name,
            image=t.image_url,
            stamp_score=t.stamp_score,
            description=t.description,
            direction=t.direction,
        )
        for t in result.scalars()
    ]


async def get_trend(db: AsyncSession, trend_id: str) -> TrendDetail:
    result = await db.execute(
        select(Trend)
        .where(Trend.id == trend_id)
        .options(
            selectinload(Trend.products)
            .selectinload(TrendProduct.product)
            .selectinload(Product.brand),
            selectinload(Trend.products)
            .selectinload(TrendProduct.product)
            .selectinload(Product.prices)
            .selectinload(ProductPrice.retailer),
            selectinload(Trend.products)
            .selectinload(TrendProduct.product)
            .selectinload(Product.filter_values),
            selectinload(Trend.videos),
            selectinload(Trend.articles),
        )
    )
    trend = result.scalar_one_or_none()
    if not trend:
        raise NotFoundError("Trend not found")

    products = []
    for tp in trend.products:
        p = tp.product
        products.append(
            ProductListItem(
                id=p.id,
                name=p.name,
                brand=p.brand.name,
                image=p.image_url,
                category=p.category_key,
                stamp_score=p.stamp_score,
                prices=[
                    RetailerPriceSchema(
                        retailer=pr.retailer.name,
                        price=pr.price,
                        url=pr.url,
                        in_stock=pr.in_stock,
                    )
                    for pr in p.prices
                ],
                filters={fv.filter_key: fv.value for fv in p.filter_values},
            )
        )

    return TrendDetail(
        id=trend.id,
        name=trend.name,
        image=trend.image_url,
        stamp_score=trend.stamp_score,
        description=trend.description,
        direction=trend.direction,
        products=products,
        videos=[v.url for v in trend.videos],
        articles=[{"title": a.title, "url": a.url} for a in trend.articles],
    )
