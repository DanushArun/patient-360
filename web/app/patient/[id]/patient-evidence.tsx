"use client";

import type { ReactNode } from "react";
import { StatusChip, buttonStyle, type Outcome } from "@/components/sa";
import type { AgentTurn, Gate } from "@/lib/patient";
import { ReviewHistory } from "./patient-review-history";

export type Turn = AgentTurn & { role: "user" | "assistant"; id: string };
export type ReviewAction = "request_document" | "escalate";
export type ReviewFeedback = {
  action: ReviewAction;
  status: "pending" | "success" | "error";
  taskId?: string;
  replay?: boolean;
  error?: string;
};

export function GateStrip({ gates, knownAsOf, selectedRuleId, isSnapshot, onSelect }: {
  gates: Gate[];
  knownAsOf: string | null;
  selectedRuleId: string | null;
  isSnapshot: boolean;
  onSelect: (ruleId: string) => void;
}): ReactNode {
  return <>
    <div className="sa-field-label" style={{ margin: "12px 0 4px" }}>
      Readiness checks{isSnapshot ? " · stored snapshot" : ""} · select any check for details
      {knownAsOf && <> · <span className="sa-num">as of {knownAsOf}</span></>}
    </div>
    {Array.from({ length: Math.ceil(gates.length / 4) }, (_, row) => (
      <div key={row} className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 17 }}>
        {gates.slice(row * 4, row * 4 + 4).map((gate) => {
          const ruleId = gate.rule_id ?? gate.gate;
          const selected = selectedRuleId === ruleId;
          return <button key={ruleId} type="button" aria-expanded={selected}
            aria-controls="readiness-evidence"
            aria-label={`${gate.gate}, ${gate.outcome}. Show check details`}
            onClick={() => onSelect(ruleId)}
            className="rounded-sm text-left transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ padding: "8px 6px", borderTop: `1px solid ${selected ? "var(--sa-patient-edge)" : "#D8DCDF"}`, background: selected ? "#f6f9fb" : "transparent" }}>
            <span className="sa-field-label block">{gate.gate}</span>
            <StatusChip outcome={gate.outcome as Outcome} />
            <span className="sa-meta mt-1 block"><code>{gate.rule_id} v{gate.rule_version}</code></span>
          </button>;
        })}
      </div>
    ))}
  </>;
}

export function GateCitation({ gate, selected, onSelect }: {
  gate: Gate; selected: boolean; onSelect: () => void;
}): ReactNode {
  return <div>
    <div className="sa-gate-row">
      <span className="sa-gate-name">{gate.gate}</span>
      <span style={{ minWidth: 158 }}><StatusChip outcome={gate.outcome as Outcome} /></span>
      <span className="sa-meta">
        <code>{gate.rule_id}{gate.rule_version ? ` v${gate.rule_version}` : ""}</code>
        {gate.severity ? ` · ${gate.severity}` : ""}
        {gate.reason && <div className="sa-meta">{gate.reason}</div>}
      </span>
    </div>
    <button type="button" style={buttonStyle} aria-expanded={selected} aria-controls="readiness-evidence" onClick={onSelect}>Evidence {selected ? "▾" : "▸"}</button>
  </div>;
}

export function EvidencePanel({ patientId, turn, selected, feedback, actionsAvailable, onAction, onUnpin }: {
  patientId: string;
  turn: Turn | null;
  selected: Gate | null;
  feedback: Record<string, ReviewFeedback>;
  actionsAvailable: boolean;
  onAction: (gate: Gate, action: ReviewAction) => Promise<void>;
  onUnpin: () => void;
}): ReactNode {
  if (selected) return <section id="readiness-evidence" aria-label={`Evidence for ${selected.gate}`}><PinnedEvidence patientId={patientId} gate={selected} feedback={{
    request_document: feedback[`${selected.rule_id}:request_document`],
    escalate: feedback[`${selected.rule_id}:escalate`],
  }}
    actionsAvailable={actionsAvailable} onAction={onAction} onUnpin={onUnpin} /></section>;
  if (turn) return <section id="readiness-evidence" aria-label="Answer evidence"><AnswerEvidence turn={turn} /></section>;
  return <section id="readiness-evidence" aria-label="Readiness evidence" className="sa-meta">
    Select a readiness check above to inspect its result, reason, and evidence. Chat answers
    include their supporting tool records here.
  </section>;
}

function GateEvidence({ gate }: { gate: Gate }): ReactNode {
  const sourceText = gate.evidence_ids?.length
    ? `Source evidence: ${gate.evidence_ids.join(", ")}`
    : "No source evidence ID was returned for this check.";
  return <div className="sa-evidence sa-ev-patient">
    <div className="sa-ev-kind">{gate.gate} · {gate.outcome}</div>
    <div className="sa-ev-id">
      <code>{gate.rule_id} v{gate.rule_version}</code>{gate.severity ? ` · ${gate.severity}` : ""}
    </div>
    <div className="sa-meta">
      {gate.reason || "The evaluator returned no explanation for this check."}
    </div>
    <div className="sa-meta" style={{ marginTop: 8 }}>
      {sourceText}{gate.known_as_of ? ` · Known as of ${gate.known_as_of}` : ""}
    </div>
    {gate.derived && <div className="sa-derivation">
      <div className="sa-derivation-lead">Derived, not printed.</div>
      <div className="sa-formula">{gate.derived}</div>
    </div>}
  </div>;
}

function PinnedEvidence({ patientId, gate, feedback, actionsAvailable, onAction, onUnpin }: {
  patientId: string;
  gate: Gate;
  feedback: Partial<Record<ReviewAction, ReviewFeedback>>;
  actionsAvailable: boolean;
  onAction: (gate: Gate, action: ReviewAction) => Promise<void>;
  onUnpin: () => void;
}): ReactNode {
  const reviewable = ["fail", "conflicting", "not_evaluated"].includes(gate.outcome);
  return <>
    <div className="sa-field-label">Evidence · {gate.gate}</div>
    <GateEvidence gate={gate} />
    {reviewable && <ActionButtons gate={gate} feedback={feedback}
      actionsAvailable={actionsAvailable} onAction={onAction} />}
    {reviewable && gate.rule_id && <ReviewHistory patientId={patientId}
      ruleId={gate.rule_id} refreshKey={Object.values(feedback)
        .filter((item) => item?.status === "success").map((item) => item?.taskId).join(":")} />}
    <button type="button" style={{ ...buttonStyle, marginTop: 12 }} onClick={onUnpin}
      disabled={Object.values(feedback).some((item) => item?.status === "pending")}>
      Clear selection
    </button>
  </>;
}

function ActionButtons({ gate, feedback, actionsAvailable, onAction }: {
  gate: Gate;
  feedback: Partial<Record<ReviewAction, ReviewFeedback>>;
  actionsAvailable: boolean;
  onAction: (gate: Gate, action: ReviewAction) => Promise<void>;
}): ReactNode {
  const pending = Object.values(feedback).some((item) => item?.status === "pending");
  const disabled = pending || !actionsAvailable;
  return <>
    <div className="sa-field-label" style={{ marginTop: 16 }}>Act on this</div>
    {!actionsAvailable && <div className="sa-meta" role="status">
      Waiting for the current readiness check before filing a task.
    </div>}
    <div className="sa-review-actions grid grid-cols-2" style={{ gap: 8 }}>
      <button type="button" style={buttonStyle} disabled={disabled}
        onClick={() => void onAction(gate, "request_document")}>
        Request document
      </button>
      <button type="button" style={buttonStyle} disabled={disabled}
        onClick={() => void onAction(gate, "escalate")}>
        Escalate to treating doctor
      </button>
    </div>
    {(["request_document", "escalate"] as const).map((action) => {
      const state = feedback[action];
      if (!state) return null;
      const verb = action === "request_document" ? "Document request" : "Escalation";
      return <div key={action} className="sa-review-feedback" role="status" aria-live="polite">
        {state.status === "pending" && `Filing ${verb.toLowerCase()} for ${gate.rule_id}…`}
        {state.status === "success" && <>
          <strong>{state.replay ? "Task already filed" : "Task filed"}</strong>
          <div>{verb} · {gate.rule_id} · open</div>
          <div>Task ID <code>{state.taskId}</code></div>
        </>}
        {state.status === "error" && <>
          <strong>Task not filed · {verb}</strong>
          <div>{state.error}</div>
        </>}
      </div>;
    })}
  </>;
}

function AnswerEvidence({ turn }: { turn: Turn }): ReactNode {
  const gates = turn.gates.filter((gate) => gate.evidence_ids?.length);
  return <>
    <div className="sa-field-label">How this was answered</div>
    {turn.tools.map((tool, index) => <ToolEvidence key={`${tool.name}-${index}`} tool={tool} />)}
    {gates.map((gate) => <GateEvidence key={gate.rule_id} gate={gate} />)}
    <div className="sa-meta" style={{ marginTop: 8 }}>
      Click &quot;Evidence&quot; on any claim above to pin just that one here.
    </div>
    {turn.thinking && <ReasoningDisclosure thinking={turn.thinking} />}
  </>;
}

function ToolEvidence({ tool }: { tool: AgentTurn["tools"][number] }): ReactNode {
  return <div className="sa-evidence sa-ev-patient">
    <div className="sa-ev-kind">Tool call</div>
    <div className="sa-ev-id">{tool.name}</div>
    <div className="sa-meta">query <code>{tool.query_id ?? "—"}</code></div>
    {tool.took_patient_id
      ? <div className="sa-derivation-note">Scope was passed in the tool input. This must never happen.</div>
      : <div className="sa-meta">No patient identifier in the tool input — scope resolved server-side from the binding.</div>}
  </div>;
}

function ReasoningDisclosure({ thinking }: { thinking: string }): ReactNode {
  return <details style={{ border: "1px solid #D8DCDF", borderRadius: 6, padding: 12, marginTop: 16 }}>
    <summary>Assistant&apos;s reasoning</summary>
    <div className="sa-meta" style={{ marginTop: 8 }}>
      Shown because it is inspectable, not because it is evidence. Every number above comes from SQL.
    </div>
    <div>{thinking}</div>
  </details>;
}
