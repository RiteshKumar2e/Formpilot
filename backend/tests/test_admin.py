"""Admin dashboard: only ADMIN_EMAILS can see it, and it never returns decrypted personal data."""

import uuid

import pytest

from app.config import get_settings

ENDPOINTS = ("/api/admin/overview", "/api/admin/users", "/api/admin/documents", "/api/admin/activity", "/api/admin/messages")


def signup(client, email: str) -> None:
    res = client.post("/api/auth/signup", json={"full_name": "Admin Person", "email": email, "password": "correcthorse42"})
    assert res.status_code == 201, res.text


@pytest.fixture()
def admin_email(monkeypatch):
    email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
    monkeypatch.setattr(get_settings(), "admin_emails", f"someone@else.com, {email.upper()}")
    return email


def test_signed_out_and_regular_users_cannot_open_admin(client, admin_email):
    for path in ENDPOINTS:
        assert client.get(path).status_code == 401
    signup(client, f"user-{uuid.uuid4().hex[:8]}@example.com")
    assert client.get("/api/auth/me").json()["is_admin"] is False
    for path in ENDPOINTS:
        assert client.get(path).status_code == 404


def test_admin_sees_counts_and_users(client, admin_email):
    signup(client, admin_email)
    assert client.get("/api/auth/me").json()["is_admin"] is True
    client.post("/api/contact", json={"name": "Visitor", "email": "visitor@example.com", "message": "Hello from the contact form, please reply."})

    overview = client.get("/api/admin/overview").json()
    assert overview["totals"]["users"] >= 1
    assert len(overview["signups"]) == 14 and sum(d["count"] for d in overview["signups"]) >= 1
    assert overview["vector_store"]["collection"]

    users = client.get("/api/admin/users").json()
    me = next(u for u in users if u["email"] == admin_email)
    assert me["documents"] == 0 and "password_hash" not in me

    for path in ENDPOINTS[2:]:
        assert client.get(path).status_code == 200


def test_admin_user_detail(client, admin_email):
    signup(client, admin_email)
    me = next(u for u in client.get("/api/admin/users").json() if u["email"] == admin_email)
    detail = client.get(f"/api/admin/users/{me['id']}").json()
    assert detail["email"] == admin_email and detail["documents"] == [] and detail["sign_in"] == "Email and password"
    assert client.get("/api/admin/users/missing").status_code == 404
