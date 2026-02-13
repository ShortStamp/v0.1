from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.services.auth_service import decode_access_token
from app.utils.exceptions import UnauthorizedError

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    user_id = decode_access_token(credentials.credentials)
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))  # noqa: E712
    user = result.scalar_one_or_none()
    if not user:
        raise UnauthorizedError()
    return user


async def get_optional_user(
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(
        HTTPBearer(auto_error=False)
    ),
) -> User | None:
    if not credentials:
        return None
    try:
        user_id = decode_access_token(credentials.credentials)
        result = await db.execute(
            select(User).where(User.id == user_id, User.is_active == True)  # noqa: E712
        )
        return result.scalar_one_or_none()
    except Exception:
        return None
