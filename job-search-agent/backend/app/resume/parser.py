"""Master-CV parsing. PDF via PyMuPDF, DOCX via python-docx.

Output is plain text stored as candidate_profile.resume_text — the single source
of truth for scoring and (later) tailored generation. Nothing here invents content.
"""
from __future__ import annotations

from pathlib import Path


def parse_pdf(path: Path) -> str:
    import fitz  # PyMuPDF

    doc = fitz.open(path)
    try:
        return "\n".join(page.get_text() for page in doc).strip()
    finally:
        doc.close()


def parse_docx(path: Path) -> str:
    import docx  # python-docx

    document = docx.Document(str(path))
    parts: list[str] = [p.text for p in document.paragraphs]
    for table in document.tables:
        for row in table.rows:
            parts.append("\t".join(cell.text for cell in row.cells))
    return "\n".join(parts).strip()


def parse_resume(path: str | Path) -> str:
    """Parse a PDF or DOCX resume to plain text. Raises on unsupported types."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Resume not found: {p}")
    suffix = p.suffix.lower()
    if suffix == ".pdf":
        return parse_pdf(p)
    if suffix in (".docx", ".doc"):
        return parse_docx(p)
    if suffix in (".txt", ".md"):
        return p.read_text(encoding="utf-8", errors="replace").strip()
    raise ValueError(f"Unsupported resume type: {suffix} (use PDF, DOCX, TXT or MD)")
