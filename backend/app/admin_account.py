"""The admin account, set up from ADMIN_EMAILS and ADMIN_PASSWORD at startup.

The first email in ADMIN_EMAILS gets an account with ADMIN_PASSWORD: created if it doesn't exist, and
its password reset to ADMIN_PASSWORD if it differs (so changing the variable changes the password).
Without ADMIN_PASSWORD nothing happens; admins sign up and sign in like everyone else.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from .config import get_settings
from .models import User
from .security import hash_password, verify_password

log = logging.getLogger(__name__)


def ensure_admin(engine: Engine) -> None:
    settings = get_settings()
    emails = [e.strip().lower() for e in settings.admin_emails.split(",") if e.strip()]
    if not emails or not settings.admin_password:
        return
    email = emails[0]
    with Session(engine) as db:
        user = db.scalar(select(User).where(func.lower(User.email) == email))
        if user is None:
            db.add(User(full_name="Admin", email=email, password_hash=hash_password(settings.admin_password)))
            log.info("Created the admin account %s", email)
        elif not verify_password(settings.admin_password, user.password_hash):
            user.password_hash = hash_password(settings.admin_password)
            user.password_changed_at = datetime.now(timezone.utc).replace(microsecond=0)
            log.info("Set the admin password for %s from ADMIN_PASSWORD", email)
        db.commit()
