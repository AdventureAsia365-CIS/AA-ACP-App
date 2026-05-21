"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

interface BlogDraftFull {
  draft_id: string;
  run_id: string;
  tenant_id: string;
  title: string;
  slug: string | null;
  content_md: string | null;
  word_count: number | null;
  seo_title: string | null;
  seo_meta: string | null;
  evaluator_score: number | null;
  evaluator_input_hash: string | null;
  review_flags: unknown[] | null;
  validation_passed: boolean | null;
  validation_score: number | null;
  failing_checks: string[] | null;
  repair_targets: unknown[] | null;
  seo_score: number | null;
  seo_issues: string[] | null;
  hitl_gate3_status: string | null;
  hitl_reviewer_id: string | null;
  hitl_decided_at: string | null;
  rewrite_count: number | null;
  pipeline_version: string | null;
  created_at: string | null;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("acp_admin_token");
}

function authHeaders(extra: Record<string, string> = {}): HeadersInit {
  const t = getToken();
  return { ...(t ? { Authorization: `Bearer ${t}` } : {}), "Content-Type": "application/json", ...extra };
}

function ScorePill({ label, score, max = 10 }: { label: string; score: number | null; max?: number }) {
  if (score === null) return <div className="text-sm text-gray-400">{label}: —</div>;
  const pct = (score / max) * 100;
  const color = pct >= 80 ? "bg-green-500" : pct >= 70 ? "bg-yellow-400" : "bg-red-500";
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-gray-600 mb-0.5">
        <span>{label}</span><span>{score.toFixed(1)}/{max}</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

export default function BlogDraftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [draft, setDraft] = useState<BlogDraftFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewerId, setReviewerId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hitlMsg, setHitlMsg] = useState<string | null>(null);

  const fetchDraft = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/acp/s4/blog/drafts/${id}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDraft(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDraft(); }, [fetchDraft]);

  const submitHitl = async (status: "approved" | "rejected") => {
    if (!reviewerId.trim()) { alert("Reviewer ID required"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/v1/acp/s4/blog/drafts/${id}/hitl`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status, reviewer_id: reviewerId, notes }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHitlMsg(`Draft ${status} by ${reviewerId}`);
      await fetchDraft();
    } catch (e: unknown) {
      setHitlMsg(e instanceof Error ? e.message : "HITL failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6 text-gray-400">Loading draft…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!draft) return <div className="p-6 text-gray-400">Draft not found</div>;

  const canDecide = draft.hitl_gate3_status === "pending" || draft.hitl_gate3_status === "flagged_human";

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-4">
        <a href="/workspace/s4/blog" className="text-sm text-indigo-600 hover:underline">← Back to blog drafts</a>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{draft.title || "Untitled draft"}</h1>
      <p className="text-sm text-gray-500 mb-6">{draft.slug} · {draft.word_count ?? "?"} words · v{draft.pipeline_version}</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main content */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg p-6 prose prose-sm max-w-none overflow-auto max-h-[70vh]">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
              {draft.content_md || "No content generated."}
            </pre>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* Scores */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm">Quality Scores</h3>
            <ScorePill label="Evaluator" score={draft.evaluator_score} />
            <ScorePill label="Validation" score={draft.validation_score ? draft.validation_score / 10 : null} max={1} />
            <ScorePill label="SEO" score={draft.seo_score} />
            <div className="mt-2 text-xs text-gray-400 font-mono break-all">
              Hash: {draft.evaluator_input_hash?.slice(0, 16) ?? "—"}…
            </div>
          </div>

          {/* Failing checks */}
          {draft.failing_checks && draft.failing_checks.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-800 mb-2 text-sm">Failing Checks ({draft.failing_checks.length})</h3>
              <ul className="space-y-1">
                {draft.failing_checks.slice(0, 10).map((c, i) => (
                  <li key={i} className="text-xs text-red-700 font-mono">{c}</li>
                ))}
                {draft.failing_checks.length > 10 && (
                  <li className="text-xs text-red-400">+{draft.failing_checks.length - 10} more…</li>
                )}
              </ul>
            </div>
          )}

          {/* SEO issues */}
          {draft.seo_issues && draft.seo_issues.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-800 mb-2 text-sm">SEO Issues</h3>
              <ul className="space-y-1">
                {draft.seo_issues.map((issue, i) => (
                  <li key={i} className="text-xs text-amber-700">{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Review flags */}
          {draft.review_flags && draft.review_flags.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-2 text-sm">Review Flags ({draft.review_flags.length})</h3>
              <p className="text-xs text-yellow-700">{draft.review_flags.length} rule flags triggered</p>
            </div>
          )}

          {/* HITL decision */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-2 text-sm">HITL Gate 3</h3>
            <div className="mb-3">
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                draft.hitl_gate3_status === "approved" ? "bg-green-100 text-green-700"
                  : draft.hitl_gate3_status === "rejected" ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
              }`}>
                {draft.hitl_gate3_status ?? "—"}
              </span>
              {draft.hitl_reviewer_id && (
                <p className="text-xs text-gray-400 mt-1">
                  by {draft.hitl_reviewer_id} · {draft.hitl_decided_at ? new Date(draft.hitl_decided_at).toLocaleDateString() : ""}
                </p>
              )}
            </div>

            {canDecide && (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Your reviewer ID"
                  value={reviewerId}
                  onChange={(e) => setReviewerId(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <textarea
                  placeholder="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => submitHitl("approved")}
                    disabled={submitting}
                    className="flex-1 text-sm py-1.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => submitHitl("rejected")}
                    disabled={submitting}
                    className="flex-1 text-sm py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}
            {hitlMsg && <p className="text-xs text-gray-600 mt-2">{hitlMsg}</p>}
          </div>

          {/* SEO meta */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-2 text-sm">SEO</h3>
            <p className="text-xs font-medium text-gray-700">{draft.seo_title}</p>
            <p className="text-xs text-gray-500 mt-1">{draft.seo_meta}</p>
          </div>

        </div>
      </div>
    </div>
  );
}
