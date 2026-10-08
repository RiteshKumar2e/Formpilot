from datetime import timezone

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import SESSION_COOKIE, read_session_token


def get_optional_user(
    db: Session = Depends(get_db),
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> User | None:
    data = read_session_token(session) if session else None
    if data is None:
        return None
    user_id, issued_at = data
    user = db.get(User, user_id)
    if user is None:
        return None
    changed = user.password_changed_at
    if changed is not None:
        changed = changed if changed.tzinfo else changed.replace(tzinfo=timezone.utc)
        if issued_at < int(changed.timestamp()):
            return None  # signed in before the password was changed or reset
    return user


def get_current_user(
    db: Session = Depends(get_db),
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> User:
    user = get_optional_user(db, session)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Please sign in to continue.")
    return user
