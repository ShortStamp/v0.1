from pydantic import BaseModel


class FilterSchema(BaseModel):
    key: str
    label: str
    type: str
    options: list[str] | None = None


class CategorySchema(BaseModel):
    key: str
    label: str
    group_key: str
    filters: list[FilterSchema] = []

    model_config = {"from_attributes": True}


class CategoryGroupSchema(BaseModel):
    key: str
    label: str
    categories: list[CategorySchema] = []

    model_config = {"from_attributes": True}


class CategoryGroupListSchema(BaseModel):
    key: str
    label: str
    categories: list[str] = []  # just keys for lightweight listing
