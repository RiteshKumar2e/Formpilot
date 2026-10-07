import base64
import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..deps import get_current_user, get_optional_user
from ..models import OAuthAccount, User
from ..ratelimit import signin_limit, signup_limit
from ..schemas import SessionOut, SignInIn, SignUpIn, UserOut
from ..services import storage
from ..security import SESSION_COOKIE, create_session_token, hash_password, verify_password

log = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# Used to keep sign-in timing similar whether or not the email exists.
_DUMMY_HASH = hash_password("timing-equalizer-0")


def _set_session(response: Response, user: User) -> None:
    settings = get_settings()
    response.set_cookie(
        SESSION_COOKIE,
        create_session_token(user.id),
        max_age=settings.session_hours * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(signup_limit)])
def sign_up(payload: SignUpIn, response: Response, db: Session = Depends(get_db)) -> User:
    if payload.website:  # Honeypot: hidden from people, filled in by bots.
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "We couldn't create your account. Please try again.")
    email = payload.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists. Try signing in.")
    user = User(full_name=payload.full_name, email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    _set_session(response, user)
    return user


@router.post("/signin", response_model=UserOut, dependencies=[Depends(signin_limit)])
def sign_in(payload: SignInIn, response: Response, db: Session = Depends(get_db)) -> User:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not verify_password(payload.password, user.password_hash if user else _DUMMY_HASH) or user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect.")
    _set_session(response, user)
    return user


@router.post("/signout", status_code=status.HTTP_204_NO_CONTENT)
def sign_out(response: Response) -> Response:
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(response: Response, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    """Permanently deletes the account, its documents (including stored files) and all extracted data."""
    for doc in user.documents:
        storage.delete(doc.storage_key)
    db.delete(user)
    db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/session", response_model=SessionOut)
def session(user: User | None = Depends(get_optional_user)) -> SessionOut:
    """Who is signed in, if anyone. Always 200, so anonymous page loads don't log errors."""
    return SessionOut(user=UserOut.model_validate(user) if user else None)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


# --- Sign in with Google (OAuth 2.0 authorization code flow + PKCE, OpenID Connect) ----------

GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
OAUTH_COOKIE = "fp_oauth"
_OAUTH_COOKIE_PATH = "/api/auth/oauth"


def _google_redirect_uri() -> str:
    return f"{get_settings().api_base_url}/api/auth/oauth/google/callback"


@router.get("/providers")
def providers() -> dict[str, bool]:
    """Which sign-in providers are configured, so the web app only shows working buttons."""
    return {"google": get_settings().google_oauth_enabled}


@router.get("/oauth/google/start")
def google_start() -> RedirectResponse:
    settings = get_settings()
    if not settings.google_oauth_enabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Google sign-in isn't configured.")
    state = secrets.token_urlsafe(24)
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": _google_redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "prompt": "select_account",
    }
    response = RedirectResponse(f"{GOOGLE_AUTHORIZE_URL}?{urlencode(params)}", status_code=status.HTTP_303_SEE_OTHER)
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    cookie = jwt.encode({"state": state, "verifier": verifier, "exp": expires}, settings.signing_key, algorithm="HS256")
    response.set_cookie(
        OAUTH_COOKIE, cookie, max_age=600, httponly=True, secure=settings.cookie_secure, samesite="lax", path=_OAUTH_COOKIE_PATH
    )
    return response


def _oauth_user(db: Session, subject: str, email: str, name: str) -> User:
    link = db.scalar(select(OAuthAccount).where(OAuthAccount.provider == "google", OAuthAccount.subject == subject))
    if link:
        user = db.get(User, link.user_id)
        if user:
            return user
    # Google verified this address, so it's safe to link to an existing account with the same email.
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(full_name=name[:200] or email.split("@")[0], email=email, password_hash="")
        db.add(user)
        db.flush()
    db.add(OAuthAccount(user_id=user.id, provider="google", subject=subject))
    db.commit()
    return user


@router.get("/oauth/google/callback")
def google_callback(
    code: str | None = None,
    state: str | None = None,
    oauth_cookie: str | None = Cookie(default=None, alias=OAUTH_COOKIE),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    settings = get_settings()
    failure = RedirectResponse(f"{settings.app_url.rstrip('/')}/login?error=oauth", status_code=status.HTTP_303_SEE_OTHER)
    failure.delete_cookie(OAUTH_COOKIE, path=_OAUTH_COOKIE_PATH)
    if not settings.google_oauth_enabled or not code or not state or not oauth_cookie:
        return failure
    try:
        saved = jwt.decode(oauth_cookie, settings.signing_key, algorithms=["HS256"])
    except jwt.PyJWTError:
        return failure
    if not hmac.compare_digest(str(saved.get("state", "")), state):
        return failure

    try:
        token = httpx.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": _google_redirect_uri(),
                "grant_type": "authorization_code",
                "code_verifier": saved["verifier"],
            },
            timeout=10,
        )
        token.raise_for_status()
        info = httpx.get(
            GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {token.json()['access_token']}"}, timeout=10
        )
        info.raise_for_status()
        profile = info.json()
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        log.warning("Google sign-in failed: %s", exc)
        return failure

    email = str(profile.get("email", "")).lower()
    if not profile.get("sub") or not email or profile.get("email_verified") is not True:
        return failure
    user = _oauth_user(db, str(profile["sub"]), email, str(profile.get("name", "")))
    response = RedirectResponse(f"{settings.app_url.rstrip('/')}/dashboard", status_code=status.HTTP_303_SEE_OTHER)
    response.delete_cookie(OAUTH_COOKIE, path=_OAUTH_COOKIE_PATH)
    _set_session(response, user)
    return response
