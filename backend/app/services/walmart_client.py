"""HTTP client for the Walmart Affiliate Marketing API.

Authentication uses RSA-SHA256 request signing:
  1. Build string-to-sign: "{consumer_id}\n{timestamp}\n{key_version}\n"
  2. Sign with RSA private key (PKCS1v15 + SHA256)
  3. Base64-encode the signature
  4. Send as WM_SEC.AUTH_SIGNATURE header

Required env vars:
  WALMART_API_KEY           — Consumer ID from developer.walmart.com
  WALMART_PRIVATE_KEY_PATH  — Path to PEM-encoded RSA private key
"""

import asyncio
import base64
import logging
import random
import time
from dataclasses import dataclass
from pathlib import Path

import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey

logger = logging.getLogger(__name__)

BASE_URL = "https://developer.api.walmart.com/api-proxy/service/affil/product/v2"
KEY_VERSION = "1"

MAX_RETRIES = 3
REQUEST_TIMEOUT = 30


def _load_private_key(path: str = "", pem_content: str = "") -> RSAPrivateKey:
    """Load an RSA private key from a PEM file or raw PEM string."""
    if pem_content:
        pem_data = pem_content.encode("utf-8")
    elif path:
        pem_data = Path(path).read_bytes()
    else:
        raise ValueError("Either path or pem_content must be provided")
    key = serialization.load_pem_private_key(pem_data, password=None)
    if not isinstance(key, RSAPrivateKey):
        raise TypeError(f"Expected RSA private key, got {type(key).__name__}")
    return key


def _sign_request(consumer_id: str, private_key: RSAPrivateKey) -> tuple[str, str]:
    """Generate auth signature and timestamp for a Walmart API request.

    Returns:
        (signature_b64, timestamp_ms)
    """
    timestamp = str(int(time.time() * 1000))
    string_to_sign = f"{consumer_id}\n{timestamp}\n{KEY_VERSION}\n"

    signature = private_key.sign(
        string_to_sign.encode("utf-8"),
        padding.PKCS1v15(),
        hashes.SHA256(),
    )
    signature_b64 = base64.b64encode(signature).decode("ascii")
    return signature_b64, timestamp


@dataclass(frozen=True)
class WalmartItem:
    """Normalized result from a Walmart API response."""

    item_id: str
    name: str
    brand: str
    upc: str | None
    sale_price: float | None
    msrp: float | None
    stock: str  # "Available", "Not Available", etc.
    product_url: str
    image_url: str | None
    category_path: str | None


class WalmartAPIError(Exception):
    """Raised when the Walmart API returns an unrecoverable error."""


class WalmartClient:
    """Async client for Walmart Affiliate Marketing API with RSA signing."""

    def __init__(self, consumer_id: str, private_key_path: str = "", private_key_pem: str = ""):
        self._consumer_id = consumer_id
        self._private_key = _load_private_key(path=private_key_path, pem_content=private_key_pem)
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self):
        self._client = httpx.AsyncClient(
            base_url=BASE_URL,
            timeout=REQUEST_TIMEOUT,
        )
        return self

    async def __aexit__(self, *exc):
        if self._client:
            await self._client.aclose()
            self._client = None

    def _auth_headers(self) -> dict[str, str]:
        """Generate fresh signed auth headers for a request."""
        sig, ts = _sign_request(self._consumer_id, self._private_key)
        return {
            "WM_CONSUMER.ID": self._consumer_id,
            "WM_CONSUMER.INTIMESTAMP": ts,
            "WM_SEC.KEY_VERSION": KEY_VERSION,
            "WM_SEC.AUTH_SIGNATURE": sig,
            "Accept": "application/json",
        }

    async def lookup_by_upc(self, upc: str) -> WalmartItem | None:
        """Look up a product by UPC/GTIN barcode.

        Returns None if the product is not found (404) or API errors out.
        """
        data = await self._request("GET", "/items", params={"upc": upc})
        if data is None:
            return None
        items = data.get("items", [])
        return _parse_item(items[0]) if items else None

    async def search(self, query: str, start: int = 1) -> list[WalmartItem]:
        """Search for products by keyword.

        Args:
            query: Search terms (e.g. "MAC lipstick").
            start: 1-indexed result offset.

        Returns:
            List of matched items (may be empty).
        """
        data = await self._request(
            "GET",
            "/search",
            params={"query": query, "start": start, "numItems": 10},
        )
        if data is None:
            return []
        return [_parse_item(item) for item in data.get("items", [])]

    async def _request(
        self, method: str, path: str, **kwargs
    ) -> dict | None:
        """Make an HTTP request with fresh signing and exponential backoff.

        Returns parsed JSON dict, or None on 404 / exhausted retries.
        """
        assert self._client is not None, "Use WalmartClient as async context manager"

        last_exc: Exception | None = None
        for attempt in range(MAX_RETRIES):
            try:
                # Sign each attempt fresh (timestamp changes)
                headers = self._auth_headers()
                resp = await self._client.request(
                    method, path, headers=headers, **kwargs
                )

                if resp.status_code in (400, 404):
                    return None

                if resp.status_code == 429 or resp.status_code >= 500:
                    wait = (2**attempt) + random.uniform(0, 1)
                    logger.warning(
                        "Walmart API %d on %s, retry %d in %.1fs",
                        resp.status_code, path, attempt + 1, wait,
                    )
                    await asyncio.sleep(wait)
                    continue

                resp.raise_for_status()
                return resp.json()

            except httpx.TimeoutException as exc:
                last_exc = exc
                wait = (2**attempt) + random.uniform(0, 1)
                logger.warning(
                    "Walmart API timeout on %s, retry %d in %.1fs",
                    path, attempt + 1, wait,
                )
                await asyncio.sleep(wait)

            except httpx.RequestError as exc:
                last_exc = exc
                if attempt == MAX_RETRIES - 1:
                    break
                await asyncio.sleep(2**attempt)

        if last_exc:
            logger.error("Walmart API exhausted retries on %s: %s", path, last_exc)
        return None


def _parse_item(raw: dict) -> WalmartItem:
    """Parse a raw Walmart API item into a normalized dataclass."""
    return WalmartItem(
        item_id=str(raw.get("itemId", "")),
        name=raw.get("name", ""),
        brand=raw.get("brandName", ""),
        upc=raw.get("upc") or raw.get("gtin13"),
        sale_price=raw.get("salePrice"),
        msrp=raw.get("msrp"),
        stock=raw.get("stock", "Unknown"),
        product_url=raw.get("productTrackingUrl") or raw.get("productUrl", ""),
        image_url=raw.get("largeImage") or raw.get("thumbnailImage"),
        category_path=raw.get("categoryPath"),
    )


def score_candidate(
    candidate: WalmartItem,
    product_name: str,
    brand_name: str,
    barcode: str | None,
) -> float:
    """Score how well a Walmart search result matches our product (0-100).

    Used in the keyword-search fallback to pick the best match.
    """
    score = 0.0

    # Barcode match — highest confidence signal
    if barcode and candidate.upc and barcode.lstrip("0") == candidate.upc.lstrip("0"):
        score += 50.0

    # Brand substring match
    brand_lower = brand_name.lower()
    cand_brand = candidate.brand.lower()
    if brand_lower and cand_brand and (brand_lower in cand_brand or cand_brand in brand_lower):
        score += 25.0

    # Name token overlap
    product_tokens = set(product_name.lower().split())
    candidate_tokens = set(candidate.name.lower().split())
    if product_tokens:
        overlap = len(product_tokens & candidate_tokens)
        score += (overlap / len(product_tokens)) * 25.0

    return score


# Minimum score for a keyword-search match to be accepted
MATCH_THRESHOLD = 35.0
