"""Generate tailored application documents for a job and record them.

Writes to data/tailored/ (never touches the master CV in data/resumes/). Creates or
updates the Application row for the job with the resume + cover-letter paths.
"""
from __future__ import annotations

import re
from dataclasses import asdict
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import DATA_DIR, candidate_config
from app.database import schemas
from app.database.models import Application, CandidateProfile, Job
from app.resume.cover_letter import generate_cover_letter
from app.resume.render_docx import render_docx
from app.resume.render_pdf import render_pdf
from app.resume.tailor import tailor_resume

TAILORED_DIR = DATA_DIR / "tailored"


def _slug(*parts: str) -> str:
    base = "_".join(parts)
    return re.sub(r"[^a-z0-9]+", "_", base.lower()).strip("_")[:80]


def _contact(db: Session) -> dict:
    """Contact details for the resume header — from onboarding (DB), name from config."""
    profile = db.get(CandidateProfile, 1)
    details = schemas.loads(profile.contact_details) if profile and profile.contact_details else {}
    details = details or {}
    name = (candidate_config().get("candidate_information") or {}).get("name", "")
    details.setdefault("name", name)
    return details


def generate_for_job(db: Session, job_id: int, *, allow_llm: bool = True) -> dict:
    job = db.get(Job, job_id)
    if not job:
        raise ValueError(f"job {job_id} not found")

    resume = tailor_resume(job.job_title or "", job.description or "", allow_llm=allow_llm)
    contact = _contact(db)

    slug = _slug(job.company_name or "company", job.job_title or "role")
    folder = TAILORED_DIR / slug
    pdf_path = folder / f"{slug}_resume.pdf"
    docx_path = folder / f"{slug}_resume.docx"
    cover_path = folder / f"{slug}_cover_letter.txt"

    render_pdf(resume, contact, pdf_path)
    render_docx(resume, contact, docx_path)

    cover_text, cover_source = generate_cover_letter(
        job.company_name or "", job.job_title or "", job.description or "",
        allow_llm=allow_llm,
    )
    folder.mkdir(parents=True, exist_ok=True)
    cover_path.write_text(cover_text, encoding="utf-8")

    # upsert Application
    app_row = db.scalar(select(Application).where(Application.job_id == job_id))
    if not app_row:
        app_row = Application(job_id=job_id)
        db.add(app_row)
    app_row.resume_path = str(pdf_path)
    app_row.cover_letter_path = str(cover_path)
    if app_row.application_status in (None, "draft"):
        app_row.application_status = "draft"
    db.commit()

    return {
        "job_id": job_id,
        "resume_pdf": str(pdf_path),
        "resume_docx": str(docx_path),
        "cover_letter": str(cover_path),
        "summary_source": resume.summary_source,
        "cover_letter_source": cover_source,
        "highlighted_skills": resume.highlighted_skills,
        "matched_terms": resume.matched_terms,
        "missing_terms": resume.missing_terms,
        "bullets_selected": sum(len(e.bullets) for e in resume.experience),
        "note": "Grounded in your master CV. No content was invented. Review before sending.",
    }
