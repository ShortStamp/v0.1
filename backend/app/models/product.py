from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, gen_uuid


class Brand(Base, TimestampMixin):
    __tablename__ = "brands"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True)
    website_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    products: Mapped[list["Product"]] = relationship(back_populates="brand")


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(300))
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"))
    category_key: Mapped[str] = mapped_column(ForeignKey("categories.key"), index=True)
    image_url: Mapped[str] = mapped_column(String(500), default="/placeholder-product.jpg")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    specs: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    inci_ingredients: Mapped[list[str] | None] = mapped_column(
        JSON, nullable=True, comment="INCI ingredient list from Open Beauty Facts"
    )
    stamp_score: Mapped[int] = mapped_column(Integer, default=0)
    upc: Mapped[str | None] = mapped_column(String(50), nullable=True, unique=True, index=True)
    amazon_asin: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    open_beauty_facts_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source: Mapped[str] = mapped_column(String(50), default="manual_seed")
    source_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    walmart_item_id: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    brand: Mapped["Brand"] = relationship(back_populates="products")
    filter_values: Mapped[list["ProductFilterValue"]] = relationship(back_populates="product")
    prices: Mapped[list["ProductPrice"]] = relationship(back_populates="product")
    reviews: Mapped[list["ProductReview"]] = relationship(back_populates="product")


class ProductFilterValue(Base):
    __tablename__ = "product_filter_values"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    filter_key: Mapped[str] = mapped_column(String(50), index=True)
    value: Mapped[str] = mapped_column(String(200))

    product: Mapped["Product"] = relationship(back_populates="filter_values")


class Retailer(Base):
    __tablename__ = "retailers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True)
    base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    affiliate_tag: Mapped[str | None] = mapped_column(String(200), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)


class ProductPrice(Base):
    __tablename__ = "product_prices"
    __table_args__ = (
        UniqueConstraint("product_id", "source", name="uq_product_price_source"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    retailer_id: Mapped[int | None] = mapped_column(ForeignKey("retailers.id"), nullable=True)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    price: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    url: Mapped[str] = mapped_column(String(500), default="#")
    in_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    availability: Mapped[str] = mapped_column(String(20), default="unknown")
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    product: Mapped["Product"] = relationship(back_populates="prices")
    retailer: Mapped["Retailer | None"] = relationship()


class PriceHistory(Base):
    __tablename__ = "price_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    retailer_id: Mapped[int] = mapped_column(ForeignKey("retailers.id"))
    price: Mapped[float] = mapped_column(Float)
    in_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ProductReview(Base, TimestampMixin):
    __tablename__ = "product_reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    source: Mapped[str] = mapped_column(String(100), default="seed")
    author: Mapped[str] = mapped_column(String(200))
    rating: Mapped[float] = mapped_column(Float)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    review_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    product: Mapped["Product"] = relationship(back_populates="reviews")
