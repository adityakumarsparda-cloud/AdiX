"""Anti-fabrication guard for any LLM-generated prose.

Enforces CLAUDE.md / SECURITY.md: "quantified achievements only when supported by the
CV" and "never fabricate experience, metrics or qualifications".

The guard extracts number-like tokens from generated text and rejects the text if any
number is not literally present in the allowed source (the CV, plus — for cover letters
— the job description, which may legitimately contain its own figures). Reordering and
re-phrasing of existing facts passes; inventing a new metric fails.
"""
from __future__ import annotations

import re

# numbers like 98, 98%, 4.3, 1,600, 2026, 24-48, INR amounts
_NUM_RE = re.compile(r"\d[\d,]*(?:\.\d+)?%?")


def numbers_in(text: str) -> list[str]:
    return [m.group(0).replace(",", "") for m in _NUM_RE.finditer(text or "")]


def is_grounded(generated: str, *allowed_sources: str) -> tuple[bool, list[str]]:
    """Return (ok, offending_numbers). ok=True if every number in `generated` also
    appears in at least one allowed source."""
    allowed_nums = set()
    for src in allowed_sources:
        allowed_nums.update(numbers_in(src))
    offending = [n for n in numbers_in(generated) if n not in allowed_nums]
    return (len(offending) == 0, offending)
