from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ContactMessage
from ..ratelimit import contact_limit
from ..schemas import ContactIn

router = APIRouter(tags=["contact"])


@router.post("/contact", dependencies=[Depends(contact_limit)])
def contact(payload: ContactIn, db: Session = Depends(get_db)) -> dict[str, bool]:
    if payload.website:
        # Honeypot filled in: report success so the bot moves on, but store nothing.
        return {"ok": True}
    db.add(ContactMessage(name=payload.name.strip(), email=payload.email, message=payload.message.strip()))
    db.commit()
    return {"ok": True}
