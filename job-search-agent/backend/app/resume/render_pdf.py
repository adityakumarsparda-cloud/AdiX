"""Render a TailoredResume to an ATS-friendly PDF (ReportLab).

ATS constraints (mirrors ../../cv/README.md):
  * Single column, no tables/text-boxes/images, black on white.
  * Times New Roman (ReportLab's built-in Times-* fonts share its metrics).
  * Conventional section headings parsers look for.
  * Hierarchy from size/weight only; no icons, no symbols outside basic Latin.
"""
from __future__ import annotations

from pathlib import Path

from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from app.resume.tailor import TailoredResume

_NAME = ParagraphStyle("name", fontName="Times-Bold", fontSize=16, leading=19, spaceAfter=1)
_HEADLINE = ParagraphStyle("headline", fontName="Times-Roman", fontSize=10.5, leading=13, spaceAfter=2)
_CONTACT = ParagraphStyle("contact", fontName="Times-Roman", fontSize=9, leading=12, spaceAfter=6)
_H = ParagraphStyle("h", fontName="Times-Bold", fontSize=10.5, leading=13, spaceBefore=7,
                    spaceAfter=2, alignment=TA_LEFT)
_BODY = ParagraphStyle("body", fontName="Times-Roman", fontSize=9.5, leading=12.5)
_ROLE = ParagraphStyle("role", fontName="Times-Bold", fontSize=9.8, leading=12.5, spaceBefore=3)
_ROLEMETA = ParagraphStyle("rolemeta", fontName="Times-Italic", fontSize=9, leading=12)
_BULLET = ParagraphStyle("bullet", fontName="Times-Roman", fontSize=9.5, leading=12.2,
                         leftIndent=10, bulletIndent=0, spaceAfter=1)


def _contact_line(contact: dict) -> str:
    bits = [contact.get("location"), contact.get("phone"), contact.get("email"),
            contact.get("linkedin_url")]
    return "  |  ".join(b for b in bits if b)


def render_pdf(resume: TailoredResume, contact: dict, out_path: str | Path) -> Path:
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(out), pagesize=A4,
        topMargin=14 * mm, bottomMargin=12 * mm, leftMargin=16 * mm, rightMargin=16 * mm,
        title=f"{resume.name} — CV",
    )
    story: list = [Paragraph(resume.name, _NAME), Paragraph(resume.headline, _HEADLINE)]
    cl = _contact_line(contact)
    if cl:
        story.append(Paragraph(cl, _CONTACT))

    story.append(Paragraph("Professional Summary", _H))
    story.append(Paragraph(resume.summary, _BODY))

    story.append(Paragraph("Core Skills", _H))
    for group, skills in resume.core_skills.items():
        story.append(Paragraph(f"<b>{group}:</b> {', '.join(skills)}", _BODY))

    story.append(Paragraph("Professional Experience", _H))
    for e in resume.experience:
        story.append(Paragraph(f"{e.title}, {e.company}", _ROLE))
        story.append(Paragraph(f"{e.location}  |  {e.dates}", _ROLEMETA))
        for b in e.bullets:
            story.append(Paragraph(b, _BULLET, bulletText="-"))

    story.append(Paragraph("Education", _H))
    for ed in resume.education:
        story.append(Paragraph(f"<b>{ed.degree}</b>", _BODY))
        story.append(Paragraph(f"{ed.institution}  |  {ed.dates}", _ROLEMETA))

    story.append(Spacer(1, 2))
    doc.build(story)
    return out
