"""Gmail integration (spec §11) — Phase 5/7.

Scopes (minimal):
  * https://www.googleapis.com/auth/gmail.compose   (create drafts)
  * https://www.googleapis.com/auth/gmail.readonly   (monitor responses)
No delete/modify scope. Email is never deleted. Send happens ONLY after approval.

This is a documented interface. The google-* libraries are commented in
requirements.txt; uncomment and wire OAuth to activate. Until then these raise a
clear NotImplemented so nothing silently "succeeds".
"""
from __future__ import annotations

from dataclasses import dataclass

SCOPES = [
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.readonly",
]

# Keyword classifiers for inbound-email event detection (spec §11).
EVENT_KEYWORDS = {
    "interview": ["interview", "schedule a call", "availability", "meet", "shortlisted"],
    "rejection": ["unfortunately", "not moving forward", "other candidates", "regret"],
    "offer": ["offer", "compensation", "joining date", "offer letter"],
    "assessment": ["assessment", "assignment", "test", "coding challenge", "task"],
    "recruiter_reply": ["your application", "thanks for applying", "received your"],
}


@dataclass
class EmailEventGuess:
    event_type: str
    summary: str


def classify(subject: str, snippet: str) -> EmailEventGuess:
    text = f"{subject} {snippet}".lower()
    for event_type, kws in EVENT_KEYWORDS.items():
        if any(k in text for k in kws):
            return EmailEventGuess(event_type=event_type, summary=subject[:140])
    return EmailEventGuess(event_type="other", summary=subject[:140])


def create_draft(*args, **kwargs):  # pragma: no cover - Phase 5
    raise NotImplementedError(
        "Gmail OAuth not wired yet. Uncomment google-* in requirements.txt and add "
        "credentials.json, then implement draft creation. Drafts are never auto-sent."
    )


def create_and_send(*args, **kwargs):  # pragma: no cover
    raise NotImplementedError(
        "Direct send is intentionally not provided. Send only a human-APPROVED draft "
        "via the approval queue."
    )
