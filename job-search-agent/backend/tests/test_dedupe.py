"""Dedupe: same source id -> same key; fallback key is stable and host-based."""
from app.discovery.base import Posting, fallback_dedupe_key


def test_source_id_dedupe_key():
    p = Posting(source="greenhouse", source_job_id="stripe:123",
                company_name="Stripe", job_title="Ops Manager")
    assert p.dedupe_key == "greenhouse:stripe:123"


def test_two_postings_same_id_same_key():
    a = Posting(source="lever", source_job_id="abc", company_name="Acme", job_title="X")
    b = Posting(source="lever", source_job_id="abc", company_name="Acme Corp", job_title="X (dup)")
    assert a.dedupe_key == b.dedupe_key


def test_fallback_key_normalizes():
    k1 = fallback_dedupe_key("Acme  Corp", "Operations Manager!", "https://acme.com/jobs/1")
    k2 = fallback_dedupe_key("acme corp", "operations manager", "https://acme.com/jobs/2")
    # company + title normalize the same; host identical -> same fallback key
    assert k1 == k2
    assert k1 == "acme-corp|operations-manager|acme.com"


def test_posting_without_source_id_uses_fallback():
    p = Posting(source="careers", source_job_id="", company_name="Acme",
                job_title="Ops Lead", application_url="https://acme.com/x")
    assert p.dedupe_key == "acme|ops-lead|acme.com"
