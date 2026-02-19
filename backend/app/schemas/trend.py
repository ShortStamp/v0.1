from pydantic import BaseModel

from app.schemas.product import ProductListItem


class TrendVideoSchema(BaseModel):
    title: str | None = None
    url: str

    model_config = {"from_attributes": True}


class TrendArticleSchema(BaseModel):
    title: str
    url: str

    model_config = {"from_attributes": True}


class TrendListItem(BaseModel):
    id: str
    name: str
    image: str
    stamp_score: int
    description: str | None = None
    direction: str

    model_config = {"from_attributes": True}


class TrendDetail(TrendListItem):
    products: list[ProductListItem] = []
    videos: list[TrendVideoSchema] = []
    articles: list[TrendArticleSchema] = []
