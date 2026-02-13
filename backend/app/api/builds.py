from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.schemas.build import BuildSchema, BuildSlotSchema, CreateBuildRequest, SetSlotRequest
from app.services import build_service

router = APIRouter(prefix="/builds", tags=["builds"])


@router.get("/active", response_model=BuildSchema)
async def get_active_build(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await build_service.get_active_build(db, user.id)


@router.post("", response_model=BuildSchema)
async def create_build(
    body: CreateBuildRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await build_service.create_build(db, user.id, body.name)


@router.put("/{build_id}/slots/{category_key}", response_model=BuildSlotSchema)
async def set_slot(
    build_id: str,
    category_key: str,
    body: SetSlotRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await build_service.set_slot(db, user.id, build_id, category_key, body.product_id)


@router.delete("/{build_id}/slots/{category_key}")
async def clear_slot(
    build_id: str,
    category_key: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await build_service.clear_slot(db, user.id, build_id, category_key)
    return {"detail": "Slot cleared"}
