"use client";

import { adminHeaders } from "@/lib/admin-auth";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

// ── Types ─────────────────────────────────────────────────────────────────────

type PlatformKey = "tiktok" | "facebook_post" | "facebook_ad";

interface SocialContent {
  social_id: string;
  run_id: string;
  tenant_id: string;
  tour_id: string;
  tour_name: string | null;
  tiktok: Record<string, unknown> | null;
  facebook_post: Record<string, unknown> | null;
  facebook_ad: Record<string, unknown> | null;
  validation_status: string | null;
  hitl_gate_3_social_status: string | null;
  rewrite_attempt: number | null;
  created_at: string | null;
}

interface CellDecision {
  status: "approved" | "rejected" | null;
  notes: string;
}

type DecisionMap = Record<string, Record<PlatformKey, CellDecision>>;

interface BatchResult {
  processed: number;
  approved: number;
  rejected: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLATFORMS: { key: PlatformKey; label: string }[] = [
  { key: "tiktok", label: "TikTok" },
  { key: "facebook_post", label: "FB Post" },
  { key: "facebook_ad", label: "FB Ad" },
];

function contentPreview(obj: Record<string, unknown> | null, maxLen = 50): string {
  if (!obj) return "—";
  const text = Object.values(obj)
    .filter((v) => typeof v === "string")
    .join(" ");
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text || "—";
}

function emptyDecision(): CellDecision {
  return { status: null, notes: "" };
}

function initDecisions(rows: SocialContent[]): DecisionMap {
  const map: DecisionMap = {};
  for (const row of rows) {
    map[row.social_id] = {
      tiktok: emptyDecision(),
      facebook_post: emptyDecision(),
      facebook_ad: emptyDecision(),
    };
  }
  return map;
}

function hitlBadge(status: string | null): string {
  const styles: Record<string, string> = {
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    pending: "bg-amber-100 text-amber-700",
  };
  return styles[status ?? ""] ?? "bg-gray-100 text-gray-400";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SocialBatchReviewPage() {
  const [rows, setRows] = useState<SocialContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<DecisionMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<BatchResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSubmitResult(null);
    try {
      const res = await fetch(`${API_BASE}/v1/social?tenant_id=aa_internal&limit=200`, {
        headers: adminHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SocialContent[] = await res.json();
      setRows(data);
      setDecisions(initDecisions(data));

      const runIds = [...new Set(data.map((r) => r.run_id))];
      setSelectedRunId(runIds[0] ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Runs available for the dropdown
  const runIds = useMemo(() => [...new Set(rows.map((r) => r.run_id))], [rows]);

  // Rows for the currently selected run
  const visibleRows = useMemo(
    () => (selectedRunId ? rows.filter((r) => r.run_id === selectedRunId) : rows),
    [rows, selectedRunId]
  );

  // ── Decision helpers ──────────────────────────────────────────────────────

  function setCell(socialId: string, platform: PlatformKey, patch: Partial<CellDecision>) {
    setDecisions((prev) => ({
      ...prev,
      [socialId]: {
        ...prev[socialId],
        [platform]: { ...prev[socialId][platform], ...patch },
      },
    }));
  }

  function handleCellToggle(socialId: string, platform: PlatformKey, status: "approved" | "rejected") {
    const current = decisions[socialId]?.[platform]?.status;
    setCell(socialId, platform, { status: current === status ? null : status });
  }

  function handleNotes(socialId: string, platform: PlatformKey, notes: string) {
    setCell(socialId, platform, { notes });
  }

  function bulkApprove(platform: PlatformKey | "all") {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const row of visibleRows) {
        if (row.hitl_gate_3_social_status) continue;
        const platforms: PlatformKey[] = platform === "all" ? ["tiktok", "facebook_post", "facebook_ad"] : [platform];
        next[row.social_id] = { ...next[row.social_id] };
        for (const p of platforms) {
          next[row.social_id][p] = { ...next[row.social_id][p], status: "approved" };
        }
      }
      return next;
    });
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    let approved = 0;
    let rejected = 0;
    let pending = 0;
    for (const row of visibleRows) {
      if (row.hitl_gate_3_social_status) continue;
      for (const { key } of PLATFORMS) {
        const s = decisions[row.social_id]?.[key]?.status ?? null;
        if (s === "approved") approved++;
        else if (s === "rejected") rejected++;
        else pending++;
      }
    }
    return { approved, rejected, pending };
  }, [decisions, visibleRows]);

  // ── Submit ────────────────────────────────────────────────────────────────

  function buildPayload() {
    const out: { social_id: string; status: "approved" | "rejected"; notes?: string }[] = [];
    for (const row of visibleRows) {
      if (row.hitl_gate_3_social_status) continue;
      for (const { key } of PLATFORMS) {
        const cell = decisions[row.social_id]?.[key];
        if (!cell?.status) continue;
        const entry: { social_id: string; status: "approved" | "rejected"; notes?: string } = {
          social_id: row.social_id,
          status: cell.status,
        };
        if (cell.notes) entry.notes = cell.notes;
        out.push(entry);
      }
    }
    return out;
  }

  async function handleSubmit() {
    const payload = buildPayload();
    if (!payload.length) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/social/batch-review`, {
        method: "POST",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ decisions: payload, reviewer_id: "trang" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `HTTP ${res.status}`);
      }
      const result: BatchResult = await res.json();
      setSubmitResult(result);
      await fetchData();
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  const pendingDecisions = buildPayload().length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-screen-xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gate 3 — Social Review</h1>
          <p className="text-sm text-gray-500 mt-1">Bulk approve or reject social content per tour</p>
        </div>
        <button
          onClick={fetchData}
          className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {/* Run selector */}
      {runIds.length > 1 && (
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Run:</label>
          <select
            value={selectedRunId ?? ""}
            onChange={(e) => setSelectedRunId(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            {runIds.map((id) => (
              <option key={id} value={id}>
                {id.slice(0, 8)}…
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-400">{visibleRows.length} tours</span>
        </div>
      )}

      {loading && <div className="text-center py-12 text-gray-400">Loading…</div>}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700 text-sm mb-4">
          {error}
        </div>
      )}

      {submitResult && (
        <div className="bg-green-50 border border-green-200 rounded p-4 text-green-800 text-sm mb-4">
          Submitted: {submitResult.processed} processed — {submitResult.approved} approved,{" "}
          {submitResult.rejected} rejected
        </div>
      )}

      {!loading && !error && visibleRows.length === 0 && (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="font-medium">No social content</p>
          <p className="text-sm mt-1">Run S4 Social pipeline first</p>
        </div>
      )}

      {!loading && !error && visibleRows.length > 0 && (
        <>
          {/* Bulk action bar */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {PLATFORMS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => bulkApprove(key)}
                className="text-xs px-3 py-1.5 rounded border border-green-300 text-green-700 hover:bg-green-50 font-medium"
              >
                Approve All {label}
              </button>
            ))}
            <button
              onClick={() => bulkApprove("all")}
              className="text-xs px-3 py-1.5 rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-medium"
            >
              Approve All
            </button>
          </div>

          {/* Grid table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-48">
                    Tour
                  </th>
                  {PLATFORMS.map(({ key, label }) => (
                    <th
                      key={key}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {visibleRows.map((row) => {
                  const alreadyReviewed = Boolean(row.hitl_gate_3_social_status);
                  return (
                    <tr key={row.social_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 align-top">
                        <div className="truncate max-w-[10rem]">
                          {row.tour_name ?? row.tour_id.slice(0, 8) + "…"}
                        </div>
                        {alreadyReviewed && (
                          <span
                            className={`mt-1 inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${hitlBadge(
                              row.hitl_gate_3_social_status
                            )}`}
                          >
                            {row.hitl_gate_3_social_status}
                          </span>
                        )}
                      </td>
                      {PLATFORMS.map(({ key, label }) => {
                        const cell = decisions[row.social_id]?.[key] ?? emptyDecision();
                        const content = row[key];
                        return (
                          <td key={key} className="px-4 py-3 align-top min-w-[200px]">
                            {alreadyReviewed ? (
                              <p className="text-xs text-gray-400 italic">reviewed</p>
                            ) : (
                              <>
                                <p className="text-xs text-gray-500 mb-2 font-mono leading-snug">
                                  {contentPreview(content)}
                                </p>
                                <div className="flex gap-1 mb-1">
                                  <button
                                    onClick={() => handleCellToggle(row.social_id, key, "approved")}
                                    title={`Approve ${label}`}
                                    className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                                      cell.status === "approved"
                                        ? "bg-green-500 text-white border-green-500"
                                        : "border-gray-300 text-gray-600 hover:border-green-400 hover:text-green-600"
                                    }`}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => handleCellToggle(row.social_id, key, "rejected")}
                                    title={`Reject ${label}`}
                                    className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                                      cell.status === "rejected"
                                        ? "bg-red-500 text-white border-red-500"
                                        : "border-gray-300 text-gray-600 hover:border-red-400 hover:text-red-600"
                                    }`}
                                  >
                                    ✕
                                  </button>
                                </div>
                                {cell.status === "rejected" && (
                                  <textarea
                                    rows={2}
                                    placeholder="Reason (optional)"
                                    value={cell.notes}
                                    onChange={(e) => handleNotes(row.social_id, key, e.target.value)}
                                    className="w-full text-xs border border-gray-300 rounded px-2 py-1 mt-1 resize-none focus:outline-none focus:border-red-400"
                                  />
                                )}
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Sticky summary + submit bar */}
      {!loading && !error && visibleRows.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-6 py-3 flex items-center justify-between z-10">
          <div className="flex gap-4 text-sm">
            <span className="text-green-700 font-medium">{summary.approved} approved</span>
            <span className="text-red-700 font-medium">{summary.rejected} rejected</span>
            <span className="text-gray-500">{summary.pending} pending</span>
          </div>
          <div className="flex items-center gap-3">
            {submitError && (
              <span className="text-xs text-red-600">{submitError}</span>
            )}
            <button
              onClick={handleSubmit}
              disabled={pendingDecisions === 0 || submitting}
              className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
                pendingDecisions === 0 || submitting
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              {submitting ? "Submitting…" : `Submit ${pendingDecisions > 0 ? `(${pendingDecisions})` : ""}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
