"use client";

import { adminHeaders, clearAdminSecret } from "@/lib/admin-auth";
import { useEffect, useState, useCallback } from "react";
import { SLATimer } from "@/components/SLATimer";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

// ── types ─────────────────────────────────────────────────────────────────────

interface Tour {
  id: string;
  src_name: string;
  country: string | null;
  provider: string | null;
  created_at: string | null;
  review_status: string;
  review_notes: string | null;
  field_coverage_pct: number;
}

// ── auth ──────────────────────────────────────────────────────────────────────

// ── coverage badge ────────────────────────────────────────────────────────────

function CoverageBadge({ pct }: { pct: number }) {
  const color = pct >= 85 ? "bg-green-100 text-green-700" : pct >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{pct}%</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending_review: "bg-yellow-100 text-yellow-700",
    reviewed:       "bg-blue-100 text-blue-700",
    approved:       "bg-green-100 text-green-700",
    rejected:       "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

// ── toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg">
      {message}
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function S0ReviewPage() {

  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // filters
  const [filterCountry, setFilterCountry] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // inline edit
  const [editingCell, setEditingCell] = useState<{ id: string; field: "src_name" | "country" } | null>(null);
  const [editValue, setEditValue] = useState("");

  // reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectError, setRejectError] = useState("");

  // toast
  const [toast, setToast] = useState("");

  const fetchTours = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const qs = new URLSearchParams();
      if (filterCountry) qs.set("country", filterCountry);
      if (filterProvider) qs.set("provider", filterProvider);
      if (filterStatus) qs.set("status", filterStatus);
      if (filterDateFrom) qs.set("date_from", filterDateFrom);
      if (filterDateTo) qs.set("date_to", filterDateTo);
      const res = await fetch(`${API_BASE}/v1/s0/review?${qs}`, { headers: adminHeaders() });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json = await res.json();
      setTours(json.data);
      setSelected(new Set());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  }, [filterCountry, filterProvider, filterStatus, filterDateFrom, filterDateTo]);

  useEffect(() => { fetchTours(); }, [fetchTours]);

  // ── login ──────────────────────────────────────────────────────────────────
  // ── selection ──────────────────────────────────────────────────────────────

  const allSelected = tours.length > 0 && selected.size === tours.length;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(tours.map((t) => t.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; });
  }

  // ── inline edit ───────────────────────────────────────────────────────────

  async function saveInlineEdit() {
    if (!editingCell) return;
    await fetch(`${API_BASE}/v1/s0/tours/${editingCell.id}`, {
      method: "PATCH",
      headers: adminHeaders(),
      body: JSON.stringify({ [editingCell.field]: editValue }),
    });
    setEditingCell(null);
    await fetchTours();
  }

  // ── bulk approve ──────────────────────────────────────────────────────────

  async function handleApprove() {
    const res = await fetch(`${API_BASE}/v1/s0/approve`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ tour_ids: [...selected] }),
    });
    const data = await res.json();
    setToast(data.message ?? `${data.approved} tours approved — ready for S1 rewrite`);
    await fetchTours();
  }

  // ── reject modal ──────────────────────────────────────────────────────────

  async function handleRejectConfirm() {
    if (!rejectNotes.trim()) { setRejectError("Notes are required"); return; }
    await fetch(`${API_BASE}/v1/s0/reject`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ tour_ids: [...selected], notes: rejectNotes }),
    });
    setShowRejectModal(false); setRejectNotes(""); setRejectError("");
    await fetchTours();
  }

  // ── unique countries for dropdown ─────────────────────────────────────────

  const countries = [...new Set(tours.map((t) => t.country).filter(Boolean) as string[])].sort();

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">S0 Data Quality Review</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review raw tour data before S1 rewrite.</p>
        </div>
        <button className="text-sm text-gray-400 hover:text-gray-600"
          onClick={() => { clearAdminSecret(); window.location.href = "/login"; }}>
          Sign out
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Country</label>
          <select className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)}>
            <option value="">All countries</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Provider</label>
          <input className="border rounded px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search…" value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Status</label>
          <select className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Pending + Reviewed</option>
            <option value="pending_review">Pending review</option>
            <option value="reviewed">Reviewed</option>
            <option value="approved">Approved</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">From</label>
          <input type="date" className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">To</label>
          <input type="date" className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
        </div>
        <button className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 mt-auto"
          onClick={fetchTours}>
          Apply
        </button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-blue-50 border border-blue-200 rounded px-4 py-2.5">
          <span className="text-sm text-blue-700 font-medium">{selected.size} selected</span>
          <button className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700" onClick={handleApprove}>
            Approve ({selected.size})
          </button>
          <button className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            onClick={() => { setShowRejectModal(true); setRejectNotes(""); setRejectError(""); }}>
            Reject ({selected.size})
          </button>
          <button className="text-sm text-gray-500 hover:text-gray-700 ml-auto" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {/* Error */}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {/* Table */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : tours.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-400 text-sm">
          No tours to review.
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-3 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="rounded border-gray-300" />
                </th>
                <th className="px-3 py-3">Tour Name</th>
                <th className="px-3 py-3">Country</th>
                <th className="px-3 py-3">Provider</th>
                <th className="px-3 py-3">Upload Date</th>
                <th className="px-3 py-3">Coverage</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tours.map((t) => (
                <tr key={t.id} className={selected.has(t.id) ? "bg-blue-50" : "hover:bg-gray-50"}>
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleOne(t.id)}
                      className="rounded border-gray-300" />
                  </td>

                  {/* Tour Name — inline edit */}
                  <td className="px-3 py-2.5 max-w-xs">
                    {editingCell?.id === t.id && editingCell.field === "src_name" ? (
                      <input autoFocus className="border rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveInlineEdit}
                        onKeyDown={(e) => { if (e.key === "Enter") saveInlineEdit(); if (e.key === "Escape") setEditingCell(null); }} />
                    ) : (
                      <span className="cursor-pointer hover:text-blue-600 truncate block"
                        title="Click to edit"
                        onClick={() => { setEditingCell({ id: t.id, field: "src_name" }); setEditValue(t.src_name); }}>
                        {t.src_name}
                      </span>
                    )}
                  </td>

                  {/* Country — inline edit */}
                  <td className="px-3 py-2.5">
                    {editingCell?.id === t.id && editingCell.field === "country" ? (
                      <input autoFocus className="border rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveInlineEdit}
                        onKeyDown={(e) => { if (e.key === "Enter") saveInlineEdit(); if (e.key === "Escape") setEditingCell(null); }} />
                    ) : (
                      <span className="cursor-pointer hover:text-blue-600"
                        title="Click to edit"
                        onClick={() => { setEditingCell({ id: t.id, field: "country" }); setEditValue(t.country ?? ""); }}>
                        {t.country ?? <span className="text-gray-300 italic">—</span>}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 text-gray-600">{t.provider ?? "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {t.created_at ? (
                      <>
                        <div className="text-xs text-aa-gray mb-1">
                          {new Date(t.created_at).toLocaleDateString("en-GB")}
                        </div>
                        <SLATimer createdAt={t.created_at} slaDurationHours={48} />
                      </>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5"><CoverageBadge pct={t.field_coverage_pct} /></td>
                  <td className="px-3 py-2.5"><StatusBadge status={t.review_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-base font-semibold mb-1">Reject {selected.size} tour{selected.size > 1 ? "s" : ""}</h2>
            <p className="text-sm text-gray-500 mb-4">Provide a reason. This will be stored in review_notes.</p>
            {rejectError && <p className="text-sm text-red-600 mb-2">{rejectError}</p>}
            <textarea
              className="w-full border rounded px-3 py-2 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder="e.g. Price data missing, itinerary incomplete…"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                onClick={handleRejectConfirm}>
                Confirm reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  );
}
