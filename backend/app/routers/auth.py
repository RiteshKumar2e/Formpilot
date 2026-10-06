from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..deps import get_current_user, get_optional_user
from ..models import User
from ..ratelimit import signin_limit, signup_limit
from ..schemas import SessionOut, SignInIn, SignUpIn, UserOut
from ..services import storage
from ..security import SESSION_COOKIE, create_session_token, hash_password, verify_password

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
