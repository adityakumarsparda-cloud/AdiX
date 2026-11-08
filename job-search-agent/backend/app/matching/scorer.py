"""Deterministic weighted job-compatibility scoring (spec §6).

Pure functions — no DB, no network — so they are unit-testable and work with NO LLM.
The LLM (Ollama) is used only to phrase the explanation more naturally; a deterministic
template is used when it is unavailable.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.config import job_preferences


@dataclass
class ScoreBreakdown:
    total: int
    band: str
    parts: dict[str, int] = field(default_factory=dict)
    flags: list[str] = field(default_factory=list)
    rejected: bool = False
    reject_reason: str | None = None
    matched_skills: list[str] = field(default_factory=list)
    missing_skills: list[str] = field(default_factory=list)
    priority: str = "P3"


def _contains_any(text: str, terms: list[str]) -> list[str]:
    hits = []
    low = text.lower()
    for t in terms:
        if t.lower() in low:
            hits.append(t)
    return hits


def _years_required(text: str) -> int | None:
    """Best-effort extract of a minimum years-of-experience requirement."""
    low = text.lower()
    # patterns like "5+ years", "5-7 years", "minimum 6 years"
    m = re.search(r"(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?(?:years|yrs)", low)
    if m:
        return int(m.group(1))
    return None


def score_job(
    title: str,
    description: str,
    location: str | None,
    salary: str | None,
    *,
    skills: list[str] | None = None,
    prefs: dict[str, Any] | None = None,
) -> ScoreBreakdown:
    prefs = prefs or job_preferences()
    skills = skills or _all_candidate_skills(prefs)
    weights = prefs["scoring_weights"]
    text = f"{title}\n{description}"
    low_title = (title or "").lower()

    parts: dict[str, int] = {}

    # 1. Title relevance
    title_terms = [t.lower() for t in prefs.get("target_titles", [])]
    title_hit = any(t in low_title for t in title_terms)
    # partial credit for ops/inventory words in the title
    partial = any(w in low_title for w in ("operations", "inventory", "warehouse", "supply chain", "fulfil", "logistics"))
    parts["title_relevance"] = weights["title_relevance"] if title_hit else (
        int(weights["title_relevance"] * 0.6) if partial else 0
    )

    # 2. Operations experience (keywords present in JD)
    ops_hits = _contains_any(text, prefs.get("operations_keywords", []))
    parts["operations_experience"] = _ratio_points(len(ops_hits), 3, weights["operations_experience"])

    # 3. Industry relevance
    ind_hits = _contains_any(text, prefs.get("target_industries", []))
    # also credit common industry words
    ind_extra = _contains_any(text, ["d2c", "ecommerce", "e-commerce", "fmcg", "retail", "quick commerce", "healthcare"])
    parts["industry_relevance"] = _ratio_points(len(ind_hits) + len(ind_extra), 2, weights["industry_relevance"])

    # 4. Technical skills overlap
    matched_skills = _contains_any(text, skills)
    parts["technical_skills"] = _ratio_points(len(matched_skills), 4, weights["technical_skills"])

    # 5. Inventory / warehouse experience
    inv_hits = _contains_any(text, prefs.get("inventory_warehouse_keywords", []))
    parts["inventory_warehouse_experience"] = _ratio_points(len(inv_hits), 3, weights["inventory_warehouse_experience"])

    # 6. Location preference
    flags: list[str] = []
    loc_pref = [p.lower() for p in prefs.get("preferred_locations", [])]
    loc_low = (location or "").lower()
    is_remote = "remote" in loc_low or "remote" in text.lower()
    if is_remote or any(p in loc_low for p in loc_pref):
        parts["location_preference"] = weights["location_preference"]
    elif not location:
        parts["location_preference"] = int(weights["location_preference"] * 0.5)
    else:
        parts["location_preference"] = 0
        flags.append(f"location outside preferences: {location}")

    # 7. Experience requirements
    yrs = _years_required(text)
    cand_years = prefs.get("candidate_years_experience", 4)
    if yrs is None:
        parts["experience_requirements"] = int(weights["experience_requirements"] * 0.6)
    elif yrs <= cand_years + 2:
        parts["experience_requirements"] = weights["experience_requirements"]
    else:
        parts["experience_requirements"] = 0

    total = sum(parts.values())

    # ---- hard filters ----------------------------------------------------------
    rejected = False
    reject_reason = None
    fcfg = prefs.get("filters", {})

    # Excluded role types: "operations" qualified by an unrelated domain (risk/people/
    # sales/...). Rejected regardless of other signals, even if the title matches.
    excluded = _contains_any(low_title, fcfg.get("exclude_title_keywords", []))
    if excluded:
        rejected = True
        reject_reason = f"excluded role type ({', '.join(excluded)})"

    if not rejected and fcfg.get("reject_unrelated_functions", True):
        bad = _contains_any(low_title, fcfg.get("unrelated_function_keywords", []))
        if bad and not title_hit:
            rejected = True
            reject_reason = f"unrelated function ({', '.join(bad)})"

    max_yrs = fcfg.get("max_years_experience_required")
    if max_yrs and yrs and yrs > max_yrs:
        rejected = True
        reject_reason = f"requires {yrs}+ yrs (> {max_yrs})"

    # salary flag (never auto-reject; spec §6)
    min_sal = fcfg.get("min_salary_lpa")
    if salary and min_sal:
        sal_num = _extract_lpa(salary)
        if sal_num is not None and sal_num < min_sal:
            flags.append(f"salary below floor: {salary}")

    band = _band(total, prefs["bands"])
    missing = [s for s in _priority_skills(prefs) if s.lower() not in text.lower()]
    priority = _priority(total, band, flags)

    return ScoreBreakdown(
        total=total,
        band=band,
        parts=parts,
        flags=flags,
        rejected=rejected,
        reject_reason=reject_reason,
        matched_skills=matched_skills,
        missing_skills=missing[:6],
        priority=priority,
    )


def _ratio_points(hits: int, target: int, weight: int) -> int:
    if hits <= 0:
        return 0
    return min(weight, round(weight * min(hits, target) / target))


def _band(total: int, bands: dict[str, int]) -> str:
    if total >= bands.get("excellent", 85):
        return "excellent"
    if total >= bands.get("strong", 70):
        return "strong"
    if total >= bands.get("moderate", 55):
        return "moderate"
    return "low"


def _priority(total: int, band: str, flags: list[str]) -> str:
    if band == "excellent":
        return "P1"
    if band == "strong":
        return "P2"
    if band == "moderate":
        return "P3"
    return "P4"


def _all_candidate_skills(prefs: dict[str, Any]) -> list[str]:
    # keep scorer independent of candidate.yaml structure: use platform-ish keywords
    base = [
        "shopify", "zoho", "unicommerce", "shiprocket", "amazon", "flipkart",
        "blinkit", "zepto", "swiggy instamart", "excel", "power bi", "sap",
        "inventory", "dispatch", "sla", "sop", "mis", "reconciliation",
    ]
    return base


def _priority_skills(prefs: dict[str, Any]) -> list[str]:
    return [
        "Shopify", "Unicommerce", "Shiprocket", "Zoho", "Power BI",
        "Inventory reconciliation", "Dispatch", "SLA", "Warehouse",
    ]


def _extract_lpa(salary: str) -> float | None:
    """Very rough LPA extraction from a salary string (INR focus)."""
    low = salary.lower().replace(",", "")
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:lpa|lac|lakh|l\b)", low)
    if m:
        return float(m.group(1))
    # crude INR annual -> LPA
    m = re.search(r"(\d{6,})", low)
    if m:
        return round(int(m.group(1)) / 100000, 2)
    return None


# ---- explanation --------------------------------------------------------------

_SYSTEM = (
    "You help a candidate evaluate a job. Use ONLY the facts given. Do not invent "
    "experience, metrics or skills. Be concise and honest about gaps."
)


def build_explanation(title: str, company: str, breakdown: ScoreBreakdown, resume_text: str | None) -> dict[str, Any]:
    """Return the structured explanation (reasons/missing/gap/priority).

    Uses Ollama for a natural 'why it matches' line if available; otherwise a template.
    """
    base = {
        "score": breakdown.total,
        "band": breakdown.band,
        "parts": breakdown.parts,
        "matched_skills": breakdown.matched_skills,
        "missing_skills": breakdown.missing_skills,
        "flags": breakdown.flags,
        "priority": breakdown.priority,
        "rejected": breakdown.rejected,
        "reject_reason": breakdown.reject_reason,
    }

    reason_template = (
        f"{breakdown.band.title()} match ({breakdown.total}/100). "
        f"Matched {len(breakdown.matched_skills)} skill keywords"
        + (f" ({', '.join(breakdown.matched_skills[:5])})" if breakdown.matched_skills else "")
        + ". "
        + ("Missing: " + ", ".join(breakdown.missing_skills) + ". " if breakdown.missing_skills else "")
        + (" ".join(breakdown.flags) if breakdown.flags else "")
    ).strip()

    from app.matching import ollama_client

    llm_reason = None
    if ollama_client.is_available():
        prompt = (
            f"Job title: {title}\nCompany: {company}\n"
            f"Deterministic score: {breakdown.total}/100 ({breakdown.band}).\n"
            f"Matched skills: {', '.join(breakdown.matched_skills) or 'none'}.\n"
            f"Missing skills: {', '.join(breakdown.missing_skills) or 'none'}.\n"
            f"Candidate resume (facts, do not exceed):\n{(resume_text or '')[:2500]}\n\n"
            "In 2-3 sentences, explain why this role does or does not fit the candidate. "
            "Be honest about gaps. Do not claim experience not in the resume."
        )
        llm_reason = ollama_client.generate(prompt, system=_SYSTEM)

    base["why_it_matches"] = llm_reason or reason_template
    base["explanation_source"] = "ollama" if llm_reason else "template"
    return base
