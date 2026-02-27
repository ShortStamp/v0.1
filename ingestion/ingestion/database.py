"""Async PostgreSQL session factory for the ingestion microservice."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from ingestion.config import settings

_connect_args = {"ssl": "require"} if settings.database_ssl else {}
engine = create_async_engine(
    settings.database_url, echo=False, pool_pre_ping=True, connect_args=_connect_args
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
