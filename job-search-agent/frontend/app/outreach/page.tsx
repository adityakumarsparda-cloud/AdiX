"use client";

import { useEffect, useState } from "react";
import { api, type Outreach } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  review: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  sent: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  pending: "bg-gray-100 text-gray-500",
};

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="text-xs rounded border border-gray-200 px-2 py-0.5 hover:bg-gray-50"
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

export default function OutreachPage() {
  const [items, setItems] = useState<Outreach[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setItems(await api.outreachList());
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function act(id: number, action: "review" | "approve" | "reject" | "send") {
    try {
      await api.outreachAction(id, action);
    } catch (e) {
      setError(String(e));
    }
    await refresh();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-brand">Outreach approval queue</h2>
      <p className="text-sm text-gray-500">
        Nothing is sent without your approval. Email sends go through Gmail once approved;
        WhatsApp and LinkedIn are copy-only — you send them yourself.
      </p>
      {error && <div className="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

      {items.length === 0 && <div className="text-gray-400 text-sm">No outreach yet.</div>}

      {items.map((o) => (
        <div key={o.id} className="rounded-lg bg-white border border-gray-100 shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">
              #{o.id} · {o.channel}
              {o.message_subject ? ` · ${o.message_subject}` : ""}
            </div>
            <span className={`rounded px-2 py-0.5 text-xs ${STATUS_COLOR[o.approval_status] ?? ""}`}>
              {o.approval_status}
            </span>
          </div>

          {o.channel === "linkedin" && o.linkedin_variants ? (
            <div className="space-y-2">
              {Object.entries(o.linkedin_variants).map(([k, v]) => (
                <div key={k} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase text-gray-400">{k}</span>
                    <Copy text={v} />
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{v}</p>
                </div>
              ))}
              {o.linkedin_profile && (
                <a href={o.linkedin_profile} target="_blank" rel="noreferrer" className="text-brand text-sm underline">
                  Open LinkedIn profile
                </a>
              )}
            </div>
          ) : (
            <div className="text-sm">
              <div className="flex items-center gap-2 mb-1">
                <Copy text={o.message_content} />
                {o.whatsapp_link && (
                  <a href={o.whatsapp_link} target="_blank" rel="noreferrer" className="text-green-700 text-xs underline">
                    Open WhatsApp draft
                  </a>
                )}
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{o.message_content}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {o.approval_status === "draft" && (
              <button onClick={() => act(o.id, "review")} className="text-xs rounded bg-brand-light text-white px-3 py-1">
                Move to review
              </button>
            )}
            {o.approval_status === "review" && (
              <button onClick={() => act(o.id, "approve")} className="text-xs rounded bg-brand text-white px-3 py-1">
                Approve
              </button>
            )}
            {o.approval_status === "approved" && (
              <button onClick={() => act(o.id, "send")} className="text-xs rounded bg-green-700 text-white px-3 py-1">
                {o.channel === "email" ? "Send via Gmail" : "Mark as sent"}
              </button>
            )}
            {["draft", "review", "approved"].includes(o.approval_status) && (
              <button onClick={() => act(o.id, "reject")} className="text-xs rounded border border-gray-200 px-3 py-1">
                Reject
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
