"""The numeric guard rejects invented numbers but allows grounded ones."""
from app.resume.cover_letter import generate_cover_letter
from app.resume.guard import is_grounded


def test_guard_passes_when_numbers_are_in_source():
    ok, offending = is_grounded("Maintained 98% SLA over 4 years.",
                                "98% on-time SLA, over 4 years of experience")
    assert ok and offending == []


def test_guard_rejects_invented_number():
    ok, offending = is_grounded("Led a team of 50 and saved $2M.",
                                "Led a 4-member team.")
    assert not ok
    assert "50" in offending


def test_guard_allows_number_from_any_source():
    ok, _ = is_grounded("The role requires 7 years.", "I have 4 years.", "requires 7 years")
    assert ok


def test_cover_letter_template_is_grounded():
    # with allow_llm=False we always get the factual template; every number in it must
    # come from the CV.
    from app.resume.structured import load_master_cv

    text, source = generate_cover_letter("Acme", "Operations Manager", "", allow_llm=False)
    assert source == "template"
    ok, offending = is_grounded(text, load_master_cv().full_text(), "Acme Operations Manager")
    assert ok, f"template leaked ungrounded numbers: {offending}"
