"""Apply the scorer to jobs in the DB and persist results."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import schemas
from app.database.models import CandidateProfile, Job
from app.matching.scorer import build_explanation, score_job


def score_pending(db: Session, *, rescore: bool = False) -> schemas.ScoreResult:
    profile = db.get(CandidateProfile, 1)
    resume_text = profile.resume_text if profile else None

    stmt = select(Job)
    if not rescore:
        stmt = stmt.where(Job.match_score.is_(None))
    jobs = list(db.scalars(stmt))

    bands = {"excellent": 0, "strong": 0, "moderate": 0, "low": 0}
    for job in jobs:
        breakdown = score_job(
            job.job_title or "",
            job.description or "",
            job.location,
            job.salary,
        )
        explanation = build_explanation(
            job.job_title or "", job.company_name or "", breakdown, resume_text
        )
        job.match_score = breakdown.total
        job.match_band = breakdown.band
        job.match_explanation = schemas.dumps(explanation)
        if breakdown.rejected:
            job.status = "rejected"
        elif job.status == "new":
            job.status = "shortlisted" if breakdown.band in ("excellent", "strong") else "new"
        bands[breakdown.band] += 1

    db.commit()
    return schemas.ScoreResult(scored=len(jobs), bands=bands)
