"""Tailoring must never fabricate: every output bullet is a verbatim master bullet,
and relevant bullets are surfaced first."""
from app.resume.structured import load_master_cv
from app.resume.tailor import tailor_resume

OPS_JD = """
Inventory Manager — D2C. Own warehouse reconciliation, cycle counts, reorder point
planning and dispatch via Shiprocket. Shopify and Unicommerce experience preferred.
MIS reporting in Excel. Maintain SLA.
"""


def _all_master_bullets() -> set[str]:
    cv = load_master_cv()
    return {b for e in cv.experience for b in e.bullets}


def test_every_output_bullet_is_verbatim_from_master():
    master = _all_master_bullets()
    r = tailor_resume("Inventory Manager", OPS_JD, allow_llm=False)
    for e in r.experience:
        for b in e.bullets:
            assert b in master, f"fabricated/edited bullet: {b!r}"


def test_relevant_bullet_surfaces_first_in_recent_role():
    r = tailor_resume("Inventory Manager", OPS_JD, allow_llm=False)
    top_role = r.experience[0]
    # the warehouse/reconciliation/cycle-count bullet should rank at or near the top
    joined_first = top_role.bullets[0].lower()
    assert any(k in joined_first for k in ("inventory", "reconciliation", "cycle", "reorder"))


def test_highlighted_skills_are_real_skills():
    cv = load_master_cv()
    all_skills = {s for g in cv.core_skills.values() for s in g}
    r = tailor_resume("Inventory Manager", OPS_JD, allow_llm=False)
    for s in r.highlighted_skills:
        assert s in all_skills


def test_summary_without_llm_is_the_master_summary():
    cv = load_master_cv()
    r = tailor_resume("Inventory Manager", OPS_JD, allow_llm=False)
    assert r.summary == cv.summary
    assert r.summary_source == "master"


def test_one_page_budget_limits_bullets():
    r = tailor_resume("Inventory Manager", OPS_JD, allow_llm=False)
    # most recent role capped at 6, oldest at 2
    assert len(r.experience[0].bullets) <= 6
    assert len(r.experience[-1].bullets) <= 2
