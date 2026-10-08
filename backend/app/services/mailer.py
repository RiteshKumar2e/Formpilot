"""Outgoing email over SMTP (used for password reset links)."""

import logging
import smtplib
from email.message import EmailMessage

from ..config import get_settings

log = logging.getLogger(__name__)


def email_configured() -> bool:
    return bool(get_settings().smtp_host)


def send_email(to: str, subject: str, text: str) -> bool:
    """Sends a plain-text email. Returns False (and logs) when SMTP isn't configured or sending fails."""
    settings = get_settings()
    if not settings.smtp_host:
        return False
    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
        return True
    except (smtplib.SMTPException, OSError) as exc:
        log.warning("Couldn't send email to %s: %s", to, exc)
        return False
