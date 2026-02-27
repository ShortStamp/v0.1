"""Resilient HTTP client with TLS impersonation, retry, and rate limiting.

Wraps curl_cffi.AsyncSession to:
- Impersonate Chrome 120 TLS fingerprint (defeats basic bot detection)
- Rotate User-Agent strings per request
- Retry with exponential backoff + jitter on transient errors and 429/5xx
- Honour Retry-After headers before retrying
- Apply per-domain rate limiting via PerDomainRateLimiter

Usage:
    async with ResilientClient() as client:
        resp = await client.get("https://www.sephora.com/...")
        data = resp.json()
"""

import asyncio
import logging
import random
from typing import Any

from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
    wait_random,
    wait_combine,
)

from ingestion.http.rate_limiter import default_limiter

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# User-agent pool — 10 real Chrome UA strings across platforms
# ──────────────────────────────────────────────────────────────────────────────
_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
]

_ACCEPT_LANGUAGES = [
    "en-US,en;q=0.9",
    "en-GB,en;q=0.9",
    "en-CA,en;q=0.9",
    "en-US,en;q=0.8,fr;q=0.5",
]

# HTTP status codes that warrant a retry
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class _RetryableHTTPError(Exception):
    """Raised when we get a retryable HTTP status code."""

    def __init__(self, status: int, retry_after: int | None = None) -> None:
        self.status = status
        self.retry_after = retry_after
        super().__init__(f"HTTP {status}")


class ResilientClient:
    """Async HTTP client with Chrome TLS impersonation and retry logic."""

    def __init__(self, max_attempts: int = 5) -> None:
        self._max_attempts = max_attempts
        self._session = None

    async def __aenter__(self) -> "ResilientClient":
        try:
            from curl_cffi.requests import AsyncSession
            self._session = AsyncSession(impersonate="chrome120")
            self._is_curl = True
        except ImportError:
            import httpx
            self._session = httpx.AsyncClient(follow_redirects=True, timeout=30.0)
            self._is_curl = False
        return self

    async def __aexit__(self, *args: Any) -> None:
        if self._session:
            if self._is_curl:
                # curl_cffi.AsyncSession.close() is a coroutine in 0.7+
                result = self._session.close()
                if asyncio.iscoroutine(result):
                    await result
            else:
                # httpx.AsyncClient.aclose() is async
                await self._session.aclose()
            self._session = None

    def _build_headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        ua = random.choice(_USER_AGENTS)
        headers = {
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": random.choice(_ACCEPT_LANGUAGES),
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        }
        if extra:
            headers.update(extra)
        return headers

    async def _do_request(
        self,
        method: str,
        url: str,
        headers: dict[str, str] | None = None,
        params: dict[str, str] | None = None,
        timeout: float = 30.0,
    ):
        merged = self._build_headers(headers)
        kwargs: dict[str, Any] = {"headers": merged, "timeout": timeout}
        if params:
            kwargs["params"] = params

        resp = await getattr(self._session, method.lower())(url, **kwargs)

        if resp.status_code in _RETRYABLE_STATUS:
            retry_after_raw = resp.headers.get("Retry-After")
            retry_after = None
            if retry_after_raw:
                try:
                    retry_after = int(retry_after_raw)
                except ValueError:
                    pass
            raise _RetryableHTTPError(resp.status_code, retry_after)

        return resp

    async def request(
        self,
        method: str,
        url: str,
        headers: dict[str, str] | None = None,
        params: dict[str, str] | None = None,
        timeout: float = 30.0,
    ):
        """Make an HTTP request with rate limiting and automatic retry."""
        await default_limiter.acquire(url)

        retry_strategy = AsyncRetrying(
            wait=wait_combine(
                wait_exponential(multiplier=1.5, min=2, max=60),
                wait_random(0, 3),
            ),
            stop=stop_after_attempt(self._max_attempts),
            retry=retry_if_exception_type((_RetryableHTTPError, OSError)),
            reraise=True,
        )

        async for attempt in retry_strategy:
            with attempt:
                # Honour Retry-After from previous attempt
                if attempt.retry_state.outcome and attempt.retry_state.outcome.failed:
                    exc = attempt.retry_state.outcome.exception()
                    if isinstance(exc, _RetryableHTTPError) and exc.retry_after:
                        logger.debug(
                            "Retry-After %ds for %s", exc.retry_after, url
                        )
                        await asyncio.sleep(exc.retry_after)

                return await self._do_request(
                    method, url, headers=headers, params=params, timeout=timeout
                )

    async def get(
        self,
        url: str,
        headers: dict[str, str] | None = None,
        params: dict[str, str] | None = None,
        timeout: float = 30.0,
    ):
        return await self.request("GET", url, headers=headers, params=params, timeout=timeout)
