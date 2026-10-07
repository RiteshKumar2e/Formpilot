import secrets

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User, Webhook, WebhookDelivery
from ..schemas import WebhookDeliveryOut, WebhookIn, WebhookOut
from ..services.integrations import InvalidWebhookUrl, validate_webhook_url

router = APIRouter(prefix="/integrations/webhooks", tags=["integrations"])

MAX_WEBHOOKS = 10


def _out(db: Session, hook: Webhook, secret: str | None = None) -> WebhookOut:
    deliveries = db.scalars(
        select(WebhookDelivery).where(WebhookDelivery.webhook_id == hook.id).order_by(WebhookDelivery.id.desc()).limit(5)
    )
    return WebhookOut(
        id=hook.id,
        url=hook.url,
        events=hook.events.split(","),
        active=hook.active,
        created_at=hook.created_at,
        secret=secret,
        recent_deliveries=[WebhookDeliveryOut.model_validate(d) for d in deliveries],
    )


@router.get("", response_model=list[WebhookOut])
def list_webhooks(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[WebhookOut]:
    hooks = db.scalars(select(Webhook).where(Webhook.user_id == user.id).order_by(Webhook.created_at))
    return [_out(db, h) for h in hooks]


@router.post("", response_model=WebhookOut, status_code=status.HTTP_201_CREATED)
def create_webhook(payload: WebhookIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WebhookOut:
    if len(list(db.scalars(select(Webhook.id).where(Webhook.user_id == user.id)))) >= MAX_WEBHOOKS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"You can add up to {MAX_WEBHOOKS} webhooks.")
    try:
        url = validate_webhook_url(payload.url)
    except InvalidWebhookUrl as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    secret = "whsec_" + secrets.token_urlsafe(32)
    hook = Webhook(user_id=user.id, url=url, secret=secret, events=",".join(dict.fromkeys(payload.events)))
    db.add(hook)
    db.commit()
    return _out(db, hook, secret=secret)


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_webhook(webhook_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    hook = db.get(Webhook, webhook_id)
    if hook is None or hook.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Webhook not found.")
    db.delete(hook)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
