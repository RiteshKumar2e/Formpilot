# Deploying FormPilot

FormPilot has four parts to deploy:

| Part | What it is | Where it runs |
| --- | --- | --- |
| Database | Turso (libSQL) with vector search | Turso cloud |
| Backend | FastAPI (`backend/`) | Any Python host with a persistent disk: Render, Railway, Fly.io, or a VM |
| Frontend | React static site (`frontend/`) | Vercel or Netlify |
| Extension | Chrome/Edge extension (`extension/`) | Users' browsers (load unpacked, or the Chrome Web Store) |

```
Browser ──► https://your-app.com            (static frontend on Vercel/Netlify)
              │  /api/*  rewritten to ──►  https://your-api.onrender.com/api/*   (FastAPI)
              │                                     │
Extension ────┘                                     ├──► Turso (data + vectors)
                                                    ├──► Groq (LLM)
                                                    ├──► Gmail SMTP (reset emails)
                                                    └──► persistent disk (encrypted uploads)
```

**Serve the API under the app's own address.** The session cookie is `httpOnly` and `SameSite=Lax`. Browsers don't send it on `fetch` calls to a different site, so a frontend on `vercel.app` calling an API on `onrender.com` directly would appear logged out. Proxy `/api/*` through the frontend host (step 4) and leave `VITE_API_BASE_URL` empty.

---

## 1. Database: Turso

```bash
# Install the CLI: https://docs.turso.tech/cli/installation
turso auth login
turso db create formpilot
turso db show formpilot --url        # → TURSO_DATABASE_URL  (libsql://formpilot-<org>.turso.io)
turso db tokens create formpilot     # → TURSO_AUTH_TOKEN
```

Tables are created on the backend's first start, and new columns are added by `app/migrations.py`. No manual migration is needed.

## 2. Secrets

Generate these once and keep them in your host's secret settings, never in git:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"                               # SECRET_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" # FILE_ENCRYPTION_KEY
```

> **Keep `FILE_ENCRYPTION_KEY` safe and don't change it.** It encrypts uploaded files and the personal data stored in the database (extracted values, applications, templates, saved answers). If it is lost or changed, that data can't be read again.

Also get:
- **Groq:** an API key from https://console.groq.com/keys (optional; without it FormPilot uses rules and embeddings only).
- **Gmail SMTP** for password reset emails: turn on 2-Step Verification, then create an App password at https://myaccount.google.com/apppasswords.

## 3. Backend (Render example)

Railway and Fly.io work the same way: a Python web service plus a persistent volume.

1. **New → Web Service**, connect the repository.
2. Settings:

   | Setting | Value |
   | --- | --- |
   | Root directory | `backend` |
   | Runtime | Python 3.10+ (tested on 3.10.11) |
   | Build command | `pip install -r requirements.txt` |
   | Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"` |
   | Instances | 1 (rate limits are kept in memory) |
   | Instance size | 1 GB RAM or more (the embedding model needs about 300–500 MB) |

3. **Add a persistent disk** mounted at `/var/data` (1 GB is plenty to start). Uploaded files are stored there, encrypted. Without a disk they disappear on every redeploy, while their database rows remain.
4. **Environment variables:**

   ```env
   ENVIRONMENT=production
   SECRET_KEY=<generated>
   FILE_ENCRYPTION_KEY=<generated>

   TURSO_DATABASE_URL=libsql://formpilot-<org>.turso.io
   TURSO_AUTH_TOKEN=<token>

   STORAGE_DIR=/var/data/storage
   FASTEMBED_CACHE_PATH=/var/data/fastembed      # embedding model is downloaded once (~70 MB) and kept

   GROQ_API_KEY=<key>
   LLM_MODEL=openai/gpt-oss-120b
   EMBEDDING_PROVIDER=fastembed                  # "hash" if the instance has < 1 GB RAM (no semantic matching)

   APP_URL=https://your-app.com                  # the frontend's public address
   CORS_ORIGINS=https://your-app.com
   COOKIE_SECURE=true
   TRUST_PROXY_HEADERS=true

   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=you@gmail.com
   SMTP_PASSWORD=<16-letter app password>
   SMTP_FROM=FormPilot <you@gmail.com>

   REMEMBER_DAYS=30
   RESET_TOKEN_MINUTES=30
   RATE_LIMIT_ENABLED=true
   ```

   In production the API refuses to start without `SECRET_KEY`, `FILE_ENCRYPTION_KEY` and `COOKIE_SECURE=true`. HTTPS redirects and HSTS are switched on automatically.

5. Optional, for scanned PDFs and photos: install Tesseract on the host and `pip install -r requirements-ocr.txt`. Without it, image uploads are accepted but marked *needs review*.

Check it:

```bash
curl https://your-api.onrender.com/api/health          # {"status":"ok"}
```

The first start takes a minute longer while the embedding model downloads.

## 4. Frontend (Vercel)

1. **New Project**, import the repository, set **Root Directory** to `frontend`.
2. Framework: Vite. Build command `npm run build`, output directory `dist`.
3. **Proxy the API.** In [`frontend/vercel.json`](../frontend/vercel.json), add the `/api` rewrite *before* the existing SPA rewrite:

   ```json
   "rewrites": [
     { "source": "/api/:path*", "destination": "https://your-api.onrender.com/api/:path*" },
     { "source": "/((?!api/|assets/).*)", "destination": "/index.html" }
   ]
   ```

4. Environment variables: leave `VITE_API_BASE_URL` **empty**, so the app calls `/api` on its own address. `VITE_PLAUSIBLE_DOMAIN` is optional.
5. Add your domain in Vercel, then set `APP_URL` and `CORS_ORIGINS` on the backend to it and redeploy the backend.

**Netlify instead:** base directory `frontend`, build `npm run build`, publish `frontend/dist`. In [`frontend/public/_redirects`](../frontend/public/_redirects), put the API line above the SPA line:

```
/api/*  https://your-api.onrender.com/api/:splat  200
/*      /index.html                                 200
```

## 5. Your own domain

Replace `https://formpilot.app` with your domain in:
- `frontend/index.html` (canonical URL, Open Graph tags)
- `frontend/public/robots.txt` and `frontend/public/sitemap.xml`
- `frontend/src/hooks/usePageMeta.ts`
- `frontend/public/_redirects` (the HTTPS redirect line, if you use Netlify)

## 6. Browser extension

Users can point the extension at your deployment without rebuilding it. In the FormPilot popup, open **Settings → FormPilot app address**, enter `https://your-app.com` and save; Chrome asks for permission to reach it. Then open `https://your-app.com/extension` and click **Connect this browser**.

To ship a build that points at your deployment by default:

1. In `extension/src/shared/messages.ts`, set `DEFAULT_APP_URL = 'https://your-app.com'`.
2. In `extension/src/manifest.json`, add `"https://your-app.com/*"` to `host_permissions`, and bump `version`.
3. Build: `cd frontend && npm run build:extension`.
4. Load `extension/dist` (Developer mode → Load unpacked), or zip the **contents** of `extension/dist` and upload it to the Chrome Web Store / Edge Add-ons. The store asks for a privacy policy and a reason for each permission. The extension runs on all sites so it can find forms; it sends only field metadata, and only when the user opens it.

## 7. Optional: Sign in with Google

In Google Cloud Console → APIs & Services → Credentials, create an **OAuth client ID** (Web application) with:
- Authorized JavaScript origin: `https://your-app.com`
- Authorized redirect URI: `https://your-app.com/api/auth/oauth/google/callback`

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the backend. The **Continue with Google** button appears automatically once both are set.

## 8. After deploying: check these

- [ ] `https://your-app.com/api/health` returns `{"status":"ok"}` (through the frontend's proxy).
- [ ] Sign up, sign out, sign in with **Remember me**, and reload: you stay signed in.
- [ ] Upload a resume: it's processed, and **Settings → AI engine** shows Groq active, semantic search on, and "Turso (libSQL, remote)".
- [ ] **Forgot password** sends an email, the link opens the reset page, and after the reset you sign in with the new password.
- [ ] Open **Use Anywhere**: CareerHub fields are detected and filled.
- [ ] Extension: connect it from `/extension`, open any site with a form, and Autofill.
- [ ] Redeploy the backend: uploaded documents can still be opened (the persistent disk works).

## 9. Before a public launch

- The Privacy Policy and Terms in the app are drafts. Fill in the highlighted placeholders (operator's legal name, address, hosting region, retention periods, governing law) and have them reviewed.
- Back up the Turso database (`turso db shell formpilot .dump > backup.sql`) and the storage disk.
- Rate limits live in one process. If you run more than one backend instance, move them to Redis first.
- Rotate any key that was ever shared in chat or committed by mistake (Groq, Resend, SMTP, Turso tokens).

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Signed in, but every page says "Please sign in" | The frontend calls the API on another site. Use the `/api` rewrite and an empty `VITE_API_BASE_URL`. |
| API won't start: "Missing required settings in production" | `SECRET_KEY`, `FILE_ENCRYPTION_KEY` or `COOKIE_SECURE=true` is missing. |
| Redirect loop or "too many redirects" | `TRUST_PROXY_HEADERS` isn't `true` behind the host's proxy, so HTTPS requests look like HTTP. |
| Uploaded documents vanish after a redeploy | No persistent disk, or `STORAGE_DIR` isn't on it. |
| Instance restarts while processing an upload | Out of memory: use 1 GB+ RAM or `EMBEDDING_PROVIDER=hash`. |
| "Email isn't set up yet" on Forgot password | `SMTP_HOST` is empty, or the backend wasn't restarted after setting it. |
| Extension: "Couldn't reach FormPilot" | Wrong app address in the popup settings, or permission for it wasn't granted. |
| Extension popup shows `ERR_FILE_NOT_FOUND` | Chrome loaded the wrong folder. Load `extension/dist`, not `extension/`. |
