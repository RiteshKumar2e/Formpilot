"""Remember me, forgot/reset password and change password."""

import time

import pytest
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import get_settings
from app.database import SessionLocal
from app.main import app
from app.models import PasswordResetToken

PASSWORD = "firstpass1"


def signup(client, email: str) -> None:
    res = client.post("/api/auth/signup", json={"full_name": "Pass Word", "email": email, "password": PASSWORD})
    assert res.status_code == 201, res.text


def cookie_header(res) -> str:
    return res.headers["set-cookie"].lower()


@pytest.fixture()
def outbox(monkeypatch):
    """Captures emails instead of sending them."""
    sent: list[dict] = []

    def fake_send(to, subject, text, html=None):
        sent.append({"to": to, "subject": subject, "text": text, "html": html})
        return True

    monkeypatch.setattr("app.routers.auth.send_email", fake_send)
    return sent


def reset_token(client, outbox, email: str) -> str:
    res = client.post("/api/auth/password/forgot", json={"email": email})
    assert res.status_code == 200, res.text
    assert "reset_url" not in res.json()  # the link only ever goes by email
    mail = outbox[-1]
    assert mail["to"] == email
    url = next(w for w in mail["text"].split() if w.startswith("http"))
    assert url.startswith("http://localhost:5173/reset-password?token=")
    assert url in mail["html"]
    return parse_qs(urlsplit(url).query)["token"][0]


# --- Remember me ---------------------------------------------------------------------------------


def test_remember_me_controls_session_length(client):
    signup(client, "remember@example.com")
    remembered = client.post("/api/auth/signin", json={"email": "remember@example.com", "password": PASSWORD, "remember": True})
    assert f"max-age={get_settings().remember_days * 86400}" in cookie_header(remembered)

    browser_session = client.post("/api/auth/signin", json={"email": "remember@example.com", "password": PASSWORD})
    assert "max-age" not in cookie_header(browser_session)  # ends when the browser closes
    assert client.get("/api/auth/me").status_code == 200


# --- Forgot and reset ----------------------------------------------------------------------------


def test_forgot_password_does_not_reveal_accounts(client):
    res = client.post("/api/auth/password/forgot", json={"email": "nobody-here@example.com"})
    assert res.status_code == 200
    # No SMTP in tests, so the response says email isn't set up; it never says whether the account exists.
    assert res.json() == {"ok": True, "expires_minutes": get_settings().reset_token_minutes, "email_enabled": False}


def test_reset_password_flow(client, outbox):
    signup(client, "reset@example.com")
    other_device = TestClient(app)
    other_device.post("/api/auth/signin", json={"email": "reset@example.com", "password": PASSWORD})
    assert other_device.get("/api/auth/me").status_code == 200

    token = reset_token(client, outbox, "reset@example.com")
    with SessionLocal() as db:  # only a hash of the token is stored
        stored = db.scalar(select(PasswordResetToken.token_hash))
    assert token not in str(stored)
    assert client.get("/api/auth/password/reset", params={"token": token}).json() == {"valid": True, "email": "reset@example.com"}

    time.sleep(1.1)  # sessions are compared to the password change at one-second resolution
    client.cookies.clear()
    res = client.post("/api/auth/password/reset", json={"token": token, "password": "brandnew22"})
    assert res.status_code == 200 and res.json()["email"] == "reset@example.com"
    assert client.get("/api/auth/me").status_code == 200  # signed in with the new password

    # The old password no longer works, the new one does, and the other device was signed out.
    assert client.post("/api/auth/signin", json={"email": "reset@example.com", "password": PASSWORD}).status_code == 401
    assert client.post("/api/auth/signin", json={"email": "reset@example.com", "password": "brandnew22"}).status_code == 200
    assert other_device.get("/api/auth/me").status_code == 401

    # Links are single use.
    assert client.get("/api/auth/password/reset", params={"token": token}).json() == {"valid": False, "email": None}
    assert client.post("/api/auth/password/reset", json={"token": token, "password": "another33"}).status_code == 400


def test_reset_rejects_expired_and_weak(client, outbox):
    signup(client, "expired@example.com")
    token = reset_token(client, outbox, "expired@example.com")
    assert client.post("/api/auth/password/reset", json={"token": token, "password": "nodigits"}).status_code == 422

    with SessionLocal() as db:
        for row in db.scalars(select(PasswordResetToken)):
            row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
    assert client.post("/api/auth/password/reset", json={"token": token, "password": "goodpass44"}).status_code == 400


def test_no_email_for_unknown_accounts(client, outbox):
    client.post("/api/auth/password/forgot", json={"email": "ghost@example.com"})
    assert outbox == []


# --- Change password -----------------------------------------------------------------------------


def test_change_password(client):
    signup(client, "change@example.com")
    bad = client.post("/api/auth/password/change", json={"current_password": "wrongpass1", "new_password": "newpass55"})
    assert bad.status_code == 400
    time.sleep(1.1)
    ok = client.post("/api/auth/password/change", json={"current_password": PASSWORD, "new_password": "newpass55"})
    assert ok.status_code == 204
    assert client.get("/api/auth/me").status_code == 200  # this browser stays signed in
    assert client.post("/api/auth/signin", json={"email": "change@example.com", "password": "newpass55"}).status_code == 200
