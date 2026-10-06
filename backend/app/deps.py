from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import SESSION_COOKIE, read_session_token


def get_optional_user(
    db: Session = Depends(get_db),
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> User | None:
    user_id = read_session_token(session) if session else None
    return db.get(User, user_id) if user_id else None


def get_current_user(
    db: Session = Depends(get_db),
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> User:
    user = get_optional_user(db, session)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Please sign in to continue.")
    return user
