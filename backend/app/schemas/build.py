from pydantic import BaseModel

from app.schemas.product import ProductListItem


class BuildSlotSchema(BaseModel):
    category_key: str
    product: ProductListItem | None = None

    model_config = {"from_attributes": True}


class BuildSchema(BaseModel):
    id: str
    name: str
    is_active: bool
    slots: list[BuildSlotSchema] = []

    model_config = {"from_attributes": True}


class CreateBuildRequest(BaseModel):
    name: str = "My Build"


class SetSlotRequest(BaseModel):
    product_id: str
