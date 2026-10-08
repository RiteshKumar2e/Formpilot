"""HTML emails. Table layout and inline styles only, so they render in Gmail, Outlook and mobile clients."""

from datetime import datetime, timezone
from html import escape

NAVY = "#0e0e62"
YELLOW = "#ffc72c"
INK = "#1b1b4b"
MUTED = "#5b5b7f"
SUBTLE = "#8a8aa8"
LINE = "#e6e6f0"
CANVAS = "#f4f4f9"
PANEL = "#eef1fd"


def password_reset_email(name: str, link: str, minutes: int, requested_at: datetime | None = None) -> tuple[str, str]:
    """The password reset email as (plain text, HTML)."""
    when = (requested_at or datetime.now(timezone.utc)).strftime("%d %b %Y, %H:%M UTC")
    first = (name.split() or ["there"])[0]

    text = (
        f"Hi {first},\n\n"
        "We received a request to reset the password for your FormPilot account.\n\n"
        f"Choose a new password here (the link works once and expires in {minutes} minutes):\n{link}\n\n"
        f"Requested: {when}\n\n"
        "If you didn't request this, you can ignore this email. Your password stays the same and no one can change it "
        "without this link.\n\n"
        "FormPilot - your reusable application profile\n"
        "This is an automated message; replies aren't monitored."
    )

    first, safe_link = escape(first), escape(link, quote=True)
    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <title>Reset your FormPilot password</title>
</head>
<body style="margin:0;padding:0;background:{CANVAS};-webkit-text-size-adjust:100%;">
  <!-- Preview text shown next to the subject in the inbox -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Use this secure link to choose a new password. It expires in {minutes} minutes.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{CANVAS};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Brand -->
          <tr>
            <td style="padding:0 4px 20px 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="36" height="36" align="center" valign="middle"
                      style="width:36px;height:36px;background:{NAVY};border-radius:9px;color:{YELLOW};font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;line-height:36px;">F</td>
                  <td style="padding-left:10px;font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:bold;color:{NAVY};letter-spacing:-0.3px;">FormPilot</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border:1px solid {LINE};border-radius:14px;overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td height="5" style="height:5px;line-height:5px;font-size:0;background:{YELLOW};">&nbsp;</td></tr>
                <tr>
                  <td style="padding:36px 40px 8px 40px;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0 0 8px 0;font-size:12px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:{SUBTLE};">Account security</p>
                    <h1 style="margin:0 0 18px 0;font-size:26px;line-height:32px;font-weight:bold;color:{NAVY};">Reset your password</h1>
                    <p style="margin:0 0 14px 0;font-size:16px;line-height:25px;color:{INK};">Hi {first},</p>
                    <p style="margin:0 0 28px 0;font-size:16px;line-height:25px;color:{INK};">
                      We received a request to reset the password for your FormPilot account. Click the button below to choose a new one.
                    </p>
                  </td>
                </tr>

                <!-- Button -->
                <tr>
                  <td style="padding:0 40px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="{NAVY}" style="border-radius:10px;">
                          <a href="{safe_link}" target="_blank"
                             style="display:inline-block;padding:15px 34px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">
                            Reset password &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Details -->
                <tr>
                  <td style="padding:28px 40px 0 40px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{PANEL};border-radius:10px;">
                      <tr>
                        <td style="padding:16px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:{INK};">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="padding:2px 0;color:{MUTED};font-size:14px;font-family:Arial,Helvetica,sans-serif;" width="110">Expires in</td>
                              <td style="padding:2px 0;font-weight:bold;color:{INK};font-size:14px;font-family:Arial,Helvetica,sans-serif;">{minutes} minutes</td>
                            </tr>
                            <tr>
                              <td style="padding:2px 0;color:{MUTED};font-size:14px;font-family:Arial,Helvetica,sans-serif;">Usable</td>
                              <td style="padding:2px 0;font-weight:bold;color:{INK};font-size:14px;font-family:Arial,Helvetica,sans-serif;">Once</td>
                            </tr>
                            <tr>
                              <td style="padding:2px 0;color:{MUTED};font-size:14px;font-family:Arial,Helvetica,sans-serif;">Requested</td>
                              <td style="padding:2px 0;font-weight:bold;color:{INK};font-size:14px;font-family:Arial,Helvetica,sans-serif;">{when}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Fallback link -->
                <tr>
                  <td style="padding:24px 40px 0 40px;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0 0 6px 0;font-size:13px;line-height:20px;color:{MUTED};">Button not working? Copy and paste this link into your browser:</p>
                    <p style="margin:0;font-size:13px;line-height:20px;word-break:break-all;">
                      <a href="{safe_link}" target="_blank" style="color:{NAVY};text-decoration:underline;">{safe_link}</a>
                    </p>
                  </td>
                </tr>

                <!-- Security note -->
                <tr>
                  <td style="padding:28px 40px 36px 40px;font-family:Arial,Helvetica,sans-serif;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid {LINE};">
                      <tr>
                        <td style="padding-top:20px;font-size:14px;line-height:22px;color:{MUTED};">
                          <strong style="color:{INK};">Didn&#39;t request this?</strong> You can safely ignore this email.
                          Your password stays the same, and no one can change it without this link.
                          After you reset it, you&#39;ll be signed out on all other devices.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 16px 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:{SUBTLE};">
              <p style="margin:0 0 4px 0;font-weight:bold;color:{MUTED};">FormPilot &middot; One verified profile for every application</p>
              <p style="margin:0;">This is an automated security email about your account. Replies aren&#39;t monitored.<br>
              FormPilot will never ask for your password by email.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
    return text, html
