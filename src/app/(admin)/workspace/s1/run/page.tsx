"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

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

interface RunConfig {
  model_id: string;
  seo_mode: string;
  brand_identity_id: string | null;
  language: string;
}

// ── auth ──────────────────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("acp_admin_token");
}
function setStoredToken(t: string) {
  localStorage.setItem("acp_admin_token", t);
}
function authHeaders(): HeadersInit {
  const t = getToken();
  return t
    ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }
    : {};
}
async function loginWithKey(apiKey: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/tenant-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });
  if (!res.ok) throw new Error("Invalid API key");
  const data = await res.json();
  return data.access_token as string;
}

// ── small components ──────────────────────────────────────────────────────────

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

function SkeletonRows() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <tr key={i} className="border-b">
          {[...Array(7)].map((__, j) => (
            <td key={j} className="px-3 py-3">
              <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── config defaults ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG: RunConfig = {
  model_id: "us.anthropic.claude-sonnet-4-5-20251001-v1:0",
  seo_mode: "informational",
  brand_identity_id: null,
  language: "EN-US",
};

const MODEL_OPTIONS = [
  {
    value: "us.anthropic.claude-sonnet-4-5-20251001-v1:0",
    label: "Claude Sonnet 4.5 (~$0.02/tour)",
  },
  {
    value: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    label: "Claude Haiku 4.5 (~$0.002/tour)",
  },
];

const SEO_MODE_OPTIONS = [
  { value: "informational", label: "Informational" },
  { value: "transactional", label: "Transactional" },
  { value: "local", label: "Local" },
  { value: "off", label: "Off (skip SEO)" },
];

const LANGUAGE_OPTIONS = [
  { value: "EN-US", label: "English (US)" },
  { value: "EN-GB", label: "English (UK)" },
];

// ── main page ─────────────────────────────────────────────────────────────────

export default function S1RunPage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [loginError, setLoginError] = useState("");

  const [tours, setTours] = useState<ApprovedTour[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // filters
  const [filterCountry, setFilterCountry] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // run config
  const [runConfig, setRunConfig] = useState<RunConfig>(DEFAULT_CONFIG);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    setToken(getToken());
  }, []);

  const fetchTours = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const qs = new URLSearchParams();
      if (filterCountry) qs.set("country", filterCountry);
      if (filterSupplier) qs.set("supplier", filterSupplier);
      if (filterDateFrom) qs.set("upload_date_from", filterDateFrom);
      if (filterDateTo) qs.set("upload_date_to", filterDateTo);
      const res = await fetch(`${API_BASE}/acp/s1/tours?${qs}`, {
        headers: authHeaders(),
      });
      if (res.status === 401) {
        setToken(null);
        localStorage.removeItem("acp_admin_token");
        return;
      }
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json = await res.json();
      setTours(json.data);
      setSelected(new Set());
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : "Failed to load tours");
    } finally {
      setLoading(false);
    }
  }, [filterCountry, filterSupplier, filterDateFrom, filterDateTo]);

  useEffect(() => {
    if (token) fetchTours();
  }, [token, fetchTours]);

  // ── login ──────────────────────────────────────────────────────────────────

  async function handleLogin() {
    setLoginError("");
    try {
      const jwt = await loginWithKey(apiKeyInput.trim());
      setStoredToken(jwt);
      setToken(jwt);
    } catch {
      setLoginError("Invalid API key");
    }
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-lg shadow p-8 w-full max-w-sm">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">
            Admin
          </p>
          <h1 className="text-lg font-semibold mb-4">S1 Rewrite</h1>
          {loginError && (
            <p className="text-sm text-red-600 mb-3">{loginError}</p>
          )}
          <input
            type="password"
            className="w-full border rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Admin API key"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
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

  // ── selection ──────────────────────────────────────────────────────────────

  const allSelected = tours.length > 0 && selected.size === tours.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(tours.map((t) => t.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // ── unique country list for dropdown ──────────────────────────────────────

  const countries = [
    ...new Set(tours.map((t) => t.country).filter(Boolean)),
  ].sort();

  // ── submit run ────────────────────────────────────────────────────────────

  async function handleRunS1() {
    if (selected.size === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const selectedTours = tours.filter((t) => selected.has(t.id));
      const res = await fetch(`${API_BASE}/acp/s1/run`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          tour_ids: [...selected],
          run_config: runConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { detail?: string }).detail ?? `API error ${res.status}`
        );
      }
      const data = await res.json();
      // Store tour metadata for the progress page to display names
      sessionStorage.setItem(
        `s1_run_${data.run_id}`,
        JSON.stringify(selectedTours)
      );
      router.push(`/workspace/s1/run/${data.run_id}`);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Failed to start run");
      setIsSubmitting(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 flex gap-6 min-h-screen">
      {/* ── Left: filter + table ── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">S1 Rewrite — Select Tours</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Choose approved tours to rewrite, then configure the run.
            </p>
          </div>
          <button
            className="text-sm text-gray-400 hover:text-gray-600"
            onClick={() => {
              localStorage.removeItem("acp_admin_token");
              setToken(null);
            }}
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
          <div>
            <label className="text-xs text-gray-500 block mb-1">From</label>
            <input
              type="date"
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">To</label>
            <input
              type="date"
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
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
              {selected.size} selected / {tours.length} approved
            </span>
          )}
        </div>

        {/* Error */}
        {fetchError && (
          <p className="text-sm text-red-600 mb-3">{fetchError}</p>
        )}

        {/* Table */}
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-gray-300"
                    disabled={tours.length === 0}
                  />
                </th>
                <th className="px-3 py-3">Tour Name</th>
                <th className="px-3 py-3">Tour Code</th>
                <th className="px-3 py-3">Country</th>
                <th className="px-3 py-3">Supplier</th>
                <th className="px-3 py-3">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <SkeletonRows />
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
                tours.map((t) => (
                  <tr
                    key={t.id}
                    className={
                      selected.has(t.id)
                        ? "bg-blue-50 cursor-pointer"
                        : "hover:bg-gray-50 cursor-pointer"
                    }
                    onClick={() => toggleOne(t.id)}
                  >
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(t.id)}
                        onChange={() => toggleOne(t.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-2.5 font-medium max-w-xs truncate">
                      {t.aa_name || <span className="text-gray-400 italic">Unnamed</span>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">
                      {t.tour_code || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{t.country || "—"}</td>
                    <td className="px-3 py-2.5 text-gray-600">{t.supplier || "—"}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                      {t.updated_at ? t.updated_at.slice(0, 10) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Right: config panel ── */}
      <div className="w-80 shrink-0">
        <div className="bg-white border rounded-lg p-5 sticky top-8">
          <h2 className="text-sm font-semibold mb-4">Run Configuration</h2>

          <div className="flex flex-col gap-4">
            {/* Model */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                LLM Model <span className="text-red-400">*</span>
              </label>
              <select
                className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={runConfig.model_id}
                onChange={(e) =>
                  setRunConfig((c) => ({ ...c, model_id: e.target.value }))
                }
              >
                {MODEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* SEO Mode */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                SEO Mode <span className="text-red-400">*</span>
              </label>
              <select
                className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={runConfig.seo_mode}
                onChange={(e) =>
                  setRunConfig((c) => ({ ...c, seo_mode: e.target.value }))
                }
              >
                {SEO_MODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Brand Identity */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Brand Identity
              </label>
              <select
                className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={runConfig.brand_identity_id ?? ""}
                onChange={(e) =>
                  setRunConfig((c) => ({
                    ...c,
                    brand_identity_id: e.target.value || null,
                  }))
                }
              >
                <option value="">None (unbranded)</option>
              </select>
            </div>

            {/* Language */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Language <span className="text-red-400">*</span>
              </label>
              <select
                className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={runConfig.language}
                onChange={(e) =>
                  setRunConfig((c) => ({ ...c, language: e.target.value }))
                }
              >
                {LANGUAGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t">
            {submitError && (
              <p className="text-xs text-red-600 mb-3">{submitError}</p>
            )}
            <p className="text-xs text-gray-500 mb-3">
              {selected.size === 0
                ? "Select tours to run"
                : `${selected.size} tour${selected.size > 1 ? "s" : ""} selected`}
            </p>
            <button
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              disabled={selected.size === 0 || isSubmitting}
              onClick={handleRunS1}
            >
              {isSubmitting
                ? "Starting run…"
                : `Run S1 Rewrite (${selected.size})`}
            </button>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  );
}
