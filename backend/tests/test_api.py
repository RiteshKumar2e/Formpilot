from pathlib import Path

from app.config import get_settings
from app.services.extraction import parse_date
from app.services.mapping import classify

from .conftest import CERTIFICATE_LINES, RESUME_LINES, make_pdf


def upload(client, name: str, data: bytes, mime: str = "application/pdf"):
    return client.post("/api/documents", files={"file": (name, data, mime)})


# --- Auth ---------------------------------------------------------------------------------


def test_signup_session_and_signout(client):
    res = client.post("/api/auth/signup", json={"full_name": "Asha Rao", "email": "asha@example.com", "password": "longpassword1"})
    assert res.status_code == 201
    cookie = res.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert client.get("/api/auth/me").json()["email"] == "asha@example.com"

    assert client.get("/api/auth/session").json()["user"]["email"] == "asha@example.com"
    assert client.post("/api/auth/signout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/session").json() == {"user": None}


def test_duplicate_email_and_bad_credentials(client):
    payload = {"full_name": "Dup User", "email": "dup@example.com", "password": "longpassword1"}
    assert client.post("/api/auth/signup", json=payload).status_code == 201
    assert client.post("/api/auth/signup", json=payload).status_code == 409
    res = client.post("/api/auth/signin", json={"email": "dup@example.com", "password": "wrongpassword1"})
    assert res.status_code == 401
    assert client.post("/api/auth/signin", json={"email": "DUP@example.com", "password": "longpassword1"}).status_code == 200


def test_weak_password_rejected(client):
    res = client.post("/api/auth/signup", json={"full_name": "Weak", "email": "weak@example.com", "password": "short"})
    assert res.status_code == 422


def test_protected_routes_require_session(client):
    client.cookies.clear()
    for path in ("/api/documents", "/api/profile"):
        assert client.get(path).status_code == 401


# --- Documents & profile --------------------------------------------------------------------


def test_resume_extraction(signed_in):
    res = upload(signed_in, "Resume.pdf", make_pdf(RESUME_LINES))
    assert res.status_code == 201, res.text
    doc = res.json()
    assert doc["status"] == "processed"
    values = {f["key"]: f["value"] for f in doc["extracted"]}
    assert values["full_name"] == "Ritesh Kumar"
    assert values["email"] == "ritesh@example.com"
    assert values["phone"] == "+91 98765 43210"
    assert values["date_of_birth"] == "12 May 2002"
    assert values["highest_qualification"] == "B.Tech in Computer Science"
    assert values["institution"] == "Northfield Institute of Technology"
    assert values["graduation_year"] == "2024"
    assert values["experience"] == "Research Intern - Machine Vision & Intelligence Lab"
    assert values["skills"] == "Python, React, FastAPI, Machine Learning"


def test_files_are_encrypted_at_rest(signed_in):
    doc = upload(signed_in, "Resume.pdf", make_pdf(RESUME_LINES)).json()
    stored = list(Path(get_settings().storage_dir).rglob(f"{doc['id']}.bin"))
    assert len(stored) == 1
    assert not stored[0].read_bytes().startswith(b"%PDF")


def test_conflict_detection_and_resolution(signed_in):
    upload(signed_in, "Resume.pdf", make_pdf(RESUME_LINES))
    cert = upload(signed_in, "Degree_Certificate.pdf", make_pdf(CERTIFICATE_LINES)).json()
    # 12/05/2003 is ambiguous (day/month), so the certificate is flagged for review.
    assert cert["status"] == "needs_review"

    profile = signed_in.get("/api/profile").json()
    conflict = next(c for c in profile["conflicts"] if c["key"] == "date_of_birth")
    assert {v["value"] for v in conflict["values"]} == {"12 May 2002", "12 May 2003"}
    assert "date_of_birth" not in {f["key"] for f in profile["fields"]}
    # Same name, and the same degree written two ways, are not conflicts.
    assert next(f for f in profile["fields"] if f["key"] == "highest_qualification")["value"] == "B.Tech in Computer Science"
    assert next(f for f in profile["fields"] if f["key"] == "full_name")["value"] == "Ritesh Kumar"

    resolved = signed_in.post("/api/profile/conflicts/resolve", json={"key": "date_of_birth", "value": "12 May 2003"}).json()
    assert not any(c["key"] == "date_of_birth" for c in resolved["conflicts"])
    dob = next(f for f in resolved["fields"] if f["key"] == "date_of_birth")
    assert dob["value"] == "12 May 2003"
    assert "Degree_Certificate.pdf" in dob["source_filename"]


def test_semantic_mapping(signed_in):
    upload(signed_in, "Resume.pdf", make_pdf(RESUME_LINES))
    res = signed_in.post(
        "/api/mapping",
        json={"fields": ["Name of applicant", "Contact email", "Highest Qualification", "Mobile number", "Notice period"]},
    )
    matches = {m["form_label"]: m for m in res.json()["matches"]}
    assert matches["Name of applicant"]["value"] == "Ritesh Kumar"
    assert matches["Contact email"]["value"] == "ritesh@example.com"
    assert matches["Highest Qualification"]["value"] == "B.Tech in Computer Science"
    assert matches["Mobile number"]["key"] == "phone"
    assert matches["Notice period"]["value"] is None
    assert matches["Notice period"]["needs_review"] is False


def test_rejects_unsupported_and_oversized_files(signed_in):
    assert upload(signed_in, "notes.txt", b"hello world", "text/plain").status_code == 415
    # A text file renamed to .pdf is still rejected: the type is sniffed from the bytes.
    assert upload(signed_in, "fake.pdf", b"not really a pdf").status_code == 415
    big = b"%PDF-" + b"0" * (10 * 1024 * 1024)
    assert upload(signed_in, "big.pdf", big).status_code == 413


def test_damaged_pdf_fails_gracefully(signed_in):
    res = upload(signed_in, "broken.pdf", b"%PDF-1.4\n garbage without structure")
    assert res.status_code == 201
    assert res.json()["status"] == "failed"


def test_documents_are_private_and_deletable(client, signed_in):
    doc = upload(signed_in, "Resume.pdf", make_pdf(RESUME_LINES)).json()
    signed_in.cookies.clear()
    client.post("/api/auth/signup", json={"full_name": "Other", "email": "other@example.com", "password": "longpassword1"})
    assert client.delete(f"/api/documents/{doc['id']}").status_code == 404
    assert all(d["id"] != doc["id"] for d in client.get("/api/documents").json())


def test_contact_validation(client):
    assert client.post("/api/contact", json={"name": "A", "email": "bad", "message": "hello there friend"}).status_code == 422
    assert client.post("/api/contact", json={"name": "A", "email": "a@example.com", "message": "Hello, I have a question."}).json() == {"ok": True}


def test_delete_account_removes_everything(client):
    client.post("/api/auth/signup", json={"full_name": "Gone Soon", "email": "gone@example.com", "password": "longpassword1"})
    doc = upload(client, "Resume.pdf", make_pdf(RESUME_LINES)).json()
    assert client.delete("/api/auth/me").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    assert not list(Path(get_settings().storage_dir).rglob(f"{doc['id']}.bin"))
    res = client.post("/api/auth/signin", json={"email": "gone@example.com", "password": "longpassword1"})
    assert res.status_code == 401


# --- Units ----------------------------------------------------------------------------------


def test_parse_date_formats():
    assert parse_date("12 May 2002") == ("12 May 2002", 0.95)
    assert parse_date("May 12th, 2002") == ("12 May 2002", 0.95)
    assert parse_date("2002-05-12") == ("12 May 2002", 0.95)
    assert parse_date("25/05/2002") == ("25 May 2002", 0.9)
    assert parse_date("12/05/2002")[1] < 0.7  # ambiguous
    assert parse_date("31/02/2002") is None


def test_degree_names_are_canonicalized():
    from app.services.extraction import extract_fields

    values = {f.key: f.value for f in extract_fields("Bachelor of Technology in Computer Science")}
    assert values["highest_qualification"] == "B.Tech in Computer Science"
    values = {f.key: f.value for f in extract_fields("M. Tech in Data Science\nB.Tech in Computer Science")}
    assert values["highest_qualification"] == "M.Tech in Data Science"


def test_classify_labels():
    assert classify("Latest degree earned")[0] == "highest_qualification"
    assert classify("Full legal name")[0] == "full_name"
    assert classify("Professional Experience")[0] == "experience"
    assert classify("Favourite colour")[0] is None


def test_image_upload_without_ocr_needs_review(signed_in, monkeypatch):
    monkeypatch.setattr("app.services.extraction.ocr_available", lambda: False)
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
    doc = upload(signed_in, "ID_scan.png", png, "image/png").json()
    assert doc["status"] == "needs_review"
    assert "Text recognition" in doc["message"]


# --- Abuse protection & transport ------------------------------------------------------------


def test_rate_limit_on_signin(client, monkeypatch):
    from app.ratelimit import signin_limit

    monkeypatch.setattr(get_settings(), "rate_limit_enabled", True)
    signin_limit.reset()
    payload = {"email": "nobody@example.com", "password": "whatever123"}
    codes = [client.post("/api/auth/signin", json=payload).status_code for _ in range(11)]
    assert codes[:10] == [401] * 10
    assert codes[10] == 429
    signin_limit.reset()


def test_honeypots(client):
    from sqlalchemy import func, select

    from app.database import SessionLocal
    from app.models import ContactMessage

    with SessionLocal() as db:
        before = db.scalar(select(func.count()).select_from(ContactMessage))
    res = client.post(
        "/api/contact",
        json={"name": "Bot", "email": "bot@example.com", "message": "Buy cheap things now!!", "website": "http://spam"},
    )
    assert res.json() == {"ok": True}
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(ContactMessage)) == before

    res = client.post(
        "/api/auth/signup",
        json={"full_name": "Bot", "email": "bot2@example.com", "password": "longpassword1", "website": "x"},
    )
    assert res.status_code == 400


def test_https_redirect_and_hsts(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "enforce_https", True)
    res = client.get("/api/health", follow_redirects=False)
    assert res.status_code == 308
    assert res.headers["location"].startswith("https://")
    secure = client.get("https://testserver/api/health")
    assert secure.status_code == 200
    assert "max-age" in secure.headers["strict-transport-security"]


def test_production_requires_secrets():
    import pytest

    from app.config import Settings

    with pytest.raises(RuntimeError):
        Settings(environment="production", secret_key="", file_encryption_key="", cookie_secure=True).validate_for_production()
    with pytest.raises(RuntimeError):
        Settings(
            environment="production", secret_key="s" * 40, file_encryption_key="k", cookie_secure=True, enforce_https=False
        ).validate_for_production()



def test_password_minimum_is_eight_characters(client):
    base = {"full_name": "Eight Chars", "email": "eight@example.com"}
    assert client.post("/api/auth/signup", json={**base, "password": "abc1234"}).status_code == 422  # 7 chars
    assert client.post("/api/auth/signup", json={**base, "password": "abcdefgh"}).status_code == 422  # no number
    assert client.post("/api/auth/signup", json={**base, "password": "abc12345"}).status_code == 201


def test_non_profile_document_gives_no_false_name(signed_in):
    """A course document's title must not be read as the user's name."""
    lines = [
        "Information Retrieval Systems",
        "Unit 2 Answers",
        "Q1. What is an inverted index?",
        "An inverted index maps each term to the documents that contain it.",
        "Q2. Define precision and recall.",
    ]
    doc = upload(signed_in, "Information_Retrieval_System_Answers.pdf", make_pdf(lines)).json()
    assert doc["extracted"] == []
    assert doc["status"] == "needs_review"
    assert "resumes, certificates" in doc["message"]


def test_resume_name_still_found_from_first_line():
    from app.services.extraction import extract_fields

    resume = "Asha Rao\nasha.rao@example.com\nEducation\nB.Sc in Physics"
    assert {f.key: f.value for f in extract_fields(resume)}["full_name"] == "Asha Rao"
    # A title line with no resume signals is not treated as a name.
    assert "full_name" not in {f.key for f in extract_fields("Data Structures Notes\nArrays and lists")}


def test_address_is_not_matched_to_email():
    assert classify("Current Address")[0] == "address"
    assert classify("Residential Address")[0] == "address"
    assert classify("Email Address")[0] == "email"
    assert classify("Emergency Contact")[0] == "emergency_contact"
