import os
import logging
import httpx

logger = logging.getLogger(__name__)

SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY")
EMAIL_FROM = os.environ.get("EMAIL_FROM")
SENDGRID_TIMEOUT_SECONDS = int(os.environ.get("SENDGRID_TIMEOUT_SECONDS", "10"))

SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send"


async def send_otp_email(to_email: str, otp: str) -> bool:
    """Sends the OTP email via SendGrid's HTTP API (port 443 — works even
    on hosts like Render that block outbound SMTP ports 25/465/587).
    Returns True/False, never raises, so a failed send never crashes the
    reset flow or leaks whether an email is registered."""
    subject = "Your Finance Tracker password reset code"
    body = (
        f"Your password reset code is: {otp}\n\n"
        f"This code expires in 10 minutes. If you didn't request this, you can ignore this email."
    )

    if not SENDGRID_API_KEY or not EMAIL_FROM:
        # Dev fallback so the flow still works without SendGrid configured.
        print(f"[DEV EMAIL] To: {to_email} | OTP: {otp}")
        return True

    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": EMAIL_FROM},
        "subject": subject,
        "content": [{"type": "text/plain", "value": body}],
    }
    headers = {
        "Authorization": f"Bearer {SENDGRID_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=SENDGRID_TIMEOUT_SECONDS) as client:
            response = await client.post(SENDGRID_URL, json=payload, headers=headers)
        if response.status_code >= 400:
            logger.error(
                "SendGrid rejected OTP email to %s: %s %s",
                to_email, response.status_code, response.text,
            )
            return False
        return True
    except Exception:
        logger.exception("Failed to send OTP email to %s", to_email)
        return False
