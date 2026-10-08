from pathlib import PurePath

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..config import get_settings
from ..database import get_db
from ..deps import get_current_user
from ..models import Document, User
from ..ratelimit import upload_limit
from ..schemas import DocumentOut
from ..services import storage
from ..services.ingest import ingest_document

router = APIRouter(prefix="/documents", tags=["documents"])


def sniff_content_type(data: bytes) -> str | None:
    """Identify the file from its bytes, not its (client-controlled) name or header."""
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    return None


def _owned_document(db: Session, user: User, document_id: str) -> Document:
    doc = db.scalar(
        select(Document).options(selectinload(Document.fields)).where(Document.id == document_id, Document.user_id == user.id)
    )
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found.")
    return doc


@router.get("", response_model=list[DocumentOut])
def list_documents(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Document]:
    return list(
        db.scalars(
            select(Document)
            .options(selectinload(Document.fields))
            .where(Document.user_id == user.id)
            .order_by(Document.created_at.desc())
        )
    )


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(upload_limit)])
def upload_document(
    file: UploadFile, background: BackgroundTasks, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Document:
    max_bytes = get_settings().max_upload_bytes
    # Sync endpoint: FastAPI runs it in a worker thread, so parsing never blocks the event loop.
    data = file.file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(413, "This file is larger than 10 MB.")
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This file is empty.")
    content_type = sniff_content_type(data)
    if content_type is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "This file type isn't supported. Upload a PDF, JPG or PNG.")

    filename = PurePath(file.filename or "document").name[:255] or "document"
    doc = Document(user_id=user.id, filename=filename, content_type=content_type, size_bytes=len(data), storage_key="")
    db.add(doc)
    db.flush()
    doc.storage_key = storage.save(user.id, doc.id, data)

    ingest_document(db, doc, data, background)
    db.commit()
    return _owned_document(db, user, doc.id)


@router.get("/{document_id}/file")
def download_document(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    """The original file, decrypted for its owner (used to attach vault documents to external forms)."""
    doc = _owned_document(db, user, document_id)
    try:
        data = storage.load(doc.storage_key)
    except (OSError, ValueError) as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This file is no longer available.") from exc
    safe_name = doc.filename.replace('"', "")
    return Response(
        content=data,
        media_type=doc.content_type,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"', "Cache-Control": "private, no-store"},
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    doc = _owned_document(db, user, document_id)
    storage.delete(doc.storage_key)
    db.delete(doc)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
