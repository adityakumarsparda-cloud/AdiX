# LinkedIn job alerts to application drafts

An n8n workflow that watches Gmail for LinkedIn job alerts, keeps the postings
that match **D2C Operations Manager** and **Supply Chain Manager**, scores each
against the CV, drafts an application opening, logs it, and emails a digest with
a link straight to the posting.

## What it does not do

It does not press Apply. LinkedIn exposes no API for submitting an application —
the self-serve products give sign-in and posting only (see `../README.md`), and
job data is partner-only. The remaining route is a browser bot driving Easy
Apply, which breaks the LinkedIn User Agreement's ban on automated access and
risks restriction of the account being used to job hunt.

So the workflow automates everything up to the submit: finding, filtering,
de-duplicating, scoring, drafting, and tracking. The apply click stays manual,
which is also what keeps anything sent under your name something you approved.

The alert email carries only title, company, and location — not the job
description. Scores are triage on those three fields, and the prompt tells
Claude to score conservatively rather than guess at an unseen JD.

## Files

| File | What it is |
|---|---|
| `job-alerts.workflow.json` | Generated. Import this into n8n. |
| `build.cjs` | Builds that JSON from the sources below. |
| `lib/parse-and-filter.js` | Code node: parse alert emails, match roles, dedupe, build the Claude request |
| `lib/score-parse.js` | Code node: read Claude's JSON, drop low scores, shape sheet rows |
| `lib/build-digest.js` | Code node: collapse the matches into one email |
| `profile.md` | The CV facts the scoring prompt is allowed to use |

Edit the sources, then `node build.cjs`. Never edit the generated JSON — the
next build overwrites it.

## Setup

### 1. LinkedIn alerts (the workflow has no input without these)

Create two saved searches at <https://www.linkedin.com/jobs/> with **alert
frequency: Daily**:

- `"D2C Operations Manager" OR "eCommerce Operations Manager" OR "Operations Manager"`
- `"Supply Chain Manager" OR "Supply Chain Lead"`

Set location and experience filters on the search itself — filtering at the
source beats filtering in code.

### 2. Google Sheet

Create a sheet with a tab named **Applications** and exactly these headers in
row 1:

```
Date | Company | Title | Location | JobId | URL | FitScore | Verdict | Gaps | Opening | Status
```

The header text is the contract: the workflow maps rows by column name, and
`JobId` is what stops the same posting reaching you twice. Copy the sheet ID
from its URL (`docs.google.com/spreadsheets/d/<THIS PART>/edit`).

### 3. n8n

**Cloud** (<https://n8n.io/cloud>) — the recommended path. Google credentials
are a click: add a Gmail and a Google Sheets credential, press *Connect*, sign
in. Nothing to configure in Google Cloud Console.

**Self-hosted** (`npx n8n`, or Docker) — free, but Google OAuth is yours to set
up: create a project in Google Cloud Console, enable the Gmail and Google Sheets
APIs, create an OAuth client of type *Web application*, and add n8n's callback
URL (shown in the credential dialog) as an authorized redirect URI. Your n8n
instance also needs a public HTTPS URL for that callback, or you tunnel it.

Either way, then:

1. **Import** — *Workflows → Import from File* → `job-alerts.workflow.json`.
2. **Credentials** — open each node showing a credential warning and pick yours:
   - `Gmail Trigger` and `Send digest` → Gmail (OAuth2)
   - `Load tracker` and `Append to tracker` → Google Sheets (OAuth2)
   - `Score fit` → a **Header Auth** credential named `Anthropic x-api-key`,
     with header name `x-api-key` and your key from
     <https://console.anthropic.com/> as the value. The key lives in the n8n
     credential store, never in this repo.
3. **Sheet ID** — replace `REPLACE_WITH_SHEET_ID` in `Load tracker` and
   `Append to tracker` with the ID from step 2.
4. **Recipient** — `Send digest` mails `adityakumar.sparda@gmail.com`; change it
   if the digest should go elsewhere.

### 4. First run

Leave the workflow inactive and press **Execute Workflow** with a real alert
sitting unread in the inbox. Then open the `Parse and filter` node's output and
check the `title`, `company`, and `location` fields.

Company and location are read from the markup that follows each job link, which
is the one part of this that LinkedIn can change without notice. If those fields
come back wrong, the fix is in `parseJobs()` in `lib/parse-and-filter.js` — and
`Score fit` costs money per item, so verify the parse before activating.

Once the parse looks right, activate the workflow. It polls every 15 minutes for
unread mail from `jobalerts-noreply@linkedin.com`.

## Tuning

| Want | Change |
|---|---|
| Different target roles | `WANTED` / `REJECT` in `lib/parse-and-filter.js` |
| More or fewer results in the digest | `MIN_SCORE` in `lib/score-parse.js` (default 7) |
| Stricter or more generous scoring | the `system` prompt in `claudeBody()` |
| Cheaper scoring | `effort` is already `low`; `model` can go to `claude-sonnet-5` |
| A new CV fact to score against | `profile.md`, keeping it consistent with `cv/build_pdf.py` |

Rebuild after any of these: `node build.cjs`.

## After you apply

Set the row's `Status` to `applied` in the sheet. Nothing reads it back yet —
it's there so the tracker stays honest, and so a follow-up workflow that watches
for replies has something to update.
