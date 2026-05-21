"use client";

import { useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

const CHANNELS = ["facebook", "linkedin", "tiktok", "instagram", "email", "newsletter", "landing_page", "ads"];
const PROVIDERS = ["bedrock", "anthropic", "openai"];

interface Angle {
  name: string;
  why_it_works: string;
  length_signal: string;
  style_signal: string;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("acp_admin_token");
}

function authHeaders(): HeadersInit {
  const t = getToken();
  return { ...(t ? { Authorization: `Bearer ${t}` } : {}), "Content-Type": "application/json" };
}

const defaultBrief = {
  brand: "Adventure Asia",
  audience: "Senior professionals 40-60, US/UK/AU",
  channel: "facebook",
  goal: "awareness",
  topic: "",
  tone: "calm, credible, specific",
  cta: "Explore the route",
  must_include: "",
  must_avoid: "trip of a lifetime, game-changing",
  destination: "",
  tour_name: "",
};

// ── Step 1: Brief Form ────────────────────────────────────────────────────────

function BriefForm({ onAngles }: { onAngles: (angles: Angle[], brief: typeof defaultBrief, provider: string) => void }) {
  const [form, setForm] = useState(defaultBrief);
  const [provider, setProvider] = useState("bedrock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/acp/s4/social/angles`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          brief: {
            ...form,
            must_include: form.must_include.split(",").map((s) => s.trim()).filter(Boolean),
            must_avoid: form.must_avoid.split(",").map((s) => s.trim()).filter(Boolean),
          },
          llm_provider: provider,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      onAngles(data.angles, form, provider);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate angles");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-aa-blackblue mb-4">Step 1 — Content Brief</h2>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-aa-gray mb-1">Channel *</label>
            <select value={form.channel} onChange={set("channel")}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-aa-orange focus:outline-none">
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-aa-gray mb-1">Goal *</label>
            <input value={form.goal} onChange={set("goal")} placeholder="e.g. awareness, conversion, engagement"
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-aa-orange focus:outline-none" />
          </div>
        </div>

        {[
          ["Brand *", "brand", "Adventure Asia"],
          ["Audience *", "audience", "Senior professionals 40-60"],
          ["Topic *", "topic", "e.g. Cycling South Korea route"],
          ["Tone *", "tone", "calm, credible, specific"],
          ["CTA *", "cta", "e.g. Explore the route"],
          ["Destination", "destination", "e.g. South Korea"],
          ["Tour Name", "tour_name", "e.g. Korea Cycling 9 Days"],
        ].map(([label, key, placeholder]) => (
          <div key={key as string}>
            <label className="block text-xs font-medium text-aa-gray mb-1">{label as string}</label>
            <input value={(form as Record<string, string>)[key as string]} onChange={set(key as string)} placeholder={placeholder as string}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-aa-orange focus:outline-none" />
          </div>
        ))}

        <div>
          <label className="block text-xs font-medium text-aa-gray mb-1">Must Include (comma-separated)</label>
          <textarea value={form.must_include} onChange={set("must_include")} rows={2}
            placeholder="e.g. Seoul, Busan, 9 days"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-aa-orange focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-aa-gray mb-1">Must Avoid (comma-separated)</label>
          <textarea value={form.must_avoid} onChange={set("must_avoid")} rows={2}
            placeholder="e.g. trip of a lifetime, game-changing"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-aa-orange focus:outline-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-aa-gray mb-1">LLM Provider</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-aa-orange focus:outline-none">
            {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <button onClick={submit} disabled={loading}
          className="w-full py-2 bg-aa-orange text-white text-sm rounded hover:bg-amber-600 disabled:opacity-50 transition-colors">
          {loading ? "Generating angles…" : "Generate 3 Angles →"}
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Angle Selection ────────────────────────────────────────────────────

function AngleSelector({
  angles, brief, provider,
  onSelect,
}: {
  angles: Angle[];
  brief: typeof defaultBrief;
  provider: string;
  onSelect: (angle: Angle, socialId: string, preview: string) => void;
}) {
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (angle: Angle, idx: number) => {
    setLoading(idx);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/acp/s4/social/write`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          brief: {
            ...brief,
            must_include: brief.must_include.split(",").map((s) => s.trim()).filter(Boolean),
            must_avoid: brief.must_avoid.split(",").map((s) => s.trim()).filter(Boolean),
          },
          selected_angle: angle,
          tenant_id: "aa_internal",
          llm_provider: provider,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      onSelect(angle, data.social_id, data.content_preview);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Write failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-aa-blackblue mb-4">Step 2 — Select an Angle</h2>
      <p className="text-sm text-aa-gray mb-4">Choose one angle. We&apos;ll write + quality-check the content.</p>
      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
      <div className="space-y-3">
        {angles.map((a, i) => (
          <button key={i} onClick={() => choose(a, i)} disabled={loading !== null}
            className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-aa-orange hover:bg-amber-50 transition-colors disabled:opacity-50">
            <div className="font-medium text-aa-blackblue mb-1">{a.name}</div>
            <div className="text-sm text-aa-gray mb-2">{a.why_it_works}</div>
            <div className="flex gap-3 text-xs text-gray-400">
              <span>📏 {a.length_signal}</span>
              <span>✍️ {a.style_signal}</span>
            </div>
            {loading === i && <div className="text-xs text-aa-orange mt-2">Writing content…</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 3: Content Preview ────────────────────────────────────────────────────

function ContentPreview({ angle, socialId, preview }: { angle: Angle; socialId: string; preview: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-aa-blackblue mb-2">Step 3 — Content Saved</h2>
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-green-700 font-medium">✓ Content saved to social_content</p>
        <p className="text-xs text-green-600 mt-1">ID: {socialId}</p>
      </div>

      <div className="bg-aa-offwhite border border-gray-200 rounded-lg p-4 mb-4">
        <p className="text-xs font-medium text-aa-gray mb-2 uppercase tracking-wide">Angle: {angle.name}</p>
        <p className="text-sm text-aa-blackblue leading-relaxed whitespace-pre-wrap">{preview}…</p>
      </div>

      <div className="flex gap-3">
        <Link href="/workspace/social"
          className="text-sm px-4 py-2 bg-aa-orange text-white rounded hover:bg-amber-600 transition-colors">
          View all social content →
        </Link>
        <button onClick={() => window.location.reload()}
          className="text-sm px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors">
          Generate another
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Step = "brief" | "angles" | "done";

export default function SocialGeneratePage() {
  const [step, setStep] = useState<Step>("brief");
  const [angles, setAngles] = useState<Angle[]>([]);
  const [savedBrief, setSavedBrief] = useState<typeof defaultBrief>(defaultBrief);
  const [savedProvider, setSavedProvider] = useState("bedrock");
  const [selectedAngle, setSelectedAngle] = useState<Angle | null>(null);
  const [socialId, setSocialId] = useState<string>("");
  const [preview, setPreview] = useState<string>("");

  const steps = ["Brief", "Angle", "Done"];
  const stepIdx = step === "brief" ? 0 : step === "angles" ? 1 : 2;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-aa-blackblue">Generate Social Content</h1>
          <p className="text-sm text-aa-gray mt-1">
            Guided mode — 8 channels, 11+ copywriting formulas
          </p>
        </div>
        <Link href="/workspace/social" className="text-sm text-aa-orange hover:underline">
          ← View content library
        </Link>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
              i < stepIdx ? "bg-green-500 text-white"
                : i === stepIdx ? "bg-aa-orange text-white"
                : "bg-gray-200 text-gray-500"
            }`}>
              {i < stepIdx ? "✓" : i + 1}
            </div>
            <span className={`text-sm ${i === stepIdx ? "font-medium text-aa-blackblue" : "text-gray-400"}`}>{s}</span>
            {i < steps.length - 1 && <div className="w-8 h-px bg-gray-200" />}
          </div>
        ))}
      </div>

      {step === "brief" && (
        <BriefForm
          onAngles={(a, b, p) => {
            setAngles(a);
            setSavedBrief(b);
            setSavedProvider(p);
            setStep("angles");
          }}
        />
      )}

      {step === "angles" && (
        <AngleSelector
          angles={angles}
          brief={savedBrief}
          provider={savedProvider}
          onSelect={(a, id, prev) => {
            setSelectedAngle(a);
            setSocialId(id);
            setPreview(prev);
            setStep("done");
          }}
        />
      )}

      {step === "done" && selectedAngle && (
        <ContentPreview angle={selectedAngle} socialId={socialId} preview={preview} />
      )}
    </div>
  );
}
