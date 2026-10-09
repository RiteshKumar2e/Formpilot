"""Security regression tests from the audit in security/SECURITY_AUDIT.md (finding IDs in each docstring)."""

import uuid

import pytest
from sqlalchemy import select

from app.config import get_settings
from app.database import SessionLocal
from app.models import User
from app.ratelimit import ai_limit, forgot_password_email_limit, forgot_password_limit, signin_account_limit, signin_limit
from tests.conftest import make_pdf

PASSWORD = "correcthorse42"


def email() -> str:
    return f"sec-{uuid.uuid4().hex[:8]}@example.com"


def signup(client, address: str | None = None) -> str:
    address = address or email()
    res = client.post("/api/auth/signup", json={"full_name": "Sec Test", "email": address, "password": PASSWORD})
    assert res.status_code == 201, res.text
    return address


@pytest.fixture()
def limits(monkeypatch):
    monkeypatch.setattr(get_settings(), "rate_limit_enabled", True)
    for limit in (signin_limit, signin_account_limit, forgot_password_limit, forgot_password_email_limit, ai_limit):
        limit.reset()
    yield
    for limit in (signin_limit, signin_account_limit, forgot_password_limit, forgot_password_email_limit, ai_limit):
        limit.reset()


# --- Rate limiting -------------------------------------------------------------------------------


def test_spoofed_forwarded_for_does_not_bypass_rate_limit(client, limits, monkeypatch):
    """SEC-01: the client controls the left of X-Forwarded-For; only the proxy-appended entry counts."""
    monkeypatch.setattr(get_settings(), "trust_proxy_headers", True)
    payload = {"email": "nobody@example.com", "password": "whatever123"}
    codes = [
        client.post("/api/auth/signin", json=payload, headers={"X-Forwarded-For": f"10.9.{i}.1, 203.0.113.7"}).status_code
        for i in range(11)
    ]
    assert codes[-1] == 429


def test_signin_limited_per_account_across_ips(client, limits, monkeypatch):
    """SEC-02: password guessing against one account from many IPs is capped."""
    monkeypatch.setattr(get_settings(), "trust_proxy_headers", True)
    target = signup(client)
    client.cookies.clear()
    codes = [
        client.post("/api/auth/signin", json={"email": target, "password": f"guess{i}x"}, headers={"X-Forwarded-For": f"198.51.100.{i}"}).status_code
        for i in range(25)
    ]
    assert codes[0] == 401 and codes[-1] == 429


def test_forgot_password_emails_capped_per_account(client, limits, monkeypatch):
    """SEC-03: reset emails to one address are capped even from many IPs; the response stays the same."""
    monkeypatch.setattr(get_settings(), "trust_proxy_headers", True)
    sent: list[str] = []
    monkeypatch.setattr("app.routers.auth.send_email", lambda to, *a, **k: sent.append(to) or True)
    target = signup(client)
    codes = [
        client.post("/api/auth/password/forgot", json={"email": target}, headers={"X-Forwarded-For": f"192.0.2.{i}"}).status_code
        for i in range(8)
    ]
    assert set(codes) == {200}
    assert 1 <= len(sent) <= 3


def test_ai_endpoints_rate_limited_per_user(client, limits):
    """SEC-04: LLM-backed endpoints can't be called without limit (cost and quota abuse)."""
    signup(client)
    body = {"question": "Why do you want this role?"}
    codes = [client.post("/api/answers/suggest", json=body).status_code for _ in range(61)]
    assert codes[0] == 200 and codes[-1] == 429


# --- Request size and CSRF ----------------------------------------------------------------------


def test_oversized_body_rejected_before_parsing(client):
    """SEC-05: a huge upload is refused from its Content-Length, before multipart parsing or auth."""
    res = client.post(
        "/api/documents",
        content=b"x" * 64,
        headers={"Content-Type": "multipart/form-data; boundary=x", "Content-Length": str(200 * 1024 * 1024)},
    )
    assert res.status_code == 413
    big_json = b'{"question":"' + b"a" * (2 * 1024 * 1024) + b'"}'
    assert client.post("/api/answers", content=big_json, headers={"Content-Type": "application/json"}).status_code == 413


def test_cross_site_requests_rejected(client):
    """SEC-06: state-changing requests from another site's page are refused (defence in depth over SameSite)."""
    res = client.post("/api/auth/signin", json={"email": "a@example.com", "password": "x"}, headers={"Origin": "https://evil.example"})
    assert res.status_code == 403
    # The app's own origin, requests without Origin (curl, server-to-server) and the extension's bearer calls still work.
    assert client.post("/api/auth/signin", json={"email": "a@example.com", "password": "x"}, headers={"Origin": "http://localhost:5173"}).status_code == 401
    assert client.post("/api/auth/signin", json={"email": "a@example.com", "password": "x"}).status_code == 401
    ext = client.post("/api/autofill/suggest", json={"fields": [{"id": "1", "label": "Name"}]}, headers={"Origin": "chrome-extension://abc", "Authorization": "Bearer fpx_invalid"})
    assert ext.status_code == 401


# --- Files --------------------------------------------------------------------------------------


def test_download_with_non_ascii_filename(client):
    """SEC-07: Content-Disposition is RFC 6266 encoded (non-Latin names used to crash with a 500)."""
    signup(client)
    files = {"file": ("रिज़्यूमे \"x\".pdf", make_pdf(["Name: Test"]), "application/pdf")}
    doc = client.post("/api/documents", files=files).json()
    res = client.get(f"/api/documents/{doc['id']}/file")
    assert res.status_code == 200
    disposition = res.headers["content-disposition"]
    assert disposition.startswith("attachment;") and "filename*=UTF-8''" in disposition and "\n" not in disposition


# --- Accounts -----------------------------------------------------------------------------------


def test_password_minimum_length(client):
    """SEC-08: passwords need at least 8 characters."""
    res = client.post("/api/auth/signup", json={"full_name": "Short", "email": email(), "password": "abc1234"})
    assert res.status_code == 422


def test_google_link_removes_preexisting_password(client):
    """SEC-09: someone who registered the victim's email first can't keep a password on the linked account."""
    from app.routers.auth import _oauth_user

    target = signup(client)
    with SessionLocal() as db:
        user = _oauth_user(db, f"google-{uuid.uuid4().hex}", target, "Victim")
        assert user.password_hash == "" and user.password_changed_at is not None
    client.cookies.clear()
    assert client.post("/api/auth/signin", json={"email": target, "password": PASSWORD}).status_code == 401


def test_extension_token_cannot_reach_admin(client, monkeypatch):
    """Admin routes refuse the extension's scoped token, even for an admin."""
    admin = signup(client)
    monkeypatch.setattr(get_settings(), "admin_emails", admin)
    token = client.post("/api/extension/tokens", json={"name": "Test"}).json()["token"]
    client.cookies.clear()
    assert client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"}).status_code == 403


def test_other_users_resources_are_not_reachable(client):
    """IDOR: another account's document id returns 404, never the file."""
    signup(client)
    doc = client.post("/api/documents", files={"file": ("a.pdf", make_pdf(["Name: A"]), "application/pdf")}).json()
    client.cookies.clear()
    signup(client)
    assert client.get(f"/api/documents/{doc['id']}/file").status_code == 404
    assert client.delete(f"/api/documents/{doc['id']}").status_code == 404


# --- Webhooks -----------------------------------------------------------------------------------


def test_webhook_delivery_pins_the_validated_address(monkeypatch):
    """SEC-10: DNS rebinding can't redirect a delivery to an internal address after validation."""
    import socket

    from app.services import integrations

    monkeypatch.setattr(get_settings(), "environment", "production")
    answers = iter([[(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))], [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443))]])
    monkeypatch.setattr(integrations.socket, "getaddrinfo", lambda *a, **k: next(answers))
    sent = {}

    def fake_send(url, body, headers, extensions):
        sent.update(url=url, headers=headers, extensions=extensions)

    monkeypatch.setattr(integrations, "_send", fake_send)
    integrations.post_signed("https://hooks.example.com/in", "secret", "application.created", b"{}")
    assert sent["url"].startswith("https://93.184.216.34")
    assert sent["headers"]["Host"] == "hooks.example.com"
    assert sent["extensions"]["sni_hostname"] == "hooks.example.com"
