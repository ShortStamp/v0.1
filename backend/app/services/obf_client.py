"""HTTP client for the Open Beauty Facts / Open Products Facts API."""

import logging

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://world.openfoodfacts.org/cgi/search.pl"

# User-Agent required by OBF policy
USER_AGENT = "ShortStamp/1.0 (ingestion; contact@shortstamp.com)"


async def search_products(
    term: str,
    page: int = 1,
    page_size: int = 50,
    *,
    client: httpx.AsyncClient | None = None,
) -> dict:
    """Search Open Beauty Facts for beauty products.

    Args:
        term: Search keyword (e.g. "foundation", "mascara").
        page: 1-indexed page number.
        page_size: Results per page (max 100 per OBF limits).
        client: Optional shared httpx client for connection reuse.

    Returns:
        Raw JSON response dict with "products" list and "count" total.
    """
    params = {
        "search_terms": term,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page": page,
        "page_size": min(page_size, 100),
        "tagtype_0": "categories",
        "tag_contains_0": "contains",
        "tag_0": "beauty",
    }

    should_close = client is None
    client = client or httpx.AsyncClient(
        timeout=60, headers={"User-Agent": USER_AGENT}
    )

    try:
        resp = await client.get(BASE_URL, params=params)
        if resp.status_code != 200:
            logger.warning(
                "OBF search failed for '%s' page %d: HTTP %d",
                term, page, resp.status_code,
            )
            return {"products": [], "count": 0}
        return resp.json()
    except httpx.RequestError as exc:
        logger.error("OBF request error for '%s': %s", term, exc)
        return {"products": [], "count": 0}
    finally:
        if should_close:
            await client.aclose()
