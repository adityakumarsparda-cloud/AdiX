# Job watch

A scheduled search for **Operations Manager roles at D2C brands in Delhi NCR**.
Runs every 6 hours in a fresh session, reports only genuinely new postings, and
leaves a ready-to-send application draft beside each one.

## What it does each run

1. Runs a fixed set of searches (see `queries.txt`).
2. Drops anything whose `company|role` slug is already in `seen.json`.
3. For each genuinely new posting, writes `finds/<slug>.md` — the posting
   details, the apply route, and a drafted application email.
4. Appends the slug to `seen.json` and commits, so the next run does not
   repeat it.
5. Notifies Aditya **only if** something new was found. Silent otherwise.

## What it cannot do

Recruiter phone numbers and email addresses are **not obtainable** from the
major boards. Naukri, LinkedIn, Glassdoor, Indeed, Instahyre and startup.jobs
all refuse automated requests (verified: HTTP 403 on each) and keep contact
details behind a login and their own apply button. That gating is deliberate.

So this watch collects **postings and apply routes**, plus a contact address
only where the company itself publishes one on its own careers page. It does
not scrape contacts out of job boards, and a run that finds no email is the
normal case, not a failure.

The repo's LinkedIn integration cannot fill this gap either — per the root
`README.md`, job postings and recruiter data are outside what LinkedIn's
self-serve API scopes permit.

## Nothing sends itself

Every draft is staged for review. No application email leaves without Aditya
seeing the exact content first — see the approval rule in `CLAUDE.md`. The
watch finds and drafts; a human presses send.

## Rules it inherits from the tracker

From `Outreach_Tracker.xlsx` → "How to use". These bind the watch too:

- Never add an address that has not been verified — a bounce is a spam signal.
- Never email the same person twice for the same role without a reply.
- Max 20 new outreach emails per day.
- Anyone on the **Do Not Contact** sheet is never contacted, and a posting
  from those companies is dropped rather than drafted.

## Files

| Path | What it is |
|---|---|
| `queries.txt` | The searches each run performs |
| `seen.json` | Dedupe store, seeded with companies already in the tracker |
| `finds/` | One file per new posting: details plus drafted email |
