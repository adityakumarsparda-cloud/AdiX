"""SQLAlchemy ORM models — mirrors DATABASE_SCHEMA.md and spec §12.

JSON-shaped columns are stored as TEXT and (de)serialized by the schemas layer /
helpers, to keep the DB a single portable SQLite file with no extensions.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.db import Base


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(Text, default="")
    source_job_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    company_name: Mapped[str] = mapped_column(Text, default="")
    company_website: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_title: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(Text, nullable=True)
    work_mode: Mapped[str | None] = mapped_column(Text, nullable=True)
    salary: Mapped[str | None] = mapped_column(Text, nullable=True)
    experience_required: Mapped[str | None] = mapped_column(Text, nullable=True)
    required_skills: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list
    application_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    posted_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    deadline: Mapped[str | None] = mapped_column(Text, nullable=True)
    discovered_at: Mapped[str] = mapped_column(Text, default=_utcnow)
    match_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    match_band: Mapped[str | None] = mapped_column(Text, nullable=True)
    match_explanation: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    status: Mapped[str] = mapped_column(Text, default="new")
    dedupe_key: Mapped[str] = mapped_column(Text, unique=True)


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_name: Mapped[str] = mapped_column(Text, default="")
    recruiter_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    designation: Mapped[str | None] = mapped_column(Text, nullable=True)
    email: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone: Mapped[str | None] = mapped_column(Text, nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(Text, nullable=True)
    verification_status: Mapped[str] = mapped_column(Text, default="unverified")
    related_job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"), nullable=True)


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    resume_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_letter_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    application_status: Mapped[str] = mapped_column(Text, default="draft")
    applied_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_followup: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_followup: Mapped[str | None] = mapped_column(Text, nullable=True)
    screenshots: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class Outreach(Base):
    __tablename__ = "outreach"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("contacts.id"), nullable=True)
    channel: Mapped[str] = mapped_column(Text, default="email")
    message_subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    message_content: Mapped[str] = mapped_column(Text, default="")
    approval_status: Mapped[str] = mapped_column(Text, default="draft")
    gmail_draft_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_status: Mapped[str] = mapped_column(Text, default="none")
    created_at: Mapped[str] = mapped_column(Text, default=_utcnow)


class EmailEvent(Base):
    __tablename__ = "email_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int | None] = mapped_column(
        ForeignKey("applications.id"), nullable=True
    )
    gmail_message_id: Mapped[str] = mapped_column(Text, unique=True)
    event_type: Mapped[str] = mapped_column(Text, default="other")
    received_at: Mapped[str] = mapped_column(Text, default=_utcnow)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)


class CandidateProfile(Base):
    __tablename__ = "candidate_profile"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # always 1
    candidate_information: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    contact_details: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    preferences: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    skills: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    resume_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    resume_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[str] = mapped_column(Text, default=_utcnow, onupdate=_utcnow)


class DiscoveryRun(Base):
    __tablename__ = "discovery_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    started_at: Mapped[str] = mapped_column(Text, default=_utcnow)
    finished_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(Text, default="")
    found: Mapped[int] = mapped_column(Integer, default=0)
    new: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class SchedulerState(Base):
    __tablename__ = "scheduler_state"

    job_name: Mapped[str] = mapped_column(Text, primary_key=True)
    last_run_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_status: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_run_at: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (UniqueConstraint("job_name"),)
