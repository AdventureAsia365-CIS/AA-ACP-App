"use client";

import { adminHeaders, clearAdminSecret } from "@/lib/admin-auth";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FunnelMix {
  tofu: number;
  mofu: number;
  bofu: number;
}

interface AdGroup {
  name: string;
  keywords: string[];
  headlines: string[];
  descriptions: string[];
}

interface Campaign {
  campaign_name: string;
  objective: string;
  ad_groups: AdGroup[];
}

interface CalendarSummary {
  calendar_id: string;
  funnel_mix: FunnelMix;
  expanded_markdown: string;
  input_tokens: number | null;
  output_tokens: number | null;
}

interface AdsSummary {
  ads_plan_id: string;
  pdf_s3_key: string | null;
  campaigns: Campaign[];
}

interface S3Run {
  run_id: string;
  status: string;
  country: string | null;
  started_at: string | null;
  completed_at: string | null;
  calendar_summary: CalendarSummary | null;
  ads_summary: AdsSummary | null;
  validation_errors: string[];
  hitl_status: string | null;
  hitl_expires_at: string | null;
}

// ── Small components ──────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg max-w-sm">
      {message}
    </div>
  );
}

function Gate2Badge({ hitlStatus }: { hitlStatus: string | null }) {
  const isPending = !hitlStatus || hitlStatus === "pending";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
        isPending
          ? "bg-red-100 text-red-700 border border-red-300"
          : hitlStatus === "approved"
          ? "bg-green-100 text-green-700 border border-green-300"
          : "bg-gray-100 text-gray-600 border border-gray-300"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isPending ? "bg-red-500 animate-pulse" : "bg-current"
        }`}
      />
      Gate 2 — Ms. Thu Required
      {hitlStatus && hitlStatus !== "pending" && ` (${hitlStatus})`}
    </span>
  );
}

function FunnelBar({ mix }: { mix: FunnelMix }) {
  const total = mix.tofu + mix.mofu + mix.bofu || 100;
  return (
    <div>
      <p className="text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wide">
        Funnel Mix
      </p>
      <div className="flex h-5 rounded overflow-hidden text-xs font-medium">
        <div
          style={{ width: `${(mix.tofu / total) * 100}%` }}
          className="bg-sky-400 flex items-center justify-center text-white"
        >
          {mix.tofu}%
        </div>
        <div
          style={{ width: `${(mix.mofu / total) * 100}%` }}
          className="bg-violet-500 flex items-center justify-center text-white"
        >
          {mix.mofu}%
        </div>
        <div
          style={{ width: `${(mix.bofu / total) * 100}%` }}
          className="bg-emerald-500 flex items-center justify-center text-white"
        >
          {mix.bofu}%
        </div>
      </div>
      <div className="flex gap-4 mt-1.5 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-sky-400 inline-block" />
          TOFU
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-violet-500 inline-block" />
          MOFU
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />
          BOFU
        </span>
      </div>
    </div>
  );
}

function CampaignAccordion({ campaigns }: { campaigns: Campaign[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set([0]));
  function toggle(i: number) {
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }
  return (
    <div className="space-y-2">
      {campaigns.map((c, ci) => (
        <div key={ci} className="border rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
            onClick={() => toggle(ci)}
          >
            <span className="font-medium text-sm">{c.campaign_name}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 capitalize bg-white border px-2 py-0.5 rounded-full">
                {c.objective}
              </span>
              <span className="text-gray-400 text-xs">
                {open.has(ci) ? "▲" : "▼"}
              </span>
            </div>
          </button>
          {open.has(ci) && (
            <div className="p-4 space-y-4">
              {c.ad_groups.map((ag, ai) => (
                <div key={ai} className="pl-3 border-l-2 border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Ad Group: {ag.name}
                  </p>
                  <p className="text-xs text-gray-500 mb-1">
                    <span className="font-medium">Keywords:</span>{" "}
                    {ag.keywords.join(", ")}
                  </p>
                  <div className="mb-2">
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      Headlines
                    </p>
                    <ul className="space-y-0.5">
                      {ag.headlines.map((h, hi) => (
                        <li key={hi} className="text-xs text-gray-700 flex gap-1.5">
                          <span className="text-gray-300 shrink-0">–</span>
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      Descriptions
                    </p>
                    <ul className="space-y-0.5">
                      {ag.descriptions.map((d, di) => (
                        <li key={di} className="text-xs text-gray-700 flex gap-1.5">
                          <span className="text-gray-300 shrink-0">–</span>
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function S3ReviewContent() {
  const searchParams = useSearchParams();

  const [runIdInput, setRunIdInput] = useState(searchParams.get("run_id") ?? "");
  const [run, setRun] = useState<S3Run | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [activeTab, setActiveTab] = useState<"calendar" | "ads">("calendar");

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [toast, setToast] = useState("");

  // Auto-load if run_id in URL
  useEffect(() => {
    const id = searchParams.get("run_id");
    if (id) {
      setRunIdInput(id);
      loadRun(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRun = useCallback(
    async (id?: string) => {
      const rid = (id ?? runIdInput).trim();
      if (!rid) return;
      setLoading(true);
      setLoadError("");
      setRun(null);
      try {
        const res = await fetch(`${API_BASE}/v1/s3/runs/${rid}`, {
          headers: adminHeaders(),
        });
        if (res.status === 404) throw new Error(`Run ${rid} not found`);
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data: S3Run = await res.json();
        setRun(data);
      } catch (e: unknown) {
        setLoadError(e instanceof Error ? e.message : "Failed to load run");
      } finally {
        setLoading(false);
      }
    },
    [runIdInput]
  );

  // ── Login ──────────────────────────────────────────────────────────────────
  // ── HITL actions ──────────────────────────────────────────────────────────

  async function handleApprove() {
    if (!run) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE}/v1/hitl/gate2/${run.run_id}/approve`,
        { method: "POST", headers: adminHeaders() }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Error ${res.status}`);
      }
      setShowApproveModal(false);
      setToast("Gate 2 approved. EventBridge notified.");
      await loadRun(run.run_id);
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    if (!run) return;
    if (!rejectNotes.trim()) {
      setRejectError("Notes are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE}/v1/hitl/gate2/${run.run_id}/reject`,
        {
          method: "POST",
          headers: adminHeaders(),
          body: JSON.stringify({ notes: rejectNotes.trim() }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Error ${res.status}`);
      }
      setShowRejectModal(false);
      setRejectNotes("");
      setRejectError("");
      setToast("Gate 2 rejected. Notes recorded in audit log.");
      await loadRun(run.run_id);
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setSubmitting(false);
    }
  }

  const hitlPending = !run?.hitl_status || run.hitl_status === "pending";
  const hasCalendar = !!run?.calendar_summary?.expanded_markdown;
  const hasCampaigns =
    (run?.ads_summary?.campaigns ?? []).length > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-semibold">S3 Campaign Planner Review</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Content calendar + Google Ads plan — Gate 2 HITL
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Gate2Badge hitlStatus={run?.hitl_status ?? null} />
          <button
            className="text-sm text-gray-400 hover:text-gray-600"
            onClick={() => { clearAdminSecret(); window.location.href = "/login"; }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Run loader */}
      <div className="flex gap-2 mb-6">
        <input
          className="flex-1 border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter run_id (UUID)…"
          value={runIdInput}
          onChange={(e) => setRunIdInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") loadRun();
          }}
        />
        <button
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
          onClick={() => loadRun()}
          disabled={loading || !runIdInput.trim()}
        >
          {loading ? "Loading…" : "Load"}
        </button>
      </div>

      {loadError && (
        <p className="text-sm text-red-600 mb-4">{loadError}</p>
      )}

      {run && (
        <>
          {/* Run meta row */}
          <div className="flex flex-wrap gap-4 mb-5 text-sm text-gray-600">
            <span>
              <span className="font-medium">Run:</span>{" "}
              <span className="font-mono text-xs">{run.run_id}</span>
            </span>
            {run.country && (
              <span>
                <span className="font-medium">Country:</span> {run.country}
              </span>
            )}
            <span>
              <span className="font-medium">Status:</span>{" "}
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                  run.status === "completed"
                    ? "bg-green-100 text-green-700"
                    : run.status === "failed"
                    ? "bg-red-100 text-red-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {run.status}
              </span>
            </span>
            {run.hitl_expires_at && hitlPending && (
              <span className="text-amber-600 text-xs font-medium">
                SLA expires{" "}
                {new Date(run.hitl_expires_at).toLocaleString()}
              </span>
            )}
          </div>

          {/* Validation warnings */}
          {run.validation_errors.length > 0 && (
            <div className="mb-5 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3">
              <p className="text-sm font-semibold text-yellow-800 mb-1">
                Validation warnings ({run.validation_errors.length})
              </p>
              <ul className="space-y-0.5">
                {run.validation_errors.map((e, i) => (
                  <li key={i} className="text-xs text-yellow-700 flex gap-1.5">
                    <span className="shrink-0">⚠</span>
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Funnel mix */}
          {run.calendar_summary?.funnel_mix && (
            <div className="mb-6">
              <FunnelBar mix={run.calendar_summary.funnel_mix} />
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b mb-4">
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === "calendar"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("calendar")}
            >
              Content Calendar
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === "ads"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("ads")}
            >
              Google Ads Plan
            </button>
          </div>

          {/* Calendar tab */}
          {activeTab === "calendar" && (
            <div className="mb-6">
              {hasCalendar ? (
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 bg-white border rounded-lg p-5 overflow-x-auto max-h-[60vh] overflow-y-auto">
                  {run.calendar_summary!.expanded_markdown}
                </pre>
              ) : (
                <div className="bg-white border rounded-lg p-8 text-center text-gray-400 text-sm">
                  {run.status === "running"
                    ? "Calendar is being generated…"
                    : "No calendar available for this run."}
                </div>
              )}
              {run.calendar_summary && (
                <p className="text-xs text-gray-400 mt-2">
                  Tokens: {(run.calendar_summary.input_tokens ?? 0).toLocaleString()} in /{" "}
                  {(run.calendar_summary.output_tokens ?? 0).toLocaleString()} out
                </p>
              )}
            </div>
          )}

          {/* Ads tab */}
          {activeTab === "ads" && (
            <div className="mb-6">
              {hasCampaigns ? (
                <CampaignAccordion campaigns={run.ads_summary!.campaigns} />
              ) : (
                <div className="bg-white border rounded-lg p-8 text-center text-gray-400 text-sm">
                  {run.status === "running"
                    ? "Ads plan is being generated…"
                    : "No ads plan available for this run."}
                </div>
              )}
              {run.ads_summary?.pdf_s3_key && (
                <p className="text-xs text-gray-400 mt-2">
                  PDF: <span className="font-mono">{run.ads_summary.pdf_s3_key}</span>
                </p>
              )}
            </div>
          )}

          {/* Gate 2 actions */}
          {hitlPending && (
            <div className="flex gap-3 pt-2 border-t">
              <button
                className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50"
                onClick={() => setShowApproveModal(true)}
                disabled={submitting}
              >
                Approve
              </button>
              <button
                className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:opacity-50"
                onClick={() => {
                  setShowRejectModal(true);
                  setRejectNotes("");
                  setRejectError("");
                }}
                disabled={submitting}
              >
                Reject
              </button>
            </div>
          )}
          {!hitlPending && run.hitl_status && (
            <div className="pt-2 border-t">
              <p className="text-sm text-gray-500">
                Gate 2 already{" "}
                <span className="font-medium capitalize">{run.hitl_status}</span>.
              </p>
            </div>
          )}
        </>
      )}

      {/* Approve confirm modal */}
      {showApproveModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-base font-semibold mb-2">Approve Gate 2</h2>
            <p className="text-sm text-gray-600 mb-1">
              This will mark the campaign calendar as approved and emit an
              EventBridge event.
            </p>
            <p className="text-xs text-gray-400 font-mono mb-5 break-all">
              run_id: {run?.run_id}
            </p>
            <p className="text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-5">
              Gate 2 — Ms. Thu Required. Only approve if you are the designated
              reviewer.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                onClick={() => setShowApproveModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                onClick={handleApprove}
                disabled={submitting}
              >
                {submitting ? "Approving…" : "Confirm Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-base font-semibold mb-1">Reject Gate 2</h2>
            <p className="text-sm text-gray-500 mb-4">
              Notes are required and will be recorded in the audit log.
            </p>
            {rejectError && (
              <p className="text-sm text-red-600 mb-2">{rejectError}</p>
            )}
            <textarea
              className="w-full border rounded px-3 py-2 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder="Describe what needs to change before re-approval…"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1 mb-4">
              {rejectNotes.trim().length} chars
            </p>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                onClick={() => setShowRejectModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                onClick={handleReject}
                disabled={submitting || !rejectNotes.trim()}
              >
                {submitting ? "Rejecting…" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  );
}

export default function S3ReviewPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <S3ReviewContent />
    </Suspense>
  );
}
