import os
import sys
import tempfile
from pathlib import Path

import pytest

# Configure an isolated database and storage directory before the app is imported.
_TMP = Path(tempfile.mkdtemp(prefix="formpilot-test-"))
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP / 'test.db'}"
# Tests run offline: no LLM calls, and the dependency-free embedder.
os.environ["GROQ_API_KEY"] = ""
os.environ["LLM_ENABLED"] = "false"
os.environ["EMBEDDING_PROVIDER"] = "hash"
os.environ["GOOGLE_CLIENT_ID"] = ""
os.environ["GOOGLE_CLIENT_SECRET"] = ""
os.environ["SMTP_HOST"] = ""
os.environ["ADMIN_EMAILS"] = ""
os.environ["ADMIN_PASSWORD"] = ""
os.environ["QDRANT_URL"] = ""
os.environ["QDRANT_PATH"] = ":memory:"  # never send real email from tests
os.environ["STORAGE_DIR"] = str(_TMP / "storage")
os.environ["ENVIRONMENT"] = "development"
os.environ["RATE_LIMIT_ENABLED"] = "false"  # enabled explicitly in the rate-limit test
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def make_pdf(lines: list[str]) -> bytes:
    """Builds a minimal one-page PDF with a real text layer."""

    def esc(s: str) -> str:
        return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    content = "BT /F1 11 Tf 50 750 Td 14 TL\n" + "".join(f"({esc(l)}) Tj T*\n" for l in lines) + "ET"
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        f"<< /Length {len(content)} >>\nstream\n{content}\nendstream",
    ]
    out = b"%PDF-1.4\n"
    offsets = []
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n{obj}\nendobj\n".encode("latin-1")
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    out += "".join(f"{o:010d} 00000 n \n" for o in offsets).encode()
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    return out


RESUME_LINES = [
    "Ritesh Kumar",
    "Email: ritesh@example.com | Phone: +91 98765 43210",
    "Date of Birth: 12 May 2002",
    "linkedin.com/in/riteshkumar",
    "Education",
    "B.Tech in Computer Science, Northfield Institute of Technology",
    "Year of passing: 2024",
    "Experience",
    "Research Intern - Machine Vision & Intelligence Lab   May 2024 - Jul 2024",
    "Skills: Python, React, FastAPI, Machine Learning",
]

CERTIFICATE_LINES = [
    "Northfield Institute of Technology",
    "This is to certify that RITESH KUMAR has been awarded the degree of",
    "Bachelor of Technology in Computer Science",
    "Date of Birth: 12/05/2003",
]


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def signed_in(client):
    import uuid

    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    res = client.post("/api/auth/signup", json={"full_name": "Ritesh Kumar", "email": email, "password": "correcthorse42"})
    assert res.status_code == 201, res.text
    return client
