// API client. In dev, next.config.js rewrites /api/* to the FastAPI backend.

export interface DashboardSummary {
  total_jobs: number;
  excellent_matches: number;
  strong_matches: number;
  moderate_matches: number;
  applications_submitted: number;
  recruiters_identified: number;
  messages_awaiting_approval: number;
  interviews_scheduled: number;
  rejections: number;
  offers_received: number;
}

export interface Job {
  id: number;
  source: string;
  company_name: string;
  job_title: string;
  location: string | null;
  salary: string | null;
  application_url: string | null;
  match_score: number | null;
  match_band: string | null;
  status: string;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "POST" });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export interface Outreach {
  id: number;
  job_id: number;
  channel: string;
  approval_status: string;
  message_subject: string | null;
  message_content: string;
  whatsapp_link?: string;
  linkedin_variants?: Record<string, string>;
  linkedin_profile?: string | null;
}

export const api = {
  summary: () => get<DashboardSummary>("/api/dashboard/summary"),
  jobs: (qs = "") => get<Job[]>(`/api/jobs${qs}`),
  discover: () => post("/api/jobs/discover"),
  score: () => post("/api/jobs/score"),
  outreachList: () => get<Outreach[]>("/api/outreach"),
  outreachAction: (id: number, action: "review" | "approve" | "reject" | "send") =>
    post(`/api/outreach/${id}/${action}`),
};
