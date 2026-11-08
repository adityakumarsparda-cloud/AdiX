"""Scheduled automation (spec §17) — Phase 7, APScheduler (Asia/Kolkata).

Timetable:
  09:00  discover new jobs
  11:00  score & filter
  13:00  recruiter discovery
  15:00  generate resumes & messages (drafts only)
  17:00  daily digest (jobs + approvals awaiting review)
  every 4h  check job-source updates
  every 2h  check Gmail responses

All jobs record last-run to `scheduler_state`; missed jobs run on startup (catch-up).
This is a documented interface; wiring APScheduler is Phase 7. The functions here are
the callables the scheduler will invoke, each taking a fresh DB session.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.database import schemas
from app.discovery.runner import discover
from app.matching.service import score_pending


def job_discover(db: Session) -> schemas.DiscoverResult:
    return discover(db)


def job_score(db: Session) -> schemas.ScoreResult:
    return score_pending(db)


# TODO(Phase 7): APScheduler setup with cron triggers in Asia/Kolkata, catch-up on
# startup using scheduler_state.last_run_at, and the 17:00 digest builder.
