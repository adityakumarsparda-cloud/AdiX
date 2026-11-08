"""Ashby public job-board API.

GET https://api.ashbyhq.com/posting-api/job-board/{token}?includeCompensation=true
Public, unauthenticated, documented.
"""
from __future__ import annotations

from app.discovery.base import Posting, get_json, html_to_text

API = "https://api.ashbyhq.com/posting-api/job-board/{token}"


def fetch(token: str) -> list[Posting]:
    data = get_json(API.format(token=token), params={"includeCompensation": "true"})
    jobs = data.get("jobs", []) if isinstance(data, dict) else []
    out: list[Posting] = []
    for j in jobs:
        comp = j.get("compensation") or {}
        salary = None
        summary = comp.get("compensationTierSummary") if isinstance(comp, dict) else None
        if summary:
            salary = str(summary)
        out.append(
            Posting(
                source="ashby",
                source_job_id=str(j.get("id")),
                company_name=token,
                job_title=(j.get("title") or "").strip(),
                description=html_to_text(j.get("descriptionHtml")) or (j.get("descriptionPlain") or ""),
                location=j.get("location"),
                work_mode=j.get("employmentType"),
                salary=salary,
                application_url=j.get("applyUrl") or j.get("jobUrl"),
                posted_at=j.get("publishedAt"),
            )
        )
    return out
