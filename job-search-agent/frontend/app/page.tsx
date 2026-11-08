"use client";

import { useEffect, useState } from "react";
import { api, type DashboardSummary, type Job } from "@/lib/api";

const BANDS: Record<string, string> = {
  excellent: "bg-green-100 text-green-800",
  strong: "bg-blue-100 text-blue-800",
  moderate: "bg-amber-100 text-amber-800",
  low: "bg-gray-100 text-gray-600",
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-100">
      <div className="text-2xl font-semibold text-brand">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setSummary(await api.summary());
      setJobs(await api.jobs("?limit=25"));
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function run(kind: "discover" | "score") {
    setBusy(kind);
    try {
      await (kind === "discover" ? api.discover() : api.score());
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <button
          onClick={() => run("discover")}
          disabled={!!busy}
          className="rounded-md bg-brand px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy === "discover" ? "Discovering…" : "Discover jobs"}
        </button>
        <button
          onClick={() => run("score")}
          disabled={!!busy}
          className="rounded-md bg-brand-light px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy === "score" ? "Scoring…" : "Score jobs"}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 text-red-700 text-sm px-4 py-3">
          {error} — is the backend running on :8000?
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Total jobs" value={summary.total_jobs} />
          <Stat label="Excellent" value={summary.excellent_matches} />
          <Stat label="Strong" value={summary.strong_matches} />
          <Stat label="Moderate" value={summary.moderate_matches} />
          <Stat label="Recruiters" value={summary.recruiters_identified} />
          <Stat label="Awaiting approval" value={summary.messages_awaiting_approval} />
          <Stat label="Applications" value={summary.applications_submitted} />
          <Stat label="Interviews" value={summary.interviews_scheduled} />
          <Stat label="Rejections" value={summary.rejections} />
          <Stat label="Offers" value={summary.offers_received} />
        </div>
      )}

      <div className="rounded-lg bg-white shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Company</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Match</th>
              <th className="px-4 py-2 font-medium">Location</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{j.company_name}</td>
                <td className="px-4 py-2">{j.job_title}</td>
                <td className="px-4 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${BANDS[j.match_band ?? "low"]}`}>
                    {j.match_score ?? "—"} {j.match_band ?? ""}
                  </span>
                </td>
                <td className="px-4 py-2">{j.location ?? "—"}</td>
                <td className="px-4 py-2">{j.status}</td>
                <td className="px-4 py-2">
                  {j.application_url && (
                    <a href={j.application_url} target="_blank" rel="noreferrer" className="text-brand underline">
                      View
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No jobs yet. Click “Discover jobs”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
