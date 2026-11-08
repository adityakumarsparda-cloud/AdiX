"""Load the structured master CV (config/master_cv.yaml) into typed objects.

This is the source of truth for tailored resume generation. The tailor may select
and reorder these items; it must never add, invent or alter their content.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache

import yaml

from app.config import CONFIG_DIR


@dataclass
class Experience:
    company: str
    location: str
    title: str
    dates: str
    bullets: list[str] = field(default_factory=list)


@dataclass
class Education:
    degree: str
    institution: str
    dates: str


@dataclass
class MasterCV:
    name: str
    headline: str
    summary: str
    core_skills: dict[str, list[str]]
    experience: list[Experience]
    education: list[Education]
    publications: list[str]

    def full_text(self) -> str:
        """Every fact in the CV as one lowercase string — used by the numeric guard."""
        parts: list[str] = [self.name, self.headline, self.summary]
        for group, skills in self.core_skills.items():
            parts.append(group)
            parts.extend(skills)
        for e in self.experience:
            parts += [e.company, e.location, e.title, e.dates, *e.bullets]
        for ed in self.education:
            parts += [ed.degree, ed.institution, ed.dates]
        parts += self.publications
        return "\n".join(parts).lower()


@lru_cache(maxsize=1)
def load_master_cv() -> MasterCV:
    path = CONFIG_DIR / "master_cv.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return MasterCV(
        name=data["name"],
        headline=data.get("headline", ""),
        summary=" ".join((data.get("summary") or "").split()),
        core_skills=data.get("core_skills", {}),
        experience=[Experience(**e) for e in data.get("experience", [])],
        education=[Education(**ed) for ed in data.get("education", [])],
        publications=data.get("publications", []),
    )
