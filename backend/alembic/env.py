import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.config import settings

# Import all models so Alembic can detect them
from app.models.base import Base
from app.models.category import Category, CategoryFilter, CategoryGroup  # noqa: F401
from app.models.product import (  # noqa: F401
    Brand,
    PriceHistory,
    Product,
    ProductFilterValue,
    ProductPrice,
    ProductReview,
    Retailer,
)
from app.models.trend import Trend, TrendArticle, TrendProduct, TrendVideo  # noqa: F401
from app.models.user import (  # noqa: F401
    BeautyProfile,
    RefreshToken,
    User,
    UserNotificationSettings,
    UserStylePreference,
)
from app.models.build import Build, BuildSlot  # noqa: F401
from app.models.ingestion import IngestionLock, IngestionRun, StampScoreHistory  # noqa: F401
from app.models.compatibility import CompatibilityResult, ChemistKnownIngredient  # noqa: F401
from app.models.analytics import AnalyticsEvent  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Override sqlalchemy.url with the env var
config.set_main_option("sqlalchemy.url", settings.database_url)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    # statement_cache_size=0 required for Supabase Supavisor (transaction-mode pooler)
    _connect_args = {"ssl": "require", "statement_cache_size": 0} if settings.database_ssl else {}
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=_connect_args,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
