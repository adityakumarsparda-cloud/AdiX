"""Approval gate: nothing dispatches without explicit human approval."""
import pytest

from app.outreach import approval
from app.applications.filler import FormPlan, submit


def test_draft_is_not_dispatchable():
    with pytest.raises(approval.ApprovalError):
        approval.assert_dispatchable(approval.DRAFT)


def test_review_is_not_dispatchable():
    with pytest.raises(approval.ApprovalError):
        approval.assert_dispatchable(approval.REVIEW)


def test_approved_is_dispatchable():
    approval.assert_dispatchable(approval.APPROVED)  # must not raise


def test_illegal_transition_rejected():
    with pytest.raises(approval.ApprovalError):
        approval.transition(approval.DRAFT, approval.SENT)


def test_application_submit_requires_token():
    plan = FormPlan(url="https://x", portal="greenhouse")
    with pytest.raises(PermissionError):
        submit(plan, human_approval_token=None)
