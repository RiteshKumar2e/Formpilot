from datetime import datetime, timedelta, timezone

from fastapi import Cookie, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import get_db
from .models import ExtensionToken, User
from .security import SESSION_COOKIE, hash_reset_token, read_session_token

EXTENSION_TOKEN_PREFIX = "fpx_"

# What the browser extension may do with its token: read the profile and documents, get autofill
# suggestions and Smart Answers, and save a value the user typed. Everything else (uploads, deletions,
# account and password changes, creating tokens) needs the signed-in web app.
EXTENSION_ALLOWED = (
    ("GET", "/api/auth/me"),
    ("POST", "/api/autofill/suggest"),
    ("GET", "/api/profile"),
    ("POST", "/api/profile/conflicts/resolve"),
    ("GET", "/api/answers"),
    ("POST", "/api/answers"),
    ("GET", "/api/documents"),
    ("POST", "/api/templates/match"),
)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _extension_user(request: Request, db: Session, token: str) -> User | None:
    row = db.scalar(select(ExtensionToken).where(ExtensionToken.token_hash == hash_reset_token(token)))
    now = datetime.now(timezone.utc)
    if row is None or row.revoked_at is not None or _aware(row.expires_at) < now:
        return None
    user = db.get(User, row.user_id)
    if user is None:
        return None
    if user.password_changed_at is not None and _aware(row.created_at) < _aware(user.password_changed_at):
        return None  # connected before the password changed: reconnect from the web app
    path, method = request.url.path, request.method
    if not any(method == m and path.startswith(p) for m, p in EXTENSION_ALLOWED):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "The browser extension can't do this. Use the FormPilot web app.")
    if row.last_used_at is None or now - _aware(row.last_used_at) > timedelta(minutes=5):
        row.last_used_at = now
        db.commit()
    request.state.via_extension = True
    return user


def get_optional_user(
    request: Request,
    db: Session = Depends(get_db),
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> User | None:
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        return _extension_user(request, db, token) if token.startswith(EXTENSION_TOKEN_PREFIX) else None

    data = read_session_token(session) if session else None
    if data is None:
        return None
    user_id, issued_at = data
    user = db.get(User, user_id)
    if user is None:
        return None
    changed = user.password_changed_at
    if changed is not None:
        if issued_at < int(_aware(changed).timestamp()):
            return None  # signed in before the password was changed or reset
    return user


def get_current_user(user: User | None = Depends(get_optional_user)) -> User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Please sign in to continue.")
    return user


def get_web_user(request: Request, user: User = Depends(get_current_user)) -> User:
    """A user signed in to the web app itself (not through the extension's token)."""
    if getattr(request.state, "via_extension", False):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sign in to the FormPilot web app to do this.")
    return user
