"use client";
// workspace/pipeline/s0/page.tsx — ACP S0 Upload stage
// GET  /v1/s0/review            → tour review queue
// GET  /v1/pipeline/brand-identity → brand brief preview
// POST /v1/pipeline/run         → parse Excel, trigger pipeline

import { useState, useRef, useCallback } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("acp_admin_token");
}
function authHeaders(): HeadersInit {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface TourReview {
  id: string;
  src_name: string;
  country: string | null;
  provider: string | null;
  created_at: string | null;
  review_status: string;
  field_coverage_pct: number;
}

interface BrandIdentity {
  configured: boolean;
  system_prompt?: string;
  style_guide?: string;
  forbidden_words?: string[];
  version?: number;
}

interface RunResult {
  batch_id: string;
  filename: string;
  summary: {
    total: number;
    successful: number;
    failed: number;
    avg_quality_score: number;
    total_cost_usd: number;
  };
  results: Array<{
    idx: number;
    src_name: string;
    country: string;
    duration: string;
    status: string;
    quality_score: number;
  }>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    pending_review: "bg-amber-100 text-amber-700",
    success: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function CoverageBadge({ pct }: { pct: number }) {
  const c = pct >= 85 ? "bg-green-100 text-green-700" : pct >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c}`}>{pct}%</span>;
}

export default function S0Page() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [brand, setBrand] = useState<BrandIdentity | null>(null);
  const [reviews, setReviews] = useState<TourReview[]>([]);
  const [brandExpanded, setBrandExpanded] = useState(false);
  const [error, setError] = useState("");

  const loadBrand = useCallback(async () => {
    const res = await fetch(`${API_BASE}/v1/pipeline/brand-identity`, { headers: authHeaders() });
    if (res.ok) setBrand(await res.json());
  }, []);

  const loadReviews = useCallback(async () => {
    const res = await fetch(`${API_BASE}/v1/s0/review`, { headers: authHeaders() });
    if (res.ok) {
      const d = await res.json();
      setReviews(d.tours || d.data || []);
    }
  }, []);

  function handleFile(f: File) {
    if (!f.name.match(/\.(xlsx|xls)$/i)) { setError("Only .xlsx / .xls supported"); return; }
    setFile(f);
    setError("");
    loadBrand();
    loadReviews();
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    if (!file) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("max_tours", "20");
      const res = await fetch(`${API_BASE}/v1/pipeline/run`, {
        method: "POST",
        headers: authHeaders() as Record<string, string>,
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Upload failed");
      }
      setResult(await res.json());
      await loadReviews();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-semibold text-aa-blackblue tracking-tight">S0 — Upload Tours</h1>
        <p className="text-sm text-gray-500 mt-1">Parse Excel · store raw tours · review & approve for S1</p>
      </div>

      <div className="grid grid-cols-5 gap-6 mb-8">
        {/* Upload card — 3 cols */}
        <div className="col-span-3 bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Source File</p>

          {/* Dropzone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors mb-4 ${
              dragging ? "border-aa-orange bg-orange-50" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <div className="text-3xl mb-2">📄</div>
            <p className="text-sm font-semibold text-gray-700">
              {file ? file.name : "Drop tours.xlsx here or click to browse"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {file ? `${(file.size / 1024).toFixed(1)} KB` : "Accepts .xlsx · .xls"}
            </p>
          </div>

          {file && (
            <div className="flex items-center gap-2 mb-4 p-2 bg-orange-50 rounded-lg border border-orange-100">
              <span className="text-sm">📊</span>
              <span className="text-sm font-medium text-gray-700">{file.name}</span>
              <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</span>
              <button onClick={() => setFile(null)} className="ml-auto text-gray-400 hover:text-gray-600 text-xs">✕</button>
            </div>
          )}

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          <button
            onClick={submit}
            disabled={!file || loading}
            className="w-full py-2.5 rounded-lg bg-aa-orange text-white font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {loading ? "Processing…" : "Parse & Submit"}
          </button>
        </div>

        {/* Brand brief card — 2 cols */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Brand Identity</p>
          {!brand && (
            <p className="text-sm text-gray-400 italic">Upload file to load brand config</p>
          )}
          {brand && !brand.configured && (
            <div className="flex items-center gap-2 text-amber-600">
              <span>⚠️</span>
              <span className="text-sm">No brand identity configured yet</span>
            </div>
          )}
          {brand?.configured && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                  Version {brand.version}
                </span>
                <button onClick={() => setBrandExpanded(e => !e)} className="text-xs text-gray-400 hover:text-gray-600">
                  {brandExpanded ? "Collapse" : "Expand"}
                </button>
              </div>
              <div className="text-sm text-gray-600 mb-3 line-clamp-3">
                {brand.system_prompt?.slice(0, 200)}…
              </div>
              {brandExpanded && (
                <div className="space-y-3">
                  {brand.style_guide && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Style Guide</p>
                      <p className="text-sm text-gray-600">{brand.style_guide.slice(0, 300)}</p>
                    </div>
                  )}
                  {brand.forbidden_words && brand.forbidden_words.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Forbidden Words</p>
                      <div className="flex flex-wrap gap-1">
                        {brand.forbidden_words.map((w, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-red-50 text-red-600 text-xs rounded">{w}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Run result */}
      {result && (
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Run Result — {result.filename}</p>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span><strong className="text-aa-blackblue">{result.summary.total}</strong> tours</span>
              <span><strong className="text-green-600">{result.summary.successful}</strong> ok</span>
              {result.summary.failed > 0 && <span><strong className="text-red-600">{result.summary.failed}</strong> failed</span>}
              <span>avg score <strong>{result.summary.avg_quality_score.toFixed(1)}/10</strong></span>
              <span className="text-gray-400">batch: {result.batch_id.slice(0, 8)}</span>
            </div>
            <Link href="/workspace/pipeline/s1" className="px-3 py-1.5 bg-aa-orange text-white text-xs font-semibold rounded-lg hover:opacity-90">
              → S1 Rewrite
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Source Name</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Country</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Duration</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-500">{r.idx}</td>
                    <td className="px-4 py-3 font-medium text-aa-blackblue">{r.src_name}</td>
                    <td className="px-4 py-3 text-gray-600">{r.country || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{r.duration || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`font-mono font-bold text-sm ${r.quality_score >= 9 ? "text-green-600" : r.quality_score >= 7 ? "text-amber-600" : "text-red-600"}`}>
                        {r.status === "success" ? r.quality_score.toFixed(1) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review queue */}
      {reviews.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Review Queue ({reviews.length})</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tour</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Country</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Provider</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Coverage</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map(t => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-aa-blackblue">{t.src_name}</td>
                    <td className="px-4 py-3 text-gray-600">{t.country || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{t.provider || "—"}</td>
                    <td className="px-4 py-3"><CoverageBadge pct={t.field_coverage_pct} /></td>
                    <td className="px-4 py-3"><StatusBadge status={t.review_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
