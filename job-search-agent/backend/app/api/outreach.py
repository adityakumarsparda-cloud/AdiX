"""Outreach approval queue (spec §9 / §13).

Generate drafts, review the queue, approve/reject, and send — with the human-approval
gate and inherited rules enforced in the service layer.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.db import get_session
from app.database.models import Outreach
from app.outreach import approval, service
from app.outreach.rules import RuleViolation

router = APIRouter(prefix="/api/outreach", tags=["outreach"])


@router.post("/generate")
def generate(
    job_id: int,
    channel: str = Query(..., description="email | whatsapp | linkedin"),
    contact_id: int | None = None,
    db: Session = Depends(get_session),
) -> dict:
    try:
        row = service.generate(db, job_id, channel, contact_id=contact_id)
    except RuleViolation as exc:
        raise HTTPException(409, f"rule blocked: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    return service.detail(db, row)


@router.get("")
def list_outreach(
    status: str | None = Query(None, description="draft|review|approved|sent|rejected|..."),
    channel: str | None = None,
    db: Session = Depends(get_session),
) -> list[dict]:
    stmt = select(Outreach).order_by(Outreach.created_at.desc())
    if status:
        stmt = stmt.where(Outreach.approval_status == status)
    if channel:
        stmt = stmt.where(Outreach.channel == channel)
    return [service.detail(db, r) for r in db.scalars(stmt)]


@router.get("/queue")
def pending_queue(db: Session = Depends(get_session)) -> list[dict]:
    """Everything awaiting a human decision (draft or review)."""
    stmt = select(Outreach).where(
        Outreach.approval_status.in_([approval.DRAFT, approval.REVIEW])
    ).order_by(Outreach.created_at.desc())
    return [service.detail(db, r) for r in db.scalars(stmt)]


@router.get("/{outreach_id}")
def get_one(outreach_id: int, db: Session = Depends(get_session)) -> dict:
    row = db.get(Outreach, outreach_id)
    if not row:
        raise HTTPException(404, "outreach not found")
    return service.detail(db, row)


def _transition(outreach_id: int, target: str, db: Session) -> dict:
    try:
        row = service.set_status(db, outreach_id, target)
    except approval.ApprovalError as exc:
        raise HTTPException(409, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    return service.detail(db, row)


@router.post("/{outreach_id}/review")
def submit_for_review(outreach_id: int, db: Session = Depends(get_session)) -> dict:
    return _transition(outreach_id, approval.REVIEW, db)


@router.post("/{outreach_id}/approve")
def approve(outreach_id: int, db: Session = Depends(get_session)) -> dict:
    return _transition(outreach_id, approval.APPROVED, db)


@router.post("/{outreach_id}/reject")
def reject(outreach_id: int, db: Session = Depends(get_session)) -> dict:
    return _transition(outreach_id, approval.REJECTED, db)


@router.post("/{outreach_id}/send")
def send(outreach_id: int, db: Session = Depends(get_session)) -> dict:
    """Dispatch an APPROVED item. Email -> Gmail (draft/send); WhatsApp/LinkedIn ->
    recorded as manually sent. Blocked unless approved + within the daily cap."""
    from app.integrations.gmail import GmailNotConfigured

    try:
        return service.send(db, outreach_id)
    except approval.ApprovalError as exc:
        raise HTTPException(409, str(exc)) from exc
    except RuleViolation as exc:
        raise HTTPException(409, f"rule blocked: {exc}") from exc
    except GmailNotConfigured as exc:
        raise HTTPException(503, f"Gmail not configured: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
