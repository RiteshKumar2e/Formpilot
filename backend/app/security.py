import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from cryptography.fernet import Fernet

from .config import get_settings

SESSION_COOKIE = "fp_session"
_ALGORITHM = "HS256"

# scrypt parameters (n=2^14, r=8, p=1) — OWASP-recommended minimum for interactive logins.
_SCRYPT = {"n": 2**14, "r": 8, "p": 1, "dklen": 32}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    if scheme != "scrypt":
        return False
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), **_SCRYPT)
    return hmac.compare_digest(digest.hex(), digest_hex)


def create_session_token(user_id: str, hours: float | None = None) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "iat": now, "exp": now + timedelta(hours=hours or settings.session_hours)}
    return jwt.encode(payload, settings.signing_key, algorithm=_ALGORITHM)


def read_session_token(token: str) -> tuple[str, int] | None:
    """The user id and issue time (Unix seconds) of a valid session token."""
    try:
        payload = jwt.decode(token, get_settings().signing_key, algorithms=[_ALGORITHM])
    except jwt.PyJWTError:
        return None
    sub, iat = payload.get("sub"), payload.get("iat")
    return (sub, int(iat)) if isinstance(sub, str) and isinstance(iat, (int, float)) else None


def new_reset_token() -> tuple[str, str]:
    """A password-reset token for the link, and the hash stored in the database."""
    token = secrets.token_urlsafe(32)
    return token, hash_reset_token(token)


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def file_cipher() -> Fernet:
    return Fernet(get_settings().fernet_key)
