from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, gen_uuid


class Build(Base, TimestampMixin):
    __tablename__ = "builds"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200), default="My Build")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship(back_populates="builds")
    slots: Mapped[list["BuildSlot"]] = relationship(back_populates="build")


class BuildSlot(Base):
    __tablename__ = "build_slots"

    id: Mapped[int] = mapped_column(primary_key=True)
    build_id: Mapped[str] = mapped_column(
        ForeignKey("builds.id", ondelete="CASCADE"), index=True
    )
    category_key: Mapped[str] = mapped_column(ForeignKey("categories.key"))
    product_id: Mapped[str | None] = mapped_column(
        ForeignKey("products.id"), nullable=True
    )

    build: Mapped["Build"] = relationship(back_populates="slots")
    product = relationship("Product")
