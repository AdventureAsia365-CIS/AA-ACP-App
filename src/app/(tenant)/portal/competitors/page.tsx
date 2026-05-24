"use client";

import { useEffect, useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";
const MAX_PER_COUNTRY = 10;

interface Competitor {
  id: string;
  country: string;
  url: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
}

interface ApiResponse {
  data: Competitor[];
  active_count_by_country: Record<string, number>;
}

// ── auth helpers ──────────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("acp_tenant_token");
}

function setToken(t: string) {
  sessionStorage.setItem("acp_tenant_token", t);
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : {};
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

// ── main page ─────────────────────────────────────────────────────────────────

export default function CompetitorsPage() {
  const [token, setTokenState] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [loginError, setLoginError] = useState("");

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [activeCountByCountry, setActiveCountByCountry] = useState<Record<string, number>>({});
  const [filterCountry, setFilterCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Add form state
  const [addUrl, setAddUrl] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addCountry, setAddCountry] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  useEffect(() => {
    const t = getToken();
    setTokenState(t);
  }, []);

  const fetchCompetitors = useCallback(async (country?: string) => {
    setLoading(true);
    setError("");
    try {
      const qs = country ? `?country=${encodeURIComponent(country)}` : "";
      const res = await fetch(`${API_BASE}/v1/competitors${qs}`, {
        headers: authHeaders(),
      });
      if (res.status === 401) { setTokenState(null); sessionStorage.removeItem("acp_tenant_token"); return; }
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json: ApiResponse = await res.json();
      setCompetitors(json.data);
      setActiveCountByCountry(json.active_count_by_country);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) fetchCompetitors(filterCountry || undefined);
  }, [token, filterCountry, fetchCompetitors]);

  // ── login form ──────────────────────────────────────────────────────────────

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-lg shadow p-8 w-full max-w-sm">
          <h1 className="text-lg font-semibold mb-1">ACP Portal</h1>
          <p className="text-sm text-gray-500 mb-5">Enter your tenant API key to continue.</p>
          {loginError && <p className="text-sm text-red-600 mb-3">{loginError}</p>}
          <input
            type="password"
            className="w-full border rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="API key"
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

  async function handleLogin() {
    setLoginError("");
    try {
      const jwt = await loginWithKey(apiKeyInput.trim());
      setToken(jwt);
      setTokenState(jwt);
    } catch {
      setLoginError("Invalid API key — check with your admin.");
    }
  }

  // ── add URL ─────────────────────────────────────────────────────────────────

  async function handleAdd() {
    setAddError("");
    if (!addUrl || !addCountry) { setAddError("URL and country are required"); return; }
    setAdding(true);
    try {
      const res = await fetch(`${API_BASE}/v1/competitors`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ url: addUrl, label: addLabel || null, country: addCountry }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? `Error ${res.status}`);
      }
      setAddUrl(""); setAddLabel(""); setAddCountry("");
      await fetchCompetitors(filterCountry || undefined);
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  }

  // ── edit label inline ───────────────────────────────────────────────────────

  async function handleSaveLabel(id: string) {
    await fetch(`${API_BASE}/v1/competitors/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ label: editLabel }),
    });
    setEditingId(null);
    await fetchCompetitors(filterCountry || undefined);
  }

  // ── toggle active ───────────────────────────────────────────────────────────

  async function handleToggle(c: Competitor) {
    await fetch(`${API_BASE}/v1/competitors/${c.id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ is_active: !c.is_active }),
    });
    await fetchCompetitors(filterCountry || undefined);
  }

  // ── deactivate (soft delete) ────────────────────────────────────────────────

  async function handleDeactivate(id: string) {
    await fetch(`${API_BASE}/v1/competitors/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    await fetchCompetitors(filterCountry || undefined);
  }

  // ── countries for filter dropdown ──────────────────────────────────────────

  const countries = [...new Set(competitors.map((c) => c.country))].sort();

  const activeCount = filterCountry ? (activeCountByCountry[filterCountry] ?? 0) : 0;
  const atLimit = filterCountry ? activeCount >= MAX_PER_COUNTRY : false;

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Competitor URLs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track competitor pages per country for S2 analysis.</p>
        </div>
        <button
          className="text-sm text-gray-500 hover:text-gray-700"
          onClick={() => { sessionStorage.removeItem("acp_tenant_token"); setTokenState(null); }}
        >
          Sign out
        </button>
      </div>

      {/* Country filter */}
      <div className="flex items-center gap-3 mb-5">
        <select
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterCountry}
          onChange={(e) => setFilterCountry(e.target.value)}
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {filterCountry && (
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            atLimit ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
          }`}>
            {activeCount}/{MAX_PER_COUNTRY} active
          </span>
        )}
      </div>

      {/* Add URL form */}
      <div className="bg-white border rounded-lg p-4 mb-5">
        <p className="text-sm font-medium mb-3">Add URL</p>
        {addError && <p className="text-sm text-red-600 mb-2">{addError}</p>}
        <div className="flex gap-2 flex-wrap">
          <input
            className="border rounded px-3 py-1.5 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://competitor.com/tours/vietnam"
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
          />
          <input
            className="border rounded px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Label (optional)"
            value={addLabel}
            onChange={(e) => setAddLabel(e.target.value)}
          />
          <input
            className="border rounded px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Country"
            value={addCountry}
            onChange={(e) => setAddCountry(e.target.value)}
          />
          <button
            className={`px-4 py-1.5 rounded text-sm font-medium text-white ${
              atLimit || adding
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
            onClick={handleAdd}
            disabled={atLimit || adding}
            title={atLimit ? `Limit of ${MAX_PER_COUNTRY} reached for ${filterCountry}` : undefined}
          >
            {adding ? "Adding…" : "Add URL"}
          </button>
        </div>
        {atLimit && (
          <p className="text-xs text-red-600 mt-2">
            Limit of {MAX_PER_COUNTRY} active URLs reached for {filterCountry}. Deactivate one to add more.
          </p>
        )}
      </div>

      {/* Table */}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : competitors.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-400 text-sm">
          No competitor URLs yet. Add one above.
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {competitors.map((c) => (
                <tr key={c.id} className={c.is_active ? "" : "opacity-50"}>
                  <td className="px-4 py-3 max-w-xs">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate block"
                      title={c.url}
                    >
                      {c.url.replace(/^https?:\/\//, "")}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === c.id ? (
                      <div className="flex gap-1">
                        <input
                          className="border rounded px-2 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          autoFocus
                        />
                        <button
                          className="text-xs text-blue-600 hover:underline"
                          onClick={() => handleSaveLabel(c.id)}
                        >Save</button>
                        <button
                          className="text-xs text-gray-400 hover:underline"
                          onClick={() => setEditingId(null)}
                        >Cancel</button>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer text-gray-600 hover:text-blue-600"
                        onClick={() => { setEditingId(c.id); setEditLabel(c.label ?? ""); }}
                        title="Click to edit label"
                      >
                        {c.label ?? <span className="text-gray-300 italic">—</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.country}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button
                        className="text-xs text-gray-500 hover:text-blue-600"
                        onClick={() => handleToggle(c)}
                      >
                        {c.is_active ? "Deactivate" : "Activate"}
                      </button>
                      {c.is_active && (
                        <button
                          className="text-xs text-red-400 hover:text-red-600"
                          onClick={() => handleDeactivate(c.id)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
