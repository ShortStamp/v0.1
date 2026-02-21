from pydantic import BaseModel


class RetailerPriceSchema(BaseModel):
    retailer: str
    retailer_logo: str | None = None
    price: float
    url: str
    in_stock: bool = True

    model_config = {"from_attributes": True}


class ReviewSchema(BaseModel):
    author: str
    rating: float
    text: str | None = None

    model_config = {"from_attributes": True}


class ProductListItem(BaseModel):
    id: str
    name: str
    brand: str
    image: str
    category: str
    stamp_score: int
    prices: list[RetailerPriceSchema] = []
    filters: dict[str, str] = {}

    model_config = {"from_attributes": True}


class ProductDetail(ProductListItem):
    description: str | None = None
    specs: list[str] | None = None
    reviews: list[ReviewSchema] = []
    walmart_url: str | None = None


class PaginatedProducts(BaseModel):
    items: list[ProductListItem]
    total: int
    page: int
    per_page: int
    pages: int


class FilterPropertiesResponse(BaseModel):
    filters: dict[str, list[str]] = {}
    counts: dict[str, dict[str, int]] = {}


class PriceHistoryEntry(BaseModel):
    retailer: str
    price: float
    in_stock: bool
    recorded_at: str

    model_config = {"from_attributes": True}
