"""Connecting the FormPilot browser extension to an account.

The web app creates a token while the user is signed in and hands it to the extension on the same
page. The extension sends it as `Authorization: Bearer fpx_...`; it can only reach the endpoints listed
in deps.EXTENSION_ALLOWED, expires after EXTENSION_TOKEN_DAYS, and stops working when revoked or when
the password changes.
"""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import EXTENSION_TOKEN_PREFIX, get_web_user
from ..models import ExtensionToken, User
from ..schemas import ExtensionTokenIn, ExtensionTokenOut
from ..security import hash_reset_token

router = APIRouter(prefix="/extension", tags=["extension"])

EXTENSION_TOKEN_DAYS = 90
MAX_CONNECTED = 10


def _active(db: Session, user: User) -> list[ExtensionToken]:
    now = datetime.now(timezone.utc)
    rows = db.scalars(select(ExtensionToken).where(ExtensionToken.user_id == user.id, ExtensionToken.revoked_at.is_(None)))
    return [r for r in rows if (r.expires_at if r.expires_at.tzinfo else r.expires_at.replace(tzinfo=timezone.utc)) > now]


@router.post("/tokens", response_model=ExtensionTokenOut, status_code=status.HTTP_201_CREATED)
def connect_extension(payload: ExtensionTokenIn, user: User = Depends(get_web_user), db: Session = Depends(get_db)) -> ExtensionTokenOut:
    if len(_active(db, user)) >= MAX_CONNECTED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"You can connect up to {MAX_CONNECTED} browsers. Disconnect one first.")
    token = EXTENSION_TOKEN_PREFIX + secrets.token_urlsafe(32)
    row = ExtensionToken(
        user_id=user.id,
        name=payload.name.strip(),
        token_hash=hash_reset_token(token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=EXTENSION_TOKEN_DAYS),
    )
    db.add(row)
    db.commit()
    out = ExtensionTokenOut.model_validate(row)
    out.token = token
    return out


@router.get("/tokens", response_model=list[ExtensionTokenOut])
def connected_extensions(user: User = Depends(get_web_user), db: Session = Depends(get_db)) -> list[ExtensionToken]:
    return sorted(_active(db, user), key=lambda r: r.created_at, reverse=True)


@router.delete("/tokens/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_extension(token_id: str, user: User = Depends(get_web_user), db: Session = Depends(get_db)) -> Response:
    row = db.get(ExtensionToken, token_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Connection not found.")
    row.revoked_at = datetime.now(timezone.utc)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
