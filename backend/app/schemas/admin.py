from datetime import datetime

from pydantic import BaseModel


class AdminPriceRow(BaseModel):
    id: int
    retailer: str | None
    source: str | None
    price: float
    url: str
    in_stock: bool

    model_config = {"from_attributes": True}


class AdminProductListItem(BaseModel):
    id: str
    name: str
    brand: str
    category: str
    image_url: str
    stamp_score: int
    is_active: bool
    source: str
    walmart_item_id: str | None
    amazon_asin: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AdminProductDetail(AdminProductListItem):
    description: str | None
    specs: list[str] | None
    inci_ingredients: list[str] | None
    prices: list[AdminPriceRow]

    model_config = {"from_attributes": True}


class AdminProductCreate(BaseModel):
    name: str
    brand: str
    category_key: str
    image_url: str = "/placeholder-product.jpg"
    description: str | None = None
    specs: list[str] | None = None
    inci_ingredients: list[str] | None = None


class AdminProductUpdate(BaseModel):
    name: str | None = None
    brand: str | None = None
    category_key: str | None = None
    image_url: str | None = None
    description: str | None = None
    specs: list[str] | None = None
    inci_ingredients: list[str] | None = None
    is_active: bool | None = None


class AdminPriceCreate(BaseModel):
    retailer: str
    url: str
    price: float
    in_stock: bool = True


class AdminPriceUpdate(BaseModel):
    retailer: str | None = None
    url: str | None = None
    price: float | None = None
    in_stock: bool | None = None


class AdminBrand(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class AdminStats(BaseModel):
    total_products: int
    active_products: int
    products_by_category: dict[str, int]
    total_brands: int


class PaginatedAdminProducts(BaseModel):
    items: list[AdminProductListItem]
    total: int
    page: int
    per_page: int
    pages: int
