"use client";

import { adminHeaders } from "@/lib/admin-auth";
import { useEffect, useState, useCallback } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api-cis.lumiguides.it.com";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OutputRule {
  rule_id: string;
  tenant_id: string | null;
  stage: string | null;
  rule_type: string;
  pattern: string;
  action_value: string | null;
  error_message: string | null;
  source_type: string;
  run_count: number;
  active: boolean;
  created_at: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ruleTypeBadge(rule_type: string) {
  const styles: Record<string, string> = {
    block: "bg-red-100 text-red-700",
    replace: "bg-blue-100 text-blue-700",
    flag: "bg-yellow-100 text-yellow-700",
    score_gate: "bg-purple-100 text-purple-700",
    truncate: "bg-gray-100 text-gray-700",
  };
  return styles[rule_type] ?? "bg-gray-100 text-gray-600";
}

const STAGES = ["All", "S4", "S3", "S2", "S1", "S0"];

// ── Component ─────────────────────────────────────────────────────────────────

export default function RulesDashboard() {
  const [rules, setRules] = useState<OutputRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("All");
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (stageFilter !== "All") params.set("stage", stageFilter);
      const res = await fetch(`${API_BASE}/v1/rules?${params}`, {
        headers: adminHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: OutputRule[] = await res.json();
      setRules(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, [stageFilter]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const toggleRule = async (rule_id: string, current: boolean) => {
    setToggling(rule_id);
    try {
      const res = await fetch(`${API_BASE}/v1/rules/${rule_id}`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ active: !current }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRules((prev) =>
        prev.map((r) => (r.rule_id === rule_id ? { ...r, active: !current } : r))
      );
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Toggle failed");
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Output Rules</h1>
          <p className="text-sm text-gray-500 mt-1">
            Deterministic brand/quality rules applied after every LLM generation (H-2)
          </p>
        </div>
        <button
          onClick={fetchRules}
          className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {/* Stage filter */}
      <div className="flex gap-2 mb-4">
        {STAGES.map((s) => (
          <button
            key={s}
            onClick={() => setStageFilter(s)}
            className={`text-sm px-3 py-1 rounded-full border transition-colors ${
              stageFilter === s
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400">Loading rules…</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <p className="text-sm text-gray-500 mb-3">{rules.length} rule(s) found</p>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Stage", "Type", "Pattern", "Action / Message", "Source", "Run Count", "Active"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {rules.map((rule) => (
                  <tr key={rule.rule_id} className={rule.active ? "" : "opacity-50"}>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {rule.stage ?? "All"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ruleTypeBadge(rule.rule_type)}`}
                      >
                        {rule.rule_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-800 max-w-xs truncate">
                      {rule.pattern}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                      {rule.action_value
                        ? `→ "${rule.action_value}"`
                        : rule.error_message ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {rule.source_type}
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-right tabular-nums">
                      {rule.run_count}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleRule(rule.rule_id, rule.active)}
                        disabled={toggling === rule.rule_id}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          rule.active ? "bg-indigo-600" : "bg-gray-300"
                        } ${toggling === rule.rule_id ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
                        aria-label={rule.active ? "Disable rule" : "Enable rule"}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            rule.active ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                ))}

                {rules.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                      No rules found{stageFilter !== "All" ? ` for stage ${stageFilter}` : ""}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
