"use client";

import { adminHeaders, clearAdminSecret } from "@/lib/admin-auth";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GateRun {
  run_id: string;
  tenant_id: string;
  country: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  stage: string;
  hitl_status: string | null;
  hitl_expires_at: string | null;
  hitl_notes: string | null;
  hitl_resolved_at: string | null;
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

function HitlBadge({ hitlStatus }: { hitlStatus: string | null }) {
  if (!hitlStatus || hitlStatus === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-300">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        Gate S3 — Awaiting Approval
      </span>
    );
  }
  const approved = hitlStatus === "approved";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
        approved
          ? "bg-green-100 text-green-700 border border-green-300"
          : "bg-gray-100 text-gray-600 border border-gray-300"
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      Gate S3 — {hitlStatus.charAt(0).toUpperCase() + hitlStatus.slice(1)}
    </span>
  );
}

// ── Main page content ─────────────────────────────────────────────────────────

function S3ApproveContent() {
  const searchParams = useSearchParams();

  const [runIdInput, setRunIdInput] = useState(searchParams.get("run_id") ?? "");
  const [run, setRun] = useState<GateRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [toast, setToast] = useState("");

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
        const res = await fetch(`${API_BASE}/v1/acp/gate/s3/run/${rid}`, {
          headers: adminHeaders(),
        });
        if (res.status === 404) throw new Error(`Run ${rid} not found`);
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data: GateRun = await res.json();
        setRun(data);
      } catch (e: unknown) {
        setLoadError(e instanceof Error ? e.message : "Failed to load run");
      } finally {
        setLoading(false);
      }
    },
    [runIdInput]
  );

  async function handleApprove() {
    if (!run) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/v1/acp/gate/s3/approve`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ run_id: run.run_id, notes: approveNotes.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Error ${res.status}`);
      }
      setShowApproveModal(false);
      setApproveNotes("");
      setToast("S3 gate approved. Audit log written.");
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
      const res = await fetch(`${API_BASE}/v1/acp/gate/s3/reject`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ run_id: run.run_id, notes: rejectNotes.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Error ${res.status}`);
      }
      setShowRejectModal(false);
      setRejectNotes("");
      setRejectError("");
      setToast("S3 gate rejected. Notes recorded in audit log.");
      await loadRun(run.run_id);
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setSubmitting(false);
    }
  }

  const hitlPending = !run?.hitl_status || run.hitl_status === "pending";

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-semibold">S3 Campaign Plan Approval</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review campaign plan output and approve or reject
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <HitlBadge hitlStatus={run?.hitl_status ?? null} />
          <button
            className="text-sm text-gray-400 hover:text-gray-600"
            onClick={() => { clearAdminSecret(); window.location.href = "/login"; }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <input
          className="flex-1 border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter run_id (UUID)…"
          value={runIdInput}
          onChange={(e) => setRunIdInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") loadRun(); }}
        />
        <button
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
          onClick={() => loadRun()}
          disabled={loading || !runIdInput.trim()}
        >
          {loading ? "Loading…" : "Load"}
        </button>
      </div>

      {loadError && <p className="text-sm text-red-600 mb-4">{loadError}</p>}

      {run && (
        <>
          <div className="bg-white border rounded-lg p-5 mb-6 space-y-3">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
              <span>
                <span className="font-medium">Run ID:</span>{" "}
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
              {run.started_at && (
                <span>
                  <span className="font-medium">Started:</span>{" "}
                  {new Date(run.started_at).toLocaleString()}
                </span>
              )}
            </div>

            {run.hitl_expires_at && hitlPending && (
              <p className="text-xs text-amber-600 font-medium">
                Gate SLA expires {new Date(run.hitl_expires_at).toLocaleString()}
              </p>
            )}

            {run.hitl_notes && !hitlPending && (
              <div className="mt-2 px-3 py-2 bg-gray-50 border rounded text-sm text-gray-700">
                <span className="font-medium text-xs text-gray-500 uppercase block mb-1">
                  Reviewer notes
                </span>
                {run.hitl_notes}
              </div>
            )}
          </div>

          {hitlPending ? (
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
          ) : (
            <div className="pt-2 border-t">
              <p className="text-sm text-gray-500">
                Gate S3 already{" "}
                <span className="font-medium capitalize">{run.hitl_status}</span>.
                {run.hitl_resolved_at && (
                  <span className="ml-1 text-xs text-gray-400">
                    ({new Date(run.hitl_resolved_at).toLocaleString()})
                  </span>
                )}
              </p>
            </div>
          )}
        </>
      )}

      {showApproveModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-base font-semibold mb-2">Approve S3 Gate</h2>
            <p className="text-sm text-gray-600 mb-1">
              Confirm approval of campaign plan output for this run.
            </p>
            <p className="text-xs text-gray-400 font-mono mb-4 break-all">
              run_id: {run?.run_id}
            </p>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm h-20 resize-none mb-4 focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Optional notes…"
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
            />
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

      {showRejectModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-base font-semibold mb-1">Reject S3 Gate</h2>
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

export default function S3ApprovePage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <S3ApproveContent />
    </Suspense>
  );
}
