"""In-memory sliding-window rate limiting for abuse-prone endpoints.

State lives in this process, which is enough for a single instance. When running several API
instances, move the counters to Redis so the limits are shared.
"""

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from .config import get_settings


def client_ip(request: Request) -> str:
    if get_settings().trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimit:
    def __init__(self, limit: int, window_seconds: float):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def __call__(self, request: Request) -> None:
        if not get_settings().rate_limit_enabled:
            return
        key = f"{request.url.path}:{client_ip(request)}"
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                retry = int(self.window - (now - hits[0])) + 1
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    "Too many attempts. Please wait a moment and try again.",
                    headers={"Retry-After": str(retry)},
                )
            hits.append(now)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


signup_limit = RateLimit(limit=5, window_seconds=600)
signin_limit = RateLimit(limit=10, window_seconds=300)
contact_limit = RateLimit(limit=5, window_seconds=600)
upload_limit = RateLimit(limit=30, window_seconds=600)
