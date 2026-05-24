"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAdminSecret } from "@/lib/admin-auth";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const secret = password.trim();
    if (!secret) { setError("Enter username and password"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/tenants`, {
        headers: { "x-admin-secret": secret, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Backend auth failed");
      setAdminSecret(secret);
      router.push("/workspace/pipeline");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Backend auth failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-aa-offwhite">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 bg-aa-orange rounded-lg flex items-center justify-center font-bold text-white text-sm">
            AA
          </div>
          <div>
            <p className="font-semibold text-aa-blackblue text-sm leading-tight">ACP Portal</p>
            <p className="text-xs text-gray-400">Staff Login</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Username */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleSubmit(e as unknown as React.FormEvent)}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-aa-orange focus:ring-2 focus:ring-aa-orange/20"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleSubmit(e as unknown as React.FormEvent)}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-aa-orange focus:ring-2 focus:ring-aa-orange/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full bg-aa-orange text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-aa-orange/90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Connecting…" : "Login"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <a href="/tenant-login" className="text-xs text-gray-400 hover:text-gray-600">
            B2B Tenant login →
          </a>
        </div>
      </div>
    </div>
  );
}
