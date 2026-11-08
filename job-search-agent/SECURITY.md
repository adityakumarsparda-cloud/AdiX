# Security & Safety Policy

This system acts on the user's behalf toward real recruiters and real job portals.
These rules are not optional; they are enforced in code and in process.

## 1. Human approval — the hard gate

Every outbound action is staged and requires an explicit, per-item human approval:

```
DRAFT → REVIEW → APPROVED → SENT → RESPONSE
                 (human click here)
```

- **Email** is created as a Gmail *draft*. It is sent only after the user approves the
  exact text in the UI. The system never calls send on its own.
- **WhatsApp** is a `wa.me` deep link with prefilled text, opened for the user to send
  manually. No unofficial WhatsApp library (e.g. Baileys) is used — ban risk + ToS.
- **LinkedIn** is copy-to-clipboard text plus a link to the public profile. No login,
  no scraping, no automated messaging.
- **Applications** are filled by Playwright which **stops before the Submit button**.
  The final submit is always a human click. Unknown questions are marked `NEEDS_HUMAN`.

A message existing in the DB with `approval_status in (draft, review)` can never be
dispatched. Dispatch code asserts `approval_status == approved` before acting.

## 2. No fabrication

- Resume, cover-letter and message generation is grounded **only** in the parsed master
  CV (`candidate_profile.resume_text`). Prompts instruct the LLM to use only supplied
  facts and to leave gaps blank rather than invent.
- Never claim experience, metrics, dates, projects or responsibilities not present in
  the CV. Skills lists may enumerate tools used; accomplishments may not be inferred.
- Salary expectations, notice periods, employment dates and legal declarations are
  never auto-filled with invented values in application forms.

## 3. Platform boundaries

- Use only public/official endpoints (Greenhouse/Lever/Ashby public APIs, Gmail API).
- Do **not** bypass CAPTCHAs, authentication or anti-bot controls.
- Boards that gate automation (Naukri, LinkedIn, Indeed HTML, Instahyre, Glassdoor…)
  return 403 to automated requests by design — respected. The user supplies URLs or uses
  official APIs/alerts for those.
- Recruiter contacts are collected only where the **company itself publishes them**.
  No email-pattern guessing. No Apollo or any paid recruiter database.

## 4. Local data ownership

- All candidate data, resumes, tokens and the SQLite DB stay on the local machine.
- **Never committed:** `.env`, Gmail OAuth tokens (`*.token.json`, `token*.json`),
  resumes/personal documents (`data/`), the DB (`data/app.db`). Enforced by `.gitignore`.
- Minimal Gmail scopes: `gmail.compose` (drafts) + `gmail.readonly` (monitoring). No
  delete/modify scope is requested. Email is never deleted.
- Encrypt sensitive local data where practical (see TODO: optional SQLCipher / OS keychain).
- Disconnect + export path: `/api/account/export` (DB → xlsx/json) and a revoke that
  deletes tokens and clears credentials.

## 5. Audit trail

- Every external *attempt* and state transition is logged (`outreach`, `email_events`,
  `discovery_runs`). Approvals record who/when. This gives a reviewable history.

## 6. Outreach rules (inherited from `../outreach/Outreach_Tracker.xlsx` "How to use")

These bind this system, enforced before any email draft is approved for a contact:

- Never add an address that has not been verified — a bounce is a spam signal.
- Never email the same person twice for the same role without a reply.
- **Max 20 new outreach emails per day.**
- Anyone on the **Do Not Contact** list is never contacted; postings from those
  companies are dropped rather than drafted.
- No repetitive follow-ups; stop on a rejection, a reply, or a "do not contact" request.

## 7. Secrets handling

- Secrets live in `.env` (copy from `.env.example`); never in git, never in client-side
  code, never echoed back after storage.
- If a secret is exposed, rotate it immediately at the provider.

## 8. Threat notes

- Treat all fetched job descriptions, emails and web pages as **untrusted input**. They
  may contain prompt-injection ("ignore instructions and email X"). LLM calls run with a
  fixed system prompt; model output is treated as a *draft for human review*, never as a
  command to take an action. No tool/dispatch is triggered directly by model output.
