import os
import smtplib
from email.mime.text import MIMEText

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER)


def send_otp_email(to_email: str, otp: str) -> None:
    subject = "Your Finance Tracker password reset code"
    body = (
        f"Your password reset code is: {otp}\n\n"
        f"This code expires in 10 minutes. If you didn't request this, you can ignore this email."
    )

    if not SMTP_USER or not SMTP_PASSWORD:
        # Dev fallback so the flow still works without SMTP configured.
        print(f"[DEV EMAIL] To: {to_email} | OTP: {otp}")
        return

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to_email

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM, [to_email], msg.as_string())
