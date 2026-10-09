"""Request guards that run before routing and body parsing.

BodySizeLimit: refuses bodies larger than the endpoint accepts, from Content-Length when sent and by
counting otherwise, so an oversized upload is never read into memory or a temp file.

CrossSiteGuard: refuses state-changing requests sent by another site's page (CSRF). The session cookie is
SameSite=Lax already; this is the second layer. Requests without an Origin header (curl, servers) and the
extension's bearer-token calls aren't browser-cookie requests, so they pass.
"""

import json
from urllib.parse import urlsplit

from .config import get_settings

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
JSON_LIMIT = 1536 * 1024  # largest valid JSON body (a 200-field template) is about 1.1 MB


class BodyTooLarge(Exception):
    pass


async def _reject(send, status: int, detail: str) -> None:
    body = json.dumps({"detail": detail}).encode()
    await send({"type": "http.response.start", "status": status, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
    await send({"type": "http.response.body", "body": body})


def _origin(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}".lower()


class SecurityGuards:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        settings = get_settings()
        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])}
        method, path = scope["method"], scope["path"]

        if method in UNSAFE_METHODS and path.startswith("/api/"):
            origin = headers.get("origin")
            bearer = headers.get("authorization", "").lower().startswith("bearer ")
            allowed = {_origin(o) for o in settings.cors_origin_list} | {_origin(settings.app_url)}
            if origin is not None and not bearer and origin.lower() not in allowed:
                return await _reject(send, 403, "Cross-site request refused.")

        limit = settings.max_upload_bytes + 64 * 1024 if path == "/api/documents" else JSON_LIMIT
        declared = headers.get("content-length")
        if declared is not None:
            try:
                too_big = int(declared) > limit or int(declared) < 0
            except ValueError:
                return await _reject(send, 400, "Invalid Content-Length.")
            if too_big:
                return await _reject(send, 413, "This request is too large.")

        received = 0
        started = False

        async def counting_receive():
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise BodyTooLarge
            return message

        async def tracking_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, counting_receive, tracking_send)
        except BodyTooLarge:
            if not started:
                await _reject(send, 413, "This request is too large.")
