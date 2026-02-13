from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, gen_uuid


class Trend(Base, TimestampMixin):
    __tablename__ = "trends"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(200), unique=True)
    image_url: Mapped[str] = mapped_column(String(500), default="/placeholder-trend.jpg")
    stamp_score: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    direction: Mapped[str] = mapped_column(String(20), default="stable")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    products: Mapped[list["TrendProduct"]] = relationship(
        back_populates="trend", order_by="TrendProduct.sort_order"
    )
    videos: Mapped[list["TrendVideo"]] = relationship(
        back_populates="trend", order_by="TrendVideo.sort_order"
    )
    articles: Mapped[list["TrendArticle"]] = relationship(
        back_populates="trend", order_by="TrendArticle.sort_order"
    )


class TrendProduct(Base):
    __tablename__ = "trend_products"

    id: Mapped[int] = mapped_column(primary_key=True)
    trend_id: Mapped[str] = mapped_column(ForeignKey("trends.id"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    trend: Mapped["Trend"] = relationship(back_populates="products")
    product = relationship("Product")


class TrendVideo(Base):
    __tablename__ = "trend_videos"

    id: Mapped[int] = mapped_column(primary_key=True)
    trend_id: Mapped[str] = mapped_column(ForeignKey("trends.id"), index=True)
    url: Mapped[str] = mapped_column(String(500))
    title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    trend: Mapped["Trend"] = relationship(back_populates="videos")


class TrendArticle(Base):
    __tablename__ = "trend_articles"

    id: Mapped[int] = mapped_column(primary_key=True)
    trend_id: Mapped[str] = mapped_column(ForeignKey("trends.id"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    url: Mapped[str] = mapped_column(String(500))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    trend: Mapped["Trend"] = relationship(back_populates="articles")
