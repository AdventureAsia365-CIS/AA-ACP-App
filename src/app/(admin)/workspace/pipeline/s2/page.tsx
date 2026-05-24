"use client";
// workspace/pipeline/s2/page.tsx — ACP S2 Market Research output
// GET /v1/acp/runs/{run_id}/context → S2 research output (market insights, competitor data)
// GET /v1/acp/runs             → list runs to pick from

import { adminHeaders } from "@/lib/admin-auth";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

interface RunListItem {
  run_id: string;
  status: string;
  started_at: string | null;
  tour_count: number | null;
}

interface RunContext {
  run_id: string;
  brand_brief?: Record<string, unknown>;
  tour_visibility_report?: {
    visibility_score?: number;
    opportunity_gaps?: string[];
    competitor_summary?: string;
    search_volume_estimate?: number;
    trend_direction?: "up" | "down" | "flat";
  };
  market_preference_summary?: {
    customer_segment?: string;
    price_positioning?: string;
    demand_signals?: string[];
  };
  social_ideas?: Array<{
    platform?: string;
    hook?: string;
    angle?: string;
    format?: string;
  }>;
  blog_briefs?: Array<{
    title?: string;
    target_keyword?: string;
    content_angle?: string;
    estimated_traffic?: number;
  }>;
  phase_2_competitor_raw?: Array<{
    name?: string;
    price_range?: string;
    highlights?: string[];
    gaps?: string[];
  }>;
  seo_context?: {
    keyword_search?: string;
    top_keywords?: string[];
  };
}

function TrendIcon({ dir }: { dir?: string }) {
  if (dir === "up") return <span className="text-green-600">↑</span>;
  if (dir === "down") return <span className="text-red-600">↓</span>;
  return <span className="text-gray-400">→</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">{title}</p>
      {children}
    </div>
  );
}

function S2Content({ runId }: { runId: string }) {
  const [ctx, setCtx] = useState<RunContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [competitorExpanded, setCompetitorExpanded] = useState(false);

  useEffect(() => {
    if (!runId) return;
    setLoading(true);
    fetch(`${API_BASE}/v1/acp/runs/${runId}/context`, { headers: adminHeaders() })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setCtx)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Loading S2 data…</div>;
  if (error) return <div className="text-sm text-red-600 py-8 text-center">{error}</div>;
  if (!ctx) return <div className="text-sm text-gray-400 py-8 text-center">No S2 data for this run.</div>;

  const tvr = ctx.tour_visibility_report;
  const mps = ctx.market_preference_summary;
  const si = ctx.social_ideas || [];
  const bb = ctx.blog_briefs || [];
  const comp = ctx.phase_2_competitor_raw || [];
  const seo = ctx.seo_context;

  return (
    <>
      {/* Panel 1: Tour Visibility */}
      {tvr && (
        <Section title="Tour Visibility Report">
          <div className="flex items-center gap-6 mb-4 flex-wrap">
            {tvr.visibility_score !== undefined && (
              <div className="text-center">
                <div className="text-3xl font-serif font-bold text-aa-blackblue">{tvr.visibility_score}</div>
                <div className="text-xs text-gray-400 mt-1">Visibility Score</div>
              </div>
            )}
            {tvr.trend_direction && (
              <div className="text-center">
                <div className="text-3xl"><TrendIcon dir={tvr.trend_direction} /></div>
                <div className="text-xs text-gray-400 mt-1">Trend</div>
              </div>
            )}
            {tvr.search_volume_estimate !== undefined && (
              <div className="text-center">
                <div className="text-xl font-bold text-aa-blackblue">{tvr.search_volume_estimate.toLocaleString()}</div>
                <div className="text-xs text-gray-400 mt-1">Est. Search Volume</div>
              </div>
            )}
          </div>
          {tvr.competitor_summary && (
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">{tvr.competitor_summary}</p>
          )}
          {tvr.opportunity_gaps && tvr.opportunity_gaps.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Opportunity Gaps</p>
              <ul className="space-y-1">
                {tvr.opportunity_gaps.map((g, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-aa-orange mt-0.5">•</span>{g}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* Panel 2: Market Preferences */}
      {mps && (
        <Section title="Market Preference Summary">
          <div className="grid grid-cols-3 gap-4 mb-4">
            {mps.customer_segment && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Customer Segment</p>
                <p className="text-sm font-semibold text-aa-blackblue">{mps.customer_segment}</p>
              </div>
            )}
            {mps.price_positioning && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Price Positioning</p>
                <p className="text-sm font-semibold text-aa-blackblue">{mps.price_positioning}</p>
              </div>
            )}
          </div>
          {mps.demand_signals && mps.demand_signals.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Demand Signals</p>
              <ul className="space-y-1">
                {mps.demand_signals.map((s, i) => <li key={i} className="text-sm text-gray-600 flex items-start gap-2"><span className="text-blue-500 mt-0.5">◆</span>{s}</li>)}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* SEO context */}
      {seo && (
        <Section title="SEO Context">
          {seo.keyword_search && (
            <p className="text-sm text-gray-600 mb-3">Seed: <strong>{seo.keyword_search}</strong></p>
          )}
          {seo.top_keywords && seo.top_keywords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {seo.top_keywords.map((k, i) => (
                <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">{k}</span>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Panel 3: Social Ideas */}
      {si.length > 0 && (
        <Section title="Social Ideas">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Platform</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Hook</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Angle</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Format</th>
                </tr>
              </thead>
              <tbody>
                {si.map((s, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="px-3 py-2.5 font-semibold text-aa-blackblue">{s.platform || "—"}</td>
                    <td className="px-3 py-2.5 text-gray-600">{s.hook || "—"}</td>
                    <td className="px-3 py-2.5 text-gray-600">{s.angle || "—"}</td>
                    <td className="px-3 py-2.5 text-gray-500">{s.format || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Panel 4: Blog Briefs */}
      {bb.length > 0 && (
        <Section title="Blog Briefs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Title</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Target Keyword</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Angle</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Est. Traffic</th>
                </tr>
              </thead>
              <tbody>
                {bb.map((b, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="px-3 py-2.5 font-medium text-aa-blackblue">{b.title || "—"}</td>
                    <td className="px-3 py-2.5 text-blue-600">{b.target_keyword || "—"}</td>
                    <td className="px-3 py-2.5 text-gray-600">{b.content_angle || "—"}</td>
                    <td className="px-3 py-2.5 text-gray-500">{b.estimated_traffic?.toLocaleString() || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Panel 5: Competitor Raw (collapsible) */}
      {comp.length > 0 && (
        <Section title="Competitor Data (Raw)">
          <button onClick={() => setCompetitorExpanded(e => !e)}
            className="text-sm text-aa-orange hover:underline mb-3">
            {competitorExpanded ? "Collapse" : `Expand (${comp.length} competitors)`}
          </button>
          {competitorExpanded && (
            <div className="space-y-4">
              {comp.map((c, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-semibold text-aa-blackblue mb-1">{c.name || `Competitor ${i + 1}`}</p>
                  {c.price_range && <p className="text-xs text-gray-500 mb-2">Price: {c.price_range}</p>}
                  {c.highlights && c.highlights.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Highlights</p>
                      <ul className="space-y-0.5">
                        {c.highlights.map((h, j) => <li key={j} className="text-xs text-gray-600">• {h}</li>)}
                      </ul>
                    </div>
                  )}
                  {c.gaps && c.gaps.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Gaps</p>
                      <ul className="space-y-0.5">
                        {c.gaps.map((g, j) => <li key={j} className="text-xs text-red-600">⚠ {g}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Proceed */}
      <div className="flex justify-end mt-4">
        <Link href={`/workspace/pipeline/s3?run_id=${runId}`}
          className="px-5 py-2.5 bg-aa-orange text-white text-sm font-semibold rounded-lg hover:opacity-90">
          → Proceed to S3
        </Link>
      </div>
    </>
  );
}

function S2PageInner() {
  const searchParams = useSearchParams();
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [runId, setRunId] = useState(searchParams.get("run_id") || "");

  useEffect(() => {
    fetch(`${API_BASE}/v1/acp/runs`, { headers: adminHeaders() })
      .then(r => r.json())
      .then(d => setRuns(d.data || []))
      .catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-semibold text-aa-blackblue tracking-tight">S2 — Market Research</h1>
        <p className="text-sm text-gray-500 mt-1">Competitor analysis · SEO intelligence · market signals</p>
      </div>

      {/* Run selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Select Run</p>
        <select value={runId} onChange={e => setRunId(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-aa-orange">
          <option value="">— Select a run to view S2 output —</option>
          {runs.map(r => (
            <option key={r.run_id} value={r.run_id}>
              {r.run_id.slice(0, 12)} · {r.status} · {r.started_at ? new Date(r.started_at).toLocaleDateString() : "—"}
            </option>
          ))}
        </select>
      </div>

      {runId && <S2Content runId={runId} />}
    </div>
  );
}

export default function S2Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading…</div>}>
      <S2PageInner />
    </Suspense>
  );
}
