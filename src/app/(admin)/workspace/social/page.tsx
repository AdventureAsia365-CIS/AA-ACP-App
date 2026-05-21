"use client";

import { useEffect, useState, useCallback } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Auth ──────────────────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("acp_admin_token");
}

function authHeaders(): HeadersInit {
  const t = getToken();
  return t
    ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function preview(obj: Record<string, unknown> | null, maxLen = 100): string {
  if (!obj) return "—";
  const text = Object.values(obj)
    .filter((v) => typeof v === "string")
    .join(" ");
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text || "—";
}

function validationBadge(status: string | null) {
  const styles: Record<string, string> = {
    passed: "bg-green-100 text-green-700",
    failed_rewrite: "bg-red-100 text-red-700",
    flagged_human: "bg-yellow-100 text-yellow-700",
    pending: "bg-gray-100 text-gray-600",
  };
  return styles[status ?? ""] ?? "bg-gray-100 text-gray-500";
}

function hitlBadge(status: string | null) {
  const styles: Record<string, string> = {
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    pending: "bg-amber-100 text-amber-700",
  };
  return styles[status ?? ""] ?? "bg-gray-100 text-gray-400";
}

const VALIDATION_FILTERS = ["All", "pending", "passed", "failed_rewrite", "flagged_human"];

// ── Component ─────────────────────────────────────────────────────────────────

export default function SocialContentPage() {
  const [rows, setRows] = useState<SocialContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tenant_id: "aa_internal" });
      if (statusFilter !== "All") params.set("validation_status", statusFilter);
      const res = await fetch(`${API_BASE}/v1/social?${params}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SocialContent[] = await res.json();
      setRows(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load social content");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Content</h1>
          <p className="text-sm text-gray-500 mt-1">
            S4 Social pipeline output — TikTok, Facebook Post, Facebook Ad
          </p>
        </div>
        <button
          onClick={fetchData}
          className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {/* Validation status filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {VALIDATION_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-sm px-3 py-1 rounded-full border transition-colors ${
              statusFilter === s
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400">Loading social content…</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="font-medium">No social content yet</p>
          <p className="text-sm mt-1">Run S4 Social pipeline to generate TikTok + Facebook content</p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <p className="text-sm text-gray-500 mb-3">{rows.length} row(s)</p>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "Tour",
                    "TikTok preview",
                    "Facebook Post preview",
                    "Validation",
                    "HITL Gate 3",
                    "Rewrites",
                    "Created",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.social_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                      {row.tour_name ?? row.tour_id.slice(0, 8) + "…"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate font-mono text-xs">
                      {preview(row.tiktok)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate font-mono text-xs">
                      {preview(row.facebook_post)}
                    </td>
                    <td className="px-4 py-3">
                      {row.validation_status ? (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${validationBadge(
                            row.validation_status
                          )}`}
                        >
                          {row.validation_status}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.hitl_gate_3_social_status ? (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${hitlBadge(
                            row.hitl_gate_3_social_status
                          )}`}
                        >
                          {row.hitl_gate_3_social_status}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-center">
                      {row.rewrite_attempt ?? 0}
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleDateString("en-AU", {
                            day: "2-digit",
                            month: "short",
                            year: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
