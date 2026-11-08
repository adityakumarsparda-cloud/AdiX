"""Jobs: list/filter, discovery trigger, scoring trigger."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import schemas
from app.database.db import get_session
from app.database.models import Job
from app.discovery.runner import discover
from app.matching.service import score_pending

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _to_out(j: Job) -> schemas.JobOut:
    return schemas.JobOut(
        id=j.id,
        source=j.source,
        company_name=j.company_name,
        job_title=j.job_title,
        location=j.location,
        work_mode=j.work_mode,
        salary=j.salary,
        experience_required=j.experience_required,
        application_url=j.application_url,
        posted_at=j.posted_at,
        discovered_at=j.discovered_at,
        match_score=j.match_score,
        match_band=j.match_band,
        match_explanation=schemas.loads(j.match_explanation),
        status=j.status,
    )


@router.get("", response_model=list[schemas.JobOut])
def list_jobs(
    db: Session = Depends(get_session),
    band: str | None = Query(None, description="excellent|strong|moderate|low"),
    status: str | None = None,
    min_score: int | None = None,
    location: str | None = None,
    company: str | None = None,
    limit: int = Query(100, le=500),
) -> list[schemas.JobOut]:
    stmt = select(Job)
    if band:
        stmt = stmt.where(Job.match_band == band)
    if status:
        stmt = stmt.where(Job.status == status)
    if min_score is not None:
        stmt = stmt.where(Job.match_score >= min_score)
    if location:
        stmt = stmt.where(Job.location.ilike(f"%{location}%"))
    if company:
        stmt = stmt.where(Job.company_name.ilike(f"%{company}%"))
    stmt = stmt.order_by(Job.match_score.desc().nullslast(), Job.discovered_at.desc()).limit(limit)
    return [_to_out(j) for j in db.scalars(stmt)]


@router.get("/{job_id}", response_model=schemas.JobOut)
def get_job(job_id: int, db: Session = Depends(get_session)) -> schemas.JobOut:
    from fastapi import HTTPException

    j = db.get(Job, job_id)
    if not j:
        raise HTTPException(404, "job not found")
    return _to_out(j)


@router.post("/discover", response_model=schemas.DiscoverResult)
def run_discovery(db: Session = Depends(get_session)) -> schemas.DiscoverResult:
    """Pull new postings from configured public boards and dedupe into the tracker."""
    return discover(db)


@router.post("/score", response_model=schemas.ScoreResult)
def run_scoring(
    rescore: bool = False, db: Session = Depends(get_session)
) -> schemas.ScoreResult:
    """Score pending (or, with rescore=true, all) jobs against the candidate profile."""
    return score_pending(db, rescore=rescore)
