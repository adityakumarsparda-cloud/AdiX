"""Generate and manage outreach drafts across channels, behind the approval gate.

Flow per message: DRAFT -> REVIEW -> APPROVED -> SENT (see outreach/approval.py).
Email can only be APPROVED if it passes the inherited rules (outreach/rules.py), and can
only be SENT if the daily cap allows. WhatsApp/LinkedIn are never auto-sent — "send"
for them only records that you sent it manually.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import candidate_config
from app.database import schemas
from app.database.models import Contact, Job, Outreach
from app.outreach import approval, rules
from app.outreach.messages import email_draft, linkedin_notes, whatsapp_deep_link
from app.resume.structured import load_master_cv


def _candidate_name() -> str:
    return (candidate_config().get("candidate_information") or {}).get("name", "")


def _summary_line() -> str:
    """One grounded sentence from the CV summary (no fabrication)."""
    summary = load_master_cv().summary
    first = summary.split(". ")[0].strip()
    return first if first.endswith(".") else first + "."


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def generate(db: Session, job_id: int, channel: str, *, contact_id: int | None = None) -> Outreach:
    """Create one outreach draft for a job on a channel. Raises RuleViolation/ValueError."""
    job = db.get(Job, job_id)
    if not job:
        raise ValueError(f"job {job_id} not found")
    if channel not in ("email", "whatsapp", "linkedin"):
        raise ValueError(f"unknown channel: {channel}")

    contact = db.get(Contact, contact_id) if contact_id else None
    name = _candidate_name()

    if channel == "email":
        # enforce rules before even drafting an email
        rules.assert_can_email(db, job_id=job_id, company=job.company_name, contact=contact)
        msg = email_draft(
            recruiter_name=contact.recruiter_name if contact else None,
            company=job.company_name,
            role=job.job_title,
            candidate_name=name,
            summary_line=_summary_line(),
        )
        row = Outreach(
            job_id=job_id, contact_id=contact_id, channel="email",
            message_subject=msg["subject"], message_content=msg["body"],
            approval_status=approval.DRAFT,
        )
    elif channel == "whatsapp":
        phone = contact.phone if contact else None
        if not phone:
            # no public number -> record as unavailable, never guessed
            row = Outreach(
                job_id=job_id, contact_id=contact_id, channel="whatsapp",
                message_content="(no public WhatsApp number available for this contact)",
                approval_status=approval.PENDING, response_status="none",
            )
        else:
            text = (
                f"Hi {contact.recruiter_name or ''}, I'm {name}. I came across the "
                f"{job.job_title} role at {job.company_name} and would love to share how my "
                f"operations and inventory background fits. Could we connect?"
            ).replace("  ", " ")
            row = Outreach(
                job_id=job_id, contact_id=contact_id, channel="whatsapp",
                message_content=text, approval_status=approval.DRAFT,
            )
    else:  # linkedin
        notes = linkedin_notes(
            recruiter_name=contact.recruiter_name if contact else None,
            company=job.company_name, role=job.job_title, candidate_name=name,
        )
        row = Outreach(
            job_id=job_id, contact_id=contact_id, channel="linkedin",
            message_content=schemas.dumps(notes), approval_status=approval.DRAFT,
        )

    db.add(row)
    db.commit()
    return row


def set_status(db: Session, outreach_id: int, target: str) -> Outreach:
    """Apply an approval transition (validated by the state machine)."""
    row = db.get(Outreach, outreach_id)
    if not row:
        raise ValueError(f"outreach {outreach_id} not found")
    row.approval_status = approval.transition(row.approval_status, target)
    db.commit()
    return row


def send(db: Session, outreach_id: int) -> dict:
    """Dispatch an APPROVED outreach.

    Email: create/send via Gmail (if configured) — hard-gated on approval + daily cap.
    WhatsApp/LinkedIn: we never send; this only records that YOU sent it manually.
    """
    row = db.get(Outreach, outreach_id)
    if not row:
        raise ValueError(f"outreach {outreach_id} not found")

    approval.assert_dispatchable(row.approval_status)  # must be APPROVED

    if row.channel == "email":
        rules.assert_can_send_now(db)  # daily cap
        from app.integrations import gmail

        contact = db.get(Contact, row.contact_id) if row.contact_id else None
        to_addr = contact.email if contact else None
        result = gmail.send_email(
            to=to_addr, subject=row.message_subject or "", body=row.message_content
        )
        row.gmail_draft_id = result.get("id")
        row.approval_status = approval.transition(row.approval_status, approval.SENT)
        row.sent_at = _now()
        db.commit()
        return {"sent": True, "channel": "email", "gmail": result}

    # manual channels: mark sent, take no external action
    row.approval_status = approval.transition(row.approval_status, approval.SENT)
    row.sent_at = _now()
    db.commit()
    return {"sent": True, "channel": row.channel, "note": "recorded as manually sent"}


def detail(db: Session, row: Outreach) -> dict:
    """Serialize an outreach row with channel-specific conveniences."""
    out: dict = {
        "id": row.id,
        "job_id": row.job_id,
        "contact_id": row.contact_id,
        "channel": row.channel,
        "approval_status": row.approval_status,
        "message_subject": row.message_subject,
        "message_content": row.message_content,
        "sent_at": row.sent_at,
        "response_status": row.response_status,
        "created_at": row.created_at,
    }
    contact = db.get(Contact, row.contact_id) if row.contact_id else None
    if row.channel == "whatsapp" and contact and contact.phone:
        out["whatsapp_link"] = whatsapp_deep_link(contact.phone, row.message_content)
    if row.channel == "linkedin":
        out["linkedin_variants"] = schemas.loads(row.message_content)
        out["linkedin_profile"] = contact.linkedin_url if contact else None
    return out
