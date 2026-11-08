# Implementation Plan

Built in independent, testable phases (spec §18). Each phase ends green before the
next starts. **This repository currently ships Phase 1 complete + working Phase 2
discovery connectors + a Phase 3 scoring path**, with Phases 4–8 scaffolded behind
clear interfaces and TODOs.

Legend: ✅ done · 🟡 partial/working-stub · ⬜ scaffolded (interface + TODO)

## Phase 1 — Foundation ✅
- ✅ Project structure (`backend/ frontend/ data/ config/ tests/`).
- ✅ SQLite + SQLAlchemy models for all §12 tables.
- ✅ FastAPI app, health check, CORS for local frontend.
- ✅ Config system (`config/candidate.yaml`, `job_preferences.yaml`, `sources.yaml`).
- ✅ Candidate onboarding endpoints (`/api/candidate`) — profile + preferences saved to DB.
- ✅ Master-CV upload + parse (`resume/parser.py`, PyMuPDF + python-docx).
- ✅ Dashboard summary endpoint (`/api/dashboard/summary`) + minimal Next.js dashboard.
- ✅ Tests: scorer + dedupe.

## Phase 2 — Job discovery 🟡 (Greenhouse/Lever/Ashby working)
- ✅ Greenhouse public board API connector (`boards-api.greenhouse.io`).
- ✅ Lever public postings API connector (`api.lever.co/v0/postings`).
- ✅ Ashby public job-board API connector (`api.ashbyhq.com/posting-api/job-board`).
- ⬜ Company career pages (generic + Playwright for JS pages).
- ✅ Dedupe by source-id + normalized `company|title|url`.
- ✅ Job tracker persistence (`jobs` table).
- ⬜ Priority-2/3 sources: user-supplied URLs, email alerts, manual import (UI).

## Phase 3 — AI engine ✅ (core)
- ✅ Ollama health probe + graceful fallback (`matching/ollama_client.py`).
- ✅ Deterministic weighted scoring (§6 weights) — works with **no** LLM.
- ✅ LLM explanation + CV analysis (reasons/missing/gap/priority) when Ollama present;
  template fallback when absent.
- ✅ Job-specific resume generation (ReportLab PDF + python-docx DOCX, ATS layout, one
  page, Times New Roman, single column). Bullets selected/reordered **verbatim** from
  `config/master_cv.yaml` — never invented.
- ✅ Cover-letter generation (template + optional Ollama), with an **anti-fabrication
  numeric guard** (`resume/guard.py`): any generated number not present in the CV (or the
  JD, for cover letters) is rejected and the factual fallback is used.
- ✅ Honest gap analysis (domain/tool vocabulary, not generic adjectives).
- API: `POST /api/jobs/{id}/generate`, `GET /api/jobs/{id}/documents`.

## Phase 4 — Recruiter discovery ⬜
- Public-only extraction: career/contact pages, recruiter names in JDs.
- Verification status (Verified / Unverified / Unavailable). **No email guessing, no Apollo.**
- `contacts` table + UI.

## Phase 5 — Outreach ⬜
- Email draft generator → Gmail *draft* (approval before send).
- WhatsApp `wa.me` deep link with prefilled message (manual send).
- LinkedIn connection/intro/follow-up/thank-you text + copy button + profile link.
- Approval queue state machine + audit log (`outreach` table).

## Phase 6 — Application automation ⬜
- Playwright filler for Greenhouse/Lever/Ashby forms; profile→field mapping.
- Resume upload; screenshots; validation; **stop before Submit**; `NEEDS_HUMAN` flags.

## Phase 7 — Monitoring ⬜
- Gmail event monitor (interview/rejection/offer/assessment/recruiter-reply).
- Match events→applications; follow-up reminders (3 then 7 business days); analytics.

## Phase 8 — Testing & deployment ⬜
- Unit + integration tests; duplicate-prevention; approval-gate tests; network-failure
  handling; Gmail OAuth; "no external action without approval" verification; install docs.

---

## Dependency verification (free-tier confirmed)

| Dependency | Free? | How used | Required? |
|---|---|---|---|
| FastAPI, Uvicorn, SQLAlchemy, Pydantic | ✅ OSS | backend | yes |
| httpx | ✅ OSS | discovery HTTP | yes |
| PyMuPDF (`fitz`), python-docx | ✅ OSS | CV parse | yes |
| reportlab | ✅ OSS | PDF resume | Phase 3 |
| PyYAML | ✅ OSS | config | yes |
| APScheduler | ✅ OSS | scheduling | Phase 7 |
| Playwright | ✅ OSS (Chromium pre-installed here) | JS pages, forms | Phase 2/6 |
| Ollama + qwen2.5/gemma2 | ✅ free local | scoring text, tailoring | **optional** (graceful fallback) |
| Gmail API | ✅ free quota | drafts + read | Phase 5/7 |
| openpyxl | ✅ OSS | xlsx export | Phase 7 |
| Next.js, Tailwind, Recharts | ✅ OSS | frontend | yes |

**No** paid AI API, recruiter DB, job API, hosting, WhatsApp or email-automation service
is a required dependency. Ollama is the runtime inference engine; if it is not running,
the system still discovers, dedupes, scores (deterministically) and tracks — only the
natural-language *explanations* and tailoring degrade to templates.

## How to run (current state)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
#   -> http://localhost:8000/docs  (OpenAPI)
#   -> http://localhost:8000/api/dashboard/summary

# (optional) local LLM
#   install Ollama from https://ollama.com ; then: ollama pull qwen2.5

# Frontend
cd ../frontend
npm install && npm run dev
#   -> http://localhost:3000

# Tests
cd ../backend && pytest
```
