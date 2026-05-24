"use client";
// workspace/pipeline/s3/page.tsx — ACP S3 Content Calendar + Gate 2
// GET  /v1/s3/runs/{run_id}          → S3 run data (calendar, ads plan)
// GET  /v1/acp/runs                  → list all runs
// POST /v1/hitl/gate2/{run_id}/approve → Gate 2 approve
// POST /v1/hitl/gate2/{run_id}/reject  → Gate 2 reject

import { adminHeaders } from "@/lib/admin-auth";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

interface CalendarRow {
  week?: number;
  date?: string;
  topic?: string;
  format?: string;
  platform?: string;
  cta?: string;
  status?: string;
}

interface AdGroup {
  name: string;
  keywords?: string[];
  headlines?: string[];
  descriptions?: string[];
}

interface Campaign {
  campaign_name: string;
  objective?: string;
  ad_groups?: AdGroup[];
}

interface S3Run {
  run_id: string;
  status: string;
  started_at: string | null;
  hitl_status: string | null;
  hitl_expires_at: string | null;
  calendar_summary?: {
    expanded_markdown?: string;
    funnel_mix?: { tofu: number; mofu: number; bofu: number };
  };
  ads_summary?: {
    campaigns?: Campaign[];
    bid_strategy?: string;
    budget_estimate?: string;
  };
  validation_errors?: string[];
}

interface RunListItem { run_id: string; status: string; started_at: string | null; }

function FunnelBar({ mix }: { mix: { tofu: number; mofu: number; bofu: number } }) {
  const total = mix.tofu + mix.mofu + mix.bofu || 100;
  return (
    <div>
      <div className="flex rounded-full overflow-hidden h-3 mb-2">
        <div className="bg-blue-400" style={{ width: `${(mix.tofu / total) * 100}%` }} />
        <div className="bg-green-400" style={{ width: `${(mix.mofu / total) * 100}%` }} />
        <div className="bg-orange-400" style={{ width: `${(mix.bofu / total) * 100}%` }} />
      </div>
      <div className="flex gap-4 text-xs text-gray-500">
        <span><span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" />TOFU {mix.tofu}%</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />MOFU {mix.mofu}%</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-orange-400 mr-1" />BOFU {mix.bofu}%</span>
      </div>
    </div>
  );
}

function Gate2Panel({ run, onAction }: { run: S3Run; onAction: () => void }) {
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");

  const isPending = !run.hitl_status || run.hitl_status === "pending";
  const isApproved = run.hitl_status === "approved";
  const isRejected = run.hitl_status === "rejected";

  async function act(action: "approve" | "reject") {
    if (action === "reject" && !notes.trim()) { setError("Notes required when rejecting"); return; }
    setActing(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/hitl/gate2/${run.run_id}/${action}`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Failed");
      onAction();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(false);
    }
  }

  return (
    <div className={`rounded-xl border-2 p-5 ${isApproved ? "border-green-300 bg-green-50" : isRejected ? "border-red-300 bg-red-50" : "border-red-400 bg-red-50"}`}>
      <div className="flex items-center gap-3 mb-3">
        <p className="text-sm font-bold text-aa-blackblue">⚠️ Gate 2 — Commercial Review</p>
        {isApproved && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✓ Approved</span>}
        {isRejected && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">✗ Rejected</span>}
        {isPending && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Manual Review Required</span>}
      </div>

      <p className="text-xs text-red-700 italic mb-4">
        Ms. Thu approval required. This gate NEVER auto-approves.
      </p>

      {run.validation_errors && run.validation_errors.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Validation Issues</p>
          <ul className="space-y-1">
            {run.validation_errors.map((e, i) => <li key={i} className="text-xs text-red-600">• {e}</li>)}
          </ul>
        </div>
      )}

      {isPending && (
        <div className="space-y-2">
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Revision notes (required if rejecting)…"
            className="w-full text-sm border border-gray-200 rounded-lg p-2.5 resize-none h-20 focus:outline-none focus:border-aa-orange" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => act("approve")} disabled={acting}
              className="flex-1 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
              ✓ Approve Gate 2
            </button>
            <button onClick={() => act("reject")} disabled={acting}
              className="flex-1 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
              ✗ Reject + Notes
            </button>
          </div>
        </div>
      )}

      {isApproved && (
        <Link href={`/workspace/pipeline/s4?run_id=${run.run_id}`}
          className="inline-block mt-2 px-4 py-2 bg-aa-orange text-white text-sm font-semibold rounded-lg hover:opacity-90">
          → Proceed to S4
        </Link>
      )}
    </div>
  );
}

function S3Content({ runId }: { runId: string }) {
  const [run, setRun] = useState<S3Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [calTab, setCalTab] = useState<"table" | "markdown">("table");
  const [expandedAg, setExpandedAg] = useState<number | null>(null);

  function load() {
    setLoading(true);
    fetch(`${API_BASE}/v1/s3/runs/${runId}`, { headers: adminHeaders() })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setRun)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { if (runId) load(); }, [runId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Loading S3 data…</div>;
  if (error) return <div className="text-sm text-red-600 py-8 text-center">{error}</div>;
  if (!run) return <div className="text-sm text-gray-400 py-8 text-center">No S3 data.</div>;

  const cal = run.calendar_summary;
  const ads = run.ads_summary;

  // Parse calendar table rows from markdown (rough extraction)
  const calRows: CalendarRow[] = [];
  if (cal?.expanded_markdown) {
    const lines = cal.expanded_markdown.split("\n").filter(l => l.startsWith("|"));
    lines.slice(2).forEach((line, i) => {
      const cells = line.split("|").map(c => c.trim()).filter(Boolean);
      if (cells.length >= 4) {
        calRows.push({
          week: i + 1,
          topic: cells[0] || "",
          format: cells[1] || "",
          platform: cells[2] || "",
          cta: cells[3] || "",
        });
      }
    });
  }

  return (
    <>
      {/* Content Calendar */}
      {cal && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Content Calendar</p>
            <div className="flex gap-1">
              {(["table", "markdown"] as const).map(t => (
                <button key={t} onClick={() => setCalTab(t)}
                  className={`px-3 py-1 text-xs rounded ${calTab === t ? "bg-aa-orange text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {cal.funnel_mix && <div className="mb-4"><FunnelBar mix={cal.funnel_mix} /></div>}

          {calTab === "table" && calRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Wk</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Topic</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Format</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Platform</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">CTA</th>
                  </tr>
                </thead>
                <tbody>
                  {calRows.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-2.5 text-gray-500">{r.week}</td>
                      <td className="px-3 py-2.5 font-medium text-aa-blackblue">{r.topic}</td>
                      <td className="px-3 py-2.5 text-gray-600">{r.format}</td>
                      <td className="px-3 py-2.5 text-gray-600">{r.platform}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{r.cta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {calTab === "markdown" && cal.expanded_markdown && (
            <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{cal.expanded_markdown}</pre>
          )}
        </div>
      )}

      {/* Ads Plan */}
      {ads && ads.campaigns && ads.campaigns.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Google Ads Plan</p>
          {ads.bid_strategy && <p className="text-sm text-gray-600 mb-2">Strategy: <strong>{ads.bid_strategy}</strong></p>}
          {ads.budget_estimate && <p className="text-sm text-gray-600 mb-4">Budget: <strong>{ads.budget_estimate}</strong></p>}

          {ads.campaigns.map((camp, ci) => (
            <div key={ci} className="mb-4 border border-gray-100 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 font-semibold text-sm text-aa-blackblue">
                {camp.campaign_name} {camp.objective && <span className="font-normal text-gray-500">· {camp.objective}</span>}
              </div>
              {camp.ad_groups?.map((ag, agi) => (
                <div key={agi} className="border-t border-gray-100">
                  <button onClick={() => setExpandedAg(expandedAg === agi ? null : agi)}
                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 flex justify-between">
                    {ag.name}
                    <span className="text-gray-400">{expandedAg === agi ? "▲" : "▼"}</span>
                  </button>
                  {expandedAg === agi && (
                    <div className="px-4 pb-3 space-y-3">
                      {ag.keywords && ag.keywords.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Keywords</p>
                          <div className="flex flex-wrap gap-1.5">
                            {ag.keywords.map((k, ki) => <span key={ki} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">{k}</span>)}
                          </div>
                        </div>
                      )}
                      {ag.headlines && ag.headlines.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Headlines</p>
                          <ol className="space-y-1">
                            {ag.headlines.map((h, hi) => (
                              <li key={hi} className="text-xs text-gray-600 flex items-start gap-2">
                                <span className="text-gray-400">{hi + 1}.</span>
                                <span>{h}</span>
                                <span className={`ml-auto text-xs ${h.length > 30 ? "text-red-500" : "text-gray-400"}`}>({h.length}/30)</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {ag.descriptions && ag.descriptions.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Descriptions</p>
                          <ol className="space-y-1">
                            {ag.descriptions.map((d, di) => (
                              <li key={di} className="text-xs text-gray-600 flex items-start gap-2">
                                <span className="text-gray-400">{di + 1}.</span>
                                <span>{d}</span>
                                <span className={`ml-auto text-xs ${d.length > 90 ? "text-red-500" : "text-gray-400"}`}>({d.length}/90)</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Gate 2 */}
      <Gate2Panel run={run} onAction={load} />
    </>
  );
}

function S3PageInner() {
  const searchParams = useSearchParams();
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [runId, setRunId] = useState(searchParams.get("run_id") || "");

  useEffect(() => {
    fetch(`${API_BASE}/v1/acp/runs`, { headers: adminHeaders() })
      .then(r => r.json()).then(d => setRuns(d.data || [])).catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-semibold text-aa-blackblue tracking-tight">S3 — Content Calendar + Gate 2</h1>
        <p className="text-sm text-gray-500 mt-1">12-week calendar · Google Ads plan · commercial review</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Select Run</p>
        <select value={runId} onChange={e => setRunId(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-aa-orange">
          <option value="">— Select a run —</option>
          {runs.map(r => (
            <option key={r.run_id} value={r.run_id}>
              {r.run_id.slice(0, 12)} · {r.status} · {r.started_at ? new Date(r.started_at).toLocaleDateString() : "—"}
            </option>
          ))}
        </select>
      </div>

      {runId && <S3Content runId={runId} />}
    </div>
  );
}

export default function S3Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading…</div>}>
      <S3PageInner />
    </Suspense>
  );
}
