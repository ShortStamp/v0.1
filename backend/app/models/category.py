from sqlalchemy import ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CategoryGroup(Base):
    __tablename__ = "category_groups"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    label: Mapped[str] = mapped_column(String(100))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    categories: Mapped[list["Category"]] = relationship(
        back_populates="group", order_by="Category.sort_order"
    )


class Category(Base):
    __tablename__ = "categories"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    label: Mapped[str] = mapped_column(String(100))
    group_key: Mapped[str] = mapped_column(ForeignKey("category_groups.key"))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    group: Mapped["CategoryGroup"] = relationship(back_populates="categories")
    filters: Mapped[list["CategoryFilter"]] = relationship(
        back_populates="category", order_by="CategoryFilter.sort_order"
    )


class CategoryFilter(Base):
    __tablename__ = "category_filters"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_key: Mapped[str] = mapped_column(ForeignKey("categories.key"))
    filter_key: Mapped[str] = mapped_column(String(50))
    label: Mapped[str] = mapped_column(String(100))
    filter_type: Mapped[str] = mapped_column(String(20))  # "checkbox" | "range"
    options: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    category: Mapped["Category"] = relationship(back_populates="filters")
