import os
import smtplib
import logging
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER)
SMTP_TIMEOUT_SECONDS = int(os.environ.get("SMTP_TIMEOUT_SECONDS", "10"))


def send_otp_email(to_email: str, otp: str) -> bool:
    """Sends the OTP email. Returns True/False, never raises — a broken
    mail server should never crash the reset flow or leak whether an
    email is registered via an error response."""
    subject = "Your Finance Tracker password reset code"
    body = (
        f"Your password reset code is: {otp}\n\n"
        f"This code expires in 10 minutes. If you didn't request this, you can ignore this email."
    )

    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[DEV EMAIL] To: {to_email} | OTP: {otp}")
        return True

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to_email

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, [to_email], msg.as_string())
        return True
    except Exception:
        logger.exception("Failed to send OTP email to %s", to_email)
        return False
