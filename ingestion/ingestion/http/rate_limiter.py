"""Per-domain async token-bucket rate limiter.

Usage:
    limiter = PerDomainRateLimiter()
    await limiter.acquire("sephora.com")   # blocks until a token is available
"""

import asyncio
import time
from urllib.parse import urlparse

# Requests per second per domain (or domain suffix)
_DOMAIN_RATES: dict[str, float] = {
    "sephora.com": 1.0,
    "amazon.com": 0.5,
    "amazon.ca": 0.5,
    "ulta.com": 0.8,
    "openfoodfacts.org": 2.0,
    "api.walmart.com": 2.0,
    "ac.cnstrc.com": 2.0,   # Constructor.io — less restrictive
}

_DEFAULT_RATE = 1.0  # req/s


class _TokenBucket:
    """Single-domain token bucket."""

    def __init__(self, rate: float) -> None:
        self._rate = rate           # tokens per second
        self._tokens = rate         # start full
        self._last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_refill
            self._tokens = min(self._rate, self._tokens + elapsed * self._rate)
            self._last_refill = now

            if self._tokens >= 1.0:
                self._tokens -= 1.0
                return

            # Sleep until a token is available
            wait = (1.0 - self._tokens) / self._rate
        await asyncio.sleep(wait)
        async with self._lock:
            self._tokens = max(0.0, self._tokens - 1.0)


class PerDomainRateLimiter:
    """Thread-safe per-domain rate limiter backed by token buckets."""

    def __init__(self) -> None:
        self._buckets: dict[str, _TokenBucket] = {}
        self._mutex = asyncio.Lock()

    def _rate_for(self, domain: str) -> float:
        # Match on suffix: "www.sephora.com" -> "sephora.com"
        for key, rate in _DOMAIN_RATES.items():
            if domain == key or domain.endswith("." + key):
                return rate
        return _DEFAULT_RATE

    async def _get_bucket(self, domain: str) -> _TokenBucket:
        async with self._mutex:
            if domain not in self._buckets:
                self._buckets[domain] = _TokenBucket(self._rate_for(domain))
            return self._buckets[domain]

    async def acquire(self, url_or_domain: str) -> None:
        """Block until a request token is available for the given URL or domain."""
        if url_or_domain.startswith("http"):
            domain = urlparse(url_or_domain).netloc.lower()
        else:
            domain = url_or_domain.lower()
        bucket = await self._get_bucket(domain)
        await bucket.acquire()


# Module-level singleton shared across all sources
default_limiter = PerDomainRateLimiter()
