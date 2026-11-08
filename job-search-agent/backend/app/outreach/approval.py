"""Outreach approval state machine (spec §9) — the hard human-in-the-loop gate.

DRAFT -> REVIEW -> APPROVED -> SENT -> RESPONSE
Plus: REJECTED, FAILED, PENDING, FOLLOWUP_REQUIRED.

Dispatch code MUST call `assert_dispatchable()` before sending anything. A message is
dispatchable only when a human has moved it to APPROVED.
"""
from __future__ import annotations

DRAFT = "draft"
REVIEW = "review"
APPROVED = "approved"
SENT = "sent"
RESPONSE = "response"
REJECTED = "rejected"
FAILED = "failed"
PENDING = "pending"
FOLLOWUP_REQUIRED = "followup_required"

# allowed transitions
_TRANSITIONS: dict[str, set[str]] = {
    DRAFT: {REVIEW, REJECTED},
    REVIEW: {APPROVED, REJECTED, DRAFT},
    APPROVED: {SENT, FAILED, REJECTED},
    SENT: {RESPONSE, FOLLOWUP_REQUIRED},
    FOLLOWUP_REQUIRED: {DRAFT, RESPONSE},
    PENDING: {DRAFT},
    FAILED: {DRAFT},
    RESPONSE: set(),
    REJECTED: set(),
}


class ApprovalError(RuntimeError):
    pass


def can_transition(current: str, target: str) -> bool:
    return target in _TRANSITIONS.get(current, set())


def transition(current: str, target: str) -> str:
    if not can_transition(current, target):
        raise ApprovalError(f"illegal transition {current!r} -> {target!r}")
    return target


def assert_dispatchable(status: str) -> None:
    """Raise unless a human has approved this item. Called right before any send."""
    if status != APPROVED:
        raise ApprovalError(
            f"refusing to dispatch: status is {status!r}, requires {APPROVED!r} "
            "(explicit human approval)"
        )
