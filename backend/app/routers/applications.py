from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Application, User
from ..schemas import ApplicationIn, AutofillField, AutofillOut
from ..services import integrations

router = APIRouter(prefix="/applications", tags=["applications"])

MAX_RECORD_BYTES = 512 * 1024


def _owned(db: Session, user: User, app_id: str) -> Application:
    app = db.get(Application, (app_id, user.id))
    if app is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found.")
    return app


@router.get("", response_model=list[dict])
def list_applications(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(Application).where(Application.user_id == user.id).order_by(Application.updated_at.desc()))
    return [row.data for row in rows]


@router.put("/{app_id}", response_model=dict)
def save_application(
    app_id: str,
    payload: ApplicationIn,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Creates or replaces an application. The whole record is stored encrypted."""
    if payload.id != app_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The application id doesn't match the URL.")
    data = payload.model_dump(mode="json")
    if len(str(data)) > MAX_RECORD_BYTES:
        raise HTTPException(413, "This application is too large to save.")

    app = db.get(Application, (app_id, user.id))
    event = None
    if app is None:
        app = Application(id=app_id, user_id=user.id, status=payload.status, data=data)
        db.add(app)
        event = "application.created"
    else:
        if payload.status == "prepared" and app.status != "prepared":
            event = "application.approved"
        app.status = payload.status
        app.data = data
    db.commit()
    if event:
        integrations.emit(
            db, background, user.id, event,
            {"application_id": app_id, "title": payload.title, "status": payload.status, "reference": data.get("reference")},
        )
    return data


@router.delete("/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(
    app_id: str, background: BackgroundTasks, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    app = _owned(db, user, app_id)
    title = (app.data or {}).get("title")
    db.delete(app)
    db.commit()
    integrations.emit(db, background, user.id, "application.deleted", {"application_id": app_id, "title": title})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{app_id}/autofill", response_model=AutofillOut)
def autofill(app_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AutofillOut:
    """Label -> value pairs ready to fill into the organization's form (browser extensions, RPA, other APIs)."""
    data = _owned(db, user, app_id).data or {}
    fields = [
        AutofillField(label=str(f.get("label", "")), value=str(f.get("value", "")), section=f.get("section"))
        for f in data.get("fields", [])
        if isinstance(f, dict) and f.get("value")
    ]
    return AutofillOut(
        application_id=app_id,
        title=str(data.get("title", "")),
        organization=data.get("organization") or None,
        status=str(data.get("status", "")),
        reference=data.get("reference"),
        fields=fields,
    )
