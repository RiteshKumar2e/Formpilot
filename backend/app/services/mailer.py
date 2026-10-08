"""Outgoing email over SMTP (used for password reset links)."""

import logging
import smtplib
from email.message import EmailMessage

from ..config import get_settings

log = logging.getLogger(__name__)


def email_configured() -> bool:
    return bool(get_settings().smtp_host)


def send_email(to: str, subject: str, text: str, html: str | None = None) -> bool:
    """Sends an email (plain text, plus HTML when given). Returns False and logs when it can't be sent."""
    settings = get_settings()
    if not settings.smtp_host:
        return False
    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)
    if html:
        message.add_alternative(html, subtype="html")
    try:
        # Port 465 uses TLS from the start; other ports (587) upgrade with STARTTLS.
        if settings.smtp_port == 465:
            smtp = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15)
        else:
            smtp = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
            smtp.starttls()
        with smtp:
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
        return True
    except (smtplib.SMTPException, OSError) as exc:
        log.warning("Couldn't send email to %s: %s", to, exc)
        return False
