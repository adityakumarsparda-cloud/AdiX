"""Greenhouse public job-board API.

GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
Public, unauthenticated, documented. No scraping, no auth bypass.
"""
from __future__ import annotations

from app.discovery.base import Posting, get_json, html_to_text

API = "https://boards-api.greenhouse.io/v1/boards/{token}/jobs"


def fetch(token: str) -> list[Posting]:
    data = get_json(API.format(token=token), params={"content": "true"})
    jobs = data.get("jobs", []) if isinstance(data, dict) else []
    out: list[Posting] = []
    for j in jobs:
        out.append(
            Posting(
                source="greenhouse",
                source_job_id=f"{token}:{j.get('id')}",
                company_name=(j.get("company_name") or token).strip(),
                job_title=(j.get("title") or "").strip(),
                description=html_to_text(j.get("content")),
                location=(j.get("location") or {}).get("name"),
                application_url=j.get("absolute_url"),
                posted_at=j.get("updated_at") or j.get("first_published"),
            )
        )
    return out
