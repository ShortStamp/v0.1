from contextlib import asynccontextmanager

import stripe
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db

settings = get_settings()

# Configure Stripe
if settings.stripe_secret_key:
    stripe.api_key = settings.stripe_secret_key


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB on startup."""
    await init_db()
    yield


app = FastAPI(
    title="ShortStamp API",
    version="0.1.0",
    description="Auth, Stripe webhooks, and AI analysis proxy for ShortStamp",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
from app.api.auth import router as auth_router
from app.api.stripe_webhooks import router as stripe_router
from app.api.analyze import router as analyze_router

app.include_router(auth_router)
app.include_router(stripe_router)
app.include_router(analyze_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "shortstamp-api"}
