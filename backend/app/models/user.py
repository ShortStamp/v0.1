from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, gen_uuid


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    display_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    beauty_profile: Mapped["BeautyProfile | None"] = relationship(
        back_populates="user", uselist=False
    )
    style_preferences: Mapped[list["UserStylePreference"]] = relationship(
        back_populates="user"
    )
    notification_settings: Mapped["UserNotificationSettings | None"] = relationship(
        back_populates="user", uselist=False
    )
    builds: Mapped[list["Build"]] = relationship(back_populates="user")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user")


class BeautyProfile(Base, TimestampMixin):
    __tablename__ = "beauty_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )
    skin_tone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    undertone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    skin_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    coverage: Mapped[str | None] = mapped_column(String(50), nullable=True)
    finish: Mapped[str | None] = mapped_column(String(50), nullable=True)
    budget: Mapped[str | None] = mapped_column(String(50), nullable=True)

    user: Mapped["User"] = relationship(back_populates="beauty_profile")


class UserStylePreference(Base):
    __tablename__ = "user_style_preferences"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    style_name: Mapped[str] = mapped_column(String(100))

    user: Mapped["User"] = relationship(back_populates="style_preferences")


class UserNotificationSettings(Base):
    __tablename__ = "user_notification_settings"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    trend_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    price_drop_alerts: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship(back_populates="notification_settings")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token: Mapped[str] = mapped_column(String(500), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")
