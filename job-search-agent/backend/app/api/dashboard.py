"""Dashboard summary metrics (spec §13)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import schemas
from app.database.db import get_session
from app.database.models import Application, Contact, EmailEvent, Job, Outreach
from app.matching import ollama_client

router = APIRouter(prefix="/api", tags=["dashboard"])


def _count(db: Session, stmt) -> int:
    return db.scalar(stmt) or 0


@router.get("/dashboard/summary", response_model=schemas.DashboardSummary)
def summary(db: Session = Depends(get_session)) -> schemas.DashboardSummary:
    return schemas.DashboardSummary(
        total_jobs=_count(db, select(func.count(Job.id))),
        excellent_matches=_count(db, select(func.count(Job.id)).where(Job.match_band == "excellent")),
        strong_matches=_count(db, select(func.count(Job.id)).where(Job.match_band == "strong")),
        moderate_matches=_count(db, select(func.count(Job.id)).where(Job.match_band == "moderate")),
        applications_submitted=_count(
            db, select(func.count(Application.id)).where(Application.application_status == "submitted")
        ),
        recruiters_identified=_count(db, select(func.count(Contact.id))),
        messages_awaiting_approval=_count(
            db, select(func.count(Outreach.id)).where(Outreach.approval_status.in_(["draft", "review"]))
        ),
        interviews_scheduled=_count(
            db, select(func.count(EmailEvent.id)).where(EmailEvent.event_type == "interview")
        ),
        rejections=_count(
            db, select(func.count(EmailEvent.id)).where(EmailEvent.event_type == "rejection")
        ),
        offers_received=_count(
            db, select(func.count(EmailEvent.id)).where(EmailEvent.event_type == "offer")
        ),
    )


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "ollama_available": ollama_client.is_available()}
