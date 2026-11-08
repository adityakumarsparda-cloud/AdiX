# Database Schema

SQLite, via SQLAlchemy 2.x. Single file at `data/app.db` (git-ignored). All timestamps
stored UTC (ISO-8601). The ORM models live in `backend/app/database/models.py`; this
document is the human-readable contract and mirrors spec §12.

## Entity relationships

```
candidate_profile (singleton, id=1)
        │
jobs ───┼───────────────┐
 │      │               │
 │ 1  *│                │ *
 ▼      ▼                ▼
applications        outreach ──* contacts (by company / id)
 │ 1                     
 │ *                     
 ▼                       
email_events            discovery_runs / scheduler_state  (operational tables)
```

## Tables

### `jobs`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| source | TEXT | greenhouse / lever / ashby / careers / manual |
| source_job_id | TEXT | provider's id; part of dedupe key |
| company_name | TEXT | |
| company_website | TEXT | |
| job_title | TEXT | |
| description | TEXT | full JD (plain text) |
| location | TEXT | |
| work_mode | TEXT | onsite / hybrid / remote / unknown |
| salary | TEXT | raw published range, nullable |
| experience_required | TEXT | parsed/raw, nullable |
| required_skills | TEXT (JSON) | extracted keywords |
| application_url | TEXT | |
| posted_at | TEXT | provider date, nullable |
| deadline | TEXT | nullable |
| discovered_at | TEXT | when we first saw it |
| match_score | INTEGER | 0–100, nullable until scored |
| match_band | TEXT | excellent/strong/moderate/low |
| match_explanation | TEXT (JSON) | reasons, missing, gap, priority |
| status | TEXT | new / shortlisted / rejected / flagged / applied / closed |
| dedupe_key | TEXT UNIQUE | `source:source_job_id` or normalized `company|title|url` |

### `contacts`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| company_name | TEXT | |
| recruiter_name | TEXT | publicly identified only |
| designation | TEXT | |
| email | TEXT | only if publicly published; never guessed |
| phone | TEXT | only if public |
| linkedin_url | TEXT | public profile link |
| source | TEXT | where discovered |
| verification_status | TEXT | verified / unverified / unavailable |
| related_job_id | INTEGER FK→jobs.id | nullable |

### `applications`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| job_id | INTEGER FK→jobs.id | |
| resume_path | TEXT | tailored resume file |
| cover_letter_path | TEXT | |
| application_status | TEXT | draft / needs_human / ready / submitted / failed |
| applied_at | TEXT | nullable until submitted |
| last_followup | TEXT | nullable |
| next_followup | TEXT | nullable |
| screenshots | TEXT (JSON) | list of screenshot paths |
| notes | TEXT | |

### `outreach`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| job_id | INTEGER FK→jobs.id | |
| contact_id | INTEGER FK→contacts.id | nullable |
| channel | TEXT | email / whatsapp / linkedin |
| message_subject | TEXT | email only |
| message_content | TEXT | exact text shown for approval |
| approval_status | TEXT | draft / review / approved / sent / rejected / failed / pending / followup_required |
| gmail_draft_id | TEXT | nullable |
| sent_at | TEXT | nullable |
| response_status | TEXT | none / replied / bounced / no_response |
| created_at | TEXT | |

### `email_events`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| application_id | INTEGER FK→applications.id | nullable |
| gmail_message_id | TEXT UNIQUE | dedupe key |
| event_type | TEXT | interview / rejection / offer / assessment / recruiter_reply / other |
| received_at | TEXT | |
| summary | TEXT | short classification summary |

### `candidate_profile` (singleton)
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | always 1 |
| candidate_information | TEXT (JSON) | name, experience, designation, notice, etc. |
| contact_details | TEXT (JSON) | email/phone/linkedin — entered at onboarding, **not** seeded from git |
| preferences | TEXT (JSON) | titles, locations, industries, salary floor |
| skills | TEXT (JSON) | operations / platforms / analytics |
| resume_path | TEXT | master CV path |
| resume_text | TEXT | parsed plain text (source of truth for generation) |
| updated_at | TEXT | |

## Operational tables (not in §12, support §17 scheduling)

### `discovery_runs`
| id PK | started_at | finished_at | source | found | new | error |

### `scheduler_state`
| job_name PK | last_run_at | last_status | next_run_at |

## Dedupe strategy
Primary key for dedupe is `source:source_job_id`. When a source id is unavailable
(career pages), fall back to a slug of `normalize(company)|normalize(title)|host(url)`.
Insert uses SQLite `INSERT … ON CONFLICT(dedupe_key) DO NOTHING`.
