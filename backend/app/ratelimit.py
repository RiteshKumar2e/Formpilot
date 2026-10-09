"""In-memory sliding-window rate limiting for abuse-prone endpoints.

State lives in this process, which is enough for a single instance. When running several API
instances, move the counters to Redis so the limits are shared.
"""

import threading
import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException, Request, status

from .config import get_settings
from .deps import get_current_user
from .models import User


def client_ip(request: Request) -> str:
    """The caller's IP. Behind proxies, read X-Forwarded-For from the right: each trusted proxy appends the
    address it received the request from, while everything further left was sent by the client and can be
    forged. TRUSTED_PROXY_HOPS is how many proxies append (1 for Render; 2 for Vercel -> Render)."""
    settings = get_settings()
    if settings.trust_proxy_headers:
        forwarded = [part.strip() for part in request.headers.get("x-forwarded-for", "").split(",") if part.strip()]
        if forwarded:
            return forwarded[-min(max(settings.trusted_proxy_hops, 1), len(forwarded))]
    return request.client.host if request.client else "unknown"


class RateLimit:
    def __init__(self, limit: int, window_seconds: float):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _recent(self, key: str, now: float) -> deque[float]:
        hits = self._hits[key]
        while hits and now - hits[0] > self.window:
            hits.popleft()
        return hits

    def exceeded(self, key: str) -> bool:
        """Whether `key` is at its limit, without counting this call."""
        if not get_settings().rate_limit_enabled:
            return False
        with self._lock:
            return len(self._recent(key, time.monotonic())) >= self.limit

    def hit(self, key: str) -> None:
        """Counts one event for `key`; raises 429 when the limit is already reached."""
        if not get_settings().rate_limit_enabled:
            return
        now = time.monotonic()
        with self._lock:
            hits = self._recent(key, now)
            if len(hits) >= self.limit:
                retry = int(self.window - (now - hits[0])) + 1
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    "Too many attempts. Please wait a moment and try again.",
                    headers={"Retry-After": str(retry)},
                )
            hits.append(now)

    def record(self, key: str) -> None:
        """Counts one event for `key` without raising."""
        if not get_settings().rate_limit_enabled:
            return
        with self._lock:
            now = time.monotonic()
            self._recent(key, now).append(now)

    def __call__(self, request: Request) -> None:
        """As a route dependency: limits each client IP on this path."""
        self.hit(f"{request.url.path}:{client_ip(request)}")

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


signup_limit = RateLimit(limit=5, window_seconds=600)
signin_limit = RateLimit(limit=10, window_seconds=300)
# Failed sign-ins per account, whatever the IP (credential stuffing and distributed guessing).
signin_account_limit = RateLimit(limit=20, window_seconds=900)
contact_limit = RateLimit(limit=5, window_seconds=600)
upload_limit = RateLimit(limit=30, window_seconds=600)
forgot_password_limit = RateLimit(limit=5, window_seconds=900)
# Reset emails per account, whatever the IP, so nobody can flood someone's inbox.
forgot_password_email_limit = RateLimit(limit=3, window_seconds=3600)
reset_password_limit = RateLimit(limit=10, window_seconds=900)
# LLM-backed endpoints per signed-in user (Groq cost and quota).
ai_limit = RateLimit(limit=60, window_seconds=600)


def ai_rate_limit(user: User = Depends(get_current_user)) -> None:
    ai_limit.hit(f"ai:{user.id}")
