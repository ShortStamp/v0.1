from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.category import Category, CategoryGroup
from app.schemas.category import CategoryGroupSchema, CategorySchema, FilterSchema
from app.utils.exceptions import NotFoundError

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/groups", response_model=list[CategoryGroupSchema])
async def get_groups(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CategoryGroup)
        .options(
            selectinload(CategoryGroup.categories).selectinload(Category.filters)
        )
        .order_by(CategoryGroup.sort_order)
    )
    groups = result.scalars().unique().all()
    return [
        CategoryGroupSchema(
            key=g.key,
            label=g.label,
            categories=[
                CategorySchema(
                    key=c.key,
                    label=c.label,
                    group_key=c.group_key,
                    filters=[
                        FilterSchema(
                            key=f.filter_key,
                            label=f.label,
                            type=f.filter_type,
                            options=f.options,
                        )
                        for f in c.filters
                    ],
                )
                for c in g.categories
            ],
        )
        for g in groups
    ]


@router.get("/{key}", response_model=CategorySchema)
async def get_category(key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Category)
        .where(Category.key == key)
        .options(selectinload(Category.filters))
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise NotFoundError("Category not found")
    return CategorySchema(
        key=cat.key,
        label=cat.label,
        group_key=cat.group_key,
        filters=[
            FilterSchema(
                key=f.filter_key,
                label=f.label,
                type=f.filter_type,
                options=f.options,
            )
            for f in cat.filters
        ],
    )
