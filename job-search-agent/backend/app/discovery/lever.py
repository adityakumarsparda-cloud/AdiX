"""Lever public postings API.

GET https://api.lever.co/v0/postings/{token}?mode=json
Public, unauthenticated, documented.
"""
from __future__ import annotations

from app.discovery.base import Posting, get_json, html_to_text

API = "https://api.lever.co/v0/postings/{token}"


def fetch(token: str) -> list[Posting]:
    data = get_json(API.format(token=token), params={"mode": "json"})
    if not isinstance(data, list):
        return []
    out: list[Posting] = []
    for j in data:
        categories = j.get("categories") or {}
        out.append(
            Posting(
                source="lever",
                source_job_id=str(j.get("id")),
                company_name=token,
                job_title=(j.get("text") or "").strip(),
                description=html_to_text(j.get("description")) or (j.get("descriptionPlain") or ""),
                location=categories.get("location"),
                work_mode=categories.get("commitment"),
                application_url=j.get("hostedUrl") or j.get("applyUrl"),
                posted_at=_ms_to_iso(j.get("createdAt")),
            )
        )
    return out


def _ms_to_iso(ms: int | None) -> str | None:
    if not ms:
        return None
    from datetime import datetime, timezone

    try:
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat()
    except (ValueError, OSError, TypeError):
        return None
