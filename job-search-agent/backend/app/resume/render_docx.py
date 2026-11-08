"""Render a TailoredResume to an ATS-friendly DOCX (python-docx).

Same ATS rules as the PDF: single column, Times New Roman, black/white, conventional
headings, hierarchy from size/weight only. No tables, images or icons.
"""
from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.shared import Pt, RGBColor

from app.resume.tailor import TailoredResume

_FONT = "Times New Roman"
_BLACK = RGBColor(0, 0, 0)


def _set(run, *, size: float, bold: bool = False, italic: bool = False):
    run.font.name = _FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = _BLACK


def _para(doc, space_before=0.0, space_after=2.0):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    return p


def _heading(doc, text):
    p = _para(doc, space_before=7, space_after=1)
    _set(p.add_run(text), size=10.5, bold=True)
    return p


def _contact_line(contact: dict) -> str:
    bits = [contact.get("location"), contact.get("phone"), contact.get("email"),
            contact.get("linkedin_url")]
    return "  |  ".join(b for b in bits if b)


def render_docx(resume: TailoredResume, contact: dict, out_path: str | Path) -> Path:
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = _FONT
    style.font.size = Pt(9.5)
    for section in doc.sections:
        section.top_margin = section.bottom_margin = Pt(36)
        section.left_margin = section.right_margin = Pt(46)

    p = _para(doc, space_after=1)
    _set(p.add_run(resume.name), size=16, bold=True)
    p = _para(doc, space_after=2)
    _set(p.add_run(resume.headline), size=10.5)
    cl = _contact_line(contact)
    if cl:
        p = _para(doc, space_after=6)
        _set(p.add_run(cl), size=9)

    _heading(doc, "Professional Summary")
    _set(_para(doc).add_run(resume.summary), size=9.5)

    _heading(doc, "Core Skills")
    for group, skills in resume.core_skills.items():
        p = _para(doc, space_after=1)
        _set(p.add_run(f"{group}: "), size=9.5, bold=True)
        _set(p.add_run(", ".join(skills)), size=9.5)

    _heading(doc, "Professional Experience")
    for e in resume.experience:
        p = _para(doc, space_before=3, space_after=0)
        _set(p.add_run(f"{e.title}, {e.company}"), size=9.8, bold=True)
        p = _para(doc, space_after=1)
        _set(p.add_run(f"{e.location}  |  {e.dates}"), size=9, italic=True)
        for b in e.bullets:
            bp = _para(doc, space_after=1)
            bp.paragraph_format.left_indent = Pt(10)
            _set(bp.add_run(f"- {b}"), size=9.5)

    _heading(doc, "Education")
    for ed in resume.education:
        p = _para(doc, space_after=0)
        _set(p.add_run(ed.degree), size=9.5, bold=True)
        p = _para(doc, space_after=1)
        _set(p.add_run(f"{ed.institution}  |  {ed.dates}"), size=9, italic=True)

    doc.save(str(out))
    return out
