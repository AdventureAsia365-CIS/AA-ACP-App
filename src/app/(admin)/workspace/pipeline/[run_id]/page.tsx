"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SLATimer } from "@/components/SLATimer";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GateRow {
  hitl_id: string;
  stage: number;
  gate_type: string;
  status: string;
  auto_approved: boolean;
  confidence_score: number | null;
  reviewer_id: string | null;
  reviewer_notes: string | null;
  rejection_note_structured: unknown;
  reviewer_type: string;
  created_at: string | null;
  resolved_at: string | null;
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
  metadata: Record<string, unknown> | null;
  run_config: Record<string, unknown> | null;
  s1_manifest_key: string | null;
  s2_report_key: string | null;
  s3_plan_key: string | null;
  s4_blog_key: string | null;
  gates: GateRow[];
}

interface CisTour {
  tour_id: string;
  src_name: string;
  country: string | null;
  duration: string | null;
  price_raw: string | null;
  aa_name: string | null;
  quality_score: number | null;
  score_brand: number | null;
  score_seo: number | null;
  model_editorial: string | null;
  version_num: number | null;
  published_at: string | null;
}

interface BlogDraftSummary {
  draft_id: string;
  title: string | null;
  slug: string | null;
  word_count: number | null;
  evaluator_score: number | null;
  validation_passed: boolean | null;
  hitl_gate3_status: string | null;
  cms_publish_status: string | null;
  featured_image_url: string | null;
  status: string | null;
  created_at: string | null;
}

interface RunContext {
  run_id: string;
  tenant_id: string;
  country: string | null;
  s0: { brand_brief: unknown };
  s1: { keywords_used: unknown; cis_tours: CisTour[] };
  s2: {
    keyword_research: unknown;
    visibility_report: unknown;
    keyword_clusters: unknown;
    market_preference: unknown;
    aa_tour_matches: unknown;
    confidence_score: number | null;
  };
  s3: { content_calendar: unknown; ads_plan: unknown; funnel_mix: unknown };
  s4: { blog_drafts: BlogDraftSummary[] };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("acp_admin_token");
}
function authHeaders(): HeadersInit {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

// ── JsonView ──────────────────────────────────────────────────────────────────

function JsonValue({ val, depth = 0 }: { val: unknown; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [showMore, setShowMore] = useState(false);

  if (val === null || val === undefined) {
    return <span className="text-gray-400">null</span>;
  }
  if (typeof val === "boolean") {
    return <span className={val ? "text-green-600" : "text-red-500"}>{String(val)}</span>;
  }
  if (typeof val === "number") {
    return <span className="text-blue-600">{val}</span>;
  }
  if (typeof val === "string") {
    const truncate = val.length > 200 && !showMore;
    return (
      <span className="text-amber-700 break-all">
        &quot;{truncate ? val.slice(0, 200) : val}&quot;
        {val.length > 200 && (
          <button onClick={() => setShowMore(s => !s)} className="ml-1 text-xs text-indigo-500 underline">
            {showMore ? "less" : `+${val.length - 200} more`}
          </button>
        )}
      </span>
    );
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="text-gray-400">[]</span>;
    const autoExpand = val.length <= 5 && depth < 2;
    const open = expanded || autoExpand;
    return (
      <span>
        <button onClick={() => setExpanded(e => !e)} className="text-gray-500 hover:text-gray-700 text-xs mr-1">
          {open ? "▾" : "▸"}
        </button>
        <span className="text-gray-500">[{val.length}]</span>
        {open && (
          <div className="ml-4 border-l border-gray-200 pl-2 mt-0.5 space-y-0.5">
            {val.slice(0, 20).map((item, i) => (
              <div key={i} className="flex gap-1">
                <span className="text-gray-400 text-xs select-none">{i}:</span>
                <JsonValue val={item} depth={depth + 1} />
              </div>
            ))}
            {val.length > 20 && <div className="text-xs text-gray-400">…{val.length - 20} more items</div>}
          </div>
        )}
      </span>
    );
  }
  if (typeof val === "object") {
    const keys = Object.keys(val as object);
    if (keys.length === 0) return <span className="text-gray-400">{"{}"}</span>;
    const autoExpand = keys.length <= 5 && depth < 2;
    const open = expanded || autoExpand;
    return (
      <span>
        <button onClick={() => setExpanded(e => !e)} className="text-gray-500 hover:text-gray-700 text-xs mr-1">
          {open ? "▾" : "▸"}
        </button>
        <span className="text-gray-500">{`{${keys.length}}`}</span>
        {open && (
          <div className="ml-4 border-l border-gray-200 pl-2 mt-0.5 space-y-0.5">
            {keys.map(k => (
              <div key={k} className="flex gap-1 flex-wrap">
                <span className="text-indigo-700 text-xs font-medium shrink-0">{k}:</span>
                <JsonValue val={(val as Record<string, unknown>)[k]} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }
  return <span className="text-gray-600">{String(val)}</span>;
}

function JsonView({ data, label }: { data: unknown; label?: string }) {
  if (data === null || data === undefined) {
    return (
      <div className="text-xs text-gray-400 italic py-2">
        {label ? `${label}: ` : ""}Not yet available
      </div>
    );
  }
  return (
    <div className="text-xs font-mono bg-gray-50 border border-gray-200 rounded p-3 overflow-auto max-h-96">
      <JsonValue val={data} depth={0} />
    </div>
  );
}

// ── Shared small components ───────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-300 text-xs">—</span>;
  const map: Record<string, string> = {
    completed: "bg-green-100 text-green-700",
    running:   "bg-blue-100 text-blue-700",
    failed:    "bg-red-100 text-red-700",
    pending:   "bg-amber-100 text-amber-700",
    approved:  "bg-green-100 text-green-700",
    rejected:  "bg-red-100 text-red-700",
    queued:    "bg-gray-100 text-gray-600",
    published: "bg-emerald-100 text-emerald-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status}
    </span>
  );
}

function ScorePill({ score, max = 10, label }: { score: number | null; max?: number; label?: string }) {
  if (score === null) return <span className="text-gray-300 text-sm">—</span>;
  const pct = (score / max) * 100;
  const cls = pct >= 80 ? "bg-green-100 text-green-700" : pct >= 70 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label && <span className="text-xs opacity-70">{label}</span>}
      {score.toFixed(1)}
    </span>
  );
}

function TabGroup({ tabs, children }: { tabs: string[]; children: React.ReactNode[] }) {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div className="flex gap-1 border-b border-gray-200 mb-3">
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setActive(i)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
              active === i ? "bg-white border border-b-white border-gray-200 -mb-px text-aa-blackblue" : "text-gray-500 hover:text-gray-700"
            }`}>
            {t}
          </button>
        ))}
      </div>
      {children[active]}
    </div>
  );
}

// ── Collapsible panel ─────────────────────────────────────────────────────────

function StagePanel({
  id, title, subtitle, badge, defaultOpen = false, children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <span className="font-fraunces font-semibold text-aa-blackblue">{title}</span>
          {subtitle && <span className="text-sm text-gray-500">{subtitle}</span>}
          {badge}
        </div>
        <span className="text-gray-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-gray-100">{children}</div>}
    </div>
  );
}

// ── Stage Timeline ────────────────────────────────────────────────────────────

type NodeStatus = "done" | "running" | "failed" | "pending";

const STAGE_IDS = ["s0","s1","gate1","s2","gate2","s3","gate3","s4","cms"];
const STAGE_LABELS = ["S0","S1","G1","S2","G2","S3","G3","S4","CMS"];

function gateStatus(gates: GateRow[], stageInt: number): NodeStatus {
  const g = gates.find(g => g.stage === stageInt);
  if (!g) return "pending";
  if (g.status === "approved") return "done";
  if (g.status === "rejected") return "failed";
  return "running";
}

function deriveTimeline(run: AcpRun): NodeStatus[] {
  const g1 = gateStatus(run.gates, 2);
  const g2 = gateStatus(run.gates, 3);
  const g3 = gateStatus(run.gates, 4);
  const done = run.status === "completed";
  const failed = run.status === "failed";
  return [
    "done",                                          // S0 — run exists means S0 approved
    done || g1 !== "pending" ? "done" : run.status === "running" ? "running" : "pending",  // S1
    g1,                                              // Gate1
    done || g2 !== "pending" ? "done" : g1 === "done" ? "running" : "pending",  // S2
    g2,                                              // Gate2
    done || g3 !== "pending" ? "done" : g2 === "done" ? "running" : "pending",  // S3
    g3,                                              // Gate3
    done ? "done" : g3 === "done" ? "running" : "pending",  // S4
    done ? "done" : "pending",                       // CMS
  ].map((s, i) => (failed && s === "running" ? "failed" : s) as NodeStatus);
}

function Timeline({ statuses }: { statuses: NodeStatus[] }) {
  const dotColor: Record<NodeStatus, string> = {
    done:    "bg-green-500 border-green-600",
    running: "bg-amber-400 border-amber-500 animate-pulse",
    failed:  "bg-red-500 border-red-600",
    pending: "bg-gray-200 border-gray-300",
  };
  const textColor: Record<NodeStatus, string> = {
    done:    "text-green-700",
    running: "text-amber-600",
    failed:  "text-red-600",
    pending: "text-gray-400",
  };
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {STAGE_LABELS.map((label, i) => (
        <div key={label} className="flex items-center">
          <a href={`#${STAGE_IDS[i]}`}
            className={`flex flex-col items-center gap-1 px-2 group transition-opacity ${statuses[i] === "pending" ? "opacity-50" : ""}`}>
            <div className={`w-4 h-4 rounded-full border-2 ${dotColor[statuses[i]]} group-hover:scale-110 transition-transform`} />
            <span className={`text-[10px] font-semibold ${textColor[statuses[i]]}`}>{label}</span>
          </a>
          {i < STAGE_LABELS.length - 1 && (
            <div className={`w-8 h-px ${statuses[i] === "done" ? "bg-green-300" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Gate Panel ────────────────────────────────────────────────────────────────

function GatePanel({
  id, title, slaHours, alwaysHuman, gate, stageStr, runId, onRefresh,
}: {
  id: string;
  title: string;
  slaHours: number;
  alwaysHuman?: boolean;
  gate: GateRow | null;
  stageStr: string;
  runId: string;
  onRefresh: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    if (action === "reject" && !notes.trim()) { setActionErr("Notes required"); return; }
    setSubmitting(true);
    setActionErr(null);
    try {
      const res = await fetch(`${API_BASE}/v1/acp/gate/${stageStr}/${action}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ run_id: runId, notes: notes.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).detail ?? `HTTP ${res.status}`);
      }
      setNotes("");
      onRefresh();
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  }

  const pending = !gate || gate.status === "pending";
  const badgeNode = gate ? <StatusBadge status={gate.status} /> : <StatusBadge status="pending" />;

  return (
    <StagePanel id={id} title={title} badge={badgeNode} defaultOpen={pending}>
      {alwaysHuman && (
        <p className="text-xs text-amber-600 font-medium mb-3">
          ⚠️ ALWAYS human — never auto-approved
        </p>
      )}

      {!gate && (
        <p className="text-sm text-gray-400 italic">Gate not yet reached.</p>
      )}

      {gate && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
            <span><span className="font-medium">Gate type:</span> {gate.gate_type}</span>
            <span><span className="font-medium">Reviewer:</span> {gate.reviewer_type}</span>
            {gate.reviewer_id && <span><span className="font-medium">By:</span> {gate.reviewer_id}</span>}
            {gate.resolved_at && <span><span className="font-medium">Resolved:</span> {new Date(gate.resolved_at).toLocaleString()}</span>}
          </div>

          {gate.auto_approved && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-700">
              <span className="font-medium">Auto-approved</span>
              {gate.confidence_score != null && (
                <span>— Confidence: <strong>{(gate.confidence_score * 100).toFixed(0)}%</strong> / 85% threshold</span>
              )}
            </div>
          )}

          {gate.reviewer_notes && (
            <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm text-gray-700">
              <span className="text-xs font-semibold text-gray-400 uppercase block mb-1">Reviewer notes</span>
              {gate.reviewer_notes}
            </div>
          )}

          {gate.created_at && pending && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">SLA:</span>
              <SLATimer createdAt={gate.created_at} slaDurationHours={slaHours} />
            </div>
          )}
        </div>
      )}

      {pending && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (required for reject, optional for approve)…"
            rows={3}
            className="w-full text-sm border border-gray-300 rounded px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-aa-orange/40"
          />
          {actionErr && <p className="text-xs text-red-600">{actionErr}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => act("approve")}
              disabled={submitting}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? "…" : "✓ Approve"}
            </button>
            <button
              onClick={() => act("reject")}
              disabled={submitting}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? "…" : "✗ Reject"}
            </button>
          </div>
        </div>
      )}
    </StagePanel>
  );
}

// ── Funnel bar ────────────────────────────────────────────────────────────────

function FunnelBar({ funnel }: { funnel: unknown }) {
  const f = funnel as Record<string, number> | null;
  if (!f) return <p className="text-sm text-gray-400 italic">No funnel data yet.</p>;
  const tofu = f.tofu ?? 20;
  const mofu = f.mofu ?? 60;
  const bofu = f.bofu ?? 20;
  return (
    <div className="space-y-2">
      <div className="flex rounded-full overflow-hidden h-5 text-xs font-medium">
        <div style={{ width: `${tofu}%` }} className="bg-sky-400 flex items-center justify-center text-white">TOFU {tofu}%</div>
        <div style={{ width: `${mofu}%` }} className="bg-indigo-400 flex items-center justify-center text-white">MOFU {mofu}%</div>
        <div style={{ width: `${bofu}%` }} className="bg-aa-orange flex items-center justify-center text-white">BOFU {bofu}%</div>
      </div>
      <p className="text-xs text-gray-500">Top-of-funnel → Mid → Bottom-of-funnel content mix</p>
    </div>
  );
}

// ── Blog draft HITL badge ─────────────────────────────────────────────────────

function HitlBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    approved:      "bg-green-100 text-green-700",
    rejected:      "bg-red-100 text-red-700",
    pending:       "bg-amber-100 text-amber-700",
    flagged_human: "bg-orange-100 text-orange-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[status ?? ""] ?? "bg-gray-100 text-gray-400"}`}>
      {status ?? "—"}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PipelineRunPage() {
  const { run_id } = useParams<{ run_id: string }>();

  const [run, setRun] = useState<AcpRun | null>(null);
  const [ctx, setCtx] = useState<RunContext | null>(null);
  const [runLoading, setRunLoading] = useState(true);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [runErr, setRunErr] = useState<string | null>(null);
  const [ctxErr, setCtxErr] = useState<string | null>(null);

  const fetchRun = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/acp/runs/${run_id}`, { headers: authHeaders() });
      if (res.status === 404) throw new Error("Run not found");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRun(await res.json());
      setRunErr(null);
    } catch (e: unknown) {
      setRunErr(e instanceof Error ? e.message : "Failed to load run");
    } finally {
      setRunLoading(false);
    }
  }, [run_id]);

  const fetchCtx = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/acp/runs/${run_id}/context`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCtx(await res.json());
      setCtxErr(null);
    } catch (e: unknown) {
      setCtxErr(e instanceof Error ? e.message : "Failed to load context");
    } finally {
      setCtxLoading(false);
    }
  }, [run_id]);

  useEffect(() => {
    fetchRun();
    fetchCtx();
  }, [fetchRun, fetchCtx]);

  const refresh = useCallback(() => {
    fetchRun();
    fetchCtx();
  }, [fetchRun, fetchCtx]);

  // ── Duration ────────────────────────────────────────────────────────────────
  function duration(start: string | null, end: string | null): string {
    if (!start) return "—";
    const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  // ── Gate lookup ─────────────────────────────────────────────────────────────
  function getGate(stageInt: number): GateRow | null {
    return run?.gates.find(g => g.stage === stageInt) ?? null;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (runLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        {[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-lg" />)}
      </div>
    );
  }

  if (runErr) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Link href="/workspace/pipeline" className="text-sm text-aa-orange hover:underline mb-4 inline-block">← All runs</Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-5 text-red-700">
          {runErr} — <button onClick={fetchRun} className="underline">retry</button>
        </div>
      </div>
    );
  }

  if (!run) return null;

  const timeline = deriveTimeline(run);
  const gate1 = getGate(2);
  const gate2 = getGate(3);
  const gate3 = getGate(4);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">

      {/* Back link */}
      <Link href="/workspace/pipeline" className="text-sm text-aa-orange hover:underline inline-block">
        ← All runs
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-fraunces text-xl font-bold text-aa-blackblue">
                {run.country ?? "Unknown Country"}
              </h1>
              <StatusBadge status={run.status} />
            </div>
            <p className="text-xs text-gray-400 font-mono mt-1">{run.run_id}</p>
          </div>
          <button onClick={refresh} className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 text-aa-gray shrink-0">
            Refresh
          </button>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 mb-4">
          <span><span className="font-medium">Tenant:</span> {run.tenant_id}</span>
          <span><span className="font-medium">Tours:</span> {run.tour_count ?? "—"}</span>
          {run.quality_avg != null && <span><span className="font-medium">Avg quality:</span> {run.quality_avg.toFixed(1)}</span>}
          {run.cost_usd != null && <span><span className="font-medium">Cost:</span> ${run.cost_usd.toFixed(4)}</span>}
          <span><span className="font-medium">Duration:</span> {duration(run.started_at, run.completed_at)}</span>
          {run.started_at && <span><span className="font-medium">Started:</span> {new Date(run.started_at).toLocaleString()}</span>}
        </div>
        <Timeline statuses={timeline} />
        {run.error_message && (
          <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <span className="font-medium">Error:</span> {run.error_message}
          </div>
        )}
      </div>

      {/* S0 — Input & Brand Brief */}
      <StagePanel id="s0" title="S0 — Input & Brand Brief" defaultOpen={false}
        badge={<span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">approved</span>}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium block text-xs text-gray-400 uppercase mb-0.5">Tenant</span>
              {run.tenant_id}
            </div>
            <div>
              <span className="font-medium block text-xs text-gray-400 uppercase mb-0.5">Upload file</span>
              {(run.metadata as Record<string, string> | null)?.filename ?? run.s1_manifest_key?.split("/").pop() ?? "—"}
            </div>
            {run.started_at && (
              <div>
                <span className="font-medium block text-xs text-gray-400 uppercase mb-0.5">Uploaded at</span>
                {new Date(run.started_at).toLocaleString()}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Brand Brief</p>
            {ctxLoading ? <div className="h-8 bg-gray-100 animate-pulse rounded" /> :
              <JsonView data={ctx?.s0?.brand_brief} label="brand_brief" />}
          </div>
        </div>
      </StagePanel>

      {/* S1 — Tour Content Rewrite */}
      <StagePanel id="s1" title="S1 — Tour Content Rewrite (CIS)" defaultOpen={false}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span><span className="font-medium">Country:</span> {run.country ?? "—"}</span>
            <span><span className="font-medium">Model:</span> {String((run.run_config as Record<string,unknown> | null)?.model_id ?? "Bedrock Sonnet 4.5")}</span>
            {run.tour_count && <span><span className="font-medium">Tours:</span> {run.tour_count} rewritten</span>}
          </div>
          {ctxLoading ? <div className="h-20 bg-gray-100 animate-pulse rounded" /> : (
            <>
              {ctx?.s1?.keywords_used && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Keywords used in S1</p>
                  <JsonView data={ctx.s1.keywords_used} />
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  CIS Tours — {ctx?.s1?.cis_tours?.length ?? 0} published for {run.country}
                </p>
                {!ctx?.s1?.cis_tours?.length ? (
                  <p className="text-sm text-gray-400 italic">No CIS tours found for country &ldquo;{run.country}&rdquo;.</p>
                ) : (
                  <div className="overflow-x-auto rounded border border-gray-200">
                    <table className="min-w-full text-xs divide-y divide-gray-100">
                      <thead className="bg-gray-50">
                        <tr>
                          {["Tour Name", "Quality", "Brand", "SEO", "Model", "Published"].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 bg-white">
                        {ctx.s1.cis_tours.map(t => (
                          <tr key={t.tour_id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 max-w-[200px]">
                              <div className="font-medium text-aa-blackblue truncate">{t.aa_name ?? t.src_name}</div>
                              <div className="text-gray-400 truncate">{t.src_name}</div>
                            </td>
                            <td className="px-3 py-2"><ScorePill score={t.quality_score} /></td>
                            <td className="px-3 py-2"><ScorePill score={t.score_brand} /></td>
                            <td className="px-3 py-2"><ScorePill score={t.score_seo} /></td>
                            <td className="px-3 py-2 text-gray-500">{t.model_editorial?.split(".").pop() ?? "—"}</td>
                            <td className="px-3 py-2 text-gray-400">
                              {t.published_at ? new Date(t.published_at).toLocaleDateString("en-AU", { day:"2-digit", month:"short" }) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </StagePanel>

      {/* Gate 1 */}
      <GatePanel
        id="gate1" title="Gate 1 — Nghiep Review" slaHours={4}
        gate={gate1} stageStr="s2" runId={run.run_id} onRefresh={refresh}
      />

      {/* S2 — Market Research */}
      <StagePanel id="s2" title="S2 — Market & Competitor Research" defaultOpen={false}>
        {ctxLoading ? <div className="h-32 bg-gray-100 animate-pulse rounded" /> :
          !ctx?.s2?.visibility_report && !ctx?.s2?.keyword_research ? (
            <p className="text-sm text-gray-400 italic">Stage S2 has not run yet.</p>
          ) : (
            <TabGroup
              tabs={["Visibility Report", "Keywords", "Market", "Confidence"]}
            >
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  Full market visibility output — blog ideas, FAQ topics, content opportunities.
                </p>
                <JsonView data={ctx?.s2?.visibility_report} />
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Keyword clusters</p>
                  <JsonView data={ctx?.s2?.keyword_clusters} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Keyword research</p>
                  <JsonView data={ctx?.s2?.keyword_research} />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Market preference</p>
                  <JsonView data={ctx?.s2?.market_preference} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">AA tour matches</p>
                  <JsonView data={ctx?.s2?.aa_tour_matches} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Confidence score</p>
                    {ctx?.s2?.confidence_score != null ? (
                      <div className="flex items-center gap-3">
                        <span className={`text-3xl font-bold ${ctx.s2.confidence_score >= 0.85 ? "text-green-600" : "text-amber-600"}`}>
                          {(ctx.s2.confidence_score * 100).toFixed(0)}%
                        </span>
                        <div>
                          <p className={`text-sm font-medium ${ctx.s2.confidence_score >= 0.85 ? "text-green-600" : "text-amber-600"}`}>
                            {ctx.s2.confidence_score >= 0.85 ? "Auto-approve threshold met" : "Below 85% threshold"}
                          </p>
                          <p className="text-xs text-gray-400">Gate 1 auto-approves at ≥ 85%</p>
                        </div>
                      </div>
                    ) : <p className="text-sm text-gray-400 italic">Not yet scored</p>}
                  </div>
                </div>
              </div>
            </TabGroup>
          )
        }
      </StagePanel>

      {/* Gate 2 */}
      <GatePanel
        id="gate2" title="Gate 2 — Ms. Thu Review" slaHours={24} alwaysHuman
        gate={gate2} stageStr="s3" runId={run.run_id} onRefresh={refresh}
      />

      {/* S3 — Campaign Planning */}
      <StagePanel id="s3" title="S3 — Content & Campaign Planning" defaultOpen={false}>
        {ctxLoading ? <div className="h-32 bg-gray-100 animate-pulse rounded" /> :
          !ctx?.s3?.content_calendar && !ctx?.s3?.ads_plan ? (
            <p className="text-sm text-gray-400 italic">Stage S3 has not run yet.</p>
          ) : (
            <TabGroup tabs={["Content Calendar", "Ads Plan", "Funnel Mix"]}>
              <JsonView data={ctx?.s3?.content_calendar} />
              <JsonView data={ctx?.s3?.ads_plan} />
              <FunnelBar funnel={ctx?.s3?.funnel_mix} />
            </TabGroup>
          )
        }
      </StagePanel>

      {/* Gate 3 */}
      <StagePanel id="gate3" title="Gate 3 — Trang QA → Ms. Thu"
        badge={gate3 ? <StatusBadge status={gate3.status} /> : <StatusBadge status="pending" />}
        defaultOpen={!!gate3 && gate3.status === "pending"}>
        <p className="text-xs text-amber-600 font-medium mb-3">
          ⚠️ ALWAYS human — 2-step: Trang QA first, then Ms. Thu final approval
        </p>
        {!gate3 ? (
          <p className="text-sm text-gray-400 italic">Gate 3 not yet reached.</p>
        ) : (
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span><span className="font-medium">Status:</span> <StatusBadge status={gate3.status} /></span>
              {gate3.reviewer_id && <span><span className="font-medium">Reviewer:</span> {gate3.reviewer_id}</span>}
              {gate3.resolved_at && <span><span className="font-medium">Resolved:</span> {new Date(gate3.resolved_at).toLocaleString()}</span>}
            </div>
            {gate3.reviewer_notes && (
              <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm text-gray-700">
                {gate3.reviewer_notes}
              </div>
            )}
            {gate3.status === "pending" && gate3.created_at && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">SLA (48h):</span>
                <SLATimer createdAt={gate3.created_at} slaDurationHours={48} />
              </div>
            )}
          </div>
        )}
        {/* Per-draft Gate 3 status */}
        {ctx?.s4?.blog_drafts && ctx.s4.blog_drafts.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Per-draft Gate 3 status</p>
            <div className="space-y-1">
              {ctx.s4.blog_drafts.map(d => (
                <div key={d.draft_id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50">
                  <Link href={`/workspace/s4/blog/${d.draft_id}`}
                    className="text-sm text-aa-orange hover:underline truncate max-w-[300px]">
                    {d.title ?? "Untitled"}
                  </Link>
                  <HitlBadge status={d.hitl_gate3_status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </StagePanel>

      {/* S4 — Blog & Social */}
      <StagePanel id="s4" title="S4 — Blog & Social Content" defaultOpen={false}>
        {ctxLoading ? <div className="h-20 bg-gray-100 animate-pulse rounded" /> : (
          <>
            {!ctx?.s4?.blog_drafts?.length ? (
              <p className="text-sm text-gray-400 italic">S4 blog engine has not run yet for this run.</p>
            ) : (
              <div className="overflow-x-auto rounded border border-gray-200">
                <table className="min-w-full text-xs divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Title", "Gate 3", "CMS Status", "Score", "Words", "Created"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {ctx.s4.blog_drafts.map(d => (
                      <tr key={d.draft_id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <Link href={`/workspace/s4/blog/${d.draft_id}`}
                            className="font-medium text-aa-orange hover:underline truncate max-w-[200px] block">
                            {d.title ?? "Untitled"}
                          </Link>
                          {d.featured_image_url && (
                            <span className="text-gray-400">📷 image</span>
                          )}
                        </td>
                        <td className="px-3 py-2"><HitlBadge status={d.hitl_gate3_status} /></td>
                        <td className="px-3 py-2"><StatusBadge status={d.cms_publish_status} /></td>
                        <td className="px-3 py-2"><ScorePill score={d.evaluator_score} /></td>
                        <td className="px-3 py-2 text-gray-500 tabular-nums">{d.word_count ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-400">
                          {d.created_at ? new Date(d.created_at).toLocaleDateString("en-AU", { day:"2-digit", month:"short" }) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </StagePanel>

      {/* CMS Publish */}
      <StagePanel id="cms" title="CMS Publish" defaultOpen={false}>
        <p className="text-sm text-gray-400 italic">
          CMS publish queue — approved blog drafts queued for WordPress. Check individual drafts for publish status.
        </p>
        {ctx?.s4?.blog_drafts && ctx.s4.blog_drafts.some(d => d.cms_publish_status) && (
          <div className="mt-3 overflow-x-auto rounded border border-gray-200">
            <table className="min-w-full text-xs divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {["Draft", "CMS Status", "Created"].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {ctx.s4.blog_drafts
                  .filter(d => d.cms_publish_status)
                  .map(d => (
                    <tr key={d.draft_id}>
                      <td className="px-3 py-2">
                        <Link href={`/workspace/s4/blog/${d.draft_id}`} className="text-aa-orange hover:underline">
                          {d.title ?? d.draft_id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-3 py-2"><StatusBadge status={d.cms_publish_status} /></td>
                      <td className="px-3 py-2 text-gray-400">
                        {d.created_at ? new Date(d.created_at).toLocaleDateString("en-AU") : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </StagePanel>

    </div>
  );
}
