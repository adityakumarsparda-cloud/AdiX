# CV sources

Both files render the same content; edit the content in **both** when it changes.

| File | Builds | Run |
|---|---|---|
| `build_pdf.py` | `Aditya_Kumar_CV.pdf` | `python3 build_pdf.py` (needs `reportlab`) |
| `build.js` | `Aditya_Kumar_CV.docx` | `node build.js` (needs `npm install docx`) |

Send the PDF when emailing a person; send the DOCX to job portals that parse
uploads.

## ATS constraints

These are deliberate — changing them breaks resume parsers:

- Single column throughout. No tables, text boxes, or images.
- No icons or emoji, including in the contact line.
- No symbols outside basic Latin (write "98% or better", not the >= sign).
- Hierarchy comes from font size, weight, and colour only.
- Never fake letter-spacing with spaces between characters; it corrupts the
  extracted text. `build.js` uses the real `characterSpacing` run property.
- Conventional section headings (Professional Summary, Core Skills, Professional
  Experience, Education) — parsers look for these exact words.
- Dates written `Month YYYY to Month YYYY`.

## Verifying a change

Check what a parser actually sees, rather than trusting the visual layout:

```bash
python3 -c "import pypdf; print('\n'.join(p.extract_text() for p in pypdf.PdfReader('Aditya_Kumar_CV.pdf').pages))"
```

Keep it to one page.
