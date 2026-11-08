"""Common types and helpers for discovery connectors."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

import httpx

USER_AGENT = "job-search-agent/0.1 (+local; personal job search)"
TIMEOUT = httpx.Timeout(20.0)


@dataclass
class Posting:
    """A normalized job posting from any source."""

    source: str
    source_job_id: str
    company_name: str
    job_title: str
    description: str = ""
    location: str | None = None
    work_mode: str | None = None
    salary: str | None = None
    experience_required: str | None = None
    required_skills: list[str] = field(default_factory=list)
    application_url: str | None = None
    company_website: str | None = None
    posted_at: str | None = None
    deadline: str | None = None

    @property
    def dedupe_key(self) -> str:
        if self.source and self.source_job_id:
            return f"{self.source}:{self.source_job_id}"
        return fallback_dedupe_key(self.company_name, self.job_title, self.application_url)


_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"[ \t]+")


def html_to_text(html: str | None) -> str:
    if not html:
        return ""
    import html as _html

    text = _TAG_RE.sub(" ", html)
    text = _html.unescape(text)
    text = _WS_RE.sub(" ", text)
    lines = [ln.strip() for ln in text.splitlines()]
    return "\n".join(ln for ln in lines if ln).strip()


def _slug(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def fallback_dedupe_key(company: str, title: str, url: str | None) -> str:
    host = ""
    if url:
        m = re.search(r"https?://([^/]+)/?", url)
        host = m.group(1).lower() if m else ""
    return f"{_slug(company)}|{_slug(title)}|{host}"


def get_json(url: str, params: dict | None = None) -> object:
    """GET JSON with a short timeout and a polite User-Agent."""
    with httpx.Client(timeout=TIMEOUT, headers={"User-Agent": USER_AGENT}) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()
