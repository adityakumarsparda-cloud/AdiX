"""Tailor the master CV to a specific job — by SELECTION and REORDERING only.

No bullet is ever created or edited here: every bullet in the output is copied
verbatim from master_cv.yaml. The job only decides which bullets to emphasise (move
up) and which skills to surface, plus an optionally LLM-refined summary that is still
guarded against fabrication.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.config import job_preferences
from app.resume.guard import is_grounded
from app.resume.structured import Experience, MasterCV, load_master_cv

# Budget to keep the tailored resume to ~one page (most recent role gets the most).
_BULLET_BUDGET = [6, 5, 2, 2, 2]

# Domain/tool vocabulary used to report HONEST gaps: things a JD may require that the
# CV may or may not evidence. Multi-word terms are matched as substrings.
_DOMAIN_VOCAB = [
    "sap", "wms", "erp", "netsuite", "blue yonder", "manhattan", "oracle",
    "six sigma", "lean", "kaizen", "5s", "p&l", "pnl", "procurement",
    "demand planning", "s&op", "sop", "last mile", "cold chain", "gst",
    "import", "export", "customs", "tally", "power bi", "sql", "advanced excel",
    "shopify", "unicommerce", "shiprocket", "zoho", "amazon", "flipkart",
    "blinkit", "zepto", "swiggy", "3pl", "fulfilment", "fulfillment", "inventory",
    "warehouse", "dispatch", "reconciliation", "forecasting", "vendor", "logistics",
    "supply chain", "quick commerce", "d2c", "marketplace", "mis", "sla",
    "stakeholder", "budget", "automation",
]


def _jd_signal_terms(job_text: str) -> set[str]:
    """Terms that matter: preference keywords/skills that actually appear in the JD."""
    prefs = job_preferences()
    candidate_terms = set()
    for key in ("operations_keywords", "inventory_warehouse_keywords"):
        candidate_terms.update(t.lower() for t in prefs.get(key, []))
    # platform/skill terms we know the candidate has
    candidate_terms.update(
        t.lower() for t in
        ["shopify", "zoho", "unicommerce", "shiprocket", "dhl", "amazon", "flipkart",
         "blinkit", "zepto", "swiggy", "excel", "power bi", "mis", "sla", "sop",
         "reconciliation", "dispatch", "inventory", "warehouse", "forecasting",
         "vendor", "logistics", "fulfilment", "fulfillment", "cycle count", "reorder"]
    )
    low = (job_text or "").lower()
    return {t for t in candidate_terms if t in low}


def _rank_bullet(bullet: str, signals: set[str]) -> int:
    low = bullet.lower()
    return sum(1 for s in signals if s in low)


@dataclass
class TailoredExperience:
    company: str
    location: str
    title: str
    dates: str
    bullets: list[str]


@dataclass
class TailoredResume:
    name: str
    headline: str
    summary: str
    summary_source: str  # "master" | "ollama"
    highlighted_skills: list[str]
    core_skills: dict[str, list[str]]
    experience: list[TailoredExperience]
    education: list
    matched_terms: list[str]
    missing_terms: list[str]


_SYSTEM = (
    "You rewrite a professional summary for a specific job. Use ONLY facts in the "
    "provided summary and bullets. Do NOT add numbers, employers, skills or claims that "
    "are not already present. Keep it to 2-3 sentences, third-person-free, factual."
)


def _tailor_summary(cv: MasterCV, job_title: str, job_text: str, allow_llm: bool) -> tuple[str, str]:
    """Return (summary, source). Falls back to the verbatim master summary."""
    if not allow_llm:
        return cv.summary, "master"
    from app.matching import ollama_client

    if not ollama_client.is_available():
        return cv.summary, "master"
    prompt = (
        f"Target role: {job_title}\n\n"
        f"Current summary (do not exceed these facts):\n{cv.summary}\n\n"
        f"Candidate achievements (facts you may reference, do not exceed):\n"
        + "\n".join(b for e in cv.experience for b in e.bullets)
        + f"\n\nJob description:\n{job_text[:1500]}\n\n"
        "Rewrite the summary to emphasise the parts most relevant to the target role. "
        "2-3 sentences. Invent nothing."
    )
    out = ollama_client.generate(prompt, system=_SYSTEM)
    if not out:
        return cv.summary, "master"
    # Guard: every number must already be in the CV.
    ok, _ = is_grounded(out, cv.full_text())
    if not ok:
        return cv.summary, "master"
    return " ".join(out.split()), "ollama"


def tailor_resume(job_title: str, job_description: str, *, allow_llm: bool = True) -> TailoredResume:
    cv = load_master_cv()
    job_text = f"{job_title}\n{job_description}"
    signals = _jd_signal_terms(job_text)

    # Reorder bullets within each role by relevance (stable), then apply the budget.
    tailored_exp: list[TailoredExperience] = []
    for idx, e in enumerate(cv.experience):
        budget = _BULLET_BUDGET[idx] if idx < len(_BULLET_BUDGET) else 2
        ranked = sorted(
            list(enumerate(e.bullets)),
            key=lambda ib: (-_rank_bullet(ib[1], signals), ib[0]),
        )
        chosen = [b for _, b in ranked[:budget]]
        tailored_exp.append(
            TailoredExperience(e.company, e.location, e.title, e.dates, chosen)
        )

    # Surface skills that the JD asks for AND the candidate has.
    all_skills = [s for group in cv.core_skills.values() for s in group]
    highlighted = [s for s in all_skills if any(sig in s.lower() for sig in signals)]

    summary, summary_source = _tailor_summary(cv, job_title, job_text, allow_llm)

    # Honest gap analysis against a domain/tool vocabulary (not generic JD adjectives).
    jd_low = job_text.lower()
    cv_text = cv.full_text()
    matched = sorted(t for t in signals if t)
    missing = sorted({t for t in _DOMAIN_VOCAB if t in jd_low and t not in cv_text})[:8]

    return TailoredResume(
        name=cv.name,
        headline=job_title if _looks_like_ops(job_title) else cv.headline,
        summary=summary,
        summary_source=summary_source,
        highlighted_skills=highlighted,
        core_skills=cv.core_skills,
        experience=tailored_exp,
        education=cv.education,
        matched_terms=matched,
        missing_terms=missing,
    )


def _looks_like_ops(title: str) -> bool:
    low = (title or "").lower()
    return any(w in low for w in ("operation", "inventory", "warehouse", "supply", "fulfil", "logistic"))
