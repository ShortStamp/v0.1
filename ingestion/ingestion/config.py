"""Ingestion microservice configuration via pydantic-settings."""

from pydantic_settings import BaseSettings


class IngestionSettings(BaseSettings):
    database_url: str = "postgresql+asyncpg://shortstamp:shortstampdev@localhost/shortstamp"
    database_ssl: bool = False  # Set True when connecting to Supabase or any hosted PostgreSQL

    # Sephora
    sephora_max_pages_per_category: int = 5
    sephora_detail_enrich_limit: int = 200

    # OBF
    max_pages_per_term: int = 5
    page_size: int = 50

    # Walmart
    walmart_api_key: str = ""
    walmart_private_key_path: str = ""
    walmart_private_key_pem: str = ""

    # Gemini ingredient agent
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash-lite"
    ingredient_agent_limit: int = 200         # products per scheduled run
    ingredient_agent_delay: float = 0.0      # seconds between Gemini API calls
    ingredient_agent_concurrency: int = 150  # concurrent Gemini calls (3000 RPM / ~1.2s avg)

    # Scheduler
    enable_scheduler: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = IngestionSettings()
