"""Excluded role types (risk/people/sales operations) are rejected even though the
title contains 'operations manager'."""
import pytest

from app.matching.scorer import score_job

OPS_BODY = "Operations role. Manage processes, SLA, reporting and a team."


@pytest.mark.parametrize(
    "title",
    [
        "Risk Operations Manager",
        "People Operations Manager",
        "Sales Operations Manager",
        "Marketing Operations Manager",
        "Security Operations Manager",
    ],
)
def test_qualified_ops_titles_are_rejected(title):
    b = score_job(title, OPS_BODY, "Bangalore", None)
    assert b.rejected, f"{title} should be rejected"
    assert "excluded role type" in (b.reject_reason or "")


def test_plain_operations_manager_not_excluded():
    b = score_job(
        "Operations Manager",
        "Own inventory reconciliation, warehouse dispatch via Shiprocket, Shopify, SLA.",
        "Gurugram",
        None,
    )
    assert not b.rejected
