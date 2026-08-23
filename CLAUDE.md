# AdiX

## Where finished files go

**Google Drive is the primary store for documents.** Save any finished document
there rather than leaving it only in the session container, which is wiped when
the session ends. Drive syncs to the phone app, so it is what makes a file
reachable away from the desktop.

Current Drive locations:

| What | Where |
|---|---|
| CV (PDF and DOCX) | Drive folder **"Aditya Kumar — CV"** |

Git still holds the *sources* that generate those documents — see `cv/README.md`.
Update Drive whenever a document changes, or the copy on the phone goes stale.

## Contents

| Path | What it is |
|---|---|
| `src/`, `post.js` | LinkedIn OAuth reference implementation and feed posting |
| `cv/` | CV build scripts, and the PDF and DOCX they produce |

## Conventions

- Secrets live in `.env` and never in git. `.env` and `.tokens.json` are ignored.
- Before publishing anything outward — a LinkedIn post, a shared document —
  show the exact content and get explicit approval first.
- Do not write CV bullets describing work that has not been confirmed as actually
  performed. Skills lists are the place for tools used; accomplishments are not
  to be inferred.
