from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.product import PaginatedProducts, ProductDetail, RetailerPriceSchema
from app.services import product_service

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=PaginatedProducts)
async def list_products(
    category: str | None = None,
    search: str | None = None,
    sort: str = "stamp_score_desc",
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    # Filter params come as query params like filters[finish]=Matte
    finish: str | None = Query(None, alias="filters[finish]"),
    coverage: str | None = Query(None, alias="filters[coverage]"),
    formula: str | None = Query(None, alias="filters[formula]"),
    skin_type: str | None = Query(None, alias="filters[skinType]"),
    brand: str | None = Query(None, alias="filters[brand]"),
    type_filter: str | None = Query(None, alias="filters[type]"),
    waterproof: str | None = Query(None, alias="filters[waterproof]"),
    effect: str | None = Query(None, alias="filters[effect]"),
    style: str | None = Query(None, alias="filters[style]"),
    material: str | None = Query(None, alias="filters[material]"),
    tinted: str | None = Query(None, alias="filters[tinted]"),
    hold: str | None = Query(None, alias="filters[hold]"),
    db: AsyncSession = Depends(get_db),
):
    filters: dict[str, str] = {}
    filter_map = {
        "finish": finish,
        "coverage": coverage,
        "formula": formula,
        "skinType": skin_type,
        "brand": brand,
        "type": type_filter,
        "waterproof": waterproof,
        "effect": effect,
        "style": style,
        "material": material,
        "tinted": tinted,
        "hold": hold,
    }
    for key, value in filter_map.items():
        if value is not None:
            filters[key] = value

    return await product_service.list_products(
        db,
        category=category,
        search=search,
        filters=filters or None,
        sort=sort,
        page=page,
        per_page=per_page,
    )


@router.get("/{product_id}", response_model=ProductDetail)
async def get_product(product_id: str, db: AsyncSession = Depends(get_db)):
    return await product_service.get_product(db, product_id)


@router.get("/{product_id}/prices", response_model=list[RetailerPriceSchema])
async def get_product_prices(product_id: str, db: AsyncSession = Depends(get_db)):
    return await product_service.get_product_prices(db, product_id)
