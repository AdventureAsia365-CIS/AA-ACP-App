"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

export default function TenantLoginPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = apiKey.trim();
    if (!val) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/tenant-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: val }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Invalid API key");
      }
      const { access_token } = await res.json();
      sessionStorage.setItem("acp_tenant_token", access_token);
      router.push("/portal/competitors");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-aa-offwhite">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 bg-aa-orange rounded-lg flex items-center justify-center font-bold text-white text-sm">
            AA
          </div>
          <div>
            <p className="font-semibold text-aa-blackblue text-sm leading-tight">ACP Portal</p>
            <p className="text-xs text-gray-400">B2B Partner Login</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              API Key
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                </svg>
              </span>
              <input
                type="password"
                placeholder="wl_live_sk_..."
                value={apiKey}
                onChange={e => { setApiKey(e.target.value); setError(""); }}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-aa-orange focus:ring-2 focus:ring-aa-orange/20"
                autoFocus
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !apiKey.trim()}
            className="w-full bg-aa-orange text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-aa-orange/90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Verifying…" : "Access Portal"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <a href="/login" className="text-xs text-gray-400 hover:text-gray-600">
            ← Staff login
          </a>
        </div>
      </div>
    </div>
  );
}
