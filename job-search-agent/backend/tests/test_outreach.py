"""Outreach: approval gate, rules enforcement, and the end-to-end draft->send flow,
all against a fresh in-memory DB. No real email is sent (manual channels only)."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.db import Base
from app.database.models import Contact, Job
from app.outreach import approval, rules, service


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    s = Session()
    yield s
    s.close()


def _job(db, company="Acme", title="Operations Manager") -> Job:
    j = Job(company_name=company, job_title=title, description="ops", dedupe_key=f"k:{company}:{title}")
    db.add(j)
    db.commit()
    return j


def _contact(db, **kw) -> Contact:
    c = Contact(company_name=kw.get("company_name", "Acme"), **kw)
    db.add(c)
    db.commit()
    return c


def test_linkedin_draft_then_full_approval_flow(db):
    j = _job(db)
    row = service.generate(db, j.id, "linkedin")
    assert row.approval_status == approval.DRAFT
    # cannot jump straight to sent
    with pytest.raises(approval.ApprovalError):
        service.send(db, row.id)
    service.set_status(db, row.id, approval.REVIEW)
    service.set_status(db, row.id, approval.APPROVED)
    out = service.send(db, row.id)  # manual channel: recorded, no external action
    assert out["sent"] and out["channel"] == "linkedin"
    assert db.get(type(row), row.id).approval_status == approval.SENT


def test_do_not_contact_blocks_email(db, monkeypatch):
    from app.config import outreach_rules
    monkeypatch.setattr(
        "app.outreach.rules.outreach_rules",
        lambda: {"do_not_contact": {"companies": ["Acme"]}, "require_verified_email": True},
    )
    j = _job(db, company="Acme")
    c = _contact(db, email="hr@acme.com", verification_status="verified")
    with pytest.raises(rules.RuleViolation):
        service.generate(db, j.id, "email", contact_id=c.id)


def test_unverified_email_blocked(db):
    j = _job(db)
    c = _contact(db, email="hr@acme.com", verification_status="unverified")
    with pytest.raises(rules.RuleViolation):
        service.generate(db, j.id, "email", contact_id=c.id)


def test_no_duplicate_email_without_reply(db):
    j = _job(db)
    c = _contact(db, email="hr@acme.com", verification_status="verified")
    service.generate(db, j.id, "email", contact_id=c.id)  # first is fine
    with pytest.raises(rules.RuleViolation):
        service.generate(db, j.id, "email", contact_id=c.id)  # second blocked


def test_whatsapp_without_number_is_unavailable(db):
    j = _job(db)
    c = _contact(db, recruiter_name="Priya")  # no phone
    row = service.generate(db, j.id, "whatsapp", contact_id=c.id)
    assert row.approval_status == approval.PENDING
    assert "no public whatsapp" in row.message_content.lower()


def test_whatsapp_link_built_when_number_present(db):
    j = _job(db)
    c = _contact(db, recruiter_name="Priya", phone="+91 99999 00000")
    row = service.generate(db, j.id, "whatsapp", contact_id=c.id)
    d = service.detail(db, row)
    assert d["whatsapp_link"].startswith("https://wa.me/919999900000?text=")


def test_daily_cap_blocks_send(db, monkeypatch):
    monkeypatch.setattr("app.outreach.rules.outreach_rules",
                        lambda: {"daily_email_cap": 0})
    with pytest.raises(rules.RuleViolation):
        rules.assert_can_send_now(db)
