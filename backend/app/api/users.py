from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.user import (
    BeautyProfile,
    User,
    UserNotificationSettings,
    UserStylePreference,
)
from app.schemas.user import (
    BeautyProfileSchema,
    NotificationSettingsSchema,
    StylePreferencesSchema,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/profile", response_model=BeautyProfileSchema)
async def get_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BeautyProfile).where(BeautyProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return BeautyProfileSchema()
    return BeautyProfileSchema.model_validate(profile)


@router.put("/me/profile", response_model=BeautyProfileSchema)
async def update_profile(
    body: BeautyProfileSchema,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BeautyProfile).where(BeautyProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = BeautyProfile(user_id=user.id)
        db.add(profile)

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    return BeautyProfileSchema.model_validate(profile)


@router.get("/me/styles", response_model=StylePreferencesSchema)
async def get_styles(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserStylePreference).where(UserStylePreference.user_id == user.id)
    )
    prefs = result.scalars().all()
    return StylePreferencesSchema(styles=[p.style_name for p in prefs])


@router.put("/me/styles", response_model=StylePreferencesSchema)
async def update_styles(
    body: StylePreferencesSchema,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Delete existing
    result = await db.execute(
        select(UserStylePreference).where(UserStylePreference.user_id == user.id)
    )
    for pref in result.scalars():
        await db.delete(pref)

    # Add new
    for style in body.styles:
        db.add(UserStylePreference(user_id=user.id, style_name=style))

    await db.commit()
    return body


@router.get("/me/notifications", response_model=NotificationSettingsSchema)
async def get_notifications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserNotificationSettings).where(
            UserNotificationSettings.user_id == user.id
        )
    )
    settings = result.scalar_one_or_none()
    if not settings:
        return NotificationSettingsSchema()
    return NotificationSettingsSchema.model_validate(settings)


@router.put("/me/notifications", response_model=NotificationSettingsSchema)
async def update_notifications(
    body: NotificationSettingsSchema,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserNotificationSettings).where(
            UserNotificationSettings.user_id == user.id
        )
    )
    settings = result.scalar_one_or_none()
    if not settings:
        settings = UserNotificationSettings(user_id=user.id)
        db.add(settings)

    settings.trend_notifications = body.trend_notifications
    settings.price_drop_alerts = body.price_drop_alerts

    await db.commit()
    await db.refresh(settings)
    return NotificationSettingsSchema.model_validate(settings)
