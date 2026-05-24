"use client";

import { adminHeaders } from "@/lib/admin-auth";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

interface BlogDraft {
  draft_id: string;
  run_id: string;
  tenant_id: string;
  title: string;
  slug: string | null;
  word_count: number | null;
  evaluator_score: number | null;
  validation_passed: boolean | null;
  validation_score: number | null;
  hitl_gate3_status: string | null;
  rewrite_count: number | null;
  status: string | null;
  created_at: string | null;
}

function scoreBadge(score: number | null): string {
  if (score === null) return "bg-gray-100 text-gray-400";
  if (score >= 8) return "bg-green-100 text-green-700";
  if (score >= 7) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function hitlBadge(status: string | null): string {
  const m: Record<string, string> = {
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    pending: "bg-amber-100 text-amber-700",
    flagged_human: "bg-orange-100 text-orange-700",
  };
  return m[status ?? ""] ?? "bg-gray-100 text-gray-400";
}

const HITL_FILTERS = ["All", "pending", "flagged_human", "approved", "rejected"];

export default function S4BlogListPage() {
  const [drafts, setDrafts] = useState<BlogDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hitlFilter, setHitlFilter] = useState("All");

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tenant_id: "aa_internal" });
      if (hitlFilter !== "All") params.set("hitl_gate3_status", hitlFilter);
      const res = await fetch(`${API_BASE}/v1/acp/s4/blog/drafts?${params}`, {
        headers: adminHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDrafts(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [hitlFilter]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">S4 Blog Drafts</h1>
          <p className="text-sm text-gray-500 mt-1">
            LangGraph blog engine output — review, approve or reject
          </p>
        </div>
        <button onClick={fetchDrafts}
          className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">
          Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {HITL_FILTERS.map((f) => (
          <button key={f} onClick={() => setHitlFilter(f)}
            className={`text-sm px-3 py-1 rounded-full border transition-colors ${
              hitlFilter === f ? "bg-indigo-600 text-white border-indigo-600"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
            {f}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-12 text-gray-400">Loading drafts…</div>}
      {error && <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700 text-sm">{error}</div>}

      {!loading && !error && drafts.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-lg text-gray-400">
          <p className="font-medium">No blog drafts yet</p>
          <p className="text-sm mt-1">Trigger the S4 Blog Engine pipeline to generate content</p>
        </div>
      )}

      {!loading && !error && drafts.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Title", "Words", "Evaluator", "Validation", "HITL Gate 3", "Rewrites", "Created"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {drafts.map((d) => (
                <tr key={d.draft_id} className="hover:bg-indigo-50 cursor-pointer">
                  <td className="px-4 py-3">
                    <Link href={`/workspace/s4/blog/${d.draft_id}`}
                      className="font-medium text-indigo-700 hover:underline max-w-xs block truncate">
                      {d.title || "Untitled"}
                    </Link>
                    <span className="text-xs text-gray-400">{d.slug || ""}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 tabular-nums">{d.word_count ?? "—"}</td>
                  <td className="px-4 py-3">
                    {d.evaluator_score !== null ? (
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${scoreBadge(d.evaluator_score)}`}>
                        {d.evaluator_score.toFixed(1)}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {d.validation_passed !== null ? (
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${d.validation_passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {d.validation_passed ? "passed" : "failed"}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${hitlBadge(d.hitl_gate3_status)}`}>
                      {d.hitl_gate3_status ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-center">{d.rewrite_count ?? 0}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {d.created_at ? new Date(d.created_at).toLocaleDateString("en-AU", {day:"2-digit",month:"short",year:"2-digit"}) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
