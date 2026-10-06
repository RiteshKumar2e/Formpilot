# FormPilot

**One profile. Every application.**

FormPilot turns your resume and certificates into a verified profile, answers application form fields from it, and shows which document every answer came from. When documents disagree, it asks you which value is right. It never submits a form for you.

```
frontend/   React + Vite + TypeScript + Tailwind CSS
backend/    Python FastAPI + SQLAlchemy (SQLite locally, PostgreSQL in production)
```

## Run locally

**Backend** (port 8000)

```bash
cd backend
python -m virtualenv .venv          # or: python -m venv .venv
.venv/Scripts/activate              # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

If port 8000 is already taken, Windows reports `WinError 10013`. Stop the other process or use `--port 8001` (and update the proxy target in `frontend/vite.config.ts`).

API docs: http://localhost:8000/api/docs (disabled in production).

**Frontend** (port 5173)

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to the backend.

## Tests

```bash
cd backend && .venv/Scripts/python -m pytest -q    # 21 tests
cd frontend && npm run build                       # type-checks and builds
```

## What's built

| Area | Today |
| --- | --- |
| Accounts | scrypt-hashed passwords, 12-hour httpOnly session cookie, account deletion |
| Documents | PDF/JPG/PNG up to 10 MB, type sniffed from bytes, encrypted at rest (Fernet) |
| Extraction | PDF text layer + rules: name, email, phone, date of birth, degree, institution, graduation year, experience, skills, LinkedIn, GitHub |
| OCR | Optional (`requirements-ocr.txt` + Tesseract). Without it, images are marked *needs attention* and nothing is extracted |
| Conflicts | Values that differ across documents are surfaced; your choice is saved |
| Field matching | Phrasing tables + token/trigram similarity (`services/mapping.py`) |
| Abuse protection | Per-IP rate limits on sign-up, sign-in, contact and uploads; honeypot fields on sign-up and contact |
| Transport | HTTPS redirect + HSTS in production (`ENFORCE_HTTPS`), security headers |

**Planned and not built:** model-assisted extraction, embeddings/vector retrieval, and filling forms directly on third-party sites. The site describes these as planned.

## Configuration

- `frontend/src/config/site.ts`: contact email, GitHub and LinkedIn.
- `frontend/.env`: `VITE_API_BASE_URL`, and optional Plausible analytics (`VITE_PLAUSIBLE_DOMAIN`). Analytics loads only after a visitor accepts it in the cookie banner.
- `backend/.env`: see `.env.example`. Production refuses to start without `SECRET_KEY`, `FILE_ENCRYPTION_KEY`, `COOKIE_SECURE=true` and HTTPS enforcement. Set `TRUST_PROXY_HEADERS=true` behind a reverse proxy.
- Hosting: `frontend/vercel.json` and `frontend/public/_redirects` + `_headers` (Netlify) provide SPA routing, HSTS and caching.
- Replace `https://formpilot.app` in `index.html`, `robots.txt`, `sitemap.xml` and `usePageMeta.ts` with your domain.

## Before launch

- The Privacy Policy and Terms of Service are **drafts**. Highlighted placeholders need the operator's legal name, address, hosting region, retention periods and governing law, followed by legal review.
- The screenshots in `public/screens/` are real captures of the app with fictional sample data. Retake them if the UI changes.

## Design

Warm paper background (`#f6f5f1`), near-black ink, one cobalt accent (`#2b45b8`). Green, amber and red are used only for status. Instrument Sans (SIL OFL, self-hosted in `public/fonts/`) plus the system monospace for data. Tokens live in `frontend/src/index.css`.
