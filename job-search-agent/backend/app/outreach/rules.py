"""Enforce outreach rules before an email can be approved/sent.

Inherited from ../../outreach/Outreach_Tracker.xlsx. These are checked in code, not left
to good intentions:
  * Max N new outreach emails per day.
  * Never contact a Do-Not-Contact company / email / domain.
  * Never email the same person twice for the same role without a reply.
  * Only email a verified address.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import outreach_rules
from app.database.models import Contact, Outreach


class RuleViolation(RuntimeError):
    pass


def _rules() -> dict:
    return outreach_rules()


def is_do_not_contact(*, company: str | None = None, email: str | None = None) -> str | None:
    """Return a reason string if blocked, else None."""
    dnc = _rules().get("do_not_contact", {}) or {}
    if company:
        for c in dnc.get("companies", []) or []:
            if c and c.lower() in company.lower():
                return f"company on Do-Not-Contact list ({c})"
    if email:
        low = email.lower()
        if low in {e.lower() for e in (dnc.get("emails", []) or [])}:
            return "email on Do-Not-Contact list"
        domain = low.split("@")[-1]
        if domain in {d.lower() for d in (dnc.get("domains", []) or [])}:
            return f"domain on Do-Not-Contact list ({domain})"
    return None


def emails_sent_today(db: Session) -> int:
    today = datetime.now(timezone.utc).date().isoformat()
    stmt = (
        select(func.count(Outreach.id))
        .where(Outreach.channel == "email")
        .where(Outreach.sent_at.is_not(None))
        .where(Outreach.sent_at >= today)
    )
    return db.scalar(stmt) or 0


def daily_cap_remaining(db: Session) -> int:
    cap = int(_rules().get("daily_email_cap", 20))
    return max(0, cap - emails_sent_today(db))


def already_emailed(db: Session, *, job_id: int, contact_id: int | None) -> bool:
    """True if there's already an email outreach for this job+contact without a reply."""
    if not _rules().get("no_duplicate_outreach", True):
        return False
    if contact_id is None:
        return False
    stmt = (
        select(func.count(Outreach.id))
        .where(Outreach.channel == "email")
        .where(Outreach.job_id == job_id)
        .where(Outreach.contact_id == contact_id)
        .where(Outreach.response_status.in_(["none", "no_response"]))
    )
    return (db.scalar(stmt) or 0) > 0


def assert_can_email(db: Session, *, job_id: int, company: str | None,
                     contact: Contact | None) -> None:
    """Raise RuleViolation if an email to this contact would break a rule.

    Does NOT check the daily cap here (that is checked at SEND time, since a draft is
    allowed even when the cap for today is reached — it just can't be sent yet)."""
    email = contact.email if contact else None
    reason = is_do_not_contact(company=company, email=email)
    if reason:
        raise RuleViolation(reason)

    if _rules().get("require_verified_email", True) and contact is not None:
        if contact.email and contact.verification_status != "verified":
            raise RuleViolation("email address is not verified (a bounce is a spam signal)")

    if already_emailed(db, job_id=job_id, contact_id=contact.id if contact else None):
        raise RuleViolation("already emailed this contact for this role without a reply")


def assert_can_send_now(db: Session) -> None:
    """Raise if sending another email now would exceed the daily cap."""
    if daily_cap_remaining(db) <= 0:
        cap = int(_rules().get("daily_email_cap", 20))
        raise RuleViolation(f"daily email cap reached ({cap}/day) — try again tomorrow")
