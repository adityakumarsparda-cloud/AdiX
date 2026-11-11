# AI Job Search & Recruitment Outreach Agent

A local-first, self-hosted agent that discovers relevant jobs, scores them against
your CV, drafts tailored applications and outreach, identifies *public* recruiter
contacts, and tracks your whole pipeline from one dashboard.

**Everything outward-facing requires your explicit, per-item approval.** The system
drafts and stages; you press send. No paid APIs are required to run it.

> Built for Aditya Kumar's job search. The master CV (`../cv/`) is the source of
> truth — nothing is fabricated. See `SECURITY.md` for the full safety policy.

## Status

| Phase | State |
|---|---|
| 1 Foundation | ✅ done (DB, config, onboarding, CV parse, dashboard, API) |
| 2 Discovery | 🟡 Greenhouse / Lever / Ashby working; career pages + manual import pending |
| 3 AI engine | ✅ scoring + tailored résumé (PDF/DOCX) + cover letter, anti-fabrication guard |
| 5 Outreach | ✅ email/WhatsApp/LinkedIn drafts, approval queue, rules (cap/DNC/no-dupe), Gmail drafts |
| 4 Recruiter · 6 Applications · 7 Monitoring · 8 Tests/deploy | ⬜ scaffolded |

See `IMPLEMENTATION_PLAN.md` for the detail and `ARCHITECTURE.md` for the design.

## Quick start

### Backend (required)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- API docs:        http://localhost:8000/docs
- Health:          http://localhost:8000/api/health
- Discover jobs:   `curl -X POST http://localhost:8000/api/jobs/discover`
- Score jobs:      `curl -X POST http://localhost:8000/api/jobs/score`
- Dashboard data:  http://localhost:8000/api/dashboard/summary

### Frontend (dashboard)

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000  (proxies /api/* to :8000)
```

### Local LLM (optional, free)

Install [Ollama](https://ollama.com), then `ollama pull qwen2.5`. The system works
without it — only the natural-language match *explanations* and (later) resume
tailoring degrade to deterministic templates. No paid AI API is ever used.

### Tests

```bash
cd backend && source .venv/bin/activate && pytest
```

## Configure

All preferences live in `config/*.yaml` — nothing candidate-specific is hardcoded in
code:

- `config/candidate.yaml` — profile & skills (grounded in the CV; **no** personal
  contact details — those are entered at onboarding and stored only locally).
- `config/job_preferences.yaml` — target titles/industries/locations, scoring weights,
  hard filters.
- `config/sources.yaml` — the Greenhouse/Lever/Ashby board tokens to crawl. The shipped
  tokens are verified *examples*; replace them with employers you target.
- `config/master_cv.yaml` — your CV in structured form, transcribed verbatim from
  `../cv/Aditya_Kumar_CV.pdf`. The tailoring engine selects and reorders these bullets
  for each job but never alters them. Keep it in sync with the CV sources in `../cv/`.

### Generate a tailored application

```bash
curl -X POST "http://localhost:8000/api/jobs/<id>/generate"   # -> PDF + DOCX + cover letter
```

Résumés land in `data/tailored/<slug>/` (git-ignored). The master CV is never
overwritten. Every bullet is verbatim from `master_cv.yaml`; any LLM-written prose that
introduces a number not in your CV is rejected automatically (`resume/guard.py`).

## What it will not do

- Send any email, WhatsApp or LinkedIn message without your approval.
- Submit any application form without your click (Playwright stops before Submit).
- Guess recruiter emails or use paid recruiter databases.
- Automate WhatsApp or LinkedIn, or scrape login-gated job boards.
- Invent experience, metrics, dates or qualifications.

## Layout

```
job-search-agent/
├── backend/   FastAPI + SQLAlchemy + discovery/matching/outreach modules
├── frontend/  Next.js + Tailwind dashboard
├── config/    candidate.yaml · job_preferences.yaml · sources.yaml
├── data/      resumes · tailored · screenshots · exports  (git-ignored)
├── ARCHITECTURE.md · IMPLEMENTATION_PLAN.md · DATABASE_SCHEMA.md · SECURITY.md
└── docker-compose.yml · .env.example
```

## Relationship to the rest of this repo

This complements the existing lightweight `../outreach/jobwatch/` watcher and
`../outreach/Outreach_Tracker.xlsx`. It inherits their outreach rules (max 20
emails/day, never email the same person twice without a reply, Do-Not-Contact list)
— see `SECURITY.md §6`.
