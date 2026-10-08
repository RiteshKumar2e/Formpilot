"""The browser extension: connecting with a token, and autofill on forms FormPilot has never seen."""

import time
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.models import ExtensionToken

from .conftest import RESUME_LINES, make_pdf

PROFILE_RESUME = RESUME_LINES + [
    "Gender: Male",
    "CGPA: 8.47/10",
    "Address: 221B Baker Street, Pune 411001",
]


def connect(client) -> str:
    res = client.post("/api/extension/tokens", json={"name": "Chrome on Windows"})
    assert res.status_code == 201, res.text
    token = res.json()["token"]
    assert token.startswith("fpx_")
    return token


def as_extension(token: str) -> TestClient:
    ext = TestClient(app)
    ext.headers["Authorization"] = f"Bearer {token}"
    return ext


def suggest(client, fields, **extra):
    res = client.post("/api/autofill/suggest", json={"fields": fields, **extra})
    assert res.status_code == 200, res.text
    return res.json()


# --- Connecting -----------------------------------------------------------------------------------


def test_extension_token_is_scoped(signed_in):
    signed_in.post("/api/documents", files={"file": ("Resume.pdf", make_pdf(RESUME_LINES), "application/pdf")})
    token = connect(signed_in)
    with SessionLocal() as db:  # only a hash is stored
        assert token not in [r.token_hash for r in db.scalars(select(ExtensionToken))]

    ext = as_extension(token)
    assert ext.get("/api/auth/me").status_code == 200
    assert ext.get("/api/profile").status_code == 200
    assert suggest(ext, [{"id": "e", "label": "Email"}])["fields"][0]["value"] == "ritesh@example.com"
    # Outside its allowlist the token is refused, including creating more tokens or changing the account.
    assert ext.get("/api/applications").status_code == 403
    assert ext.post("/api/extension/tokens", json={}).status_code == 403
    assert ext.delete("/api/auth/me").status_code == 403
    doc_id = signed_in.get("/api/documents").json()[0]["id"]
    assert ext.delete(f"/api/documents/{doc_id}").status_code == 403
    # A made-up token is just "not signed in".
    assert as_extension("fpx_not-a-real-token").get("/api/auth/me").status_code == 401


def test_disconnect_expiry_and_password_change(signed_in):
    token = connect(signed_in)
    listed = signed_in.get("/api/extension/tokens").json()
    assert len(listed) == 1 and listed[0]["token"] is None and listed[0]["name"] == "Chrome on Windows"
    assert signed_in.delete(f"/api/extension/tokens/{listed[0]['id']}").status_code == 204
    assert as_extension(token).get("/api/auth/me").status_code == 401

    expiring = connect(signed_in)
    with SessionLocal() as db:
        for row in db.scalars(select(ExtensionToken)):
            row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
    assert as_extension(expiring).get("/api/auth/me").status_code == 401

    fresh = connect(signed_in)
    time.sleep(1.1)
    assert signed_in.post("/api/auth/password/change", json={"current_password": "correcthorse42", "new_password": "newhorse99"}).status_code == 204
    assert as_extension(fresh).get("/api/auth/me").status_code == 401


# --- Understanding fields on an unknown website ----------------------------------------------------


def test_semantics_on_an_unseen_form(signed_in):
    signed_in.post("/api/documents", files={"file": ("Resume.pdf", make_pdf(PROFILE_RESUME), "application/pdf")})
    fields = [
        {"id": "1", "label": "Applicant Full Name"},
        {"id": "2", "label": "", "name": "fname", "autocomplete": "given-name"},
        {"id": "3", "label": "Surname"},
        {"id": "4", "label": "Mobile Number", "type": "tel"},
        {"id": "5", "label": "Name of University"},
        {"id": "6", "label": "Gender", "type": "select", "options": ["-- Select --", "Man", "Woman", "Non-binary"]},
        {"id": "7", "label": "Date of Birth", "type": "date"},
        {"id": "8", "label": "Current Address", "type": "textarea"},
        {"id": "9", "label": "Father's Name"},
        {"id": "10", "label": "Name", "section": "Emergency contact"},
        {"id": "11", "label": "I agree to the terms and conditions", "type": "checkbox"},
        {"id": "12", "label": "Upload CV", "type": "file"},
        {"id": "13", "label": "CGPA"},
        {"id": "14", "label": "Passport Number"},
    ]
    body = suggest(signed_in, fields, page_url="https://jobs.unknown-company.example")
    f = {x["id"]: x for x in body["fields"]}

    assert f["1"]["value"] == "Ritesh Kumar"
    assert f["2"]["value"] == "Ritesh" and f["2"]["method"] == "autocomplete"
    assert f["3"]["value"] == "Kumar"
    assert f["4"]["value"] == "+91 98765 43210" and f["4"]["status"] == "ready" and f["4"]["tier"] == "safe"
    assert f["5"]["value"] == "Northfield Institute of Technology"
    assert f["6"]["kind"] == "choice" and f["6"]["option"] == "Man" and f["6"]["status"] == "ready"
    assert f["7"]["value_iso"] == "2002-05-12" and f["7"]["sensitive"] is True
    assert f["8"]["value"] == "221B Baker Street, Pune 411001" and f["8"]["sensitive"] is True
    # Someone else's details are never filled with the applicant's own.
    assert f["9"]["status"] == "missing" and f["9"]["value"] is None
    assert f["10"]["status"] == "missing" and f["10"]["value"] is None
    assert f["11"]["kind"] == "consent" and f["11"]["status"] == "missing"
    assert f["12"]["kind"] == "document" and f["12"]["value"] == "Resume.pdf" and f["12"]["status"] == "needs_review"
    assert f["13"]["value"] == "8.47/10"
    assert f["14"]["status"] == "missing" and f["14"]["sensitive"] is True

    assert [d["filename"] for d in body["documents"]] == ["Resume.pdf"]
    assert any(p["key"] == "full_name" for p in body["profile"])


def test_select_without_a_matching_option_needs_review(signed_in):
    signed_in.post("/api/documents", files={"file": ("Resume.pdf", make_pdf(PROFILE_RESUME), "application/pdf")})
    body = suggest(signed_in, [{"id": "g", "label": "Gender", "type": "radio", "options": ["Option A", "Option B"]}])
    g = body["fields"][0]
    assert g["status"] == "needs_review" and g["value"] is None and "Pick one yourself" in g["reasoning"]


def test_saved_answers_fill_missing_details_for_review(signed_in):
    signed_in.post("/api/documents", files={"file": ("Resume.pdf", make_pdf(RESUME_LINES), "application/pdf")})
    signed_in.post("/api/answers", json={"question": "Expected salary", "answer": "12 LPA"})
    body = suggest(signed_in, [{"id": "s", "label": "Expected Salary (CTC)"}])
    s = body["fields"][0]
    assert s["value"] == "12 LPA" and s["status"] == "needs_review" and s["method"] == "saved_answer"


def test_conflicts_offer_alternatives(signed_in):
    from .conftest import CERTIFICATE_LINES

    signed_in.post("/api/documents", files={"file": ("Resume.pdf", make_pdf(RESUME_LINES), "application/pdf")})
    signed_in.post("/api/documents", files={"file": ("Degree.pdf", make_pdf(CERTIFICATE_LINES), "application/pdf")})
    dob = suggest(signed_in, [{"id": "d", "label": "Date of birth"}])["fields"][0]
    assert dob["status"] == "needs_review" and dob["value"] is None
    assert {a["value"] for a in dob["alternatives"]} == {"12 May 2002", "12 May 2003"}


def test_option_matching_units():
    from app.services.form_semantics import choose_option, iso_date, suggest_document

    assert choose_option("Male", ["Select", "Man", "Woman"]) == ("Man", 0.95)
    assert choose_option("Female", ["M", "F"]) == ("F", 0.95)
    assert choose_option("B.Tech in Computer Science", ["B.Sc", "B.Tech in Computer Science", "MBA"])[0] == "B.Tech in Computer Science"
    assert choose_option("India", ["Bharat", "Nepal"])[0] == "Bharat"
    assert choose_option("Male", ["Option A", "Option B"]) is None
    assert iso_date("12 May 2002") == "2002-05-12" and iso_date("sometime") is None
    assert suggest_document("Upload Degree Certificate", ["Resume.pdf", "Degree_Certificate.pdf"]) == "Degree_Certificate.pdf"
    assert suggest_document("Upload CV", ["Degree.pdf", "My_Resume.pdf"]) == "My_Resume.pdf"
