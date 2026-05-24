"use client";

import { adminHeaders } from "@/lib/admin-auth";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

// ── types ─────────────────────────────────────────────────────────────────────

interface ApprovedTour {
  id: string;
  tour_code: string;
  aa_name: string;
  country: string;
  supplier: string;
  review_status: string;
  updated_at: string | null;
}

interface TourEvent {
  tour_id: string;
  status: "queued" | "processing" | "done" | "failed";
  quality_score: number | null;
  error: string | null;
}

interface S1Run {
  run_id: string;
  run_config: {
    model_id: string;
    seo_mode: string;
    brand_identity_id: string | null;
    language: string;
  };
  status: string;
  created_at: string | null;
  total_tours: number;
  done_count: number;
  failed_count: number;
}

type SseState = "connecting" | "connected" | "disconnected" | "complete";

// ── auth ──────────────────────────────────────────────────────────────────────

// ── small components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued:     "bg-gray-100 text-gray-600",
    processing: "bg-blue-100 text-blue-700 animate-pulse",
    done:       "bg-green-100 text-green-700",
    published:  "bg-green-100 text-green-700",
    failed:     "bg-red-100 text-red-700",
    running:    "bg-blue-100 text-blue-700",
    complete:   "bg-green-100 text-green-700",
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

function SseIndicator({ state }: { state: SseState }) {
  const map: Record<SseState, { dot: string; label: string }> = {
    connecting:   { dot: "bg-yellow-400 animate-pulse", label: "Connecting…" },
    connected:    { dot: "bg-green-400 animate-pulse", label: "Live" },
    disconnected: { dot: "bg-red-400", label: "Disconnected" },
    complete:     { dot: "bg-gray-300", label: "Stream closed" },
  };
  const { dot, label } = map[state];
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`w-2 h-2 rounded-full inline-block ${dot}`} />
      {label}
    </span>
  );
}

// ── model display name helper ─────────────────────────────────────────────────

function modelLabel(modelId: string): string {
  if (modelId.includes("sonnet")) return "Sonnet 4.5";
  if (modelId.includes("haiku")) return "Haiku 4.5";
  return modelId;
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function S1RunProgressPage({
  params,
}: {
  params: { run_id: string };
}) {
  const runId = params.run_id;
  const [runInfo, setRunInfo] = useState<S1Run | null>(null);
  const [runInfoError, setRunInfoError] = useState("");

  // tour name lookup from sessionStorage
  const [tourNameMap, setTourNameMap] = useState<Record<string, string>>({});

  // SSE state
  const [sseState, setSseState] = useState<SseState>("connecting");
  const [tourProgress, setTourProgress] = useState<Record<string, TourEvent>>({});
  const [tourOrder, setTourOrder] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  // fallback poll timer ref
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── load run info ──────────────────────────────────────────────────────────

  const fetchRunInfo = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/acp/s1/runs`, {
        headers: adminHeaders(),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json = await res.json();
      const run = (json.data as S1Run[]).find((r) => r.run_id === runId);
      if (run) setRunInfo(run);
      else setRunInfoError("Run not found");
    } catch (e: unknown) {
      setRunInfoError(e instanceof Error ? e.message : "Failed to load run");
    }
  }, [runId]);

  // ── load tour names from sessionStorage ───────────────────────────────────

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(`s1_run_${runId}`);
      if (raw) {
        const tours = JSON.parse(raw) as ApprovedTour[];
        const m: Record<string, string> = {};
        tours.forEach((t) => {
          m[t.id] = t.aa_name || t.tour_code || t.id.slice(0, 8);
        });
        setTourNameMap(m);
      }
    } catch {
      // sessionStorage unavailable or corrupt — names will show as IDs
    }
  }, [runId]);

  // ── fallback poll when SSE disconnects ────────────────────────────────────

  const fetchVersionsFallback = useCallback(async () => {
    if (tourOrder.length === 0) return;
    try {
      for (const tourId of tourOrder) {
        const res = await fetch(
          `${API_BASE}/acp/s1/tours/${tourId}/versions`,
          { headers: adminHeaders() }
        );
        if (!res.ok) continue;
        const json = await res.json();
        const versions = json.versions as Array<{
          status: string;
          quality_score: number | null;
          failure_codes: Array<{ detail?: string }>;
        }>;
        if (versions.length > 0) {
          const latest = versions[0];
          const mapped =
            latest.status === "published" ? "done" : latest.status;
          setTourProgress((prev) => ({
            ...prev,
            [tourId]: {
              tour_id: tourId,
              status: mapped as TourEvent["status"],
              quality_score: latest.quality_score,
              error:
                latest.failure_codes?.[0]?.detail ?? null,
            },
          }));
        }
      }
    } catch {
      // silent — fallback poll, not critical
    }
  }, [tourOrder]);

  // schedule fallback polling when SSE is disconnected
  useEffect(() => {
    if (sseState === "disconnected" && !isComplete) {
      pollRef.current = setInterval(fetchVersionsFallback, 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sseState, isComplete, fetchVersionsFallback]);

  // ── SSE connection ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetchRunInfo();

    let cancelled = false;
    const abort = new AbortController();

    (async () => {
      setSseState("connecting");
      try {
        const res = await fetch(
          `${API_BASE}/acp/s1/run/${runId}/stream`,
          { headers: adminHeaders(), signal: abort.signal }
        );
        if (!res.ok || !res.body) {
          if (!cancelled) setSseState("disconnected");
          return;
        }
        if (!cancelled) setSseState("connected");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const evt = JSON.parse(line.slice(6)) as
                | TourEvent
                | { event: string; run_id: string; total: number; done: number; failed: number };
              if ("event" in evt && evt.event === "complete") {
                if (!cancelled) {
                  setIsComplete(true);
                  setSseState("complete");
                  fetchRunInfo();
                }
                return;
              }
              if ("tour_id" in evt && !("event" in evt)) {
                const te = evt as TourEvent;
                setTourProgress((prev) => ({ ...prev, [te.tour_id]: te }));
                setTourOrder((prev) =>
                  prev.includes(te.tour_id) ? prev : [...prev, te.tour_id]
                );
              }
            } catch {
              // malformed event — skip
            }
          }
        }
        if (!cancelled) setSseState("complete");
      } catch (e: unknown) {
        if (!cancelled) {
          const name = e instanceof Error ? e.name : "";
          if (name !== "AbortError") setSseState("disconnected");
        }
      }
    })();

    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [runId, fetchRunInfo]);

  // ── derived progress counts ────────────────────────────────────────────────

  const totalTracked = tourOrder.length;
  const doneCount = Object.values(tourProgress).filter(
    (t) => t.status === "done"
  ).length;
  const failedCount = Object.values(tourProgress).filter(
    (t) => t.status === "failed"
  ).length;
  const processingCount = Object.values(tourProgress).filter(
    (t) => t.status === "processing"
  ).length;

  const totalForBar = runInfo?.total_tours ?? totalTracked;
  const progressPct =
    totalForBar > 0 ? Math.round(((doneCount + failedCount) / totalForBar) * 100) : 0;

  const configDisplay = runInfo?.run_config;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-semibold">S1 Rewrite Run</h1>
          <SseIndicator state={sseState} />
        </div>
        <p className="text-xs font-mono text-gray-400">{runId}</p>

        {/* Config summary chips */}
        {configDisplay && (
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
              {modelLabel(configDisplay.model_id)}
            </span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded capitalize">
              SEO: {configDisplay.seo_mode}
            </span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
              {configDisplay.language}
            </span>
            {configDisplay.brand_identity_id ? (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">
                Branded
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-400 text-xs rounded">
                Unbranded
              </span>
            )}
          </div>
        )}

        {runInfoError && (
          <p className="text-sm text-red-600 mt-2">{runInfoError}</p>
        )}
      </div>

      {/* Progress bar */}
      <div className="bg-white border rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            {doneCount + failedCount} / {totalForBar} processed
            {processingCount > 0 && (
              <span className="ml-2 text-blue-600 text-xs">
                ({processingCount} processing…)
              </span>
            )}
          </span>
          <StatusBadge
            status={
              isComplete
                ? "complete"
                : sseState === "connected" || sseState === "connecting"
                ? "running"
                : "disconnected"
            }
          />
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">{progressPct}% complete</p>
      </div>

      {/* Tours progress table */}
      <div className="bg-white border rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">Tour Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Quality Score</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tourOrder.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-gray-400 text-sm"
                >
                  {sseState === "connecting"
                    ? "Connecting to run stream…"
                    : "Waiting for tour events…"}
                </td>
              </tr>
            ) : (
              tourOrder.map((tourId) => {
                const ev = tourProgress[tourId];
                const displayName =
                  tourNameMap[tourId] ||
                  `Tour ${tourId.slice(0, 8)}…`;
                return (
                  <tr key={tourId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium max-w-xs truncate">
                      {displayName}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ev?.status ?? "queued"} />
                      {ev?.error && (
                        <p className="text-xs text-red-500 mt-0.5 max-w-xs truncate">
                          {ev.error}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {ev?.quality_score != null ? (
                        <span className="font-medium">
                          {ev.quality_score.toFixed(1)}
                          <span className="text-gray-400 font-normal">
                            {" "}
                            / 10
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {ev?.status === "done" && (
                        <Link
                          href="/workspace/catalog"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View in Catalog →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer — shown when complete */}
      {isComplete && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-5">
          <p className="text-sm font-medium text-green-800 mb-1">
            Run complete
          </p>
          <p className="text-sm text-green-700 mb-4">
            {doneCount} tour{doneCount !== 1 ? "s" : ""} completed
            successfully
            {failedCount > 0 && `, ${failedCount} failed`}.
          </p>
          <div className="flex gap-3">
            <Link
              href="/workspace/catalog"
              className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
            >
              View All in Catalog
            </Link>
            <Link
              href="/workspace/s1/run"
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-50"
            >
              Run Another
            </Link>
          </div>
        </div>
      )}

      {/* SSE disconnected banner */}
      {sseState === "disconnected" && !isComplete && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
          Live stream disconnected — polling for updates every 5s.
        </div>
      )}
    </div>
  );
}
