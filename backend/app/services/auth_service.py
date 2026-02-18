import uuid
from datetime import datetime, timedelta, timezone

import bcrypt as _bcrypt
import httpx
from jose import JWTError, jwt
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import RefreshToken, User
from app.utils.exceptions import ConflictError, UnauthorizedError


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    return jwt.encode(
        {"sub": user_id, "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token() -> str:
    return str(uuid.uuid4())


def decode_access_token(token: str) -> str:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise UnauthorizedError()
        return user_id
    except JWTError:
        raise UnauthorizedError()


async def signup(
    db: AsyncSession, email: str, password: str, display_name: str | None
) -> tuple[User, str, str]:
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise ConflictError("Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(password),
        display_name=display_name,
    )
    db.add(user)
    await db.flush()

    access = create_access_token(user.id)
    refresh = create_refresh_token()
    expires = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    db.add(RefreshToken(user_id=user.id, token=refresh, expires_at=expires))
    await db.commit()
    await db.refresh(user)
    return user, access, refresh


async def login(db: AsyncSession, email: str, password: str) -> tuple[User, str, str]:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash or not verify_password(password, user.password_hash):
        raise UnauthorizedError("Invalid email or password")

    access = create_access_token(user.id)
    refresh = create_refresh_token()
    expires = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    db.add(RefreshToken(user_id=user.id, token=refresh, expires_at=expires))
    await db.commit()
    return user, access, refresh


async def refresh_tokens(db: AsyncSession, refresh_token: str) -> tuple[User, str, str]:
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token == refresh_token,
            RefreshToken.is_revoked == False,  # noqa: E712
        )
    )
    token_obj = result.scalar_one_or_none()
    if not token_obj or token_obj.expires_at < datetime.now(timezone.utc):
        raise UnauthorizedError("Invalid or expired refresh token")

    # Revoke old token
    token_obj.is_revoked = True

    # Create new pair
    access = create_access_token(token_obj.user_id)
    new_refresh = create_refresh_token()
    expires = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    db.add(RefreshToken(user_id=token_obj.user_id, token=new_refresh, expires_at=expires))
    await db.commit()

    result = await db.execute(select(User).where(User.id == token_obj.user_id))
    user = result.scalar_one()
    return user, access, new_refresh


async def logout(db: AsyncSession, user_id: str) -> None:
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id, RefreshToken.is_revoked == False  # noqa: E712
        )
    )
    for token in result.scalars():
        token.is_revoked = True
    await db.commit()


def _issue_tokens_for_user(user: User) -> tuple[str, str]:
    access = create_access_token(user.id)
    refresh = create_refresh_token()
    return access, refresh


async def oauth_login_or_signup(
    db: AsyncSession,
    provider: str,
    oauth_id: str,
    email: str,
    display_name: str | None = None,
    avatar_url: str | None = None,
) -> tuple[User, str, str]:
    # 1. Look up by oauth_provider + oauth_id
    result = await db.execute(
        select(User).where(
            and_(User.oauth_provider == provider, User.oauth_id == oauth_id)
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        # 2. Look up by email — link OAuth to existing account
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.oauth_provider = provider
            user.oauth_id = oauth_id
            if not user.avatar_url and avatar_url:
                user.avatar_url = avatar_url
        else:
            # 3. Create new user (no password_hash)
            user = User(
                email=email,
                password_hash=None,
                display_name=display_name,
                avatar_url=avatar_url,
                oauth_provider=provider,
                oauth_id=oauth_id,
            )
            db.add(user)
            await db.flush()

    access, refresh = _issue_tokens_for_user(user)
    expires = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    db.add(RefreshToken(user_id=user.id, token=refresh, expires_at=expires))
    await db.commit()
    await db.refresh(user)
    return user, access, refresh


async def verify_google_token(id_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
        )
    if resp.status_code != 200:
        raise UnauthorizedError("Invalid Google ID token")
    data = resp.json()
    if settings.google_client_id and data.get("aud") != settings.google_client_id:
        raise UnauthorizedError("Google token audience mismatch")
    return {
        "sub": data["sub"],
        "email": data["email"],
        "name": data.get("name"),
        "picture": data.get("picture"),
    }


async def verify_apple_token(id_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get("https://appleid.apple.com/auth/keys")
    if resp.status_code != 200:
        raise UnauthorizedError("Failed to fetch Apple public keys")
    apple_keys = resp.json()

    try:
        header = jwt.get_unverified_header(id_token)
        kid = header.get("kid")
        # Find the matching key
        key = None
        for k in apple_keys.get("keys", []):
            if k.get("kid") == kid:
                key = k
                break
        if not key:
            raise UnauthorizedError("Apple key not found")

        payload = jwt.decode(
            id_token,
            key,
            algorithms=["RS256"],
            audience=settings.apple_client_id or None,
            issuer="https://appleid.apple.com",
        )
    except JWTError:
        raise UnauthorizedError("Invalid Apple ID token")

    return {
        "sub": payload["sub"],
        "email": payload.get("email", ""),
    }
