"""Ingredient agent — uses Gemini 2.0 Flash with Google Search grounding.

Finds INCI ingredient lists for products that have none, regardless of source
(Sephora, Amazon, OBF, manual). Processes up to `ingredient_agent_limit`
products per run, prioritising Sephora/Ulta over Amazon/OBF.

Schedule: weekly, Sunday 06:00 UTC.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession

from ingestion.config import settings
from ingestion.models import Brand, Product
from ingestion.pipeline.runner import run_job
from ingestion.sources.sephora import _parse_ingredient_string

logger = logging.getLogger(__name__)

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

# Source priority for query ordering (lower = higher priority)
_SOURCE_PRIORITY = case(
    (Product.source == "sephora_scrape", 0),
    (Product.source == "ulta", 1),
    (Product.source == "amazon", 2),
    (Product.source == "obf", 3),
    else_=4,
)


def _get_grounding_llm() -> Any:
    """Initialise ChatGoogleGenerativeAI with Google Search grounding tool."""
    if not settings.gemini_api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. "
            "Add it to your .env file or environment before running the ingredient agent."
        )
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
    except ImportError as exc:
        raise RuntimeError(
            "langchain-google-genai is not installed. "
            "Run: pip install 'langchain-google-genai>=2.0.0'"
        ) from exc

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


def _parse_agent_response(text: str) -> list[str] | None:
    """Parse LLM response into an ingredient list, or return None if invalid."""
    text = text.strip()
    if not text or text.upper() == "NONE":
        return None

    # Reject responses that look like prose rather than ingredient lists
    sentences = [s for s in text.split(".") if s.strip()]
    if len(sentences) > 3 and "," not in text:
        logger.debug("Response looks like prose, skipping")
        return None

    parsed = _parse_ingredient_string(text)
    if len(parsed) < 3:
        logger.debug("Parsed fewer than 3 ingredients (%d), treating as hallucination", len(parsed))
        return None
    if len(parsed) > 150:
        logger.debug("Parsed %d ingredients (>150), treating as hallucination", len(parsed))
        return None

    return parsed


async def _fetch_ingredients_for_product(
    llm: Any,
    name: str,
    brand: str,
    category: str,
) -> list[str] | None:
    """Call Gemini with grounding for one product. Returns parsed list or None."""
    prompt = _PROMPT_TEMPLATE.format(name=name, brand=brand, category=category)

    loop = asyncio.get_event_loop()
    try:
        response = await asyncio.wait_for(
            loop.run_in_executor(None, llm.invoke, prompt),
            timeout=45,
        )
    except asyncio.TimeoutError:
        logger.warning("Gemini call timed out for %r", name)
        raise
    except Exception as exc:
        logger.warning("Gemini call failed for %r: %s", name, exc)
        raise

    raw_text = ""
    if hasattr(response, "content"):
        raw_text = str(response.content)
    else:
        raw_text = str(response)

    return _parse_agent_response(raw_text)


async def ingest_ingredient_agent(db: AsyncSession) -> dict[str, Any]:
    """Find and store INCI ingredients for products that have none."""
    import threading

    stats: dict[str, Any] = {
        "queried": 0,
        "updated": 0,
        "not_found": 0,
        "errors": 0,
        "skipped_no_brand": 0,
    }
    stats_lock = threading.Lock()
    commit_lock = asyncio.Lock()

    llm = _get_grounding_llm()

    result = await db.execute(
        select(Product, Brand.name.label("brand_name"))
        .join(Brand, Product.brand_id == Brand.id)
        .where(
            Product.is_active == True,  # noqa: E712
            Product.inci_ingredients.is_(None),
        )
        .order_by(_SOURCE_PRIORITY)
        .limit(settings.ingredient_agent_limit)
    )
    rows = result.all()
    logger.info("[ingredient_agent] %d products to process (concurrency=%d)",
                len(rows), settings.ingredient_agent_concurrency)

    sem = asyncio.Semaphore(settings.ingredient_agent_concurrency)

    async def _process(product: Product, brand_name: str) -> None:
        async with sem:
            with stats_lock:
                stats["queried"] += 1
                queried = stats["queried"]

            if not brand_name:
                logger.debug("Skipping product %s — no brand name", product.id)
                with stats_lock:
                    stats["skipped_no_brand"] += 1
                return

            if settings.ingredient_agent_delay > 0:
                await asyncio.sleep(settings.ingredient_agent_delay)

            try:
                ingredients = await _fetch_ingredients_for_product(
                    llm,
                    name=product.name,
                    brand=brand_name,
                    category=product.category_key,
                )
            except Exception:
                with stats_lock:
                    stats["errors"] += 1
                return

            if ingredients and not product.inci_ingredients:
                product.inci_ingredients = ingredients
                async with commit_lock:
                    await db.flush()
                with stats_lock:
                    stats["updated"] += 1
                logger.info(
                    "[ingredient_agent] FOUND %r (%s) — %d ingredients",
                    product.name,
                    product.source,
                    len(ingredients),
                )
            else:
                with stats_lock:
                    stats["not_found"] += 1
                logger.debug("[ingredient_agent] NOT_FOUND %r (%s)", product.name, product.source)

            # Checkpoint commit every 100 products
            if queried % 100 == 0:
                async with commit_lock:
                    await db.commit()
                logger.info("[ingredient_agent] checkpoint @ %d — %s", queried, stats)

    await asyncio.gather(*[_process(p, b) for p, b in rows])

    await db.commit()
    logger.info("[ingredient_agent] done — %s", stats)
    return stats


async def run_ingredient_agent() -> None:
    await run_job(
        job_name="ingredient_agent",
        source="gemini_search",
        job_fn=ingest_ingredient_agent,
        parameters={
            "limit": settings.ingredient_agent_limit,
            "model": settings.gemini_model,
        },
    )
