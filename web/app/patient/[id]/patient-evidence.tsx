"use client";

import type { ReactNode } from "react";
import { ActionButtons } from "@/components/review-task-controls";
import type { ReviewAction, ReviewFeedback } from "@/components/review-task-feedback";
import { StatusChip, buttonStyle, type Outcome } from "@/components/sa";
import type { AgentTurn, Gate } from "@/lib/patient";
import { ReviewHistory } from "./patient-review-history";

export type { ReviewAction, ReviewFeedback } from "@/components/review-task-feedback";

export type Turn = AgentTurn & { role: "user" | "assistant"; id: string };
export function GateCitation({ gate, selected, onSelect }: {
  gate: Gate; selected: boolean; onSelect: () => void;
}): ReactNode {
  return <article className="sa-chat-gate">
    <div className="sa-chat-gate-heading">
      <span className="sa-gate-name">{gate.gate}</span>
      <StatusChip outcome={gate.outcome as Outcome} />
    </div>
    <div className="sa-meta sa-chat-gate-id">
      <code>{gate.rule_id}{gate.rule_version ? ` v${gate.rule_version}` : ""}</code>
      {gate.severity ? ` · ${gate.severity}` : ""}
    </div>
    {gate.reason && <div className="sa-meta sa-chat-gate-reason">{gate.reason}</div>}
    <button className="sa-chat-gate-evidence" style={buttonStyle} onClick={onSelect}>
      Evidence {selected ? "▾" : "▸"}
    </button>
  </article>;
}

export function EvidencePanel({ patientId, patientName, recipientName, selected, feedback,
  actionsAvailable, onAction, onUnpin }: {
  patientId: string;
  patientName?: string;
  recipientName?: string | null;
  selected: Gate | null;
  feedback: Record<string, ReviewFeedback>;
  actionsAvailable: boolean;
  onAction: (gate: Gate, action: ReviewAction) => Promise<void>;
  onUnpin: () => void;
}): ReactNode {
  if (selected) return <PinnedEvidence patientId={patientId} patientName={patientName}
    recipientName={recipientName} gate={selected} feedback={{
    request_document: feedback[`${selected.rule_id}:request_document`],
    escalate: feedback[`${selected.rule_id}:escalate`],
  }}
    actionsAvailable={actionsAvailable} onAction={onAction} onUnpin={onUnpin} />;
  return <div className="sa-meta">
    Select a readiness check above to inspect its result, reason, and evidence. Chat answers
    include their supporting tool records here.
  </div>;
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
    {gate.provenance_note && <div className="sa-provenance" style={{ marginTop: 8 }}>
      {gate.provenance_note}
    </div>}
    {gate.derived && <div className="sa-derivation">
      <div className="sa-derivation-lead">Derived, not printed.</div>
      <div className="sa-formula">{gate.derived}</div>
    </div>}
  </div>;
}

function PinnedEvidence({ patientId, patientName, recipientName, gate, feedback,
  actionsAvailable, onAction, onUnpin }: {
  patientId: string;
  patientName?: string;
  recipientName?: string | null;
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
    {reviewable && <ActionButtons patientId={patientId} patientName={patientName}
      recipientName={recipientName} gate={gate} feedback={feedback}
      actionsAvailable={actionsAvailable} onAction={onAction} />}
    {reviewable && gate.rule_id && <ReviewHistory patientId={patientId}
      ruleId={gate.rule_id} refreshKey={Object.values(feedback)
        .filter((item) => item?.status === "success").map((item) => item?.taskId).join(":")} />}
    <button style={{ ...buttonStyle, marginTop: 12 }} onClick={onUnpin}
      disabled={Object.values(feedback).some((item) => item?.status === "pending")}>
      Clear selection
    </button>
  </>;
}
