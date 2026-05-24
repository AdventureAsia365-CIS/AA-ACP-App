"use client";
// workspace/pipeline/s4/page.tsx — ACP S4 Blog Drafts + Gate 3 + Final Status
// GET  /v1/acp/s4/blog/runs/{run_id} → S4 run status
// GET  /v1/acp/s4/blog/drafts        → list blog drafts (with ?run_id filter)
// GET  /v1/acp/s4/blog/drafts/{id}   → single draft
// GET  /v1/acp/gate/gate3/run/{id}   → Gate 3 status
// POST /v1/acp/gate/gate3/approve    → approve Gate 3
// POST /v1/acp/gate/gate3/reject     → reject Gate 3

import { adminHeaders } from "@/lib/admin-auth";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

interface BlogDraft {
  draft_id: string;
  run_id?: string;
  title?: string;
  target_keyword?: string;
  word_count?: number;
  seo_title?: string;
  seo_meta?: string;
  evaluator_score?: number;
  publish_status?: string;
  wordpress_url?: string;
  status?: string;
  blog_brief?: {
    title?: string;
    target_keyword?: string;
    outline?: string[];
  };
  blog_draft?: string;
  internal_links?: string[];
  social?: Array<{
    platform?: string;
    content?: string;
    post_url?: string;
    scheduled_at?: string;
  }>;
}

interface GateData {
  status: string | null;
  confidence_score?: number | null;
  auto_approved?: boolean;
  notes?: string | null;
}

interface RunListItem { run_id: string; status: string; started_at: string | null; }

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const map: Record<string, string> = {
    published: "bg-green-100 text-green-700",
    draft: "bg-gray-100 text-gray-600",
    failed: "bg-red-100 text-red-700",
    pending: "bg-amber-100 text-amber-700",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>{status}</span>;
}

function ScoreBadge({ score }: { score?: number }) {
  if (score === undefined || score === null) return null;
  const c = score >= 8 ? "bg-green-100 text-green-700" : score >= 6 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono ${c}`}>{score.toFixed(1)}</span>;
}

function DraftCard({ draft }: { draft: BlogDraft }) {
  const [tab, setTab] = useState<"blog" | "seo" | "published" | "social">("blog");
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 mb-4">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full px-5 py-4 text-left flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-serif font-semibold text-aa-blackblue">{draft.title || draft.blog_brief?.title || "Untitled"}</span>
          <StatusBadge status={draft.status || draft.publish_status} />
          <ScoreBadge score={draft.evaluator_score} />
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {draft.word_count && <span>{draft.word_count.toLocaleString()} words</span>}
          <span>{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-5">
          <div className="flex gap-1 mb-4">
            {(["blog", "seo", "published", "social"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${tab === t ? "bg-aa-orange text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab === "blog" && (
            <div className="space-y-4">
              {draft.blog_brief && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Brief</p>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                    {draft.blog_brief.title && <p className="text-sm font-semibold text-aa-blackblue">{draft.blog_brief.title}</p>}
                    {draft.blog_brief.target_keyword && <p className="text-xs text-blue-600">🔑 {draft.blog_brief.target_keyword}</p>}
                    {draft.blog_brief.outline && draft.blog_brief.outline.length > 0 && (
                      <ul className="mt-2 space-y-0.5">
                        {draft.blog_brief.outline.map((s, i) => <li key={i} className="text-xs text-gray-600">• {s}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              )}
              {draft.blog_draft && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Draft <span className="text-gray-400">({draft.word_count?.toLocaleString()} words)</span></p>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-64 overflow-y-auto">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{draft.blog_draft.slice(0, 2000)}{draft.blog_draft.length > 2000 ? "…" : ""}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "seo" && (
            <div className="space-y-3">
              {draft.seo_title && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                    SEO Title <span className={`${draft.seo_title.length > 70 ? "text-red-500" : "text-gray-400"}`}>({draft.seo_title.length}/70)</span>
                  </p>
                  <p className="text-sm text-aa-blackblue font-medium">{draft.seo_title}</p>
                </div>
              )}
              {draft.seo_meta && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                    Meta Description <span className={`${draft.seo_meta.length > 170 ? "text-red-500" : "text-gray-400"}`}>({draft.seo_meta.length}/170)</span>
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">{draft.seo_meta}</p>
                </div>
              )}
              {draft.internal_links && draft.internal_links.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Internal Links</p>
                  <ul className="space-y-1">
                    {draft.internal_links.map((l, i) => <li key={i} className="text-xs text-blue-600 break-all">{l}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {tab === "published" && (
            <div className="space-y-3">
              <StatusBadge status={draft.publish_status} />
              {draft.wordpress_url && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">WordPress URL</p>
                  <a href={draft.wordpress_url} target="_blank" rel="noreferrer"
                    className="text-sm text-aa-orange hover:underline break-all">
                    🔗 {draft.wordpress_url}
                  </a>
                </div>
              )}
              {draft.evaluator_score !== undefined && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Evaluator Score</p>
                  <ScoreBadge score={draft.evaluator_score} />
                </div>
              )}
            </div>
          )}

          {tab === "social" && (
            <div>
              {(!draft.social || draft.social.length === 0) ? (
                <p className="text-sm text-gray-400 italic">No social posts yet.</p>
              ) : (
                <div className="space-y-3">
                  {draft.social.map((s, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-aa-blackblue uppercase">{s.platform}</span>
                        {s.post_url && <a href={s.post_url} target="_blank" rel="noreferrer" className="text-xs text-aa-orange hover:underline">View →</a>}
                      </div>
                      <p className="text-sm text-gray-600">{s.content}</p>
                      {s.scheduled_at && <p className="text-xs text-gray-400 mt-1">Scheduled: {new Date(s.scheduled_at).toLocaleDateString()}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Gate3Panel({ runId, onAction }: { runId: string; onAction: () => void }) {
  const [gate, setGate] = useState<GateData | null>(null);
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!runId) return;
    fetch(`${API_BASE}/v1/acp/gate/gate3/run/${runId}`, { headers: adminHeaders() })
      .then(r => r.ok ? r.json() : null).then(d => { if (d) setGate(d); }).catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  async function act(action: "approve" | "reject") {
    if (action === "reject" && !notes.trim()) { setError("Notes required"); return; }
    setActing(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/acp/gate/gate3/${action}`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ run_id: runId, notes }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Failed");
      const d = await res.json();
      setGate(d);
      onAction();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setActing(false);
    }
  }

  const isPending = !gate?.status || gate.status === "pending";
  const isApproved = gate?.status === "approved";
  const isRejected = gate?.status === "rejected";

  return (
    <div className={`rounded-xl border-2 p-5 ${isApproved ? "border-green-300 bg-green-50" : isRejected ? "border-red-300 bg-red-50" : "border-orange-400 bg-orange-50"}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-aa-blackblue">Gate 3 — QA Review</p>
        {isApproved && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✓ Approved</span>}
        {isRejected && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">✗ Rejected</span>}
        {isPending && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">⏳ Pending</span>}
      </div>
      <p className="text-xs text-orange-700 italic mb-4">Trang · 48h SLA · NEVER auto-approves.</p>

      {gate?.notes && <p className="text-sm text-gray-600 italic mb-3">Notes: {gate.notes}</p>}

      {isPending && (
        <div className="space-y-2">
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="QA notes…"
            className="w-full text-sm border border-gray-200 rounded-lg p-2.5 resize-none h-16 focus:outline-none focus:border-aa-orange" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => act("approve")} disabled={acting}
              className="flex-1 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
              ✓ Pass Gate 3
            </button>
            <button onClick={() => act("reject")} disabled={acting}
              className="flex-1 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
              ✗ Needs Revision
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function S4Content({ runId }: { runId: string }) {
  const [drafts, setDrafts] = useState<BlogDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [gate3Done, setGate3Done] = useState(false);

  function load() {
    setLoading(true);
    fetch(`${API_BASE}/v1/acp/s4/blog/drafts${runId ? `?run_id=${runId}` : ""}`, { headers: adminHeaders() })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setDrafts(d.data || d.drafts || []))
      .catch(() => null)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [runId]); // eslint-disable-line react-hooks/exhaustive-deps

  const publishedCount = drafts.filter(d => d.publish_status === "published").length;
  const avgScore = drafts.length
    ? drafts.reduce((s, d) => s + (d.evaluator_score ?? 0), 0) / drafts.length
    : 0;

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Loading drafts…</div>;

  return (
    <>
      {/* Stats */}
      {drafts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">S4 Summary</p>
          <div className="flex gap-8 text-sm flex-wrap">
            <div><span className="text-gray-500">Drafts:</span> <strong className="text-aa-blackblue">{drafts.length}</strong></div>
            <div><span className="text-gray-500">Published:</span> <strong className="text-green-600">{publishedCount}</strong></div>
            <div><span className="text-gray-500">Avg Score:</span> <strong className={avgScore >= 8 ? "text-green-600" : "text-amber-600"}>{avgScore.toFixed(1)}</strong></div>
          </div>
        </div>
      )}

      {/* Blog drafts */}
      {drafts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400 mb-4">
          No blog drafts yet. Trigger S4 run or wait for pipeline.
        </div>
      ) : (
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Blog Drafts ({drafts.length})</p>
          {drafts.map(d => <DraftCard key={d.draft_id} draft={d} />)}
        </div>
      )}

      {/* Gate 3 */}
      <Gate3Panel runId={runId} onAction={() => { setGate3Done(true); load(); }} />

      {/* Final status */}
      {gate3Done && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">✅</div>
          <h2 className="font-serif text-xl font-semibold text-green-800 mb-1">Pipeline Complete</h2>
          <p className="text-sm text-green-700">
            {drafts.length} blog{drafts.length !== 1 ? "s" : ""} · avg score {avgScore.toFixed(1)} · run {runId.slice(0, 8)}
          </p>
          <Link href="/workspace/pipeline" className="inline-block mt-4 px-5 py-2 bg-aa-orange text-white text-sm font-semibold rounded-lg hover:opacity-90">
            View All Runs
          </Link>
        </div>
      )}
    </>
  );
}

function S4PageInner() {
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
        <h1 className="font-serif text-2xl font-semibold text-aa-blackblue tracking-tight">S4 — Publish + Gate 3</h1>
        <p className="text-sm text-gray-500 mt-1">Blog drafts · SEO · social posts · QA review</p>
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

      {runId ? <S4Content runId={runId} /> : (
        <div className="text-sm text-gray-400 text-center py-8">Select a run to view S4 output.</div>
      )}
    </div>
  );
}

export default function S4Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading…</div>}>
      <S4PageInner />
    </Suspense>
  );
}
