"""Run discovery across configured sources and persist new postings (deduped)."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import sources_config
from app.database import schemas
from app.database.models import DiscoveryRun, Job
from app.discovery import ashby, greenhouse, lever
from app.discovery.base import Posting

_CONNECTORS = {
    "greenhouse": greenhouse.fetch,
    "lever": lever.fetch,
    "ashby": ashby.fetch,
}


def _keyword_match(posting: Posting, keywords: list[str]) -> bool:
    if not keywords:
        return True
    haystack = f"{posting.job_title} {posting.description}".lower()
    return any(k.lower() in haystack for k in keywords)


def _persist(db: Session, posting: Posting) -> bool:
    """Insert if the dedupe_key is new. Returns True if inserted."""
    exists = db.scalar(select(Job.id).where(Job.dedupe_key == posting.dedupe_key))
    if exists:
        return False
    job = Job(
        source=posting.source,
        source_job_id=posting.source_job_id,
        company_name=posting.company_name,
        company_website=posting.company_website,
        job_title=posting.job_title,
        description=posting.description,
        location=posting.location,
        work_mode=posting.work_mode,
        salary=posting.salary,
        experience_required=posting.experience_required,
        required_skills=schemas.dumps(posting.required_skills),
        application_url=posting.application_url,
        posted_at=posting.posted_at,
        deadline=posting.deadline,
        dedupe_key=posting.dedupe_key,
        status="new",
    )
    db.add(job)
    return True


def discover(db: Session) -> schemas.DiscoverResult:
    cfg = sources_config()
    keywords = cfg.get("discovery_keywords", [])
    source_tokens = {
        "greenhouse": (cfg.get("greenhouse") or {}).get("tokens", []),
        "lever": (cfg.get("lever") or {}).get("tokens", []),
        "ashby": (cfg.get("ashby") or {}).get("tokens", []),
    }

    found = inserted = duplicates = 0
    errors: list[str] = []

    for source, tokens in source_tokens.items():
        fetch = _CONNECTORS[source]
        for token in tokens:
            run = DiscoveryRun(source=f"{source}:{token}")
            db.add(run)
            db.flush()
            try:
                postings = fetch(token)
                run.found = len(postings)
                new_here = 0
                for p in postings:
                    if not _keyword_match(p, keywords):
                        continue
                    found += 1
                    if _persist(db, p):
                        inserted += 1
                        new_here += 1
                    else:
                        duplicates += 1
                run.new = new_here
            except Exception as exc:  # noqa: BLE001 — record, keep going
                msg = f"{source}:{token}: {type(exc).__name__}: {exc}"
                errors.append(msg)
                run.error = msg
            finally:
                run.finished_at = datetime.now(timezone.utc).isoformat()
        db.commit()

    return schemas.DiscoverResult(
        source_tokens=source_tokens,
        found=found,
        inserted=inserted,
        duplicates=duplicates,
        errors=errors,
    )
