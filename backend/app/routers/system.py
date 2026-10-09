from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import describe as describe_database
from ..database import get_db
from ..deps import get_current_user
from ..models import User, WorkflowRun
from ..schemas import CapabilitiesOut, WorkflowRunOut
from ..services.embeddings import HashEmbedder, get_embedder
from ..services.extraction import ocr_available
from ..services.vectorstore import describe as describe_vector_store

router = APIRouter(tags=["system"])


@router.get("/system/capabilities", response_model=CapabilitiesOut)
def capabilities(db: Session = Depends(get_db), _user: User = Depends(get_current_user)) -> CapabilitiesOut:
    """Which parts of the AI pipeline are active on this server."""
    settings = get_settings()
    embedder = get_embedder()
    bind = db.get_bind()
    return CapabilitiesOut(
        llm={"enabled": settings.llm_active, "provider": "Groq", "model": settings.llm_model},
        embeddings={"provider": embedder.name, "semantic": not isinstance(embedder, HashEmbedder)},
        vector_store=describe_vector_store(),
        database=describe_database(bind),
        ocr=ocr_available(),
        oauth={"google": settings.google_oauth_enabled},
    )


@router.get("/workflows", response_model=list[WorkflowRunOut])
def list_workflows(
    subject_id: str | None = Query(default=None, max_length=64),
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkflowRun]:
    """Recent workflow runs (document ingestion, form mapping, external autofill), optionally for one subject."""
    query = select(WorkflowRun).where(WorkflowRun.user_id == user.id)
    if subject_id:
        query = query.where(WorkflowRun.subject_id == subject_id)
    return list(db.scalars(query.order_by(WorkflowRun.started_at.desc()).limit(limit)))
