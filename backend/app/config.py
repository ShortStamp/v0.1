from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./shortstamp.db"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    cors_origins: list[str] = ["http://localhost:3000"]

    # Ingestion pipeline
    walmart_api_key: str = ""
    walmart_private_key_path: str = ""
    walmart_private_key_pem: str = ""  # PEM key content as env var (alternative to file)
    enable_scheduler: bool = False
    max_pages_per_term: int = 5
    page_size: int = 50

    # Legacy keys (kept for backward compat)
    amazon_access_key: str = ""
    amazon_secret_key: str = ""
    amazon_partner_tag: str = ""
    serpapi_key: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
