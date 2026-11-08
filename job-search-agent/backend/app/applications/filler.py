"""Application form automation (spec §10) — Phase 6, Playwright.

CRITICAL SAFETY CONTRACT:
  * Fills known fields from the candidate profile only.
  * Uploads the tailored resume.
  * Captures screenshots at each step.
  * STOPS before the final Submit button — the submit is always a human click.
  * Any unknown question is flagged NEEDS_HUMAN; never auto-answered.
  * Never invents salary expectations, notice periods, dates or legal declarations.

This module is a documented interface for Phase 6. The submit function below is a
hard guard that refuses to click submit without an explicit human-approval token.
"""
from __future__ import annotations

from dataclasses import dataclass, field

SUPPORTED_PORTALS = ("greenhouse", "lever", "ashby")


@dataclass
class FormPlan:
    url: str
    portal: str
    mapped_fields: dict[str, str] = field(default_factory=dict)
    unknown_questions: list[str] = field(default_factory=list)
    resume_path: str | None = None
    screenshots: list[str] = field(default_factory=list)
    status: str = "draft"  # draft | needs_human | ready | submitted | failed


def build_plan(url: str, portal: str, profile: dict) -> FormPlan:
    """Phase 6: open the page with Playwright, detect fields, map from `profile`.

    Returns a plan WITHOUT submitting. Unknown questions -> needs_human.
    """
    plan = FormPlan(url=url, portal=portal)
    # TODO(Phase 6): real Playwright field detection + mapping + screenshots.
    plan.status = "draft"
    return plan


def submit(plan: FormPlan, *, human_approval_token: str | None) -> FormPlan:
    """Refuse to submit unless an explicit human-approval token is supplied."""
    if not human_approval_token:
        raise PermissionError(
            "refusing to submit application: human approval required (no token). "
            "The final Submit is always a human action."
        )
    # TODO(Phase 6): click submit via Playwright, capture confirmation screenshot.
    plan.status = "submitted"
    return plan
