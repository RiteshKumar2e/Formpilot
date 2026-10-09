"""LLM extraction, RAG mapping, vector search, workflows, integrations, OAuth and encryption at rest.

LLM calls are replaced with fakes, so these tests check FormPilot's own logic (grounding, validation,
fallbacks) without network access.
"""

from urllib.parse import parse_qs, urlsplit

import pytest
from sqlalchemy import text

from app.config import get_settings
from app.database import SessionLocal
from app.services import llm
from app.services.extraction import Extracted, grounded, merge_extractions

from .conftest import RESUME_LINES, make_pdf


def upload(client, name: str, lines: list[str]):
    return client.post("/api/documents", files={"file": (name, make_pdf(lines), "application/pdf")})


@pytest.fixture()
def fake_llm(monkeypatch):
    """Turns the LLM on and answers with canned JSON per schema name."""
    answers: dict[str, dict] = {}
    monkeypatch.setattr(get_settings(), "llm_enabled", True)
    monkeypatch.setattr(llm, "_complete", lambda system, content, name, schema: answers.get(name))
    return answers


# --- Encryption at rest ---------------------------------------------------------------------


def test_extracted_values_and_passages_are_encrypted_at_rest(signed_in):
    from app.services import vectorstore

    doc = upload(signed_in, "Resume.pdf", RESUME_LINES).json()
    with SessionLocal() as db:
        values = [r[0] for r in db.execute(text("SELECT value FROM extracted_fields"))]
    points, _ = vectorstore.client().scroll(
        vectorstore._collection(), scroll_filter=vectorstore.models.Filter(must=[vectorstore._match("document_id", doc["id"])]), with_payload=True
    )
    passages = [p.payload["text"] for p in points]
    assert values and passages
    assert not any("ritesh@example.com" in v for v in values)
    assert not any("Ritesh" in p for p in passages)
    # Through the API they read normally.
    assert signed_in.get("/api/profile").json()["fields"][0]["value"]


# --- Vector index and retrieval --------------------------------------------------------------


def test_documents_are_indexed_and_searchable(signed_in):
    from app.models import User
    from app.services.vectorstore import chunk_text, search

    upload(signed_in, "Resume.pdf", RESUME_LINES)
    me = signed_in.get("/api/auth/me").json()
    with SessionLocal() as db:
        results = search(db, db.get(User, me["id"]).id, ["Skills: Python, React"], k=2)
    assert results[0], "expected at least one passage"
    assert "Python" in results[0][0].text
    assert results[0][0].source_filename == "Resume.pdf"

    long = "\n".join(f"Line number {i} with some words" for i in range(100))
    chunks = chunk_text(long, max_chars=200)
    assert len(chunks) > 5 and all(len(c) <= 260 for c in chunks)


def test_search_is_scoped_to_the_user(client, signed_in):
    from app.services.vectorstore import search

    upload(signed_in, "Resume.pdf", RESUME_LINES)
    signed_in.cookies.clear()
    client.post("/api/auth/signup", json={"full_name": "Someone Else", "email": "else@example.com", "password": "longpassword1"})
    other = client.get("/api/auth/me").json()
    with SessionLocal() as db:
        assert search(db, other["id"], ["Python"], k=3) == [[]]


def test_deleting_a_document_removes_its_vectors(signed_in):
    from app.services.vectorstore import search

    doc = upload(signed_in, "Resume.pdf", RESUME_LINES).json()
    me = signed_in.get("/api/auth/me").json()
    with SessionLocal() as db:
        assert search(db, me["id"], ["Python skills"], k=3)[0]
    assert signed_in.delete(f"/api/documents/{doc['id']}").status_code == 204
    with SessionLocal() as db:
        assert search(db, me["id"], ["Python skills"], k=3) == [[]]


def test_passages_move_from_the_old_database_table(signed_in):
    """Earlier versions kept vectors in a `document_chunks` table; they move to Qdrant once."""
    import numpy as np

    from app.database import engine
    from app.security import file_cipher
    from app.services import vectorstore
    from app.services.embeddings import get_embedder

    doc = upload(signed_in, "Resume.pdf", RESUME_LINES).json()
    vectorstore.delete_document(doc["id"])
    me = signed_in.get("/api/auth/me").json()
    passage = "Skills: Python, React, FastAPI, Machine Learning"
    vector = get_embedder().embed([passage])[0].astype("<f4").tobytes()
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS document_chunks (id INTEGER PRIMARY KEY, document_id TEXT, user_id TEXT, "
                "position INTEGER, text TEXT, embedder TEXT, embedding BLOB)"
            )
        )
        conn.execute(
            text("INSERT INTO document_chunks (document_id, user_id, position, text, embedder, embedding) VALUES (:d, :u, 0, :t, :e, :v)"),
            {"d": doc["id"], "u": me["id"], "t": file_cipher().encrypt(passage.encode()).decode(), "e": get_embedder().name, "v": vector},
        )
    assert vectorstore.migrate_from_database(engine) == 1
    with SessionLocal() as db:
        hits = vectorstore.search(db, me["id"], ["Python"], k=1)[0]
    assert hits and hits[0].text == passage and hits[0].source_filename == "Resume.pdf"
    with engine.begin() as conn:
        assert conn.execute(text("SELECT COUNT(*) FROM document_chunks")).scalar() == 0
    assert np.isfinite(hits[0].score)


# --- Workflow engine -------------------------------------------------------------------------


def test_ingestion_workflow_is_recorded(signed_in):
    doc = upload(signed_in, "Resume.pdf", RESUME_LINES).json()
    runs = signed_in.get("/api/workflows", params={"subject_id": doc["id"]}).json()
    assert len(runs) == 1 and runs[0]["workflow"] == "document_ingestion"
    steps = {s["name"]: s for s in runs[0]["steps"]}
    assert list(steps) == ["read_text", "rule_extraction", "llm_extraction", "validation", "vector_indexing"]
    assert steps["llm_extraction"]["status"] == "skipped"
    assert steps["vector_indexing"]["status"] == "completed"
    assert runs[0]["status"] == "completed"


def test_unreadable_document_workflow_skips_later_steps(signed_in):
    res = signed_in.post("/api/documents", files={"file": ("broken.pdf", b"%PDF-1.4\n garbage", "application/pdf")})
    run = signed_in.get("/api/workflows", params={"subject_id": res.json()["id"]}).json()[0]
    assert run["status"] == "failed"
    assert [s["status"] for s in run["steps"]] == ["failed", "skipped", "skipped", "skipped", "skipped"]


# --- LLM extraction --------------------------------------------------------------------------


def test_grounding():
    text_ = "Ritesh Kumar\nB.Tech in Computer Science"
    assert grounded("Ritesh Kumar", text_)
    assert grounded("B.Tech in Computer Science", text_)
    assert not grounded("Stanford University", text_)


def test_merge_prefers_agreement_and_rejects_hallucinations():
    text_ = "Ritesh Kumar\nritesh@example.com\nWorked as Data Analyst at Acme Corp"
    rules = [Extracted("full_name", "Ritesh Kumar", 0.85), Extracted("email", "ritesh@example.com", 0.99)]
    model = [
        Extracted("full_name", "Ritesh Kumar", 0.9),
        Extracted("email", "someone@else.com", 0.9),  # rules are authoritative for email
        Extracted("experience", "Data Analyst at Acme Corp", 0.9),  # found only by the model
        Extracted("institution", "Stanford University", 0.95),  # not in the document
    ]
    merged = {f.key: f for f in merge_extractions(rules, model, text_)}
    assert merged["full_name"].confidence == 0.95
    assert merged["email"].value == "ritesh@example.com"
    assert merged["experience"].value == "Data Analyst at Acme Corp"
    assert "institution" not in merged


def test_llm_extraction_in_the_upload_workflow(signed_in, fake_llm):
    lines = ["Asha Rao", "asha@example.com", "Currently: Data Analyst at Acme Corp"]
    fake_llm["profile_extraction"] = {
        "fields": [
            {"key": "experience", "value": "Data Analyst at Acme Corp", "confidence": 0.9, "evidence": lines[2]},
            {"key": "institution", "value": "Harvard University", "confidence": 0.9, "evidence": "made up"},
        ]
    }
    doc = upload(signed_in, "Resume.pdf", lines).json()
    values = {f["key"]: f["value"] for f in doc["extracted"]}
    assert values["experience"] == "Data Analyst at Acme Corp"
    assert "institution" not in values
    run = signed_in.get("/api/workflows", params={"subject_id": doc["id"]}).json()[0]
    llm_step = next(s for s in run["steps"] if s["name"] == "llm_extraction")
    assert llm_step["status"] == "completed"


def test_llm_outage_falls_back_to_rules(signed_in, fake_llm):
    # No canned answer: the fake returns None, as the real client does on errors.
    doc = upload(signed_in, "Resume.pdf", RESUME_LINES).json()
    assert {f["key"]: f["value"] for f in doc["extracted"]}["full_name"] == "Ritesh Kumar"
    run = signed_in.get("/api/workflows", params={"subject_id": doc["id"]}).json()[0]
    assert next(s for s in run["steps"] if s["name"] == "llm_extraction")["status"] == "failed"


# --- RAG mapping -----------------------------------------------------------------------------


def test_mapping_without_llm_returns_evidence_and_workflow(signed_in):
    upload(signed_in, "Resume.pdf", RESUME_LINES)
    res = signed_in.post("/api/mapping", json={"fields": ["Name of applicant", "Key skills"]}).json()
    by_label = {m["form_label"]: m for m in res["matches"]}
    assert by_label["Name of applicant"]["method"] == "lexical"
    assert by_label["Key skills"]["evidence"]
    run = next(r for r in signed_in.get("/api/workflows").json() if r["id"] == res["workflow_id"])
    assert [s["name"] for s in run["steps"]] == ["retrieve", "classify", "generate", "validate"]


def test_rag_mapping_accepts_grounded_values_only(signed_in, fake_llm):
    lines = RESUME_LINES + ["Address: 221B Baker Street, Pune 411001"]
    upload(signed_in, "Resume.pdf", lines)
    labels = ["Current Address", "Name of applicant", "Passport number", "Team name"]
    fake_llm["form_mapping"] = {
        "matches": [
            {"form_label": labels[0], "key": "address", "value": "221B Baker Street, Pune 411001",
             "source_filename": "Resume.pdf", "confidence": 0.9, "reasoning": "The resume lists this address."},
            {"form_label": labels[1], "key": "full_name", "value": "Ritesh Kumar",
             "source_filename": "Resume.pdf", "confidence": 0.95, "reasoning": "The applicant's name."},
            {"form_label": labels[2], "key": "none", "value": "K1234567",
             "source_filename": "Resume.pdf", "confidence": 0.9, "reasoning": "Invented."},
            {"form_label": labels[3], "key": "none", "value": "", "source_filename": "", "confidence": 0.0,
             "reasoning": "A team name isn't a personal detail."},
        ]
    }
    matches = {m["form_label"]: m for m in signed_in.post("/api/mapping", json={"fields": labels}).json()["matches"]}

    address = matches["Current Address"]
    assert address["value"] == "221B Baker Street, Pune 411001"
    assert address["method"] == "llm_rag" and address["source_filename"] == "Resume.pdf"
    assert address["confidence"] < 0.8  # values read from passages always go to the user for review

    assert matches["Name of applicant"]["value"] == "Ritesh Kumar"
    assert matches["Passport number"]["value"] is None  # not in any document: rejected
    assert matches["Team name"]["value"] is None


def test_rag_mapping_never_fills_a_conflict(signed_in, fake_llm):
    from .conftest import CERTIFICATE_LINES

    upload(signed_in, "Resume.pdf", RESUME_LINES)
    upload(signed_in, "Degree_Certificate.pdf", CERTIFICATE_LINES)
    fake_llm["form_mapping"] = {
        "matches": [{"form_label": "Date of birth", "key": "date_of_birth", "value": "12 May 2002",
                     "source_filename": "Resume.pdf", "confidence": 0.9, "reasoning": "From the resume."}]
    }
    match = signed_in.post("/api/mapping", json={"fields": ["Date of birth"]}).json()["matches"][0]
    assert match["value"] is None and match["needs_review"] is True


def test_semantic_matcher_is_off_with_hash_embeddings():
    from app.services.mapping import classify_hybrid, semantic_classify

    assert semantic_classify("Technical proficiencies") == (None, 0.0)
    assert classify_hybrid("Full legal name")[2] == "lexical"


# --- Applications, autofill API and webhooks -------------------------------------------------


def _application(app_id: str, status: str = "ready") -> dict:
    return {
        "id": app_id,
        "title": "ML Engineer",
        "organization": "Acme",
        "status": status,
        "reference": "FP-2026-00001" if status == "prepared" else None,
        "fields": [
            {"id": "f1", "label": "Full name", "value": "Ritesh Kumar", "section": "Personal Information"},
            {"id": "f2", "label": "Notice period", "value": "", "section": "Additional Information"},
        ],
    }


def test_applications_are_stored_per_user(client, signed_in):
    assert signed_in.put("/api/applications/app-1", json=_application("app-1")).status_code == 200
    assert signed_in.put("/api/applications/app-2", json=_application("app-1")).status_code == 400
    assert [a["id"] for a in signed_in.get("/api/applications").json()] == ["app-1"]

    autofill = signed_in.get("/api/applications/app-1/autofill").json()
    assert autofill["fields"] == [{"label": "Full name", "value": "Ritesh Kumar", "section": "Personal Information"}]

    with SessionLocal() as db:
        raw = db.execute(text("SELECT data FROM applications")).scalar()
    assert "Ritesh" not in raw

    signed_in.cookies.clear()
    client.post("/api/auth/signup", json={"full_name": "Other", "email": "other2@example.com", "password": "longpassword1"})
    assert client.get("/api/applications").json() == []
    assert client.get("/api/applications/app-1/autofill").status_code == 404
    assert client.delete("/api/applications/app-1").status_code == 404


def test_webhooks_fire_on_approval_with_a_signature(signed_in, monkeypatch):
    import hashlib
    import hmac

    from app.services import integrations

    sent = []

    class FakeResponse:
        status_code = 200

    def fake_post(url, content, headers, **kwargs):
        sent.append((url, content, headers))
        return FakeResponse()

    monkeypatch.setattr(integrations.httpx, "post", fake_post)

    hook = signed_in.post(
        "/api/integrations/webhooks", json={"url": "https://hooks.example.com/formpilot", "events": ["application.approved"]}
    ).json()
    assert hook["secret"].startswith("whsec_")
    assert signed_in.get("/api/integrations/webhooks").json()[0]["secret"] is None  # only shown once

    signed_in.put("/api/applications/app-9", json=_application("app-9", "ready"))
    assert sent == []  # created, but not subscribed to application.created
    signed_in.put("/api/applications/app-9", json=_application("app-9", "prepared"))
    assert len(sent) == 1
    url, body, headers = sent[0]
    assert headers["X-FormPilot-Event"] == "application.approved"
    expected = "sha256=" + hmac.new(hook["secret"].encode(), body, hashlib.sha256).hexdigest()
    assert headers["X-FormPilot-Signature"] == expected

    # Saving again while already approved doesn't fire twice.
    signed_in.put("/api/applications/app-9", json=_application("app-9", "prepared"))
    assert len(sent) == 1
    deliveries = signed_in.get("/api/integrations/webhooks").json()[0]["recent_deliveries"]
    assert deliveries[0]["ok"] is True and deliveries[0]["status_code"] == 200


def test_webhook_urls_are_restricted_in_production(signed_in, monkeypatch):
    monkeypatch.setattr(get_settings(), "environment", "production")
    for url in ("http://hooks.example.com/x", "https://127.0.0.1/x", "https://localhost/x"):
        res = signed_in.post("/api/integrations/webhooks", json={"url": url, "events": ["document.processed"]})
        assert res.status_code == 400, url


# --- Google OAuth ----------------------------------------------------------------------------


@pytest.fixture()
def google(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "google_client_id", "client-123")
    monkeypatch.setattr(settings, "google_client_secret", "secret-456")
    return settings


def test_google_disabled_without_credentials(client):
    assert client.get("/api/auth/providers").json() == {"google": False}
    assert client.get("/api/auth/oauth/google/start", follow_redirects=False).status_code == 404


def _start(client) -> str:
    res = client.get("/api/auth/oauth/google/start", follow_redirects=False)
    assert res.status_code == 303
    query = parse_qs(urlsplit(res.headers["location"]).query)
    assert query["client_id"] == ["client-123"] and query["code_challenge_method"] == ["S256"]
    assert query["redirect_uri"] == ["http://localhost:5173/api/auth/oauth/google/callback"]
    return query["state"][0]


def test_google_sign_in_creates_a_session(client, google, monkeypatch):
    from app.routers import auth

    class Res:
        def __init__(self, data):
            self._data = data

        def raise_for_status(self):
            return None

        def json(self):
            return self._data

    monkeypatch.setattr(auth.httpx, "post", lambda *a, **k: Res({"access_token": "at"}))
    monkeypatch.setattr(
        auth.httpx, "get",
        lambda *a, **k: Res({"sub": "g-1", "email": "Priya@Example.com", "email_verified": True, "name": "Priya Shah"}),
    )
    client.cookies.clear()
    assert client.get("/api/auth/providers").json() == {"google": True}
    state = _start(client)
    res = client.get("/api/auth/oauth/google/callback", params={"code": "c", "state": state}, follow_redirects=False)
    assert res.status_code == 303 and res.headers["location"].endswith("/dashboard")
    me = client.get("/api/auth/me").json()
    assert me["email"] == "priya@example.com" and me["full_name"] == "Priya Shah"
    # OAuth-only accounts can't be signed into with an empty password.
    assert client.post("/api/auth/signin", json={"email": "priya@example.com", "password": "x"}).status_code == 401


def test_google_callback_rejects_bad_state_and_unverified_email(client, google, monkeypatch):
    from app.routers import auth

    client.cookies.clear()
    _start(client)
    res = client.get("/api/auth/oauth/google/callback", params={"code": "c", "state": "forged"}, follow_redirects=False)
    assert res.headers["location"].endswith("/login?error=oauth")

    class Res:
        def __init__(self, data):
            self._data = data

        def raise_for_status(self):
            return None

        def json(self):
            return self._data

    monkeypatch.setattr(auth.httpx, "post", lambda *a, **k: Res({"access_token": "at"}))
    monkeypatch.setattr(auth.httpx, "get", lambda *a, **k: Res({"sub": "g-2", "email": "x@example.com", "email_verified": False}))
    state = _start(client)
    res = client.get("/api/auth/oauth/google/callback", params={"code": "c", "state": state}, follow_redirects=False)
    assert res.headers["location"].endswith("/login?error=oauth")
    assert client.get("/api/auth/me").status_code == 401


# --- Capabilities ----------------------------------------------------------------------------


def test_capabilities(signed_in):
    caps = signed_in.get("/api/system/capabilities").json()
    assert caps["llm"] == {"enabled": False, "provider": "Groq", "model": "openai/gpt-oss-120b"}
    assert caps["database"] == "SQLite (local file)"
    assert caps["vector_store"] == "Qdrant (in-memory)"
    assert caps["embeddings"]["semantic"] is False
