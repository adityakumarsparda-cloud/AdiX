# Architecture — AI Job Search & Recruitment Outreach Agent

**Status:** Phase 1 (Foundation) implemented. Phases 2–8 scaffolded.
**Deployment:** Local-first, self-hosted. No paid APIs are required to run it.

---

## 1. Design principles

1. **Human-in-the-loop for every external action.** Nothing — no email, no WhatsApp
   message, no LinkedIn note, no job application — leaves the machine without an
   explicit, per-item human approval. The system *drafts and stages*; a person *sends*.
2. **No fabrication.** Resume and message content is generated only from the parsed
   master CV. Experience, metrics, dates and responsibilities are never invented.
   (Enforced in prompt design and in review: see `SECURITY.md`.)
3. **Zero recurring cost.** Local LLM via Ollama; free public job-board APIs; no paid
   recruiter database; no paid scraping service; no paid hosting.
4. **Respect platform boundaries.** We use public/official endpoints only. We do not
   bypass CAPTCHAs, authentication, or anti-bot controls. Where a board blocks
   automation (Naukri, LinkedIn, Indeed HTML, Instahyre…), the user supplies URLs or
   uses official APIs/alerts instead.
5. **Local data ownership.** All candidate data, resumes and tokens stay on the local
   machine and are git-ignored. A disconnect + export path is provided.

## 2. Why these choices (reference-repo analysis)

Three repos were inspected. **None declares a license**, so under default copyright
their *code* is all-rights-reserved. We therefore reuse **architecture and concepts
only** and write all code fresh — which is also what the project spec asks for.

| Reference | Reused *concept* | Rejected / replaced |
|---|---|---|
| `AkhilDhawan22/job-track-os` (Node) | Greenhouse/Lever/Ashby crawler shape; Gmail outcome-monitoring by keyword; dedupe by source id; daily 9am digest; resume-tailoring-then-approve flow | Firecrawl (paid) → self-hosted `httpx`+Playwright. Baileys WhatsApp automation (ban risk, unofficial) → **deep links only**. Anthropic/DeepSeek API (paid) → **Ollama**. |
| `Dharma-aaryan/Job-Agent` (Python) | Fit-scoring stage before spending tokens; per-job resume/cover-letter; Playwright form-filler that stops before Submit; `dry_run`/`require_human_approval` defaults | Anthropic API (paid) → Ollama. **Apollo** contact enrichment (paid credits) → public-only recruiter discovery. |
| `dyyfk/auto-apply` | Public ATS discovery + an application queue concept | Any code; license unknown. |

The existing repo already contains a grounded, honest `../outreach/jobwatch/` watcher
and an `Outreach_Tracker.xlsx` with real (Gmail-sourced, verified) contacts and
outreach rules (max 20/day, never email twice without a reply, Do-Not-Contact list).
**Those rules are inherited by this system** (see `SECURITY.md` → Outreach rules).

## 3. Component diagram

```
                         ┌─────────────────────────────────────────────┐
                         │                FRONTEND (Next.js)            │
                         │  Dashboard · Jobs · Outreach · Analytics     │
                         │  Approval queue · Onboarding                 │
                         └───────────────┬─────────────────────────────┘
                                         │ HTTP (localhost)
                         ┌───────────────▼─────────────────────────────┐
                         │             BACKEND (FastAPI)                │
                         │  /api/candidate /api/jobs /api/outreach ...  │
                         └──┬────────┬────────┬────────┬────────┬───────┘
                            │        │        │        │        │
             ┌──────────────▼┐ ┌─────▼────┐ ┌─▼──────┐ ┌▼───────┐ ┌▼──────────┐
             │  discovery/   │ │ matching/│ │resume/ │ │outreach│ │applications│
             │ greenhouse    │ │ scorer   │ │ parser │ │ email  │ │ playwright │
             │ lever ashby   │ │ (+Ollama)│ │ tailor │ │ wa/li  │ │ formfiller │
             │ careers dedupe│ │          │ │        │ │ links  │ │ stop@submit│
             └──────┬────────┘ └────┬─────┘ └───┬────┘ └───┬────┘ └─────┬──────┘
                    │               │           │          │            │
                    │          ┌────▼───┐   ┌───▼────┐  ┌──▼─────┐  ┌───▼────┐
                    │          │ Ollama │   │ recruiter│ integrations│scheduler│
                    │          │ (local)│   │ (public) │  Gmail API │ APScheduler
                    │          └────────┘   └────────┘  └────────┘  └────────┘
                    │
             ┌──────▼───────────────────────────────────────────────────┐
             │   SQLite (SQLAlchemy ORM)  +  data/ (resumes, screenshots)│
             └──────────────────────────────────────────────────────────┘
```

## 4. Runtime flow (end-to-end)

1. **Onboard** — user enters preferences + uploads master CV (PDF/DOCX). CV is parsed
   (PyMuPDF / python-docx) into structured text stored locally. Personal contact
   details are entered here, never committed.
2. **Discover** (every 4h + 9am digest) — `discovery/*` pull public postings from
   Greenhouse/Lever/Ashby boards and configured career pages; `dedupe` drops repeats
   by source-id and normalized `company|title|url`.
3. **Score** — `matching/scorer` computes a 0–100 weighted score (deterministic rules)
   and asks Ollama for a human-readable explanation (match reasons, missing skills,
   experience gap, priority). Hard filters flag/reject out-of-scope roles.
4. **Recruiter discovery** — `recruiter/` collects only *publicly listed* HR contacts
   (career pages, contact pages, recruiter names in the JD). No email guessing. No Apollo.
5. **Generate** — on demand per job: tailored resume (ATS, Harvard, Times New Roman,
   one page), cover letter, and the three outreach message variants (email/WhatsApp/
   LinkedIn). Stored as separate files; master CV never overwritten.
6. **Approve & act** — everything enters the approval queue
   (`DRAFT → REVIEW → APPROVED → SENT → RESPONSE`). Email → Gmail *draft* (sent only
   after approval). WhatsApp → `wa.me` deep link with prefilled text (manual send).
   LinkedIn → copy buttons + profile link (no automation). Application → Playwright
   fills the form and **stops before Submit** for human review.
7. **Monitor** — Gmail is scanned every 2h for interview/rejection/offer/assessment/
   recruiter-reply, matched to applications, logged as `email_events`.
8. **Track & analyse** — all of the above persists in SQLite and surfaces on the
   dashboard and analytics pages.

## 5. Technology stack (all free / open source)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js + TypeScript + Tailwind + Recharts | App Router. |
| Backend | Python 3.11 + FastAPI + Uvicorn | |
| DB / ORM | SQLite + SQLAlchemy 2.x | Single file `data/app.db`. |
| AI runtime | **Ollama** (local) | Models: `qwen2.5` / `gemma2`. Graceful degradation if absent. |
| Browser automation | Playwright (Chromium) | Discovery of JS career pages + form filling. |
| Resume parsing | PyMuPDF + python-docx | |
| Resume/CV generation | ReportLab (PDF) + python-docx (DOCX) | Reuses conventions from `../cv/`. |
| Scheduling | APScheduler | Asia/Kolkata; catch-up on restart. |
| Email | Gmail API (OAuth, minimal scopes) | Drafts + read; never auto-send. |
| Export | OpenPyXL | Mirrors `Outreach_Tracker.xlsx` columns. |
| Config | YAML (`config/*.yaml`) | No candidate data hardcoded in logic. |

## 6. Module responsibilities (backend/app)

| Module | Responsibility |
|---|---|
| `api/` | FastAPI routers; the only layer the frontend talks to. |
| `database/` | SQLAlchemy engine/session, models, Pydantic schemas, migrations/seed. |
| `config.py` | Loads `config/*.yaml` + `.env`; single source of settings. |
| `resume/` | CV parse (`parser.py`); tailored resume + cover-letter generation. |
| `matching/` | `ollama_client.py` (LLM wrapper) + `scorer.py` (weighted score + filters). |
| `discovery/` | `base.py` interface; `greenhouse/lever/ashby/careers`; `dedupe.py`. |
| `recruiter/` | Public-only contact extraction + verification status. |
| `outreach/` | Draft email/WhatsApp-link/LinkedIn text; approval-queue state machine. |
| `applications/` | Playwright form filler that stops before Submit; screenshotting. |
| `integrations/` | Gmail client (OAuth, drafts, read, event classification). |
| `scheduler/` | APScheduler jobs on the §17 timetable; last-run + catch-up. |
| `agents/` | Orchestration that stitches discover→score→recruiter→generate per run. |

## 7. Non-goals / explicit limits

- No unsolicited automated WhatsApp or LinkedIn messaging (deep links / copy only).
- No scraping of contacts out of login-gated boards.
- No auto-accepting interviews or offers; no deleting email.
- No final application submit without a human click.
- No paid API as a *required* dependency.
