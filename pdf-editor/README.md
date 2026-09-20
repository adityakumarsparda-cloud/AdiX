# PDF editor (localhost)

A PDF editor that runs on this machine. Start it, open a PDF in the browser,
mark it up, and save a real PDF back to disk.

```bash
npm run pdf          # from the repo root
# then open http://localhost:4747
```

`PDF_EDITOR_PORT=5000 npm run pdf` picks a different port. Ctrl+C stops it.

## Nothing is uploaded

The Node process is a static file server and nothing else — it has no upload
route and no write access to your documents. The browser reads the file you
pick, holds it in memory, and writes the edited copy out itself. The editor
also works with the network cable pulled: both libraries it uses
([pdf.js](https://mozilla.github.io/pdf.js/) for display,
[pdf-lib](https://pdf-lib.js.org/) for writing) are vendored under
`public/vendor/`, so there are no CDN calls and no `npm install`.

## What you can do

| Tool | What it does |
|---|---|
| **Select** | Move, resize (corner handle) and delete. Double-click text to retype it. |
| **Text** | Click anywhere and type. Helvetica, Times or Courier, any size and colour. |
| **Whiteout** | A filled box — the way to remove something that is already printed on the page. |
| **Highlight** | A translucent box that multiplies, so the text underneath stays readable. |
| **Draw** | Freehand pen, for a signature or a circled paragraph. |
| **Box** | A rectangle outline. |
| **Image** | Place a PNG or JPEG — a scanned signature, a stamp, a logo. |

Pages: rotate, delete, duplicate, insert a blank one, or append a second PDF
with **Append PDF…** (also Shift-drop a file onto the window).

Forms: if the PDF has real form fields, they are listed on the right and typed
values are written into the fields themselves, so they stay fillable.

Shortcuts: `V` select · `T` text · `W` whiteout · `H` highlight · `D` draw ·
`R` box · `Delete` remove · `Ctrl+Z`/`Ctrl+Shift+Z` undo/redo · `Ctrl+S` save ·
`PageUp`/`PageDown` to move between pages.

## How an edit becomes a PDF

Edits are kept in page points against the page *as displayed*, then converted
to PDF user space at save time, undoing the page's `/Rotate` and re-applying it
to each drawn object. That is why a rotated page saves with the annotations
still upright.

If you have not added, moved or deleted any page, the original document is
edited in place, which keeps its form fields, outline and metadata. Otherwise
the pages are copied into a new document — that is what makes merging and
reordering possible, but interactive form fields do not survive the copy, and
the editor says so when it happens.

## Known limits

- Existing text is not re-flowed. Editing a printed sentence means covering it
  with **Whiteout** and typing the replacement — the same thing Acrobat does
  when a document has no editable text layer.
- Only the 14 standard PDF fonts are available for new text, so characters
  outside Latin-1 (CJK, for instance) are saved as `?` and the editor warns
  you. The page's own text is untouched either way.
- Scanned PDFs are images: everything here works, but there is no OCR.
- A page whose CropBox differs from its MediaBox may place annotations at a
  small offset.
- Rotate pages before annotating them. Rotating afterwards moves annotations
  with the page but keeps text upright, so a long line can end up misaligned.
