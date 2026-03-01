from collections.abc import AsyncGenerator
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

_connect_args: dict = {"ssl": "require"} if settings.database_ssl else {}
# Supabase Supavisor runs in transaction-mode pooling: the underlying PG connection
# is reused between asyncpg clients.  asyncpg generates sequential named prepared
# statements (__asyncpg_stmt_1__, ...) that persist on the server connection.  When a
# second client gets the same server connection it tries to create __asyncpg_stmt_1__
# again → DuplicatePreparedStatementError.
#
# Fix: override the name generator with UUIDs so each statement has a unique name and
# can't collide across clients, even on the same underlying PG connection.
if "asyncpg" in settings.database_url:
    _connect_args["statement_cache_size"] = 0
    _connect_args["prepared_statement_name_func"] = lambda: f"_s{uuid4().hex}"
engine = create_async_engine(settings.database_url, echo=False, connect_args=_connect_args)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
