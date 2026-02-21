from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from urllib.parse import parse_qs, unquote, urlparse

from app.models.product import Brand, Product, ProductFilterValue, ProductPrice, ProductReview
from app.schemas.product import (
    FilterPropertiesResponse,
    PaginatedProducts,
    ProductDetail,
    ProductListItem,
    RetailerPriceSchema,
    ReviewSchema,
)
from app.utils.exceptions import NotFoundError
from app.utils.pagination import paginate


def _get_walmart_url(product: Product) -> str | None:
    for price in product.prices:
        if price.source == "walmart" and price.url and price.url != "#":
            return price.url
        if price.retailer and "walmart" in price.retailer.name.lower() and price.url and price.url != "#":
            return price.url
    if product.walmart_item_id:
        return f"https://www.walmart.com/ip/{product.walmart_item_id}"
    return None


def _normalize_walmart_url(url: str | None) -> str:
    if not url:
        return "#"

    parsed = urlparse(url)
    host = parsed.netloc.lower()

    # Walmart affiliate tracking links often include the real destination in `u=...`.
    if "goto.walmart.com" in host:
        query = parse_qs(parsed.query)
        target = (query.get("u") or [None])[0]
        if target:
            decoded = unquote(target)
            target_parsed = urlparse(decoded)
            if "walmart." in target_parsed.netloc.lower():
                return decoded
        return "#"

    if "walmart." in host:
        return url

    return "#"


def _retailer_name(price: ProductPrice) -> str:
    if price.retailer and price.retailer.name:
        return price.retailer.name
    if price.source:
        return price.source.title()
    return "Unknown"


def _retailer_logo(price: ProductPrice) -> str | None:
    if price.retailer and price.retailer.logo_url:
        return price.retailer.logo_url
    return None


def _product_to_list_item(product: Product) -> ProductListItem:
    return ProductListItem(
        id=product.id,
        name=product.name,
        brand=product.brand.name,
        image=product.image_url,
        category=product.category_key,
        stamp_score=product.stamp_score,
        prices=[
            RetailerPriceSchema(
                retailer=_retailer_name(p),
                retailer_logo=_retailer_logo(p),
                price=p.price,
                url=_normalize_walmart_url(p.url) if p.source == "walmart" else p.url,
                in_stock=p.in_stock,
            )
            for p in product.prices
        ],
        filters={fv.filter_key: fv.value for fv in product.filter_values},
    )


def _product_to_detail(product: Product) -> ProductDetail:
    return ProductDetail(
        id=product.id,
        name=product.name,
        brand=product.brand.name,
        image=product.image_url,
        category=product.category_key,
        stamp_score=product.stamp_score,
        description=product.description,
        specs=product.specs,
        prices=[
            RetailerPriceSchema(
                retailer=_retailer_name(p),
                retailer_logo=_retailer_logo(p),
                price=p.price,
                url=_normalize_walmart_url(p.url) if p.source == "walmart" else p.url,
                in_stock=p.in_stock,
            )
            for p in product.prices
        ],
        reviews=[
            ReviewSchema(author=r.author, rating=r.rating, text=r.text)
            for r in product.reviews
        ],
        filters={fv.filter_key: fv.value for fv in product.filter_values},
        walmart_url=_get_walmart_url(product),
    )


def _apply_category_and_search_filters(
    query,
    count_query,
    category: str | None = None,
    search: str | None = None,
):
    if category:
        query = query.where(Product.category_key == category)
        count_query = count_query.where(Product.category_key == category)

    if search:
        pattern = f"%{search}%"
        query = query.join(Brand).where(
            Product.name.ilike(pattern) | Brand.name.ilike(pattern)
        )
        count_query = count_query.join(Brand).where(
            Product.name.ilike(pattern) | Brand.name.ilike(pattern)
        )

    return query, count_query


def _apply_attribute_filters(query, count_query, filters: dict[str, str] | None = None):
    if not filters:
        return query, count_query

    for key, value in filters.items():
        values = [v.strip() for v in value.split(",") if v.strip()]
        if not values:
            continue
        if key == "brand":
            lowered = [v.lower() for v in values]
            query = query.where(
                Product.brand.has(func.lower(Brand.name).in_(lowered))
            )
            count_query = count_query.where(
                Product.brand.has(func.lower(Brand.name).in_(lowered))
            )
            continue
        subq = select(ProductFilterValue.product_id).where(
            ProductFilterValue.filter_key == key,
            ProductFilterValue.value.in_(values),
        )
        query = query.where(Product.id.in_(subq))
        count_query = count_query.where(Product.id.in_(subq))

    return query, count_query


async def list_products(
    db: AsyncSession,
    category: str | None = None,
    search: str | None = None,
    filters: dict[str, str] | None = None,
    sort: str = "stamp_score_desc",
    page: int = 1,
    per_page: int = 20,
) -> PaginatedProducts:
    query = (
        select(Product)
        .where(Product.is_active == True)  # noqa: E712
        .options(
            selectinload(Product.brand),
            selectinload(Product.prices).selectinload(ProductPrice.retailer),
            selectinload(Product.filter_values),
        )
    )

    count_query = select(func.count(Product.id)).where(Product.is_active == True)  # noqa: E712

    query, count_query = _apply_category_and_search_filters(
        query, count_query, category=category, search=search
    )
    query, count_query = _apply_attribute_filters(query, count_query, filters=filters)

    if sort == "stamp_score_desc":
        query = query.order_by(Product.stamp_score.desc())
    elif sort == "stamp_score_asc":
        query = query.order_by(Product.stamp_score.asc())
    elif sort == "name_asc":
        query = query.order_by(Product.name.asc())
    elif sort == "name_desc":
        query = query.order_by(Product.name.desc())
    else:
        query = query.order_by(Product.stamp_score.desc())

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    products = result.scalars().unique().all()

    items = [_product_to_list_item(p) for p in products]
    return PaginatedProducts(items=items, **paginate(total, page, per_page))


async def list_filter_properties(
    db: AsyncSession,
    category: str | None = None,
    search: str | None = None,
    filters: dict[str, str] | None = None,
) -> FilterPropertiesResponse:
    product_ids_query = select(Product.id).where(Product.is_active == True)  # noqa: E712
    product_ids_query, _ = _apply_category_and_search_filters(
        product_ids_query, product_ids_query, category=category, search=search
    )
    product_ids_query, _ = _apply_attribute_filters(
        product_ids_query, product_ids_query, filters=filters
    )

    product_ids_subquery = product_ids_query.subquery()
    product_ids = select(product_ids_subquery.c.id)

    filter_rows = await db.execute(
        select(
            ProductFilterValue.filter_key,
            ProductFilterValue.value,
            func.count(func.distinct(ProductFilterValue.product_id)).label("count"),
        )
        .where(ProductFilterValue.product_id.in_(product_ids))
        .group_by(ProductFilterValue.filter_key, ProductFilterValue.value)
        .order_by(
            ProductFilterValue.filter_key.asc(),
            func.lower(ProductFilterValue.value).asc(),
        )
    )

    brand_rows = await db.execute(
        select(
            Brand.name,
            func.count(func.distinct(Product.id)).label("count"),
        )
        .select_from(Product)
        .join(Brand, Product.brand_id == Brand.id)
        .where(Product.id.in_(product_ids))
        .group_by(Brand.name)
        .order_by(func.lower(Brand.name).asc())
    )

    grouped: dict[str, list[str]] = {}
    counts: dict[str, dict[str, int]] = {}

    for key, value, count in filter_rows:
        grouped.setdefault(key, []).append(value)
        counts.setdefault(key, {})[value] = int(count or 0)

    brand_names: list[str] = []
    brand_counts: dict[str, int] = {}
    for brand_name, count in brand_rows:
        if not brand_name:
            continue
        brand_names.append(brand_name)
        brand_counts[brand_name] = int(count or 0)

    if brand_names:
        grouped["brand"] = brand_names
        counts["brand"] = brand_counts

    return FilterPropertiesResponse(filters=grouped, counts=counts)


async def get_product(db: AsyncSession, product_id: str) -> ProductDetail:
    result = await db.execute(
        select(Product)
        .where(Product.id == product_id)
        .options(
            selectinload(Product.brand),
            selectinload(Product.prices).selectinload(ProductPrice.retailer),
            selectinload(Product.filter_values),
            selectinload(Product.reviews),
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundError("Product not found")
    return _product_to_detail(product)


async def get_product_prices(db: AsyncSession, product_id: str) -> list[RetailerPriceSchema]:
    result = await db.execute(
        select(Product)
        .where(Product.id == product_id)
        .options(
            selectinload(Product.prices).selectinload(ProductPrice.retailer),
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundError("Product not found")
    return [
        RetailerPriceSchema(
            retailer=_retailer_name(p),
            price=p.price,
            url=_normalize_walmart_url(p.url) if p.source == "walmart" else p.url,
            in_stock=p.in_stock,
        )
        for p in product.prices
    ]


async def list_brands(db: AsyncSession, category: str | None = None) -> list[str]:
    query = (
        select(Brand.name)
        .join(Product, Product.brand_id == Brand.id)
        .where(Product.is_active == True)  # noqa: E712
        .group_by(Brand.name)
        .order_by(func.lower(Brand.name))
    )
    if category:
        query = query.where(Product.category_key == category)

    result = await db.execute(query)
    return [name for name in result.scalars().all() if name]
