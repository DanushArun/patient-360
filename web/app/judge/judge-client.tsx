"use client";

import { useState, type ReactNode } from "react";
import { buttonStyle } from "@/components/sa";

type ProbeResult = {
  probe: number;
  title: string;
  description: string;
  sql: string;
  expect: string;
  passed: boolean | null;
  query_id: string | null;
  rowCount: number;
  rows: Record<string, unknown>[];
};

const PROBE_LABELS: Record<number, { title: string; short: string }> = {
  1: { title: "Rule catalog completeness", short: "16 rules" },
  2: { title: "RAP scopes READINESS_STATE", short: "No leaked rows" },
  3: { title: "Binding lifecycle integrity", short: "No dangling" },
  4: { title: "Three-clock coverage (R2)", short: "All 3 clocks" },
  5: { title: "Review task idempotency", short: "No duplicates" },
  6: { title: "Consent-gated access", short: "Consent check" },
  7: { title: "Gate outcome distribution", short: "4 outcomes" },
  8: { title: "Scheme eligibility coverage", short: "3 schemes" },
};

export default function JudgeClient(): ReactNode {
  const [results, setResults] = useState<Record<number, ProbeResult | "loading" | "error">>({});

  async function runProbe(probeId: number) {
    setResults((prev) => ({ ...prev, [probeId]: "loading" }));
    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ probe: probeId }),
      });
      if (!res.ok) throw new Error("probe_failed");
      const data = await res.json() as ProbeResult;
      setResults((prev) => ({ ...prev, [probeId]: data }));
    } catch {
      setResults((prev) => ({ ...prev, [probeId]: "error" }));
    }
  }

  async function runAll() {
    for (const id of [1, 2, 3, 4, 5, 6, 7, 8]) {
      void runProbe(id);
    }
  }

  const completed = Object.values(results).filter((r) => typeof r === "object" && r !== null) as ProbeResult[];
  const passing = completed.filter((r) => r.passed).length;
  const total = completed.filter((r) => r.passed !== null).length;
  const resultColor = (passed: boolean | null) => passed === null ? "#656C73" : passed ? "#1E6B3A" : "#A8261C";

  return <>
    <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
      <div className="flex items-center gap-4">
        <button type="button" style={{ ...buttonStyle, width: "auto", background: "#1A1D21", color: "#fff", borderColor: "#1A1D21" }} onClick={runAll}>
          Run all 8 probes
        </button>
        {total > 0 && (
          <span className="tabular-nums" style={{ fontSize: 15, color: passing === total ? "#1E6B3A" : "#A8261C", fontWeight: 600 }}>
            {passing} of {total} passing
          </span>
        )}
      </div>
    </div>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ marginBottom: 32 }}>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((id) => {
        const result = results[id];
        const isLoading = result === "loading";
        const isError = result === "error";
        const isDone = typeof result === "object" && result !== null;
        return (
          <button
            key={id}
            type="button"
            onClick={() => void runProbe(id)}
            disabled={isLoading}
            className="sa-gate-tile rounded text-left"
            style={{
              padding: "12px 14px",
              border: `1px solid ${isDone ? resultColor(result.passed) : "#D8DCDF"}`,
              background: isDone ? (result.passed === null ? "#F6F7F8" : result.passed ? "#f0f7f2" : "#fdf2f1") : "#fff",
              cursor: isLoading ? "wait" : "pointer",
            }}
          >
            <div className="sa-field-label" style={{ marginBottom: 4 }}>Probe {id}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1D21", marginBottom: 2 }}>
              {PROBE_LABELS[id].title}
            </div>
            <div className="sa-meta">
              {isLoading ? "Running..." : isError ? "Failed — click to retry" : isDone
                ? (result.passed === null ? `Information · ${result.rowCount} rows` : result.passed ? `✓ ${result.rowCount} row${result.rowCount !== 1 ? "s" : ""}` : `✕ ${result.expect}`)
                : PROBE_LABELS[id].short}
            </div>
          </button>
        );
      })}
    </div>

    {completed.map((result) => (
      <ProbeDetail key={result.probe} result={result} />
    ))}
  </>;
}

function ProbeDetail({ result }: { result: ProbeResult }): ReactNode {
  const [showSql, setShowSql] = useState(false);
  const cols = result.rows.length > 0 ? Object.keys(result.rows[0]) : [];
  return (
    <div style={{ marginBottom: 24, borderTop: "1px solid #D8DCDF", paddingTop: 16 }}>
      <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "2px 10px", borderRadius: 4, fontSize: 13, fontWeight: 600,
          color: result.passed === null ? "#656C73" : result.passed ? "#1E6B3A" : "#A8261C",
          border: `1px solid ${result.passed === null ? "#656C73" : result.passed ? "#1E6B3A" : "#A8261C"}`,
        }}>
          {result.passed === null ? "INFORMATION" : result.passed ? "✓ PASS" : "✕ FAIL"} · Probe {result.probe}
        </span>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{result.title}</span>
      </div>
      <div className="sa-meta" style={{ marginBottom: 8 }}>{result.description}</div>
      <div className="sa-meta" style={{ marginBottom: 8 }}>
        Expected: {result.expect} · Got: {result.rowCount} row{result.rowCount !== 1 ? "s" : ""}
      </div>
      {result.query_id && <div className="sa-meta" style={{ marginBottom: 8 }}>Query: {result.query_id}</div>}
      <button type="button" style={{ ...buttonStyle, width: "auto", fontSize: 13, minHeight: 32, padding: "4px 12px" }}
        onClick={() => setShowSql(!showSql)}>
        {showSql ? "Hide SQL" : "Show SQL"}
      </button>
      {showSql && (
        <pre className="sa-page-text" style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 12 }}>
          {result.sql}
        </pre>
      )}
      {result.rows.length > 0 && (
        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {cols.map((col) => (
                  <th key={col} style={{ textAlign: "left", padding: "6px 10px", borderBottom: "2px solid #D8DCDF", color: "#656C73", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.slice(0, 20).map((row, i) => (
                <tr key={i}>
                  {cols.map((col) => (
                    <td key={col} style={{ padding: "6px 10px", borderBottom: "1px solid #D8DCDF", color: "#4A5157", fontVariantNumeric: "tabular-nums" }}>
                      {String(row[col] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {result.rows.length > 20 && <div className="sa-meta" style={{ marginTop: 4 }}>Showing 20 of {result.rows.length} rows</div>}
        </div>
      )}
    </div>
  );
}
