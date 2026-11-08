"""Scorer: a strong ops/inventory role scores well; an unrelated role is rejected."""
from app.matching.scorer import score_job


OPS_JD = """
Operations Manager — Inventory and Dispatch
We are a D2C quick-commerce brand. You will own warehouse reconciliation, inventory
cycle counts, reorder point planning and domestic dispatch via Shiprocket. Manage a
small team, maintain a 98% on-time SLA, produce MIS reporting in Excel/Power BI, and
coordinate vendors. Experience with Unicommerce and Shopify preferred. 3+ years.
"""

ENG_JD = """
Senior Software Engineer
Build backend services in Go and Python. 8+ years of distributed systems experience.
"""


def test_strong_ops_role_scores_high():
    b = score_job("Operations Manager", OPS_JD, "Gurugram", "8 LPA")
    assert not b.rejected
    assert b.total >= 70, b.parts
    assert b.band in ("strong", "excellent")
    assert any("shopify" in s.lower() or "inventory" in s.lower() for s in b.matched_skills)


def test_unrelated_engineering_role_rejected():
    b = score_job("Senior Software Engineer", ENG_JD, "Remote", None)
    assert b.rejected
    assert b.reject_reason


def test_experience_gap_filter():
    jd = "Operations Director. Requires 12 years of operations leadership."
    b = score_job("Operations Director", jd, "Noida", None)
    # 12 > max_years_experience_required(7) -> rejected
    assert b.rejected
    assert "12" in (b.reject_reason or "")


def test_location_flag_outside_preferences():
    b = score_job("Inventory Manager", OPS_JD, "Kolkata", None)
    assert any("location" in f for f in b.flags)


def test_weights_sum_to_100():
    from app.config import job_preferences

    assert sum(job_preferences()["scoring_weights"].values()) == 100
