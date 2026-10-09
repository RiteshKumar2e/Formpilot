"""Outgoing webhooks, so other systems can react to FormPilot events.

Each delivery is a JSON POST signed with the webhook's secret:
    X-FormPilot-Event: application.approved
    X-FormPilot-Signature: sha256=<hex HMAC-SHA256 of the raw body>
Receivers should recompute the signature and compare it in constant time before trusting the body.
"""

from __future__ import annotations

import hashlib
import hmac
import ipaddress
import json
import logging
import socket
from datetime import datetime, timezone
from urllib.parse import urlsplit

import httpx
from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import SessionLocal
from ..models import Webhook, WebhookDelivery

log = logging.getLogger(__name__)

EVENTS = ("document.processed", "application.created", "application.approved", "application.deleted")


class InvalidWebhookUrl(ValueError):
    pass


def _checked_parts(url: str):
    parts = urlsplit(url.strip())
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise InvalidWebhookUrl("Enter a full URL starting with https://")
    if get_settings().is_production and parts.scheme != "https":
        raise InvalidWebhookUrl("Webhook URLs must use https.")
    return parts


def validate_webhook_url(url: str) -> str:
    """Rejects URLs that would let a user make the server call its own network (SSRF)."""
    parts = _checked_parts(url)
    if get_settings().is_production:
        _public_address(parts.hostname or "", parts.port or 443)
    return url.strip()


def sign(secret: str, body: bytes) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def _public_address(hostname: str, port: int) -> str:
    """Resolves `hostname` once and returns an address only if every answer is public."""
    try:
        addresses = [info[4][0] for info in socket.getaddrinfo(hostname, port, proto=socket.IPPROTO_TCP)]
    except socket.gaierror as exc:
        raise InvalidWebhookUrl("This host can't be resolved.") from exc
    if not addresses or any(not ipaddress.ip_address(a).is_global for a in addresses):
        raise InvalidWebhookUrl("Webhook URLs must point to a public internet address.")
    return addresses[0]


def post_signed(url: str, secret: str, event: str, body: bytes) -> httpx.Response:
    """POSTs a signed event. In production the host is resolved once, checked, and the connection pinned to
    that address (TLS still verifies the real hostname), so DNS rebinding can't swap in an internal address
    between the check and the request."""
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "FormPilot-Webhooks/1.0",
        "X-FormPilot-Event": event,
        "X-FormPilot-Signature": sign(secret, body),
    }
    extensions: dict = {}
    target = url
    if get_settings().is_production:
        parts = _checked_parts(url)
        hostname, port = parts.hostname or "", parts.port or 443
        address = _public_address(hostname, port)
        host = f"[{address}]" if ":" in address else address
        target = parts._replace(netloc=f"{host}:{port}").geturl()
        headers["Host"] = parts.netloc.rsplit("@", 1)[-1]
        extensions["sni_hostname"] = hostname
    return _send(target, body, headers, extensions)


def _send(url: str, body: bytes, headers: dict[str, str], extensions: dict) -> httpx.Response:
    with httpx.Client(timeout=get_settings().webhook_timeout_seconds, follow_redirects=False) as client:
        return client.post(url, content=body, headers=headers, extensions=extensions)


def deliver(webhook_id: str, event: str, body: bytes) -> None:
    """Sends one event and records the outcome. Runs after the response, in its own session."""
    with SessionLocal() as db:
        hook = db.get(Webhook, webhook_id)
        if hook is None or not hook.active:
            return
        delivery = WebhookDelivery(webhook_id=hook.id, event=event, ok=False)
        try:
            res = post_signed(hook.url, hook.secret, event, body)
            delivery.status_code = res.status_code
            delivery.ok = 200 <= res.status_code < 300
        except (httpx.HTTPError, InvalidWebhookUrl) as exc:
            delivery.error = str(exc)[:500] or exc.__class__.__name__
        db.add(delivery)
        db.commit()


def emit(db: Session, background: BackgroundTasks | None, user_id: str, event: str, data: dict) -> int:
    """Queues `event` for every active webhook of the user subscribed to it. Returns how many."""
    hooks = [
        h
        for h in db.scalars(select(Webhook).where(Webhook.user_id == user_id, Webhook.active.is_(True)))
        if event in h.events.split(",")
    ]
    if not hooks or background is None:
        return 0
    body = json.dumps(
        {"event": event, "created_at": datetime.now(timezone.utc).isoformat(), "data": data}, separators=(",", ":")
    ).encode()
    for hook in hooks:
        background.add_task(deliver, hook.id, event, body)
    return len(hooks)
