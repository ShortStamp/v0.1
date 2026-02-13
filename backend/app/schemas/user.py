from pydantic import BaseModel


class BeautyProfileSchema(BaseModel):
    skin_tone: str | None = None
    undertone: str | None = None
    skin_type: str | None = None
    coverage: str | None = None
    finish: str | None = None
    budget: str | None = None

    model_config = {"from_attributes": True}


class StylePreferencesSchema(BaseModel):
    styles: list[str] = []


class NotificationSettingsSchema(BaseModel):
    trend_notifications: bool = True
    price_drop_alerts: bool = True

    model_config = {"from_attributes": True}
