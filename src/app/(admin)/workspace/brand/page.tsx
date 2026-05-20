"use client";

import { useEffect, useState, useCallback, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

// ── types ─────────────────────────────────────────────────────────────────────

interface Tenant {
  tenant_id: string;
  name: string;
  slug: string;
}

interface VoiceExamples {
  tone_traits: string[];
  good_example: string;
  preferred: string[];
  should_not_write: string[];
}

interface BrandRules {
  brand_type: string;
  core_idea: string;
  customer_segment: string;
  customer_mindset: string;
  target_markets: string[];
  voice_examples: VoiceExamples;
  style_guide: string;
  forbidden_words: string[];
  updated_at: string;
}

interface ParseResult {
  status: "ok" | "low_confidence" | "error";
  confidence: number;
  sections_parsed: number;
  warnings: string[];
  version_id: string;
  brand_rules?: BrandRules;
}

type PageState = "select" | "uploading" | "diff" | "confirming" | "done" | "error";

// ── auth helpers ──────────────────────────────────────────────────────────────

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("acp_admin_token");
}
function setStoredToken(t: string) { localStorage.setItem("acp_admin_token", t); }

function authHeaders(): HeadersInit {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function loginWithKey(apiKey: string) {
  const res = await fetch(`${API_BASE}/auth/tenant-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });
  if (!res.ok) throw new Error("Invalid API key");
  const data = await res.json();
  return data.access_token as string;
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

// ── diff row ──────────────────────────────────────────────────────────────────

function DiffRow({
  label,
  oldVal,
  newVal,
}: {
  label: string;
  oldVal: string | null;
  newVal: string | null;
}) {
  const changed = oldVal !== newVal;
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 px-3 text-xs font-medium text-gray-500 w-32 align-top">{label}</td>
      <td className="py-2 px-3 text-sm text-gray-700 align-top whitespace-pre-wrap">
        {oldVal ?? <span className="text-gray-400 italic">—</span>}
      </td>
      <td
        className={`py-2 px-3 text-sm align-top whitespace-pre-wrap ${
          changed ? "bg-amber-50 border-l-2 border-amber-400 text-gray-900" : "text-gray-700"
        }`}
      >
        {newVal ?? <span className="text-gray-400 italic">—</span>}
      </td>
    </tr>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function arrStr(arr: string[] | null | undefined): string {
  return arr?.join(", ") ?? "";
}

function truncate(s: string | null | undefined, n = 200): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function BrandBriefPage() {
  const [token, setToken] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [loginError, setLoginError] = useState("");

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [tenantsError, setTenantsError] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pageState, setPageState] = useState<PageState>("select");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [currentRules, setCurrentRules] = useState<BrandRules | null>(null);
  const [noCurrentRules, setNoCurrentRules] = useState(false);

  const [uploadError, setUploadError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => { setToken(getToken()); }, []);

  // ── fetch tenants ─────────────────────────────────────────────────────────

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/admin/tenants`, {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
      });
      if (res.status === 401) { setToken(null); localStorage.removeItem("acp_admin_token"); return; }
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json = await res.json();
      setTenants(json.data ?? []);
      if ((json.data ?? []).length === 0) setTenantsError("No tenants found");
    } catch {
      setTenantsError("Failed to load tenants");
    }
  }, []);

  useEffect(() => { if (token) fetchTenants(); }, [token, fetchTenants]);

  // ── fetch current brand rules ─────────────────────────────────────────────

  async function fetchCurrentRules(tenantId: string) {
    setCurrentRules(null);
    setNoCurrentRules(false);
    try {
      const res = await fetch(`${API_BASE}/v1/admin/tenants/${tenantId}/brand-rules`, {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
      });
      if (res.status === 404) { setNoCurrentRules(true); return; }
      if (!res.ok) { setNoCurrentRules(true); return; }
      const json: BrandRules = await res.json();
      setCurrentRules(json);
    } catch {
      setNoCurrentRules(true);
    }
  }

  // ── login ─────────────────────────────────────────────────────────────────

  async function handleLogin() {
    setLoginError("");
    try {
      const jwt = await loginWithKey(apiKeyInput.trim());
      setStoredToken(jwt); setToken(jwt);
    } catch { setLoginError("Invalid API key"); }
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-lg shadow p-8 w-full max-w-sm">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Admin</p>
          <h1 className="text-lg font-semibold mb-4">Brand Brief Upload</h1>
          {loginError && <p className="text-sm text-red-600 mb-3">{loginError}</p>}
          <input
            type="password"
            className="w-full border rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Admin API key"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
          />
          <button
            className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700"
            onClick={handleLogin}
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  // ── file handling ─────────────────────────────────────────────────────────

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.endsWith(".docx")) setFile(f);
  }

  // ── upload ────────────────────────────────────────────────────────────────

  async function handleUpload() {
    if (!selectedTenant || !file) return;
    setPageState("uploading");
    setUploadError("");
    try {
      await fetchCurrentRules(selectedTenant);
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `${API_BASE}/v1/admin/tenants/${selectedTenant}/brand-brief`,
        {
          method: "POST",
          headers: authHeaders(), // NO Content-Type — browser sets multipart boundary
          body: form,
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Upload failed (${res.status})`);
      }
      const data: ParseResult = await res.json();
      setParseResult(data);
      setPageState("diff");
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Upload failed. Please try again.");
      setPageState("error");
    }
  }

  // ── confirm ───────────────────────────────────────────────────────────────

  async function handleConfirm() {
    setPageState("confirming");
    await new Promise((r) => setTimeout(r, 600));
    setPageState("done");
    setTimeout(() => {
      setPageState("select");
      setFile(null);
      setParseResult(null);
      setCurrentRules(null);
      setNoCurrentRules(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }, 3000);
  }

  // ── build diff rows ───────────────────────────────────────────────────────

  const newRules = parseResult?.brand_rules;

  const diffRows: { label: string; oldVal: string | null; newVal: string | null }[] = [
    { label: "Brand Type",        oldVal: currentRules?.brand_type ?? null,           newVal: newRules?.brand_type ?? null },
    { label: "Core Idea",         oldVal: currentRules?.core_idea ?? null,            newVal: newRules?.core_idea ?? null },
    { label: "Customer Segment",  oldVal: currentRules?.customer_segment ?? null,     newVal: newRules?.customer_segment ?? null },
    { label: "Customer Mindset",  oldVal: currentRules?.customer_mindset ?? null,     newVal: newRules?.customer_mindset ?? null },
    { label: "Target Markets",    oldVal: arrStr(currentRules?.target_markets),       newVal: arrStr(newRules?.target_markets) },
    { label: "Tone of Voice",     oldVal: arrStr(currentRules?.voice_examples?.tone_traits), newVal: arrStr(newRules?.voice_examples?.tone_traits) },
    { label: "Writing Style",     oldVal: truncate(currentRules?.style_guide),        newVal: truncate(newRules?.style_guide) },
    { label: "Forbidden Words",   oldVal: arrStr(currentRules?.forbidden_words),      newVal: arrStr(newRules?.forbidden_words) },
  ];

  // ── render: select / uploading ────────────────────────────────────────────

  if (pageState === "select" || pageState === "uploading" || pageState === "error") {
    return (
      <div className="max-w-xl mx-auto py-10 px-4">
        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Admin</p>
        <h1 className="text-xl font-semibold mb-1">Brand Brief Upload</h1>
        <p className="text-sm text-gray-500 mb-6">Update tenant brand voice from DOCX</p>

        {/* Tenant selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Tenant</label>
          {tenantsError ? (
            <p className="text-sm text-red-600">{tenantsError}</p>
          ) : (
            <select
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              disabled={pageState === "uploading"}
            >
              <option value="">Select a tenant…</option>
              {tenants.map((t) => (
                <option key={t.tenant_id} value={t.tenant_id}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Drop zone */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Brand Brief (.docx)</label>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragging
                ? "border-blue-400 bg-blue-50"
                : "border-gray-300 hover:border-gray-400 bg-gray-50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? (
              <div>
                <p className="text-sm font-medium text-gray-800">{file.name}</p>
                <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600">Drop .docx here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">Max 5 MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </div>

        {/* Error */}
        {pageState === "error" && uploadError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded px-4 py-3 text-sm text-red-700">
            {uploadError}
          </div>
        )}

        <button
          className="bg-blue-600 text-white rounded px-5 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleUpload}
          disabled={!selectedTenant || !file || pageState === "uploading"}
        >
          {pageState === "uploading" ? "Uploading…" : "Upload & Parse"}
        </button>
      </div>
    );
  }

  // ── render: done ──────────────────────────────────────────────────────────

  if (pageState === "done") {
    return (
      <div className="max-w-xl mx-auto py-10 px-4 text-center">
        <div className="text-4xl mb-4">✅</div>
        <h2 className="text-lg font-semibold mb-2">Brand rules updated</h2>
        <p className="text-sm text-gray-500">Version ID: {parseResult?.version_id}</p>
        <p className="text-xs text-gray-400 mt-4">Returning to upload screen…</p>
      </div>
    );
  }

  // ── render: diff ──────────────────────────────────────────────────────────

  const isLowConfidence = parseResult?.status === "low_confidence";
  const isParseError = parseResult?.status === "error";
  const confidencePct = parseResult ? Math.round(parseResult.confidence * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Admin</p>
        <h1 className="text-xl font-semibold">Brand Brief — Diff View</h1>
      </div>

      {/* Parse status banner */}
      {isParseError ? (
        <div className="mb-4 bg-red-50 border border-red-200 rounded px-4 py-3 text-sm text-red-700">
          <strong>Parse failed</strong>
          {parseResult?.warnings?.length > 0 && (
            <ul className="mt-2 list-disc list-inside space-y-0.5">
              {parseResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      ) : isLowConfidence ? (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded px-4 py-3 text-sm text-amber-800">
          <strong>⚠️ Low confidence</strong> — {parseResult?.sections_parsed ?? 0}/8 sections parsed ({confidencePct}%)
          <p className="mt-1 text-amber-700">Manual review required before activating</p>
          {parseResult?.warnings?.length > 0 && (
            <ul className="mt-2 list-disc list-inside space-y-0.5">
              {parseResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      ) : (
        <div className="mb-4 bg-green-50 border border-green-200 rounded px-4 py-3 text-sm text-green-700">
          ✅ Parsed — confidence {confidencePct}% ({parseResult?.sections_parsed ?? 0}/8 sections)
        </div>
      )}

      {/* Diff table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase w-32">Field</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase">
                Current {noCurrentRules && <span className="text-gray-400 font-normal normal-case">(none on file)</span>}
              </th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase">
                New (from DOCX)
              </th>
            </tr>
          </thead>
          <tbody>
            {diffRows.map((row) => (
              <DiffRow key={row.label} label={row.label} oldVal={row.oldVal} newVal={row.newVal} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          className="bg-blue-600 text-white rounded px-5 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleConfirm}
          disabled={isLowConfidence || isParseError || pageState === "confirming"}
        >
          {pageState === "confirming" ? "Activating…" : "Confirm Activate"}
        </button>
        <button
          className="bg-white border border-gray-300 text-gray-700 rounded px-5 py-2 text-sm font-medium hover:bg-gray-50"
          onClick={() => {
            setPageState("select");
            setFile(null);
            setParseResult(null);
            setCurrentRules(null);
            setNoCurrentRules(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        >
          Cancel
        </button>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  );
}
