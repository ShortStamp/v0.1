from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.product import (
    FilterPropertiesResponse,
    PaginatedProducts,
    ProductDetail,
    RetailerPriceSchema,
)
from app.services import product_service

router = APIRouter(prefix="/products", tags=["products"])


def _extract_filter_params(request: Request) -> dict[str, str]:
    filters: dict[str, str] = {}
    for key, raw_value in request.query_params.multi_items():
        if not key.startswith("filters[") or not key.endswith("]"):
            continue
        filter_key = key[8:-1].strip()
        value = raw_value.strip()
        if not filter_key or not value:
            continue
        if filter_key in filters:
            filters[filter_key] = f"{filters[filter_key]},{value}"
        else:
            filters[filter_key] = value
    return filters


@router.get("", response_model=PaginatedProducts)
async def list_products(
    request: Request,
    category: str | None = None,
    search: str | None = None,
    sort: str = "stamp_score_desc",
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    filters = _extract_filter_params(request)

    return await product_service.list_products(
        db,
        category=category,
        search=search,
        filters=filters or None,
        sort=sort,
        page=page,
        per_page=per_page,
    )


@router.get("/brands", response_model=list[str])
async def list_product_brands(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    return await product_service.list_brands(db, category=category)


@router.get("/filter-properties", response_model=FilterPropertiesResponse)
async def get_filter_properties(
    request: Request,
    category: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    filters = _extract_filter_params(request)
    return await product_service.list_filter_properties(
        db,
        category=category,
        search=search,
        filters=filters or None,
    )


@router.get("/{product_id}", response_model=ProductDetail)
async def get_product(product_id: str, db: AsyncSession = Depends(get_db)):
    return await product_service.get_product(db, product_id)


@router.get("/{product_id}/prices", response_model=list[RetailerPriceSchema])
async def get_product_prices(product_id: str, db: AsyncSession = Depends(get_db)):
    return await product_service.get_product_prices(db, product_id)
