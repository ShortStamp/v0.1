from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.builds import router as builds_router
from app.api.categories import router as categories_router
from app.api.products import router as products_router
from app.api.quiz import router as quiz_router
from app.api.trends import router as trends_router
from app.api.users import router as users_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(categories_router)
api_router.include_router(products_router)
api_router.include_router(trends_router)
api_router.include_router(builds_router)
api_router.include_router(users_router)
api_router.include_router(quiz_router)
