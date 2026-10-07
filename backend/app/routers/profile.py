from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import ProfileChoice, User
from ..schemas import MappingIn, MappingOut, ProfileOut, ResolveConflictIn
from ..services.fields import FIELD_LABELS
from ..services.rag import map_fields as rag_map_fields
from ..services.profile import build_profile

router = APIRouter(tags=["profile"])


@router.get("/profile", response_model=ProfileOut)
def get_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ProfileOut:
    return build_profile(db, user)


@router.post("/profile/conflicts/resolve", response_model=ProfileOut)
def resolve_conflict(payload: ResolveConflictIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ProfileOut:
    """Sets a profile value: picks one side of a conflict, fills in a missing detail, or edits a list."""
    if payload.key not in FIELD_LABELS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This isn't a profile field.")
    choice = db.scalar(select(ProfileChoice).where(ProfileChoice.user_id == user.id, ProfileChoice.key == payload.key))
    if choice:
        choice.value = payload.value
    else:
        db.add(ProfileChoice(user_id=user.id, key=payload.key, value=payload.value))
    db.commit()
    return build_profile(db, user)


@router.post("/mapping", response_model=MappingOut)
def map_fields(payload: MappingIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MappingOut:
    """Maps form labels to the user's details using retrieval-augmented generation (see services/rag.py)."""
    matches, workflow_id = rag_map_fields(db, user, payload.fields, payload.application_id)
    return MappingOut(matches=matches, workflow_id=workflow_id)

