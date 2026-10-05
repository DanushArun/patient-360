import { StatusChip, type Outcome } from "@/components/sa";
import type { Gate, PatientData } from "@/lib/patient";
import { formatRecordDate } from "@/lib/workspace-record-date.mjs";
import type { ReactNode } from "react";
import { OverviewRecordInventory } from "./overview-record-inventory";
import styles from "./workspace-patient-overview.module.css";

type PatientOverviewProps = {
  patient: PatientData;
  preview: boolean;
  onSelectGate: (ruleId: string) => void;
  onCompareSources?: () => void;
};

export function PatientOverview({ patient, preview, onSelectGate, onCompareSources,
}: PatientOverviewProps): ReactNode {
  const issues = patient.gates.filter((gate) => gate.outcome !== "pass");
  return <div className={styles.overview}>
    <ReadinessSummary gates={patient.gates} />
    <ReadinessTable gates={issues} preview={preview} onSelectGate={onSelectGate}
      onCompareSources={onCompareSources} />
    {preview && <p id="overview-preview-limit" className={styles.previewLimit}>
      Recorded preview: source evidence and live evidence actions are unavailable.
    </p>}
    <OverviewRecordInventory patientId={patient.patientId} knownAsOf={patient.knownAsOf}
      preview={preview} visit={<VisitSummary patient={patient} />} />
  </div>;
}

function ReadinessSummary({ gates }: { gates: Gate[] }): ReactNode {
  if (!gates.length) return <p className={styles.unavailable} role="status">
    No readiness snapshot was returned. No passing state is inferred.
  </p>;
  return <div className={styles.statusLine} aria-label="Returned readiness outcomes">
    {statusGroups(gates).map((group) => <span key={group.label}>
      <strong>{group.label}</strong> {group.outcomes.map(prettyOutcome).join(" · ")}
    </span>)}
  </div>;
}

function statusGroups(gates: Gate[]): Array<{ label: string; outcomes: string[] }> {
  const groups = new Map<string, string[]>();
  for (const gate of gates) {
    const label = groupLabel(gate.rule_id);
    const outcomes = groups.get(label) ?? [];
    if (!outcomes.includes(gate.outcome)) groups.set(label, [...outcomes, gate.outcome]);
  }
  return [...groups].map(([label, outcomes]) => ({ label, outcomes }));
}

function groupLabel(ruleId?: string): string {
  const prefix = ruleId?.split("-")[0];
  return ({ CLIN: "Clinical", DOC: "Documents", COV: "Coverage", ID: "Identity" } as
    Record<string, string>)[prefix ?? ""] ?? "Other checks";
}

function prettyOutcome(outcome: string): string {
  if (outcome === "not_evaluated") return "Not evaluated";
  return outcome.charAt(0).toUpperCase() + outcome.slice(1);
}

function ReadinessTable({ gates, preview, onSelectGate, onCompareSources }: {
  gates: Gate[];
  preview: boolean;
  onSelectGate: (ruleId: string) => void;
  onCompareSources?: () => void;
}): ReactNode {
  return <section aria-label="Needs attention" className={styles.issueSection}>
    <h2>Needs attention</h2>
    <div className={styles.tableWrap}>
      <table aria-label="Readiness checks">
        <thead><tr><th>Issue</th><th>Record check</th><th>Evidence IDs</th>
          <th>Action</th></tr></thead>
        <tbody>{gates.map((gate, index) => <ReadinessRow key={gate.rule_id ?? index}
          gate={gate} preview={preview} onSelectGate={onSelectGate}
          onCompareSources={onCompareSources} />)}</tbody>
      </table>
    </div>
    {!gates.length && <p className={styles.emptyIssues}>
      No non-pass outcomes were returned. This does not confirm treatment readiness.
    </p>}
  </section>;
}

function ReadinessRow({ gate, preview, onSelectGate, onCompareSources }: {
  gate: Gate;
  preview: boolean;
  onSelectGate: (ruleId: string) => void;
  onCompareSources?: () => void;
}): ReactNode {
  const ruleId = gate.rule_id;
  return <tr data-copilot-ref={ruleId ? `check:${ruleId}` : undefined}
    data-copilot-label={ruleId ? `Check ${ruleId}` : undefined}>
    <td data-label="Issue">
      <strong>{gate.reason ?? gate.gate}</strong>
      <small>{ruleId ?? "Rule ID unavailable"}
        {gate.rule_version ? ` v${gate.rule_version}` : ""}</small>
    </td>
    <td data-label="Record check"><OutcomeCell outcome={gate.outcome} /></td>
    <td data-label="Evidence IDs"><EvidenceSource gate={gate} /></td>
    <td data-label="Action"><CheckAction gate={gate} preview={preview} ruleId={ruleId}
      onSelectGate={onSelectGate} onCompareSources={onCompareSources} /></td>
  </tr>;
}

function OutcomeCell({ outcome }: { outcome: string }): ReactNode {
  if (isOutcome(outcome)) return <StatusChip outcome={outcome} />;
  return <span>{outcome || "Outcome unavailable"}</span>;
}

function isOutcome(value: string): value is Outcome {
  return ["pass", "fail", "not_evaluated", "conflicting"].includes(value);
}

function EvidenceSource({ gate }: { gate: Gate }): ReactNode {
  if (!gate.evidence_ids?.length) return <span>Source ID unavailable</span>;
  return <span className={styles.sourceCell}>
    {gate.evidence_ids.map((id) => <code key={id}>{id}</code>)}
  </span>;
}

function CheckAction({ gate, preview, ruleId, onSelectGate, onCompareSources }: {
  gate: Gate;
  preview: boolean;
  ruleId?: string;
  onSelectGate: (ruleId: string) => void;
  onCompareSources?: () => void;
}): ReactNode {
  const comparison = gate.rule_id === "COV-AUTH-001";
  const label = actionLabel(gate.rule_id);
  const unavailable = comparison && !onCompareSources;
  const missingRule = !comparison && !ruleId;
  const disabled = preview || unavailable || missingRule;
  const activate = (): void => {
    if (comparison) onCompareSources?.();
    else if (ruleId) onSelectGate(ruleId);
  };
  return <div className={styles.actionCell}>
    <button type="button" className="sa-quiet-button" disabled={disabled}
      aria-describedby={preview ? "overview-preview-limit" : undefined}
      title={disabled && preview
        ? "Evidence actions are unavailable in this recorded preview." : undefined}
      onClick={activate}>{label}</button>
    {unavailable && <small>Coverage comparison navigation is unavailable.</small>}
    {missingRule && <small>Rule identifier unavailable; this check cannot be opened.</small>}
  </div>;
}

function actionLabel(ruleId?: string): string {
  if (ruleId === "DOC-PATH-001") return "Request document";
  if (ruleId === "COV-AUTH-001") return "Compare sources";
  return "View check";
}

function VisitSummary({ patient }: { patient: PatientData }): ReactNode {
  const visitDate = patient.scheduledAt
    ? formatRecordDate(patient.scheduledAt)
    : formatVisitDay(patient.nextVisit);
  return <section role="group" aria-label="Current visit" className={styles.summarySection}>
    <h2>Current visit</h2>
    <dl>
      <Property label="Visit date and time" value={visitDate} />
      <Property label="Treatment regimen" value={patient.regimen ?? "Not recorded"} />
      <Property label="Cycle" value={patient.cycleNumber === null
        ? "Not recorded" : `Cycle ${patient.cycleNumber}`} />
      <Property label="Treating doctor"
        value={patient.treatingPractitionerName ?? "Not recorded"} />
    </dl>
  </section>;
}

function formatVisitDay(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Visit date unavailable";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10) !== value) return "Visit date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(date);
}

function Property({ label, value }: { label: string; value: ReactNode }): ReactNode {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
