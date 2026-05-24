"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAdminSecret } from "@/lib/admin-auth";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

export default function LoginPage() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = secret.trim();
    if (!val) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/tenants`, {
        headers: { "x-admin-secret": val, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Invalid secret key");
      setAdminSecret(val);
      router.push("/workspace/pipeline");
    } catch {
      setError("Invalid secret key");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-aa-offwhite">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="mb-6 text-center">
          <h1 className="font-fraunces text-2xl font-bold text-aa-blackblue">Admin Login</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your admin secret key</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}
          <input
            type="password"
            placeholder="Secret key"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aa-orange/40"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !secret.trim()}
            className="w-full bg-aa-orange text-white rounded-lg py-2.5 text-sm font-medium hover:bg-aa-orange/90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Verifying…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
