"""Cover-letter generation, grounded in the CV. LLM-refined if Ollama is present,
but any generated prose passes the numeric guard; otherwise a factual template is used.
"""
from __future__ import annotations

from app.resume.guard import is_grounded
from app.resume.structured import load_master_cv

_SYSTEM = (
    "You write a concise, professional cover letter (max 4 short paragraphs). Use ONLY "
    "facts from the candidate's summary and achievements provided. Do NOT invent "
    "numbers, employers, tools or claims. No flattery, no clichés."
)


def _template(cv, company: str, role: str, recruiter: str | None) -> str:
    greeting = f"Dear {recruiter}," if recruiter else "Dear Hiring Team,"
    opener = (
        f"I am writing to apply for the {role} role at {company}. "
        f"I am {cv.name}, {cv.headline.lower()}, and the position aligns closely with my "
        "operations and inventory background."
    )
    # pull two verbatim, high-signal achievements
    achievements = [b for e in cv.experience[:2] for b in e.bullets][:2]
    body = " ".join(achievements)
    close = (
        "I would welcome the chance to discuss how I can support your operations team. "
        "Thank you for your consideration."
    )
    return f"{greeting}\n\n{opener}\n\n{body}\n\n{close}\n\nSincerely,\n{cv.name}"


def generate_cover_letter(
    company: str, role: str, job_description: str, *, recruiter: str | None = None,
    allow_llm: bool = True,
) -> tuple[str, str]:
    """Return (text, source). source in {"template","ollama"}."""
    cv = load_master_cv()
    template = _template(cv, company, role, recruiter)
    if not allow_llm:
        return template, "template"

    from app.matching import ollama_client

    if not ollama_client.is_available():
        return template, "template"

    prompt = (
        f"Company: {company}\nRole: {role}\n"
        f"Candidate: {cv.name} — {cv.headline}\n"
        f"Summary (facts):\n{cv.summary}\n\n"
        f"Achievements (facts, do not exceed):\n"
        + "\n".join(b for e in cv.experience for b in e.bullets)
        + f"\n\nJob description:\n{job_description[:1500]}\n\n"
        "Write the cover letter now."
    )
    out = ollama_client.generate(prompt, system=_SYSTEM)
    if not out:
        return template, "template"
    # Numbers must come from the CV or the job description (JD may list its own figures).
    ok, _offending = is_grounded(out, cv.full_text(), job_description or "")
    if not ok:
        return template, "template"
    return out.strip(), "ollama"
