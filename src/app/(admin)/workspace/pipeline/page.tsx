"use client";

import { adminHeaders } from "@/lib/admin-auth";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GateSummaryItem {
  status: string | null;
  auto_approved: boolean | null;
  confidence_score: number | null;
  reviewer_id: string | null;
}

interface AcpRun {
  run_id: string;
  tenant_id: string;
  country: string | null;
  status: string;
  tour_count: number | null;
  quality_avg: number | null;
  cost_usd: number | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  gate_summary: {
    gate1: GateSummaryItem | null;
    gate2: GateSummaryItem | null;
    gate3: GateSummaryItem | null;
  };
}

// ── Stage progress nodes ──────────────────────────────────────────────────────

type NodeStatus = "done" | "running" | "failed" | "pending";

interface StageNode {
  label: string;
  status: NodeStatus;
}

function deriveNodes(run: AcpRun): StageNode[] {
  const g1 = run.gate_summary.gate1?.status;
  const g2 = run.gate_summary.gate2?.status;
  const g3 = run.gate_summary.gate3?.status;
  const overall = run.status;

  function gs(status: string | null | undefined): NodeStatus {
    if (!status) return "pending";
    if (status === "approved") return "done";
    if (status === "rejected") return "failed";
    if (status === "pending") return "running";
    return "pending";
  }

  const failed = overall === "failed";
  const completed = overall === "completed";
  const running = overall === "running";

  // Derive which stage is active based on available gate data
  const s0: NodeStatus = "done"; // run exists → S0 was approved
  const s1: NodeStatus = g1 || completed ? "done" : running ? "running" : "pending";
  const g1n: NodeStatus = gs(g1);
  const s2: NodeStatus = g1 === "approved" || completed ? "done" : g1n === "done" ? "running" : "pending";
  const g2n: NodeStatus = gs(g2);
  const s3: NodeStatus = g2 === "approved" || completed ? "done" : g2n === "done" ? "running" : "pending";
  const g3n: NodeStatus = gs(g3);
  const s4: NodeStatus = completed ? "done" : g3n === "done" ? "running" : "pending";
  const cms: NodeStatus = completed ? "done" : "pending";

  return [
    { label: "S0", status: s0 },
    { label: "S1", status: failed && !g1 ? "failed" : s1 },
    { label: "G1", status: g1n },
    { label: "S2", status: failed && !g2 ? "failed" : s2 },
    { label: "G2", status: g2n },
    { label: "S3", status: failed && !g3 ? "failed" : s3 },
    { label: "G3", status: g3n },
    { label: "S4", status: s4 },
    { label: "CMS", status: cms },
  ];
}

function NodeDot({ status, label }: { status: NodeStatus; label: string }) {
  const colors: Record<NodeStatus, string> = {
    done:    "bg-green-500",
    running: "bg-amber-400 animate-pulse",
    failed:  "bg-red-500",
    pending: "bg-gray-300",
  };
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`w-2.5 h-2.5 rounded-full ${colors[status]}`} />
      <span className="text-[9px] text-gray-400 font-medium leading-none">{label}</span>
    </div>
  );
}

function StageLine({ nodes }: { nodes: StageNode[] }) {
  return (
    <div className="flex items-start gap-1">
      {nodes.map((n, i) => (
        <div key={n.label} className="flex items-center gap-1">
          <NodeDot status={n.status} label={n.label} />
          {i < nodes.length - 1 && <div className="w-3 h-px bg-gray-200 mb-3" />}
        </div>
      ))}
    </div>
  );
}

// ── Misc helpers ──────────────────────────────────────────────────────────────

function relative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-green-100 text-green-700",
    running:   "bg-blue-100 text-blue-700",
    failed:    "bg-red-100 text-red-700",
    pending:   "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status}
    </span>
  );
}

function ScorePill({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-300">—</span>;
  const cls = score >= 8 ? "bg-green-100 text-green-700" : score >= 7 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{score.toFixed(1)}</span>;
}

// ── Main page ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ["", "running", "completed", "failed", "pending"];

export default function PipelinePage() {
  const [runs, setRuns] = useState<AcpRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRuns = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (countryFilter.trim()) params.set("country", countryFilter.trim());
    params.set("limit", "50");
    try {
      const res = await fetch(`${API_BASE}/v1/acp/runs?${params}`, { headers: adminHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRuns(await res.json());
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load runs");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, countryFilter]);

  useEffect(() => {
    setLoading(true);
    fetchRuns();
  }, [fetchRuns]);

  // Poll every 10s while any run is running
  useEffect(() => {
    const hasRunning = runs.some(r => r.status === "running");
    if (pollRef.current) clearInterval(pollRef.current);
    if (hasRunning) {
      pollRef.current = setInterval(fetchRuns, 10_000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [runs, fetchRuns]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-fraunces text-2xl font-bold text-aa-blackblue">Pipeline Runs</h1>
          <p className="text-sm text-aa-gray/70 mt-0.5">ACP pipeline E2E — S0 → S1 → S2 → S3 → S4 → CMS</p>
        </div>
        <button onClick={fetchRuns} className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-aa-gray">
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded px-3 py-1.5 bg-white text-aa-gray focus:outline-none focus:ring-2 focus:ring-aa-orange/40"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          value={countryFilter}
          onChange={e => setCountryFilter(e.target.value)}
          placeholder="Filter by country…"
          className="text-sm border border-gray-300 rounded px-3 py-1.5 w-44 focus:outline-none focus:ring-2 focus:ring-aa-orange/40"
        />
      </div>

      {loading && (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error} — <button onClick={fetchRuns} className="underline">retry</button>
        </div>
      )}

      {!loading && !error && runs.length === 0 && (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-aa-gray/50 font-medium text-lg">No pipeline runs yet</p>
          <p className="text-sm text-gray-400 mt-1">Upload a batch via S0 Review to get started.</p>
        </div>
      )}

      {!loading && !error && runs.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Run ID", "Country / Tenant", "Stage Progress", "Tours", "Quality", "Cost", "Started", "Status"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {runs.map(run => (
                <tr key={run.run_id} className="hover:bg-aa-offwhite cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/workspace/pipeline/${run.run_id}`} className="font-mono text-xs text-aa-orange hover:underline">
                      {run.run_id.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-aa-blackblue">{run.country ?? "—"}</div>
                    <div className="text-xs text-gray-400">{run.tenant_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StageLine nodes={deriveNodes(run)} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 tabular-nums">{run.tour_count ?? "—"}</td>
                  <td className="px-4 py-3"><ScorePill score={run.quality_avg} /></td>
                  <td className="px-4 py-3 text-gray-500 tabular-nums">
                    {run.cost_usd != null ? `$${run.cost_usd.toFixed(3)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{relative(run.started_at)}</td>
                  <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
