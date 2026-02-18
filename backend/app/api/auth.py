from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.schemas.auth import (
    AppleOAuthRequest,
    AuthResponse,
    GoogleOAuthRequest,
    LoginRequest,
    RefreshRequest,
    SignupRequest,
    UserResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse)
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    user, access, refresh = await auth_service.signup(
        db, body.email, body.password, body.display_name
    )
    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=access,
        refresh_token=refresh,
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user, access, refresh = await auth_service.login(db, body.email, body.password)
    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=access,
        refresh_token=refresh,
    )


@router.post("/refresh")
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    user, access, refresh = await auth_service.refresh_tokens(db, body.refresh_token)
    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=access,
        refresh_token=refresh,
    )


@router.post("/logout")
async def logout(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await auth_service.logout(db, user.id)
    return {"detail": "Logged out"}


@router.post("/oauth/google", response_model=AuthResponse)
async def oauth_google(body: GoogleOAuthRequest, db: AsyncSession = Depends(get_db)):
    info = await auth_service.verify_google_token(body.id_token)
    user, access, refresh = await auth_service.oauth_login_or_signup(
        db,
        provider="google",
        oauth_id=info["sub"],
        email=info["email"],
        display_name=info.get("name"),
        avatar_url=info.get("picture"),
    )
    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=access,
        refresh_token=refresh,
    )


@router.post("/oauth/apple", response_model=AuthResponse)
async def oauth_apple(body: AppleOAuthRequest, db: AsyncSession = Depends(get_db)):
    info = await auth_service.verify_apple_token(body.id_token)
    display_name = None
    if body.user and isinstance(body.user, dict):
        name_parts = body.user.get("name", {})
        if isinstance(name_parts, dict):
            first = name_parts.get("firstName", "")
            last = name_parts.get("lastName", "")
            display_name = f"{first} {last}".strip() or None
        elif isinstance(name_parts, str):
            display_name = name_parts or None
    user, access, refresh = await auth_service.oauth_login_or_signup(
        db,
        provider="apple",
        oauth_id=info["sub"],
        email=info["email"],
        display_name=display_name,
    )
    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=access,
        refresh_token=refresh,
    )


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)
