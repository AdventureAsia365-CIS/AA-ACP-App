"use client";
// workspace/pipeline/s1/page.tsx — ACP S1 Rewrite stage + Gate 1
// GET  /acp/s1/tours           → available raw tours
// GET  /acp/s1/runs            → list runs
// POST /acp/s1/run             → start run
// GET  /acp/s1/run/{id}/stream → SSE progress
// GET  /v1/acp/gate/gate1/run/{run_id} → Gate 1 status
// POST /v1/acp/gate/gate1/approve → approve Gate 1
// POST /v1/acp/gate/gate1/reject  → reject Gate 1

import { adminHeaders } from "@/lib/admin-auth";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

interface RawTour { id: string; aa_name: string; country: string; supplier: string; }
interface Run {
  run_id: string; status: string; created_at: string;
  total_tours: number; done_count: number; failed_count: number;
  run_config: { model_id?: string; seo_mode?: string };
}
interface GateData {
  run_id: string;
  stage: string;
  status: string | null;
  confidence_score: number | null;
  auto_approved: boolean;
  reviewer_id: string | null;
  notes: string | null;
  approved_at: string | null;
}

function ScoreBadge({ score }: { score: number }) {
  const c = score >= 9 ? "bg-green-100 text-green-700" : score >= 7 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono ${c}`}>{score.toFixed(1)}</span>;
}

function RunBadge({ status }: { status: string }) {
  const c = status === "running" ? "bg-amber-100 text-amber-700" : status === "completed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c}`}>{status}</span>;
}

function SseLog({ runId, onDone }: { runId: string; onDone: () => void }) {
  const logRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    if (!runId) return;
    const url = `${API_BASE}/acp/s1/run/${runId}/stream`;
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        setLines(prev => [...prev, d.message || JSON.stringify(d)]);
        if (d.status === "done" || d.event === "done") { es.close(); onDone(); }
      } catch { setLines(prev => [...prev, e.data]); }
      setTimeout(() => logRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 50);
    };
    es.onerror = () => { es.close(); onDone(); setLines(prev => [...prev, "[stream ended]"]); };
    return () => es.close();
  }, [runId, onDone]);

  return (
    <div ref={logRef} className="h-40 overflow-y-auto bg-aa-blackblue rounded-lg p-3 font-mono text-xs text-gray-300 space-y-0.5">
      {lines.length === 0 && <span className="text-gray-500">Waiting for events…</span>}
      {lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}

function GatePanel({ runId }: { runId: string }) {
  const [gate, setGate] = useState<GateData | null>(null);
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!runId) return;
    fetch(`${API_BASE}/v1/acp/gate/gate1/run/${runId}`, { headers: adminHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setGate(d); })
      .catch(() => null);
  }, [runId]);

  async function act(action: "approve" | "reject") {
    if (action === "reject" && !notes.trim()) { setError("Notes required when rejecting"); return; }
    setActing(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/acp/gate/gate1/${action}`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ run_id: runId, notes }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Failed");
      const d = await res.json();
      setGate(d);
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
    <div className={`rounded-xl border-2 p-5 ${isApproved ? "border-green-300 bg-green-50" : isRejected ? "border-red-300 bg-red-50" : "border-gray-300 bg-white"}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-aa-blackblue">Gate 1 — Content Quality Review</p>
        {gate?.auto_approved && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Auto-approved</span>}
        {isApproved && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✓ Approved</span>}
        {isRejected && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">✗ Rejected</span>}
        {isPending && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">⏳ Pending</span>}
      </div>

      {gate?.confidence_score !== null && gate?.confidence_score !== undefined && (
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm text-gray-600">Confidence:</span>
          <ScoreBadge score={gate.confidence_score * 10} />
          <span className="text-xs text-gray-500">{gate.confidence_score >= 0.85 ? "≥85% — eligible for auto-approve" : "Manual review required"}</span>
        </div>
      )}

      {gate?.notes && <p className="text-sm text-gray-600 italic mb-3">Notes: {gate.notes}</p>}

      {isPending && (
        <div className="space-y-2">
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Review notes (required if rejecting)…"
            className="w-full text-sm border border-gray-200 rounded-lg p-2.5 resize-none h-20 focus:outline-none focus:border-aa-orange"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => act("approve")} disabled={acting}
              className="flex-1 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
              ✓ Approve Gate 1
            </button>
            <button onClick={() => act("reject")} disabled={acting}
              className="flex-1 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
              ✗ Reject
            </button>
          </div>
        </div>
      )}

      {isApproved && (
        <Link href="/workspace/pipeline/s2" className="inline-block mt-2 px-4 py-2 bg-aa-orange text-white text-sm font-semibold rounded-lg hover:opacity-90">
          → Proceed to S2
        </Link>
      )}
    </div>
  );
}

export default function S1Page() {
  const [tours, setTours] = useState<RawTour[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [modelId, setModelId] = useState("us.anthropic.claude-haiku-4-5-20251001-v1:0");
  const [seoMode, setSeoMode] = useState("informational");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runDone, setRunDone] = useState(false);
  const [selectedRun, setSelectedRun] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/acp/s1/tours`, { headers: adminHeaders() }).then(r => r.json()),
      fetch(`${API_BASE}/acp/s1/runs`, { headers: adminHeaders() }).then(r => r.json()),
    ]).then(([t, r]) => {
      setTours(t.data || []);
      setRuns(r.data || []);
    }).catch(() => null).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRun() {
    if (selected.length === 0) return;
    setRunning(true); setRunDone(false); setError("");
    try {
      const res = await fetch(`${API_BASE}/acp/s1/run`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          tour_ids: selected,
          run_config: { model_id: modelId, seo_mode: seoMode, language: "EN-US" },
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Failed");
      const d = await res.json();
      setActiveRunId(d.run_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
      setRunning(false);
    }
  }

  function onRunDone() {
    setRunning(false); setRunDone(true);
    fetch(`${API_BASE}/acp/s1/runs`, { headers: adminHeaders() })
      .then(r => r.json()).then(d => setRuns(d.data || [])).catch(() => null);
  }

  const viewRunId = activeRunId || (selectedRun ? selectedRun : null);

  if (loading) {
    return <div className="p-8 text-sm text-gray-400">Loading…</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-semibold text-aa-blackblue tracking-tight">S1 — Rewrite Stage</h1>
        <p className="text-sm text-gray-500 mt-1">Select tours · configure model · monitor pipeline · Gate 1 review</p>
      </div>

      {/* Config panel */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Available Tours ({tours.length})</p>
          {tours.length === 0 ? (
            <p className="text-sm text-gray-400">No approved tours. Upload via <Link href="/workspace/pipeline/s0" className="text-aa-orange underline">S0</Link> first.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {tours.map(t => (
                <label key={t.id} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer border transition-colors ${selected.includes(t.id) ? "border-aa-orange bg-orange-50" : "border-gray-100 hover:bg-gray-50"}`}>
                  <input type="checkbox" checked={selected.includes(t.id)}
                    onChange={() => setSelected(p => p.includes(t.id) ? p.filter(x => x !== t.id) : [...p, t.id])}
                    className="accent-aa-orange" />
                  <div>
                    <p className="text-sm font-medium text-aa-blackblue">{t.aa_name}</p>
                    <p className="text-xs text-gray-400">{t.country} · {t.supplier}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Run Config</p>
          <div className="space-y-3 mb-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Model</label>
              <select value={modelId} onChange={e => setModelId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-aa-orange">
                <option value="us.anthropic.claude-haiku-4-5-20251001-v1:0">Haiku 4.5 (fast)</option>
                <option value="us.anthropic.claude-sonnet-4-5-20251001-v1:0">Sonnet 4.5 (quality)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">SEO Mode</label>
              <select value={seoMode} onChange={e => setSeoMode(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-aa-orange">
                <option value="dataforseo">DataForSEO (live)</option>
                <option value="informational">Informational (mock)</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <button onClick={startRun} disabled={selected.length === 0 || running}
            className="w-full py-2.5 bg-aa-orange text-white text-sm font-semibold rounded-lg disabled:opacity-50 hover:opacity-90">
            {running ? "Running…" : `Run S1 (${selected.length} tour${selected.length !== 1 ? "s" : ""})`}
          </button>
        </div>
      </div>

      {/* SSE log */}
      {activeRunId && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Pipeline Progress</p>
            <span className="text-xs font-mono text-gray-400">run: {activeRunId.slice(0, 8)}</span>
            {running && <span className="text-xs text-amber-600 animate-pulse">⚡ Live</span>}
            {runDone && <span className="text-xs text-green-600">✓ Complete</span>}
          </div>
          <SseLog runId={activeRunId} onDone={onRunDone} />
        </div>
      )}

      {/* Run selector + Gate 1 */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Historical Runs ({runs.length})</p>
          <select value={selectedRun} onChange={e => setSelectedRun(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-aa-orange mb-3">
            <option value="">— Select run —</option>
            {runs.map(r => (
              <option key={r.run_id} value={r.run_id}>
                {r.run_id.slice(0, 8)} · {r.total_tours}t · {r.done_count}/{r.total_tours} done · {new Date(r.created_at).toLocaleDateString()}
              </option>
            ))}
          </select>
          {runs.map(r => r.run_id === (selectedRun || activeRunId) ? (
            <div key={r.run_id} className="flex gap-2 flex-wrap">
              <RunBadge status={r.status} />
              <span className="text-xs text-gray-500">{r.done_count}/{r.total_tours} done</span>
              {r.failed_count > 0 && <span className="text-xs text-red-600">{r.failed_count} failed</span>}
            </div>
          ) : null)}
        </div>

        <div>
          {viewRunId && <GatePanel runId={viewRunId} />}
        </div>
      </div>

      {/* Runs table */}
      {runs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">All Runs</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Run ID</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Tours</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Done</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => (
                <tr key={r.run_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.run_id.slice(0, 12)}</td>
                  <td className="px-4 py-3 text-gray-600">{r.total_tours}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-semibold ${r.done_count === r.total_tours ? "text-green-600" : "text-amber-600"}`}>
                      {r.done_count}/{r.total_tours}
                    </span>
                  </td>
                  <td className="px-4 py-3"><RunBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
