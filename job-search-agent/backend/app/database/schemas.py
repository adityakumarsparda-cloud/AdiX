"""Pydantic schemas for API I/O, plus JSON (de)serialization helpers."""
from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel


def dumps(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False)


def loads(value: str | None) -> Any:
    if not value:
        return None
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return None


# ---- Candidate ----------------------------------------------------------------

class ContactDetails(BaseModel):
    email: str = ""
    phone: str = ""
    linkedin_url: str = ""
    location: str = ""


class CandidateUpdate(BaseModel):
    candidate_information: dict[str, Any] | None = None
    contact_details: ContactDetails | None = None
    preferences: dict[str, Any] | None = None
    skills: dict[str, Any] | None = None


class CandidateOut(BaseModel):
    id: int
    candidate_information: dict[str, Any] | None = None
    contact_details: dict[str, Any] | None = None
    preferences: dict[str, Any] | None = None
    skills: dict[str, Any] | None = None
    resume_path: str | None = None
    has_resume_text: bool = False
    updated_at: str | None = None


# ---- Jobs ---------------------------------------------------------------------

class JobOut(BaseModel):
    id: int
    source: str
    company_name: str
    job_title: str
    location: str | None = None
    work_mode: str | None = None
    salary: str | None = None
    experience_required: str | None = None
    application_url: str | None = None
    posted_at: str | None = None
    discovered_at: str
    match_score: int | None = None
    match_band: str | None = None
    match_explanation: dict[str, Any] | None = None
    status: str


class DiscoverResult(BaseModel):
    source_tokens: dict[str, list[str]]
    found: int
    inserted: int
    duplicates: int
    errors: list[str] = []


class ScoreResult(BaseModel):
    scored: int
    bands: dict[str, int]


# ---- Dashboard ----------------------------------------------------------------

class DashboardSummary(BaseModel):
    total_jobs: int
    excellent_matches: int
    strong_matches: int
    moderate_matches: int
    applications_submitted: int
    recruiters_identified: int
    messages_awaiting_approval: int
    interviews_scheduled: int
    rejections: int
    offers_received: int
