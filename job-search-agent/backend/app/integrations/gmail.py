"""Gmail integration (spec §11).

Scopes (minimal): gmail.compose (drafts/send) + gmail.readonly (monitor responses).
No delete/modify scope. Email is never deleted.

The default and SAFEST action is to create a Gmail *draft* — the user opens Gmail and
presses send. `send_email` creates a draft by default; it only sends when
GMAIL_ALLOW_SEND=1 AND the caller already enforced approval + the daily cap
(outreach/service.send does both).

Requires the google-* libraries (commented in requirements.txt) and a local
credentials.json. Until configured, calls raise a clear, actionable error — nothing
silently "succeeds".
"""
from __future__ import annotations

import base64
import os
from email.mime.text import MIMEText
from pathlib import Path

from app.config import settings

SCOPES = [
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.readonly",
]

# Keyword classifiers for inbound-email event detection (spec §11 / Phase 7).
EVENT_KEYWORDS = {
    "interview": ["interview", "schedule a call", "availability", "meet", "shortlisted"],
    "rejection": ["unfortunately", "not moving forward", "other candidates", "regret"],
    "offer": ["offer", "compensation", "joining date", "offer letter"],
    "assessment": ["assessment", "assignment", "test", "coding challenge", "task"],
    "recruiter_reply": ["your application", "thanks for applying", "received your"],
}


class GmailNotConfigured(RuntimeError):
    pass


def classify(subject: str, snippet: str) -> dict:
    text = f"{subject} {snippet}".lower()
    for event_type, kws in EVENT_KEYWORDS.items():
        if any(k in text for k in kws):
            return {"event_type": event_type, "summary": subject[:140]}
    return {"event_type": "other", "summary": subject[:140]}


def _service():
    """Build an authenticated Gmail API client, or raise GmailNotConfigured."""
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
    except ImportError as exc:  # pragma: no cover
        raise GmailNotConfigured(
            "Gmail libraries not installed. Uncomment the google-* lines in "
            "requirements.txt and `pip install -r requirements.txt`."
        ) from exc

    cred_path = Path(settings().gmail_credentials_path)
    token_path = Path(settings().gmail_token_path)
    creds = None
    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        elif cred_path.exists():
            flow = InstalledAppFlow.from_client_secrets_file(str(cred_path), SCOPES)
            creds = flow.run_local_server(port=0)
            token_path.write_text(creds.to_json(), encoding="utf-8")
        else:
            raise GmailNotConfigured(
                f"No Gmail credentials. Place an OAuth Desktop client at {cred_path} "
                "and run once to authorize (a browser window opens)."
            )
    return build("gmail", "v1", credentials=creds)


def _raw(to: str | None, subject: str, body: str) -> dict:
    mime = MIMEText(body)
    if to:
        mime["To"] = to
    mime["Subject"] = subject
    return {"raw": base64.urlsafe_b64encode(mime.as_bytes()).decode()}


def create_draft(*, to: str | None, subject: str, body: str) -> dict:
    """Create a Gmail draft in the user's account (never sends)."""
    svc = _service()
    draft = svc.users().drafts().create(
        userId="me", body={"message": _raw(to, subject, body)}
    ).execute()
    return {"draft_id": draft.get("id"), "sent": False}


def send_email(*, to: str | None, subject: str, body: str) -> dict:
    """Create a draft by default; only send if GMAIL_ALLOW_SEND=1.

    The caller (outreach.service.send) must have already enforced human approval and the
    daily cap before invoking this.
    """
    svc = _service()
    message = _raw(to, subject, body)
    if os.getenv("GMAIL_ALLOW_SEND") == "1":
        sent = svc.users().messages().send(userId="me", body=message).execute()
        return {"id": sent.get("id"), "sent": True}
    draft = svc.users().drafts().create(userId="me", body={"message": message}).execute()
    return {"id": draft.get("id"), "sent": False,
            "note": "Draft created in Gmail. Open Gmail and press send, or set "
                    "GMAIL_ALLOW_SEND=1 to let an approved message send via the API."}
