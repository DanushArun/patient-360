import Link from "next/link";
import type { ReactNode } from "react";
import { StatusChip, type Outcome } from "@/components/sa";
import type { Gate, PatientData } from "@/lib/patient";
import type { PatientSection } from "@/lib/workspace-state.mjs";
import { PatientTimelinePanel } from "@/app/patient/[id]/patient-timeline";
import { DocumentsWorkspace } from "@/components/workspace-patient-data";
import { StructuredFactsWorkspace } from "@/components/workspace-patient-facts";
import { EvidenceHistory } from "@/components/evidence-history";
import { PatientOverview } from "@/components/workspace-patient-overview";
import { PatientCoverage } from "@/components/workspace-patient-coverage";
import { WorkspaceAuthorizationComparison } from "./workspace-authorization-comparison";

type SectionContentProps = {
  section: PatientSection;
  patient: PatientData;
  preview: boolean;
  onSelectGate: (ruleId: string) => void;
  onCompareSources?: () => void;
  onBackToCoverage?: () => void;
};

export function PatientSectionContent({
  section,
  patient,
  preview,
  onSelectGate,
  onCompareSources,
  onBackToCoverage,
}: SectionContentProps): ReactNode {
  if (section === "Coverage comparison") return <WorkspaceAuthorizationComparison
    patientId={patient.patientId} patientName={patient.patientName} knownAsOf={patient.knownAsOf}
    preview={preview} onBack={() => onBackToCoverage?.()} onEscalate={onSelectGate} />;
  if (section === "Timeline") {
    return preview
      ? <Unavailable message="Timeline events are not included in this preview." />
      : <PatientTimelinePanel patientId={patient.patientId} />;
  }
  if (section === "Facts") return preview
    ? <Unavailable message="Patient facts are not included in this recorded preview." />
    : <StructuredFactsWorkspace patientId={patient.patientId} knownAsOf={patient.knownAsOf} />;
  if (section === "Documents") return preview
    ? <Unavailable message={
      "Document metadata and pages are not included in this recorded preview."
    } />
    : <DocumentsWorkspace patientId={patient.patientId} knownAsOf={patient.knownAsOf}
      onSelectGate={onSelectGate} />;
  if (section === "Coverage") {
    return <PatientCoverage patientId={patient.patientId} patientName={patient.patientName}
      nextVisit={patient.nextVisit} scheduledAt={patient.scheduledAt}
      cycleNumber={patient.cycleNumber} knownAsOf={patient.knownAsOf} preview={preview}
      onSelectGate={onSelectGate} onCompareSources={onCompareSources} />;
  }
  if (section === "Review") {
    return <ReviewView patientId={patient.patientId} preview={preview}
      gates={patient.gates.filter((gate) => gate.outcome !== "pass")}
      onSelectGate={preview ? undefined : onSelectGate} />;
  }
  return <PatientOverview patient={patient} preview={preview} onSelectGate={onSelectGate}
    onCompareSources={onCompareSources} />;
}

function ReviewView({ patientId, preview, gates, onSelectGate }: {
  patientId: string;
  preview: boolean;
  gates: Gate[];
  onSelectGate?: (ruleId: string) => void;
}): ReactNode {
  return <>
    <div className="sa-view-intro">
      <h2>Review recorded issues</h2>
      <p>Task state and rule outcome are separate. Open a check to review its available
        evidence and task history.</p>
      <Link href="/review-queue" className="sa-inline-link">Open review queue</Link>
      {!preview && <Link href={`/history/${encodeURIComponent(patientId)}`}
        className="sa-inline-link">Open task lifecycle</Link>}
    </div>
    <RuleList title="Current issues" gates={gates} onSelectGate={onSelectGate} />
    {preview
      ? <Unavailable message={
        "Saved task and answer history are not included in this recorded preview."
      } />
      : <EvidenceHistory patientId={patientId} />}
  </>;
}

function RuleList({ title, gates, onSelectGate }: {
  title: string;
  gates: Gate[];
  onSelectGate?: (ruleId: string) => void;
}): ReactNode {
  return <section className="sa-rule-list" aria-label={title}>
    <h2>{title}</h2>
    {gates.map((gate) => <RuleRow key={gate.rule_id ?? gate.gate}
      gate={gate} onSelectGate={onSelectGate} />)}
    {!gates.length && <p className="sa-empty-inline">No matching rule results were returned.</p>}
  </section>;
}

function RuleRow({ gate, onSelectGate }: {
  gate: Gate;
  onSelectGate?: (ruleId: string) => void;
}): ReactNode {
  const ruleId = gate.rule_id ?? gate.gate;
  return <article className="sa-rule-row">
    <div><strong>{gate.gate}</strong>
      <small>{ruleId}{gate.rule_version ? ` v${gate.rule_version}` : ""}</small></div>
    <StatusChip outcome={gate.outcome as Outcome} />
    <p>{gate.reason ?? "No explanation was returned for this check."}</p>
    {gate.evidence_ids?.length
      ? <small>Evidence IDs: {gate.evidence_ids.join(", ")}</small>
      : <small>No source evidence ID returned</small>}
    {onSelectGate
      ? <button type="button" className="sa-quiet-button"
        onClick={() => onSelectGate(ruleId)}>View evidence</button>
      : <small>Evidence pages are not included in this recorded preview.</small>}
  </article>;
}

function Unavailable({ message }: { message: string }): ReactNode {
  return <p className="sa-data-unavailable" role="status">{message}</p>;
}
