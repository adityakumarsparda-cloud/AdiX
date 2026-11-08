"""Outreach message builders (email / WhatsApp link / LinkedIn notes).

Content is grounded in the parsed CV. WhatsApp produces a wa.me deep link only —
no automated delivery. LinkedIn produces copy-ready text only — no automation.
These are DRAFTS; nothing is sent here (see outreach/approval.py).
"""
from __future__ import annotations

from urllib.parse import quote


def whatsapp_deep_link(phone_e164_digits: str, message: str) -> str:
    """Build a wa.me link with prefilled text. phone must be public & digits-only."""
    digits = "".join(ch for ch in phone_e164_digits if ch.isdigit())
    return f"https://wa.me/{digits}?text={quote(message)}"


def email_draft(*, recruiter_name: str | None, company: str, role: str,
                candidate_name: str, summary_line: str) -> dict[str, str]:
    greeting = f"Hi {recruiter_name}," if recruiter_name else f"Hi {company} hiring team,"
    subject = f"Application — {role} ({candidate_name})"
    body = (
        f"{greeting}\n\n"
        f"I'm writing about the {role} role at {company}. {summary_line}\n\n"
        f"My CV is attached. I'd welcome a short call to discuss how I can help your "
        f"operations team. Thank you for your time.\n\n"
        f"Best regards,\n{candidate_name}"
    )
    return {"subject": subject, "body": body}


def linkedin_notes(*, recruiter_name: str | None, company: str, role: str,
                   candidate_name: str) -> dict[str, str]:
    name = recruiter_name or "there"
    connect = (  # LinkedIn invite note cap is ~300 chars
        f"Hi {name}, I came across the {role} opening at {company}. I'm an operations "
        f"and inventory manager with D2C/quick-commerce experience and would love to "
        f"connect. — {candidate_name}"
    )[:300]
    intro = (
        f"Thanks for connecting, {name}. I'm interested in the {role} role at {company}. "
        f"Happy to share how my dispatch/inventory background maps to it whenever suits."
    )
    followup = (
        f"Hi {name}, following up on the {role} role — still keen and happy to send a "
        f"tailored CV or jump on a quick call."
    )
    thanks = (
        f"Thank you for the time, {name}. I appreciated the conversation about {company}'s "
        f"operations and look forward to next steps."
    )
    return {"connection": connect, "intro": intro, "followup": followup, "thank_you": thanks}
