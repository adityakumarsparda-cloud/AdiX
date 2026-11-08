"""Recruiter discovery — PUBLIC sources only (spec §7).

Phase 4. Collects HR/recruitment contacts ONLY where the company itself publishes
them (career page, contact page, recruiter name in the JD). Never guesses emails.
Never uses Apollo or any paid recruiter database.

Verification status: 'verified' (confirmed public source), 'unverified' (name only),
'unavailable' (no public contact — save the career page instead).
"""
from __future__ import annotations

import re
from dataclasses import dataclass

# Conservative: only accept an email if the page literally publishes it.
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

RECRUITER_TITLES = [
    "Talent Acquisition Manager", "HR Manager", "Recruitment Manager",
    "Senior HR Executive", "Talent Acquisition Specialist",
    "Operations Hiring Manager", "Warehouse Hiring Manager",
]


@dataclass
class RecruiterContact:
    company_name: str
    recruiter_name: str | None = None
    designation: str | None = None
    email: str | None = None
    phone: str | None = None
    linkedin_url: str | None = None
    source: str | None = None
    verification_status: str = "unavailable"


def extract_public_emails(page_text: str) -> list[str]:
    """Return emails literally present on a company page (deduped, lowercased)."""
    return sorted({m.group(0).lower() for m in _EMAIL_RE.finditer(page_text or "")})


def from_career_page(company: str, page_text: str, page_url: str) -> RecruiterContact:
    """Build a contact from a company's own page. No guessing."""
    emails = extract_public_emails(page_text)
    if emails:
        # prefer careers/jobs/hr style mailboxes
        preferred = next(
            (e for e in emails if any(k in e for k in ("career", "job", "hr", "talent", "recruit"))),
            emails[0],
        )
        return RecruiterContact(
            company_name=company, email=preferred, source=page_url,
            verification_status="verified",
        )
    return RecruiterContact(company_name=company, source=page_url, verification_status="unavailable")


# TODO(Phase 4): fetch career/contact pages (httpx + Playwright for JS), persist to
# `contacts`, surface in the dashboard. Respect robots and the Do-Not-Contact list.
