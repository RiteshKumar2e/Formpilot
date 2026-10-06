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


def create_session_token(user_id: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "iat": now, "exp": now + timedelta(hours=settings.session_hours)}
    return jwt.encode(payload, settings.signing_key, algorithm=_ALGORITHM)


def read_session_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, get_settings().signing_key, algorithms=[_ALGORITHM])
    except jwt.PyJWTError:
        return None
    sub = payload.get("sub")
    return sub if isinstance(sub, str) else None


def file_cipher() -> Fernet:
    return Fernet(get_settings().fernet_key)
