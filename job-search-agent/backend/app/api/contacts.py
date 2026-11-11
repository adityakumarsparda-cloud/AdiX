"""Minimal recruiter-contact CRUD (full discovery is Phase 4).

Enforces the public-only / no-guessing policy at the edge: a contact is stored exactly
as given; its verification_status defaults to 'unverified' until confirmed from a public
source. Nothing here invents an address.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.db import get_session
from app.database.models import Contact

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


class ContactIn(BaseModel):
    company_name: str
    recruiter_name: str | None = None
    designation: str | None = None
    email: str | None = None
    phone: str | None = None
    linkedin_url: str | None = None
    source: str | None = None
    verification_status: str = "unverified"  # verified | unverified | unavailable
    related_job_id: int | None = None


class ContactOut(ContactIn):
    id: int


def _out(c: Contact) -> ContactOut:
    return ContactOut(
        id=c.id, company_name=c.company_name, recruiter_name=c.recruiter_name,
        designation=c.designation, email=c.email, phone=c.phone,
        linkedin_url=c.linkedin_url, source=c.source,
        verification_status=c.verification_status, related_job_id=c.related_job_id,
    )


@router.get("", response_model=list[ContactOut])
def list_contacts(
    company: str | None = None, db: Session = Depends(get_session)
) -> list[ContactOut]:
    stmt = select(Contact)
    if company:
        stmt = stmt.where(Contact.company_name.ilike(f"%{company}%"))
    return [_out(c) for c in db.scalars(stmt)]


@router.post("", response_model=ContactOut)
def create_contact(payload: ContactIn, db: Session = Depends(get_session)) -> ContactOut:
    if payload.verification_status not in ("verified", "unverified", "unavailable"):
        raise HTTPException(400, "verification_status must be verified|unverified|unavailable")
    c = Contact(**payload.model_dump())
    db.add(c)
    db.commit()
    return _out(c)
