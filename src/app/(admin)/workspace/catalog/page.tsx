"use client";

import { adminHeaders, clearAdminSecret } from "@/lib/admin-auth";
import { useEffect, useState, useCallback } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

// ── types ─────────────────────────────────────────────────────────────────────

interface CatalogTour {
  id: string;
  tour_code: string;
  aa_name: string;
  country: string;
  supplier: string;
  review_status: string;
  updated_at: string | null;
}

interface RunConfig {
  model_id: string;
  seo_mode: string;
  brand_identity_id: string | null;
  language: string;
}

interface VersionContent {
  aa_name: string;
  aa_subtitle: string;
  aa_summary: string;
  aa_highlights: string[];
  aa_itineraries: string[];
  seo_title: string;
  seo_meta: string;
  og_tags: Record<string, string>;
}

interface FailureCode {
  code?: string;
  detail?: string;
}

interface TourVersion {
  id: string;
  raw_tour_id: string;
  acp_run_id: string;
  run_config: RunConfig;
  content: VersionContent | null;
  quality_score: number | null;
  status: "draft" | "approved" | "published" | "rejected";
  is_active: boolean;
  failure_codes: FailureCode[];
  created_at: string;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function modelLabel(modelId: string): string {
  if (modelId.includes("sonnet")) return "Sonnet 4.5";
  if (modelId.includes("haiku")) return "Haiku 4.5";
  return modelId;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${min}`;
}

// ── small components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft:     "bg-gray-100 text-gray-600",
    approved:  "bg-green-100 text-green-700",
    published: "bg-blue-100 text-blue-700",
    rejected:  "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
        map[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {status}
    </span>
  );
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg">
      {message}
    </div>
  );
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {[...Array(4)].map((_, i) => (
        <tr key={i} className="border-b">
          {[...Array(cols)].map((__, j) => (
            <td key={j} className="px-3 py-3">
              <div className="h-3 bg-gray-100 rounded animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── ExpandableText ────────────────────────────────────────────────────────────

function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 200;
  const display = expanded || !isLong ? text : text.slice(0, 200) + "…";
  return (
    <div>
      <p className="text-xs text-gray-700 leading-relaxed">{display}</p>
      {isLong && (
        <button
          className="text-xs text-blue-600 mt-1 hover:underline"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

// ── CompareView ───────────────────────────────────────────────────────────────

function CompareView({
  versionA,
  versionB,
  onClose,
}: {
  versionA: TourVersion;
  versionB: TourVersion;
  onClose: () => void;
}) {
  const scoreA = versionA.quality_score;
  const scoreB = versionB.quality_score;
  const failA = versionA.failure_codes.length;
  const failB = versionB.failure_codes.length;

  function scoreClass(mine: number | null, other: number | null): string {
    if (mine == null || other == null) return "";
    if (mine > other) return "text-green-600 font-semibold";
    if (mine < other) return "text-red-600";
    return "";
  }

  function failClass(mine: number, other: number): string {
    if (mine < other) return "text-green-600 font-semibold";
    if (mine > other) return "text-red-600";
    return "";
  }

  const showFailures = failA > 0 || failB > 0;

  return (
    <div className="mt-4 border rounded-lg bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
        <p className="text-xs font-semibold text-gray-600">Side-by-side Compare</p>
        <button
          className="text-xs text-gray-400 hover:text-gray-700"
          onClick={onClose}
        >
          ✕ Close Compare
        </button>
      </div>
      <div className="p-4">
        {/* Column headers */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {([versionA, versionB] as const).map((v, i) => (
            <div key={v.id} className="bg-gray-50 rounded px-3 py-2">
              <p className="text-xs font-semibold text-gray-700">
                Version {i === 0 ? "A" : "B"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{formatDate(v.created_at)}</p>
            </div>
          ))}
        </div>

        {/* Run config */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Run Config
          </p>
          <div className="grid grid-cols-2 gap-4">
            {([versionA, versionB] as const).map((v) => (
              <div key={v.id} className="text-xs text-gray-700 space-y-1">
                <p>
                  <span className="text-gray-400">Model:</span>{" "}
                  {modelLabel(v.run_config.model_id)}
                </p>
                <p>
                  <span className="text-gray-400">SEO:</span>{" "}
                  {v.run_config.seo_mode}
                </p>
                <p>
                  <span className="text-gray-400">Lang:</span>{" "}
                  {v.run_config.language}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Quality score */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Quality Score
          </p>
          <div className="grid grid-cols-2 gap-4">
            <p className={`text-sm font-medium ${scoreClass(scoreA, scoreB)}`}>
              {scoreA != null ? `${scoreA.toFixed(1)} / 10` : "—"}
            </p>
            <p className={`text-sm font-medium ${scoreClass(scoreB, scoreA)}`}>
              {scoreB != null ? `${scoreB.toFixed(1)} / 10` : "—"}
            </p>
          </div>
        </div>

        {/* aa_name */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Name
          </p>
          <div className="grid grid-cols-2 gap-4">
            <p className="text-xs text-gray-700">{versionA.content?.aa_name ?? "—"}</p>
            <p className="text-xs text-gray-700">{versionB.content?.aa_name ?? "—"}</p>
          </div>
        </div>

        {/* aa_summary */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Summary
          </p>
          <div className="grid grid-cols-2 gap-4">
            <ExpandableText text={versionA.content?.aa_summary ?? "—"} />
            <ExpandableText text={versionB.content?.aa_summary ?? "—"} />
          </div>
        </div>

        {/* seo_title */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            SEO Title
          </p>
          <div className="grid grid-cols-2 gap-4">
            <p className="text-xs text-gray-700">{versionA.content?.seo_title ?? "—"}</p>
            <p className="text-xs text-gray-700">{versionB.content?.seo_title ?? "—"}</p>
          </div>
        </div>

        {/* seo_meta */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            SEO Meta
          </p>
          <div className="grid grid-cols-2 gap-4">
            <ExpandableText text={versionA.content?.seo_meta ?? "—"} />
            <ExpandableText text={versionB.content?.seo_meta ?? "—"} />
          </div>
        </div>

        {/* Failure codes */}
        {showFailures && (
          <div className="mb-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Failure Codes
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className={`text-xs ${failClass(failA, failB)}`}>
                {failA === 0 ? (
                  <span className="text-gray-400">None</span>
                ) : (
                  versionA.failure_codes.map((f, i) => (
                    <p key={i}>{f.code ?? f.detail ?? "Error"}</p>
                  ))
                )}
              </div>
              <div className={`text-xs ${failClass(failB, failA)}`}>
                {failB === 0 ? (
                  <span className="text-gray-400">None</span>
                ) : (
                  versionB.failure_codes.map((f, i) => (
                    <p key={i}>{f.code ?? f.detail ?? "Error"}</p>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── VersionsPanel ─────────────────────────────────────────────────────────────

function VersionsPanel({ tourId }: { tourId: string }) {
  const [versions, setVersions] = useState<TourVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  const [toast, setToast] = useState("");

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/acp/s1/tours/${tourId}/versions`,
        { headers: adminHeaders() }
      );
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json = await res.json();
      setVersions(json.versions ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load versions");
    }
  }, [tourId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchVersions();
      setLoading(false);
    })();
  }, [fetchVersions]);

  async function handleSetActive(versionId: string) {
    const prevVersions = versions;
    setActivatingId(versionId);
    setVersions((vs) => vs.map((v) => ({ ...v, is_active: v.id === versionId })));
    try {
      const res = await fetch(
        `${API_BASE}/acp/s1/versions/${versionId}/activate`,
        { method: "PATCH", headers: adminHeaders() }
      );
      if (!res.ok) throw new Error(`API error ${res.status}`);
      await fetchVersions();
    } catch (e: unknown) {
      setVersions(prevVersions);
      setToast(e instanceof Error ? e.message : "Failed to set active");
    } finally {
      setActivatingId(null);
    }
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
      } else if (n.size < 2) {
        n.add(id);
      }
      return n;
    });
    setShowCompare(false);
  }

  const hasCompare = versions.length >= 2;
  const compareArr = Array.from(compareIds);
  const versionA = compareArr[0] ? versions.find((v) => v.id === compareArr[0]) : undefined;
  const versionB = compareArr[1] ? versions.find((v) => v.id === compareArr[1]) : undefined;

  if (loading) {
    return (
      <div className="bg-gray-50 border-t px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="w-3 h-3 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          Loading versions…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 border-t px-4 py-3">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="bg-gray-50 border-t px-4 py-4 text-center text-sm text-gray-400">
        No versions yet. Run S1 to generate content.
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border-t">
      {toast && <Toast message={toast} onDone={() => setToast("")} />}
      <div className="px-4 py-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="pb-2 pr-4 font-medium">#</th>
              <th className="pb-2 pr-4 font-medium">Date</th>
              <th className="pb-2 pr-4 font-medium">Model</th>
              <th className="pb-2 pr-4 font-medium">SEO Mode</th>
              <th className="pb-2 pr-4 font-medium">Quality</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 pr-4 font-medium">Active</th>
              {hasCompare && <th className="pb-2 pr-4 font-medium">Compare</th>}
              <th className="pb-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {versions.map((v, i) => (
              <tr
                key={v.id}
                className={v.is_active ? "bg-green-50" : "hover:bg-white"}
              >
                <td className="py-2.5 pr-4 text-gray-500">{versions.length - i}</td>
                <td className="py-2.5 pr-4 whitespace-nowrap text-gray-600">
                  {formatDate(v.created_at)}
                </td>
                <td className="py-2.5 pr-4 text-gray-700">
                  {modelLabel(v.run_config.model_id)}
                </td>
                <td className="py-2.5 pr-4 text-gray-600 capitalize">
                  {v.run_config.seo_mode}
                </td>
                <td className="py-2.5 pr-4">
                  {v.quality_score != null ? (
                    <span className="font-medium text-gray-700">
                      {v.quality_score.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="py-2.5 pr-4">
                  <StatusBadge status={v.status} />
                </td>
                <td className="py-2.5 pr-4">
                  {v.is_active ? (
                    <span title="Active">✅</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                {hasCompare && (
                  <td className="py-2.5 pr-4">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={compareIds.has(v.id)}
                      onChange={() => toggleCompare(v.id)}
                      disabled={!compareIds.has(v.id) && compareIds.size >= 2}
                    />
                  </td>
                )}
                <td className="py-2.5">
                  {!v.is_active && v.status !== "rejected" ? (
                    <button
                      className="px-2 py-0.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={() => handleSetActive(v.id)}
                      disabled={activatingId !== null}
                    >
                      {activatingId === v.id ? "Setting…" : "Set Active"}
                    </button>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Compare trigger */}
        {hasCompare && compareIds.size === 2 && !showCompare && (
          <div className="mt-3">
            <button
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => setShowCompare(true)}
            >
              Compare selected versions
            </button>
          </div>
        )}

        {/* Compare view */}
        {showCompare && versionA && versionB && (
          <CompareView
            versionA={versionA}
            versionB={versionB}
            onClose={() => {
              setShowCompare(false);
              setCompareIds(new Set());
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── TourRow ────────────────────────────────────────────────────────────────────

function TourRow({ tour }: { tour: CatalogTour }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className="border-b hover:bg-gray-50">
        <td className="px-3 py-2.5 font-medium max-w-xs truncate">
          {tour.aa_name || <span className="text-gray-400 italic">Unnamed</span>}
        </td>
        <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">
          {tour.tour_code || "—"}
        </td>
        <td className="px-3 py-2.5 text-gray-600">{tour.country || "—"}</td>
        <td className="px-3 py-2.5 text-gray-600">{tour.supplier || "—"}</td>
        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
          {tour.updated_at ? tour.updated_at.slice(0, 10) : "—"}
        </td>
        <td className="px-3 py-2.5">
          <button
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
            onClick={() => setExpanded((e) => !e)}
          >
            <span className="text-gray-400">{expanded ? "▲" : "▼"}</span>
            Versions
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="p-0">
            <VersionsPanel tourId={tour.id} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function CatalogPage() {

  const [tours, setTours] = useState<CatalogTour[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const [filterCountry, setFilterCountry] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");

  const fetchTours = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const qs = new URLSearchParams();
      if (filterCountry) qs.set("country", filterCountry);
      if (filterSupplier) qs.set("supplier", filterSupplier);
      const res = await fetch(`${API_BASE}/acp/s1/tours?${qs}`, {
        headers: adminHeaders(),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json = await res.json();
      setTours(json.data);
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : "Failed to load tours");
    } finally {
      setLoading(false);
    }
  }, [filterCountry, filterSupplier]);

  useEffect(() => {
    fetchTours();
  }, [fetchTours]);

  const countries = [
    ...new Set(tours.map((t) => t.country).filter(Boolean)),
  ].sort();

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Catalog</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tour content versions — view history, set active, compare.
          </p>
        </div>
        <button
          className="text-sm text-gray-400 hover:text-gray-600"
          onClick={() => { clearAdminSecret(); window.location.href = "/login"; }}
        >
          Sign out
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Country</label>
          <select
            className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
          >
            <option value="">All countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Supplier</label>
          <input
            className="border rounded px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search…"
            value={filterSupplier}
            onChange={(e) => setFilterSupplier(e.target.value)}
          />
        </div>
        <button
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 mt-auto"
          onClick={fetchTours}
        >
          Apply
        </button>
        {tours.length > 0 && (
          <span className="text-sm text-gray-500 mt-auto ml-1">
            {tours.length} tour{tours.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {fetchError && (
        <p className="text-sm text-red-600 mb-3">{fetchError}</p>
      )}

      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="px-3 py-3">Tour Name</th>
              <th className="px-3 py-3">Tour Code</th>
              <th className="px-3 py-3">Country</th>
              <th className="px-3 py-3">Supplier</th>
              <th className="px-3 py-3">Last Updated</th>
              <th className="px-3 py-3">Versions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={6} />
            ) : tours.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-10 text-center text-gray-400 text-sm"
                >
                  No approved tours found. Complete S0 review first.
                </td>
              </tr>
            ) : (
              tours.map((t) => <TourRow key={t.id} tour={t} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
