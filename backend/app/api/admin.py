from __future__ import annotations

import math

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth_middleware import require_admin
from app.models.product import Brand, Product, ProductPrice
from app.models.user import User
from app.schemas.admin import (
    AdminBrand,
    AdminPriceCreate,
    AdminPriceRow,
    AdminPriceUpdate,
    AdminProductCreate,
    AdminProductDetail,
    AdminProductListItem,
    AdminProductUpdate,
    AdminStats,
    PaginatedAdminProducts,
)
from app.utils.exceptions import NotFoundError

router = APIRouter(prefix="/admin", tags=["admin"])


def _product_to_list_item(product: Product) -> AdminProductListItem:
    return AdminProductListItem(
        id=product.id,
        name=product.name,
        brand=product.brand.name if product.brand else "Unknown",
        category=product.category_key,
        image_url=product.image_url,
        stamp_score=product.stamp_score,
        is_active=product.is_active,
        source=product.source,
        walmart_item_id=product.walmart_item_id,
        amazon_asin=product.amazon_asin,
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


def _product_to_detail(product: Product) -> AdminProductDetail:
    prices = [
        AdminPriceRow(
            id=p.id,
            retailer=p.retailer.name if p.retailer else p.source,
            source=p.source,
            price=p.price,
            url=p.url,
            in_stock=p.in_stock,
        )
        for p in (product.prices or [])
    ]
    return AdminProductDetail(
        id=product.id,
        name=product.name,
        brand=product.brand.name if product.brand else "Unknown",
        category=product.category_key,
        image_url=product.image_url,
        stamp_score=product.stamp_score,
        is_active=product.is_active,
        source=product.source,
        walmart_item_id=product.walmart_item_id,
        amazon_asin=product.amazon_asin,
        created_at=product.created_at,
        updated_at=product.updated_at,
        description=product.description,
        specs=product.specs,
        inci_ingredients=product.inci_ingredients,
        prices=prices,
    )


async def _resolve_brand(db: AsyncSession, brand_name: str) -> int:
    """Get or create a brand by name, return its ID."""
    from app.ingestion.retailer_scrape import _get_or_create_brand
    cache: dict[str, int] = {}
    return await _get_or_create_brand(db, brand_name, cache)


# ---- Stats ----

@router.get("/stats", response_model=AdminStats)
async def get_stats(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminStats:
    total = await db.scalar(select(func.count()).select_from(Product))
    active = await db.scalar(
        select(func.count()).select_from(Product).where(Product.is_active == True)  # noqa: E712
    )
    brand_count = await db.scalar(select(func.count()).select_from(Brand))

    cat_rows = await db.execute(
        select(Product.category_key, func.count().label("cnt"))
        .group_by(Product.category_key)
        .order_by(func.count().desc())
    )
    products_by_category = {row.category_key: row.cnt for row in cat_rows}

    return AdminStats(
        total_products=total or 0,
        active_products=active or 0,
        products_by_category=products_by_category,
        total_brands=brand_count or 0,
    )


# ---- Products list ----

@router.get("/products", response_model=PaginatedAdminProducts)
async def list_products(
    search: str | None = Query(None),
    category: str | None = Query(None),
    source: str | None = Query(None),
    is_active: bool | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    sort: str = Query("created_at_desc"),
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> PaginatedAdminProducts:
    stmt = (
        select(Product)
        .options(selectinload(Product.brand))
    )

    if search:
        stmt = stmt.where(Product.name.ilike(f"%{search}%"))
    if category:
        stmt = stmt.where(Product.category_key == category)
    if source:
        stmt = stmt.where(Product.source == source)
    if is_active is not None:
        stmt = stmt.where(Product.is_active == is_active)

    # Sorting
    sort_map = {
        "created_at_desc": Product.created_at.desc(),
        "created_at_asc": Product.created_at.asc(),
        "name_asc": Product.name.asc(),
        "name_desc": Product.name.desc(),
        "stamp_score_desc": Product.stamp_score.desc(),
    }
    stmt = stmt.order_by(sort_map.get(sort, Product.created_at.desc()))

    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = await db.scalar(total_stmt) or 0

    offset = (page - 1) * per_page
    result = await db.execute(stmt.offset(offset).limit(per_page))
    products = result.scalars().all()

    return PaginatedAdminProducts(
        items=[_product_to_list_item(p) for p in products],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


# ---- Create product ----

@router.post("/products", response_model=AdminProductDetail, status_code=201)
async def create_product(
    body: AdminProductCreate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminProductDetail:
    brand_id = await _resolve_brand(db, body.brand)
    product = Product(
        name=body.name,
        brand_id=brand_id,
        category_key=body.category_key,
        image_url=body.image_url,
        description=body.description,
        specs=body.specs,
        inci_ingredients=body.inci_ingredients,
        source="manual_admin",
    )
    db.add(product)
    await db.flush()
    await db.refresh(product, ["brand", "prices"])
    await db.commit()
    await db.refresh(product, ["brand", "prices"])
    return _product_to_detail(product)


# ---- Get product ----

@router.get("/products/{product_id}", response_model=AdminProductDetail)
async def get_product(
    product_id: str,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminProductDetail:
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.brand), selectinload(Product.prices).selectinload(ProductPrice.retailer))
        .where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundError("Product not found")
    return _product_to_detail(product)


# ---- Update product ----

@router.patch("/products/{product_id}", response_model=AdminProductDetail)
async def update_product(
    product_id: str,
    body: AdminProductUpdate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminProductDetail:
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.brand), selectinload(Product.prices).selectinload(ProductPrice.retailer))
        .where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundError("Product not found")

    if body.name is not None:
        product.name = body.name
    if body.category_key is not None:
        product.category_key = body.category_key
    if body.image_url is not None:
        product.image_url = body.image_url
    if body.description is not None:
        product.description = body.description
    if body.specs is not None:
        product.specs = body.specs
    if body.inci_ingredients is not None:
        product.inci_ingredients = body.inci_ingredients
    if body.is_active is not None:
        product.is_active = body.is_active
    if body.brand is not None:
        product.brand_id = await _resolve_brand(db, body.brand)
        await db.flush()
        await db.refresh(product, ["brand"])

    await db.commit()
    await db.refresh(product, ["brand", "prices"])
    return _product_to_detail(product)


# ---- Deactivate product ----

@router.delete("/products/{product_id}", status_code=204)
async def deactivate_product(
    product_id: str,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundError("Product not found")
    product.is_active = False
    await db.commit()


# ---- Brands ----

@router.get("/brands", response_model=list[AdminBrand])
async def list_brands(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[AdminBrand]:
    result = await db.execute(select(Brand).order_by(Brand.name))
    brands = result.scalars().all()
    return [AdminBrand(id=b.id, name=b.name) for b in brands]


# ---- Price links ----

@router.post("/products/{product_id}/prices", response_model=AdminPriceRow, status_code=201)
async def add_price(
    product_id: str,
    body: AdminPriceCreate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminPriceRow:
    result = await db.execute(select(Product).where(Product.id == product_id))
    if not result.scalar_one_or_none():
        raise NotFoundError("Product not found")

    price = ProductPrice(
        product_id=product_id,
        source=body.retailer,
        price=body.price,
        url=body.url,
        in_stock=body.in_stock,
    )
    db.add(price)
    await db.commit()
    await db.refresh(price)
    return AdminPriceRow(
        id=price.id,
        retailer=price.source,
        source=price.source,
        price=price.price,
        url=price.url,
        in_stock=price.in_stock,
    )


@router.patch("/products/{product_id}/prices/{price_id}", response_model=AdminPriceRow)
async def update_price(
    product_id: str,
    price_id: int,
    body: AdminPriceUpdate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminPriceRow:
    result = await db.execute(
        select(ProductPrice).where(
            ProductPrice.id == price_id, ProductPrice.product_id == product_id
        )
    )
    price = result.scalar_one_or_none()
    if not price:
        raise NotFoundError("Price not found")

    if body.retailer is not None:
        price.source = body.retailer
    if body.url is not None:
        price.url = body.url
    if body.price is not None:
        price.price = body.price
    if body.in_stock is not None:
        price.in_stock = body.in_stock

    await db.commit()
    await db.refresh(price)
    return AdminPriceRow(
        id=price.id,
        retailer=price.source,
        source=price.source,
        price=price.price,
        url=price.url,
        in_stock=price.in_stock,
    )


@router.delete("/products/{product_id}/prices/{price_id}", status_code=204)
async def delete_price(
    product_id: str,
    price_id: int,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(ProductPrice).where(
            ProductPrice.id == price_id, ProductPrice.product_id == product_id
        )
    )
    price = result.scalar_one_or_none()
    if not price:
        raise NotFoundError("Price not found")
    await db.delete(price)
    await db.commit()
