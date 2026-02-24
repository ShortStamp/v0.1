"""Admin ingestion endpoints — trigger ingredient agent and track progress.

Endpoints:
  GET  /admin/ingestion/stats                  — missing/total ingredient counts
  POST /admin/ingestion/ingredient-agent/run   — start background batch job
  GET  /admin/ingestion/ingredient-agent/status — live progress of current/last job
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session, get_db
from app.middleware.auth_middleware import require_admin
from app.models.product import Brand, Product
from app.models.user import User

router = APIRouter(prefix="/admin/ingestion", tags=["admin-ingestion"])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# In-memory job state — single slot, admin-only, no persistence needed
# ---------------------------------------------------------------------------

_job_state: dict[str, Any] = {
    "running": False,
    "started_at": None,
    "finished_at": None,
    "total": 0,
    "progress": {"queried": 0, "updated": 0, "not_found": 0, "errors": 0},
    "last_result": None,
}


# ---------------------------------------------------------------------------
# Ingredient fetching (Gemini 2.x with Google Search grounding)
# ---------------------------------------------------------------------------

_PROMPT_TEMPLATE = """\
You are a cosmetic ingredient researcher. Search the web for the exact INCI \
ingredient list for this makeup product:

Product name: {name}
Brand: {brand}
Category: {category}

Instructions:
1. Search Sephora, Ulta, the brand's website, or INCI databases (CosDNA, INCIDecoder).
2. Return ONLY the INCI ingredient list as a single comma-separated line.
   Example: Aqua, Glycerin, Niacinamide, Dimethicone, Titanium Dioxide
3. No headers, bullets, markdown, or "Ingredients:" prefix.
4. If you cannot find it with confidence, respond with exactly: NONE\
"""

# Source priority — Sephora/Ulta first, Amazon/OBF later
_SOURCE_PRIORITY = case(
    (Product.source == "sephora_scrape", 0),
    (Product.source == "ulta", 1),
    (Product.source == "amazon", 2),
    (Product.source == "open_beauty_facts", 3),
    else_=4,
)


def _get_grounding_llm() -> Any:
    """Return Gemini with Google Search grounding for web ingredient lookup."""
    if not settings.gemini_api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured — add it to your .env file."
        )
    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=0,
        max_retries=1,
        request_timeout=30,
        model_kwargs={
            "tools": [{"google_search": {}}],
            "automatic_function_calling": {"maximum_remote_calls": 3},
        },
    )


def _parse_response(text: str) -> list[str] | None:
    """Parse a Gemini ingredient response into a clean list, or None if invalid."""
    text = text.strip()
    if not text or text.upper() == "NONE":
        return None
    # Reject prose responses (many sentences, no commas)
    sentences = [s for s in text.split(".") if s.strip()]
    if len(sentences) > 3 and "," not in text:
        return None
    parsed = [i.strip() for i in text.split(",") if i.strip()]
    if len(parsed) < 3 or len(parsed) > 150:
        return None
    return parsed


async def _fetch_for_product(
    llm: Any, name: str, brand: str, category: str
) -> list[str] | None:
    prompt = _PROMPT_TEMPLATE.format(name=name, brand=brand, category=category)
    loop = asyncio.get_event_loop()
    response = await asyncio.wait_for(
        loop.run_in_executor(None, llm.invoke, prompt),
        timeout=45,
    )
    raw = str(response.content) if hasattr(response, "content") else str(response)
    return _parse_response(raw)


# ---------------------------------------------------------------------------
# Background job
# ---------------------------------------------------------------------------

async def _run_agent_job(product_ids: list[str] | None, limit: int) -> None:
    """Core background task — fetch ingredients for products that have none."""
    _job_state["running"] = True
    _job_state["started_at"] = datetime.now(timezone.utc).isoformat()
    _job_state["finished_at"] = None
    _job_state["last_result"] = None
    _job_state["progress"] = {"queried": 0, "updated": 0, "not_found": 0, "errors": 0}

    try:
        llm = _get_grounding_llm()
    except RuntimeError as exc:
        logger.error("[ingredient_agent] Cannot start: %s", exc)
        _job_state["running"] = False
        _job_state["finished_at"] = datetime.now(timezone.utc).isoformat()
        _job_state["last_result"] = {"error": str(exc)}
        return

    # Load products to process
    async with async_session() as db:
        stmt = (
            select(Product, Brand.name.label("brand_name"))
            .join(Brand, Product.brand_id == Brand.id)
            .where(
                Product.is_active == True,  # noqa: E712
                Product.inci_ingredients.is_(None),
            )
        )
        if product_ids:
            stmt = stmt.where(Product.id.in_(product_ids))
        else:
            stmt = stmt.order_by(_SOURCE_PRIORITY).limit(limit)

        result = await db.execute(stmt)
        rows = result.all()

    _job_state["total"] = len(rows)
    logger.info("[ingredient_agent] %d products queued", len(rows))

    # Conservative concurrency for an admin-triggered run
    sem = asyncio.Semaphore(10)

    async def _process(product_id: str, name: str, brand_name: str, category: str) -> None:
        async with sem:
            _job_state["progress"]["queried"] += 1

            if not brand_name:
                _job_state["progress"]["errors"] += 1
                return

            try:
                ingredients = await _fetch_for_product(llm, name, brand_name, category)
            except Exception as exc:
                logger.warning("[ingredient_agent] Gemini failed for %r: %s", name, exc)
                _job_state["progress"]["errors"] += 1
                return

            if ingredients:
                async with async_session() as db:
                    res = await db.execute(select(Product).where(Product.id == product_id))
                    p = res.scalar_one_or_none()
                    if p and not p.inci_ingredients:
                        p.inci_ingredients = ingredients
                        await db.commit()
                _job_state["progress"]["updated"] += 1
                logger.info(
                    "[ingredient_agent] FOUND %r — %d ingredients", name, len(ingredients)
                )
            else:
                _job_state["progress"]["not_found"] += 1
                logger.debug("[ingredient_agent] NOT FOUND %r", name)

    try:
        await asyncio.gather(
            *[_process(p.id, p.name, b, p.category_key) for p, b in rows]
        )
    except Exception as exc:
        logger.error("[ingredient_agent] gather failed: %s", exc, exc_info=True)
        _job_state["last_result"] = {"error": str(exc)}
    finally:
        _job_state["running"] = False
        _job_state["finished_at"] = datetime.now(timezone.utc).isoformat()
        if _job_state["last_result"] is None:
            _job_state["last_result"] = dict(_job_state["progress"])
        logger.info("[ingredient_agent] done — %s", _job_state["progress"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class IngestionStats(BaseModel):
    missing_ingredients: int
    total_active: int


class JobRunRequest(BaseModel):
    limit: int = Field(default=200, ge=1, le=2000)
    product_ids: list[str] | None = None


class JobStatusResponse(BaseModel):
    running: bool
    started_at: str | None
    finished_at: str | None
    total: int
    progress: dict[str, int]
    last_result: dict | None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/stats", response_model=IngestionStats)
async def get_ingestion_stats(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> IngestionStats:
    total = await db.scalar(
        select(func.count()).select_from(Product).where(Product.is_active == True)  # noqa: E712
    )
    missing = await db.scalar(
        select(func.count()).select_from(Product).where(
            Product.is_active == True,  # noqa: E712
            Product.inci_ingredients.is_(None),
        )
    )
    return IngestionStats(missing_ingredients=missing or 0, total_active=total or 0)


@router.post("/ingredient-agent/run")
async def run_ingredient_agent(
    body: JobRunRequest,
    background_tasks: BackgroundTasks,
    _: User = Depends(require_admin),
) -> dict:
    if _job_state["running"]:
        return {"status": "already_running", "message": "A job is already in progress."}
    background_tasks.add_task(_run_agent_job, body.product_ids, body.limit)
    return {"status": "started"}


@router.get("/ingredient-agent/status", response_model=JobStatusResponse)
async def get_agent_status(_: User = Depends(require_admin)) -> JobStatusResponse:
    return JobStatusResponse(**_job_state)
