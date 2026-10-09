"""Admin dashboard: what's in the database, for the people listed in ADMIN_EMAILS.

Read-only, and it never decrypts personal data: profile values, application answers and document
passages stay encrypted. It shows accounts, counts, file names and statuses.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import describe as describe_database
from ..database import get_db
from ..deps import get_admin_user
from ..models import (
    Application,
    ApplicationTemplate,
    ContactMessage,
    Document,
    ExtensionToken,
    ExtractedField,
    OAuthAccount,
    SavedAnswer,
    User,
    WorkflowRun,
)
from ..services import vectorstore

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_admin_user)])


def _by_status(db: Session, column) -> dict[str, int]:
    return {status: count for status, count in db.execute(select(column, func.count()).group_by(column))}


def _per_user(db: Session, column) -> dict[str, int]:
    return dict(db.execute(select(column, func.count()).group_by(column)).all())


@router.get("/overview")
def overview(db: Session = Depends(get_db)) -> dict:
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=13)
    signups: dict[str, int] = {(since + timedelta(days=i)).date().isoformat(): 0 for i in range(14)}
    for (created,) in db.execute(select(User.created_at).where(User.created_at >= since.replace(hour=0, minute=0, second=0, microsecond=0))):
        day = created.date().isoformat()
        if day in signups:
            signups[day] += 1
    count = lambda model: db.scalar(select(func.count()).select_from(model)) or 0  # noqa: E731
    return {
        "database": describe_database(db.get_bind()),
        "vector_store": {"name": vectorstore.describe(), **vectorstore.stats()},
        "totals": {
            "users": count(User),
            "documents": count(Document),
            "extracted_fields": count(ExtractedField),
            "applications": count(Application),
            "saved_answers": count(SavedAnswer),
            "templates": count(ApplicationTemplate),
            "workflow_runs": count(WorkflowRun),
            "contact_messages": count(ContactMessage),
            "extensions_connected": db.scalar(
                select(func.count()).select_from(ExtensionToken).where(ExtensionToken.revoked_at.is_(None), ExtensionToken.expires_at > now)
            )
            or 0,
            "storage_bytes": db.scalar(select(func.coalesce(func.sum(Document.size_bytes), 0))) or 0,
        },
        "documents_by_status": _by_status(db, Document.status),
        "applications_by_status": _by_status(db, Application.status),
        "workflows_by_status": _by_status(db, WorkflowRun.status),
        "signups": [{"date": day, "count": n} for day, n in signups.items()],
    }


@router.get("/users")
def users(db: Session = Depends(get_db), limit: int = Query(default=200, ge=1, le=1000)) -> list[dict]:
    documents = _per_user(db, Document.user_id)
    applications = _per_user(db, Application.user_id)
    answers = _per_user(db, SavedAnswer.user_id)
    extensions = dict(
        db.execute(
            select(ExtensionToken.user_id, func.max(ExtensionToken.last_used_at))
            .where(ExtensionToken.revoked_at.is_(None))
            .group_by(ExtensionToken.user_id)
        ).all()
    )
    last_active = dict(db.execute(select(WorkflowRun.user_id, func.max(WorkflowRun.started_at)).group_by(WorkflowRun.user_id)).all())
    rows = db.scalars(select(User).order_by(User.created_at.desc()).limit(limit))
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "created_at": u.created_at,
            "documents": documents.get(u.id, 0),
            "applications": applications.get(u.id, 0),
            "saved_answers": answers.get(u.id, 0),
            "extension": u.id in extensions,
            "last_active": last_active.get(u.id),
        }
        for u in rows
    ]


@router.get("/documents")
def documents(db: Session = Depends(get_db), limit: int = Query(default=50, ge=1, le=500)) -> list[dict]:
    rows = db.execute(select(Document, User.email).join(User, User.id == Document.user_id).order_by(Document.created_at.desc()).limit(limit))
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "owner": email,
            "content_type": d.content_type,
            "size_bytes": d.size_bytes,
            "page_count": d.page_count,
            "status": d.status,
            "created_at": d.created_at,
        }
        for d, email in rows
    ]


@router.get("/activity")
def activity(db: Session = Depends(get_db), limit: int = Query(default=50, ge=1, le=500)) -> list[dict]:
    rows = db.execute(select(WorkflowRun, User.email).join(User, User.id == WorkflowRun.user_id).order_by(WorkflowRun.started_at.desc()).limit(limit))
    return [
        {
            "id": r.id,
            "workflow": r.workflow,
            "status": r.status,
            "user": email,
            "steps": len(r.steps or []),
            "started_at": r.started_at,
            "finished_at": r.finished_at,
        }
        for r, email in rows
    ]


@router.get("/messages")
def messages(db: Session = Depends(get_db), limit: int = Query(default=100, ge=1, le=500)) -> list[dict]:
    rows = db.scalars(select(ContactMessage).order_by(ContactMessage.created_at.desc()).limit(limit))
    return [{"id": m.id, "name": m.name, "email": m.email, "message": m.message, "created_at": m.created_at} for m in rows]


@router.get("/users/{user_id}")
def user_detail(user_id: str, db: Session = Depends(get_db)) -> dict:
    """One account: its documents, applications (title and status, not the answers), connections and runs."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    now = datetime.now(timezone.utc)
    documents = db.scalars(select(Document).where(Document.user_id == user.id).order_by(Document.created_at.desc()))
    applications = db.scalars(select(Application).where(Application.user_id == user.id).order_by(Application.updated_at.desc()))
    tokens = db.scalars(select(ExtensionToken).where(ExtensionToken.user_id == user.id).order_by(ExtensionToken.created_at.desc()))
    runs = db.scalars(select(WorkflowRun).where(WorkflowRun.user_id == user.id).order_by(WorkflowRun.started_at.desc()).limit(20))
    google = db.scalar(select(func.count()).select_from(OAuthAccount).where(OAuthAccount.user_id == user.id)) or 0
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "created_at": user.created_at,
        "password_changed_at": user.password_changed_at,
        "sign_in": "Google and password" if google else "Email and password",
        "profile_details": db.scalar(select(func.count()).select_from(ExtractedField).where(ExtractedField.user_id == user.id)) or 0,
        "saved_answers": db.scalar(select(func.count()).select_from(SavedAnswer).where(SavedAnswer.user_id == user.id)) or 0,
        "templates": db.scalar(select(func.count()).select_from(ApplicationTemplate).where(ApplicationTemplate.user_id == user.id)) or 0,
        "documents": [
            {"id": d.id, "filename": d.filename, "size_bytes": d.size_bytes, "page_count": d.page_count, "status": d.status, "created_at": d.created_at}
            for d in documents
        ],
        "applications": [
            {
                "id": a.id,
                "title": str((a.data or {}).get("title", "")),
                "organization": (a.data or {}).get("organization") or None,
                "status": a.status,
                "fields": len((a.data or {}).get("fields", [])),
                "updated_at": a.updated_at,
            }
            for a in applications
        ],
        "extensions": [
            {
                "name": t.name,
                "created_at": t.created_at,
                "last_used_at": t.last_used_at,
                "active": t.revoked_at is None and (t.expires_at if t.expires_at.tzinfo else t.expires_at.replace(tzinfo=timezone.utc)) > now,
            }
            for t in tokens
        ],
        "runs": [{"id": r.id, "workflow": r.workflow, "status": r.status, "started_at": r.started_at} for r in runs],
    }
