"""Candidate onboarding + master-CV upload."""
from __future__ import annotations

import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import DATA_DIR, candidate_config, job_preferences
from app.database import schemas
from app.database.db import get_session
from app.database.models import CandidateProfile
from app.resume.parser import parse_resume

router = APIRouter(prefix="/api/candidate", tags=["candidate"])

RESUME_DIR = DATA_DIR / "resumes"


def _get_or_create(db: Session) -> CandidateProfile:
    profile = db.get(CandidateProfile, 1)
    if profile is None:
        cfg = candidate_config()
        profile = CandidateProfile(
            id=1,
            candidate_information=schemas.dumps(cfg.get("candidate_information")),
            contact_details=schemas.dumps(cfg.get("contact_details")),
            preferences=schemas.dumps(
                {k: job_preferences().get(k) for k in
                 ("target_titles", "target_industries", "preferred_locations")}
            ),
            skills=schemas.dumps(cfg.get("skills")),
        )
        db.add(profile)
        db.commit()
    return profile


def _to_out(p: CandidateProfile) -> schemas.CandidateOut:
    return schemas.CandidateOut(
        id=p.id,
        candidate_information=schemas.loads(p.candidate_information),
        contact_details=schemas.loads(p.contact_details),
        preferences=schemas.loads(p.preferences),
        skills=schemas.loads(p.skills),
        resume_path=p.resume_path,
        has_resume_text=bool(p.resume_text),
        updated_at=p.updated_at,
    )


@router.get("", response_model=schemas.CandidateOut)
def get_candidate(db: Session = Depends(get_session)) -> schemas.CandidateOut:
    return _to_out(_get_or_create(db))


@router.put("", response_model=schemas.CandidateOut)
def update_candidate(
    payload: schemas.CandidateUpdate, db: Session = Depends(get_session)
) -> schemas.CandidateOut:
    p = _get_or_create(db)
    if payload.candidate_information is not None:
        p.candidate_information = schemas.dumps(payload.candidate_information)
    if payload.contact_details is not None:
        p.contact_details = schemas.dumps(payload.contact_details.model_dump())
    if payload.preferences is not None:
        p.preferences = schemas.dumps(payload.preferences)
    if payload.skills is not None:
        p.skills = schemas.dumps(payload.skills)
    db.commit()
    return _to_out(p)


@router.post("/resume", response_model=schemas.CandidateOut)
async def upload_resume(
    file: UploadFile = File(...), db: Session = Depends(get_session)
) -> schemas.CandidateOut:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in (".pdf", ".docx", ".doc", ".txt", ".md"):
        raise HTTPException(400, "Upload a PDF, DOCX, TXT or MD file")
    RESUME_DIR.mkdir(parents=True, exist_ok=True)
    dest = RESUME_DIR / f"master_resume{suffix}"
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    try:
        text = parse_resume(dest)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(422, f"Could not parse resume: {exc}") from exc
    p = _get_or_create(db)
    p.resume_path = str(dest)
    p.resume_text = text
    db.commit()
    return _to_out(p)
