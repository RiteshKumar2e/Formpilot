"""Master Profile metadata, Common Answers, Smart Answers, templates and the browser-extension autofill API."""

import pytest
from sqlalchemy import create_engine, inspect, text

from app.config import get_settings
from app.services import llm
from app.services.answers import is_open_question

from .conftest import CERTIFICATE_LINES, RESUME_LINES, make_pdf

MASTER_RESUME = RESUME_LINES + [
    "Address: 221B Baker Street, Pune 411001",
    "Projects",
    "* FormPilot - reusable application profile",
    "* Plant disease detector using CNNs",
    "Achievements",
    "- Winner, Smart India Hackathon 2023",
    "Certifications: AWS Cloud Practitioner, Google Data Analytics",
]

CAREERHUB_FIELDS = [
    {"id": "name", "label": "Full Name", "type": "text", "required": True},
    {"id": "email", "label": "Email", "type": "email", "required": True},
    {"id": "phone", "label": "Phone", "type": "tel"},
    {"id": "dob", "label": "Date of Birth", "type": "date"},
    {"id": "uni", "label": "University", "type": "text"},
    {"id": "degree", "label": "Degree", "type": "text"},
    {"id": "year", "label": "Graduation Year", "type": "text"},
    {"id": "skills", "label": "Skills", "type": "text"},
    {"id": "exp", "label": "Experience", "type": "text"},
    {"id": "linkedin", "label": "LinkedIn Profile", "type": "url"},
    {"id": "resume", "label": "Resume Upload", "type": "file"},
    {"id": "why", "label": "Why do you want to join us?", "type": "textarea"},
]


def upload(client, name: str, lines: list[str]):
    res = client.post("/api/documents", files={"file": (name, make_pdf(lines), "application/pdf")})
    assert res.status_code == 201, res.text
    return res.json()


@pytest.fixture()
def fake_llm(monkeypatch):
    answers: dict[str, dict] = {}
    monkeypatch.setattr(get_settings(), "llm_enabled", True)
    monkeypatch.setattr(llm, "_complete", lambda system, content, name, schema: answers.get(name))
    return answers


# --- Master Profile ----------------------------------------------------------------------------


def test_master_profile_sections_and_metadata(signed_in):
    upload(signed_in, "Resume.pdf", MASTER_RESUME)
    fields = {f["key"]: f for f in signed_in.get("/api/profile").json()["fields"]}
    assert fields["address"]["value"] == "221B Baker Street, Pune 411001"
    assert fields["projects"]["value"] == "FormPilot - reusable application profile; Plant disease detector using CNNs"
    assert fields["achievements"]["value"] == "Winner, Smart India Hackathon 2023"
    assert fields["certifications"]["value"] == "AWS Cloud Practitioner; Google Data Analytics"

    email = fields["email"]
    assert email["sources"] == ["Resume.pdf"]
    assert email["verification"] == "high_confidence" and email["verified"] is True
    assert email["updated_at"]
    assert fields["projects"]["verification"] == "unverified"


def test_values_found_in_two_documents_are_verified(signed_in):
    upload(signed_in, "Resume.pdf", RESUME_LINES)
    upload(signed_in, "Degree_Certificate.pdf", CERTIFICATE_LINES)
    name = next(f for f in signed_in.get("/api/profile").json()["fields"] if f["key"] == "full_name")
    assert name["verification"] == "multiple_documents"
    assert name["sources"] == ["Resume.pdf", "Degree_Certificate.pdf"]


def test_user_can_add_and_edit_any_profile_detail(signed_in):
    upload(signed_in, "Resume.pdf", RESUME_LINES)
    # A detail no document contains is kept, and marked as confirmed by the user.
    profile = signed_in.post("/api/profile/conflicts/resolve", json={"key": "address", "value": "12 MG Road, Ranchi"}).json()
    address = next(f for f in profile["fields"] if f["key"] == "address")
    assert address["value"] == "12 MG Road, Ranchi" and address["verification"] == "confirmed_by_you"
    # List fields can be edited too.
    profile = signed_in.post("/api/profile/conflicts/resolve", json={"key": "skills", "value": "Python, Go"}).json()
    assert next(f for f in profile["fields"] if f["key"] == "skills")["value"] == "Python, Go"
    assert signed_in.post("/api/profile/conflicts/resolve", json={"key": "favourite_colour", "value": "x"}).status_code == 400


def test_migration_adds_missing_columns(tmp_path):
    from app import migrations

    engine = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE profile_choices (id INTEGER PRIMARY KEY, user_id TEXT, key TEXT, value TEXT)"))
    migrations.upgrade(engine)
    migrations.upgrade(engine)  # idempotent
    assert "updated_at" in {c["name"] for c in inspect(engine).get_columns("profile_choices")}


# --- Common Answers and Smart Answers ------------------------------------------------------------


def test_common_answers_crud_and_isolation(client, signed_in):
    created = signed_in.post("/api/answers", json={"question": "Work authorization", "answer": "Indian citizen."}).json()
    updated = signed_in.put(f"/api/answers/{created['id']}", json={"question": "Work authorization", "answer": "Indian citizen; no sponsorship needed."})
    assert updated.json()["answer"].endswith("sponsorship needed.")
    assert len(signed_in.get("/api/answers").json()) == 1

    signed_in.cookies.clear()
    client.post("/api/auth/signup", json={"full_name": "Other", "email": "other-vault@example.com", "password": "longpassword1"})
    assert client.get("/api/answers").json() == []
    assert client.delete(f"/api/answers/{created['id']}").status_code == 404


def test_open_question_detection():
    assert is_open_question("Why do you want to join us?")
    assert is_open_question("Describe a project you are proud of")
    assert is_open_question("Anything else?", "textarea")
    assert not is_open_question("Full Name")
    assert not is_open_question("Skills", "textarea")


def test_smart_answer_without_llm_uses_saved_answer_or_profile(signed_in):
    upload(signed_in, "Resume.pdf", MASTER_RESUME)
    draft = signed_in.post("/api/answers/suggest", json={"question": "Why do you want to join us?", "organization": "CareerHub"}).json()
    assert draft["method"] == "profile_draft" and draft["is_suggestion"] is True
    assert "Research Intern - Machine Vision & Intelligence Lab" in draft["answer"]
    assert {s["label"] for s in draft["sources"]} >= {"Professional experience", "Skills"}

    signed_in.post("/api/answers", json={"question": "Why do you want to join our company?", "answer": "Because of your open-source work."})
    saved = signed_in.post("/api/answers/suggest", json={"question": "Why do you want to join us?"}).json()
    assert saved["method"] == "saved_answer" and saved["answer"] == "Because of your open-source work."


def test_smart_answer_with_llm_cites_only_real_sources(signed_in, fake_llm):
    upload(signed_in, "Resume.pdf", MASTER_RESUME)
    fake_llm["smart_answer"] = {
        "answer": "I want to join because my research internship in machine vision prepared me for this role.",
        "sources_used": ["profile:experience", "document:0", "made-up-id"],
    }
    res = signed_in.post("/api/answers/suggest", json={"question": "Why are you interested in this role?"}).json()
    assert res["method"] == "llm_rag"
    assert [s["type"] for s in res["sources"]] == ["profile", "document"]


# --- Templates -----------------------------------------------------------------------------------


TEMPLATE = {
    "name": "Software Engineer Application",
    "application_type": "job",
    "organization": "Acme",
    "documents": ["Resume.pdf", "Degree.pdf"],
    "fields": [
        {"label": "Full Name", "value": "Ritesh Kumar", "profileKey": "full_name"},
        {"label": "Email", "value": "ritesh@example.com", "profileKey": "email"},
        {"label": "Skills", "value": "Python", "profileKey": "skills"},
        {"label": "Why this company?", "value": "Your engineering culture.", "profileKey": None},
        {"label": "Work authorization", "value": "Indian citizen", "profileKey": None},
        {"label": "Relocation preference", "value": "Open to Bengaluru", "profileKey": None},
    ],
}


def test_templates_save_match_and_use(signed_in):
    created = signed_in.post("/api/templates", json=TEMPLATE).json()
    assert created["completed"] == 6 and created["total"] == 6
    assert [a["label"] for a in created["common_answers"]] == ["Why this company?", "Work authorization", "Relocation preference"]

    similar = ["Name of applicant", "Contact email", "Key skills", "Work authorization", "Relocation preference", "Why this company?"]
    match = signed_in.post("/api/templates/match", json={"labels": similar}).json()
    assert match["id"] == created["id"] and match["score"] >= 0.5 and match["reusable"] == 3

    unrelated = ["Blood group", "Annual family income", "Bank account number"]
    assert signed_in.post("/api/templates/match", json={"labels": unrelated}).json() is None

    assert signed_in.post(f"/api/templates/{created['id']}/use").json()["use_count"] == 1
    assert signed_in.delete(f"/api/templates/{created['id']}").status_code == 204
    assert signed_in.get("/api/templates").json() == []


# --- Browser extension autofill ------------------------------------------------------------------


def test_autofill_for_an_external_form(signed_in):
    upload(signed_in, "Resume.pdf", MASTER_RESUME)
    res = signed_in.post(
        "/api/autofill/suggest",
        json={"fields": CAREERHUB_FIELDS, "page_title": "CareerHub - ML Engineer", "organization": "CareerHub", "role": "ML Engineer"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    by_id = {f["id"]: f for f in body["fields"]}

    # The name comes from the resume's first line only (confidence 0.75), so the user confirms it.
    assert by_id["name"]["value"] == "Ritesh Kumar" and by_id["name"]["status"] == "needs_review"
    assert by_id["email"]["status"] == "ready" and by_id["email"]["verified"] is True
    assert by_id["resume"]["kind"] == "document" and by_id["resume"]["value"] == "Resume.pdf" and by_id["resume"]["document_id"]
    why = by_id["why"]
    assert why["kind"] == "answer" and why["status"] == "needs_review" and why["value"]  # suggested, never auto-used

    summary = body["summary"]
    assert summary["detected"] == 12
    assert summary["ready"] + summary["needs_review"] + summary["missing"] == 12
    print(summary, {f["id"]: f["status"] for f in body["fields"]})
    assert summary["ready"] >= 8
    run = next(r for r in signed_in.get("/api/workflows").json() if r["id"] == body["workflow_id"])
    assert [s["name"] for s in run["steps"]] == ["detect", "map_details", "smart_answers", "documents", "template"]


def test_autofill_reuses_template_answers_for_review(signed_in):
    upload(signed_in, "Resume.pdf", RESUME_LINES)
    signed_in.post("/api/templates", json=TEMPLATE)
    fields = [
        {"id": "a", "label": "Full Name"},
        {"id": "b", "label": "Email"},
        {"id": "c", "label": "Skills"},
        {"id": "d", "label": "Work authorization"},
        {"id": "e", "label": "Relocation preference"},
    ]
    body = signed_in.post("/api/autofill/suggest", json={"fields": fields}).json()
    assert body["template"]["name"] == "Software Engineer Application"
    work = next(f for f in body["fields"] if f["id"] == "d")
    assert work["value"] == "Indian citizen" and work["status"] == "needs_review" and work["method"] == "template"


def test_document_download_is_owner_only(client, signed_in):
    original = make_pdf(RESUME_LINES)
    doc = signed_in.post("/api/documents", files={"file": ("Resume.pdf", original, "application/pdf")}).json()
    res = signed_in.get(f"/api/documents/{doc['id']}/file")
    assert res.status_code == 200 and res.content == original
    assert res.headers["content-type"] == "application/pdf"

    signed_in.cookies.clear()
    client.post("/api/auth/signup", json={"full_name": "Other", "email": "other-dl@example.com", "password": "longpassword1"})
    assert client.get(f"/api/documents/{doc['id']}/file").status_code == 404
