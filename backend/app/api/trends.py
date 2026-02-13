from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.trend import TrendDetail, TrendListItem
from app.services import trend_service

router = APIRouter(prefix="/trends", tags=["trends"])


@router.get("", response_model=list[TrendListItem])
async def list_trends(db: AsyncSession = Depends(get_db)):
    return await trend_service.list_trends(db)


@router.get("/{trend_id}", response_model=TrendDetail)
async def get_trend(trend_id: str, db: AsyncSession = Depends(get_db)):
    return await trend_service.get_trend(db, trend_id)
