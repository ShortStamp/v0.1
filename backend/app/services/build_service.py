from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.build import Build, BuildSlot
from app.models.category import Category
from app.models.product import Product, ProductPrice
from app.schemas.build import BuildSchema, BuildSlotSchema
from app.schemas.product import ProductListItem, RetailerPriceSchema
from app.utils.exceptions import NotFoundError


def _slot_to_schema(slot: BuildSlot) -> BuildSlotSchema:
    product = None
    if slot.product:
        p = slot.product
        product = ProductListItem(
            id=p.id,
            name=p.name,
            brand=p.brand.name if p.brand else "",
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
    return BuildSlotSchema(category_key=slot.category_key, product=product)


async def get_active_build(db: AsyncSession, user_id: str) -> BuildSchema:
    result = await db.execute(
        select(Build)
        .where(Build.user_id == user_id, Build.is_active == True)  # noqa: E712
        .options(
            selectinload(Build.slots)
            .selectinload(BuildSlot.product)
            .selectinload(Product.brand),
            selectinload(Build.slots)
            .selectinload(BuildSlot.product)
            .selectinload(Product.prices)
            .selectinload(ProductPrice.retailer),
            selectinload(Build.slots)
            .selectinload(BuildSlot.product)
            .selectinload(Product.filter_values),
        )
    )
    build = result.scalar_one_or_none()
    if not build:
        raise NotFoundError("No active build found")

    return BuildSchema(
        id=build.id,
        name=build.name,
        is_active=build.is_active,
        slots=[_slot_to_schema(s) for s in build.slots],
    )


async def create_build(db: AsyncSession, user_id: str, name: str) -> BuildSchema:
    # Deactivate existing active builds
    result = await db.execute(
        select(Build).where(Build.user_id == user_id, Build.is_active == True)  # noqa: E712
    )
    for b in result.scalars():
        b.is_active = False

    build = Build(user_id=user_id, name=name, is_active=True)
    db.add(build)
    await db.flush()

    # Create empty slots for all categories
    cats = await db.execute(select(Category))
    for cat in cats.scalars():
        db.add(BuildSlot(build_id=build.id, category_key=cat.key))

    await db.commit()
    return await get_active_build(db, user_id)


async def set_slot(
    db: AsyncSession, user_id: str, build_id: str, category_key: str, product_id: str
) -> BuildSlotSchema:
    result = await db.execute(
        select(Build).where(Build.id == build_id, Build.user_id == user_id)
    )
    build = result.scalar_one_or_none()
    if not build:
        raise NotFoundError("Build not found")

    result = await db.execute(
        select(BuildSlot).where(
            BuildSlot.build_id == build_id,
            BuildSlot.category_key == category_key,
        )
    )
    slot = result.scalar_one_or_none()
    if not slot:
        slot = BuildSlot(build_id=build_id, category_key=category_key)
        db.add(slot)

    slot.product_id = product_id
    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(BuildSlot)
        .where(BuildSlot.id == slot.id)
        .options(
            selectinload(BuildSlot.product).selectinload(Product.brand),
            selectinload(BuildSlot.product)
            .selectinload(Product.prices)
            .selectinload(ProductPrice.retailer),
            selectinload(BuildSlot.product).selectinload(Product.filter_values),
        )
    )
    slot = result.scalar_one()
    return _slot_to_schema(slot)


async def clear_slot(
    db: AsyncSession, user_id: str, build_id: str, category_key: str
) -> None:
    result = await db.execute(
        select(Build).where(Build.id == build_id, Build.user_id == user_id)
    )
    build = result.scalar_one_or_none()
    if not build:
        raise NotFoundError("Build not found")

    result = await db.execute(
        select(BuildSlot).where(
            BuildSlot.build_id == build_id,
            BuildSlot.category_key == category_key,
        )
    )
    slot = result.scalar_one_or_none()
    if slot:
        slot.product_id = None
        await db.commit()
