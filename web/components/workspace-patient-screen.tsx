"use client";

import Link from "next/link";
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { Page, WorkspaceBar, WorkspaceNav } from "@/components/sa";
import type { RosterPatient } from "@/components/patient-roster";
import type { Gate, PatientData } from "@/lib/patient";
import type { PatientSection } from "@/lib/workspace-state.mjs";
import {
  EvidencePanel,
  type Turn,
} from "@/app/patient/[id]/patient-evidence";
import type { ReviewAction, ReviewFeedback } from "@/components/review-task-feedback";
import type { SourceScope } from "@/components/workspace-patient-copilot";
import { PatientChatInput, PatientConversation } from "@/components/workspace-patient-copilot";
import { FamilyChecklist } from "@/components/workspace-patient-family";
import { PatientSectionContent } from "@/components/workspace-patient-views";
import { formatRecordDate } from "@/lib/workspace-record-date.mjs";
import { UserRound } from "lucide-react";
import styles from "./workspace-patient-screen.module.css";

type ChatModel = {
  question: string;
  setQuestion: (value: string) => void;
  busy: boolean;
  send: (text: string, scope: SourceScope) => Promise<void>;
  retry: (scope: SourceScope) => void;
};
type ReviewModel = {
  feedback: Record<string, ReviewFeedback>;
  act: (gate: Gate, action: ReviewAction) => Promise<void>;
};
export type PatientScreenModel = {
  patient: PatientData;
  patients: RosterPatient[];
  preview: boolean;
  refreshState: "refreshing" | "current" | "failed";
  refreshReadiness: (persist?: boolean) => Promise<void>;
  section: PatientSection;
  setSection: (section: PatientSection) => void;
  language: string;
  setLanguage: (value: string) => void;
  selected: { turnId: string; ruleId: string } | null;
  selectedGate: Gate | null;
  contextOpen: boolean;
  contextRef: React.RefObject<HTMLElement | null>;
  askOpen: boolean;
  sourceScope: SourceScope;
  setSourceScope: (scope: SourceScope) => void;
  turns: Turn[];
  chat: ChatModel;
  review: ReviewModel;
  toggleAsk: () => void;
  closeEvidence: () => void;
  onSelectGate: (ruleId: string) => void;
  onSelectAnswer: (turnId: string, ruleId: string) => void;
};

export function PatientWorkspaceScreen({ model }: { model: PatientScreenModel }): ReactNode {
  return <Page>
    <WorkspaceNav patients={model.patients} patientId={model.patient.patientId}
      practitioner={model.preview ? "Design preview" : model.patient.practitionerName}
      preview={model.preview} onAsk={model.preview ? undefined : model.toggleAsk} />
    <WorkspaceBar section={model.patient.patientName} knownAsOf={
      <time dateTime={model.patient.knownAsOf ?? undefined}
        title={model.patient.knownAsOf ?? "Timestamp unavailable"}>
        Known as of {formatRecordDate(model.patient.knownAsOf)}
      </time>
    } />
    <PatientHeader patient={model.patient} preview={model.preview} onAsk={model.toggleAsk} />
    <RefreshStatus model={model} />
    {!model.preview && <button type="button" className="sa-quiet-button"
      disabled={model.refreshState === "refreshing"}
      onClick={() => void model.refreshReadiness(true)}>Recompute readiness</button>}
    <PatientTabs section={model.section} onChange={model.setSection} />
    <PatientWorkspaceBody model={model} />
  </Page>;
}

function PatientHeader({ patient, preview, onAsk }: {
  patient: PatientData; preview: boolean; onAsk: () => void;
}): ReactNode {
  const visit = visitLabel(patient);
  return <header className="sa-screen-header sa-patient-screen-header">
    <div className={styles.identity}>
      <span className={styles.avatar} aria-hidden="true">
        <UserRound size={22} strokeWidth={1.7} />
      </span>
      <div className={styles.identityCopy}>
        <p className="sa-eyebrow">Patient record · {patient.patientId}</p>
        <div className={styles.nameLine}><h1>{patient.patientName}</h1>
          {preview && <span className={styles.previewBadge}>Synthetic preview</span>}
        </div>
        <p className={styles.patientDetails}>
          <span>Visit {visit}</span>
          <span>{patient.regimen ?? "Treatment regimen not recorded"}</span>
          <span>{patient.cycleNumber === null
            ? "Cycle not recorded" : `Cycle ${patient.cycleNumber}`}</span>
          <span>{patient.treatingPractitionerName ?? "Treating practitioner not recorded"}</span>
        </p>
      </div>
    </div>
    {!preview && <button type="button" className="sa-primary-action"
      onClick={onAsk}>Ask the record</button>}
  </header>;
}

function visitLabel(patient: PatientData): ReactNode {
  if (patient.scheduledAt) return <time dateTime={patient.scheduledAt}
    title={patient.scheduledAt}>{formatRecordDate(patient.scheduledAt)}</time>;
  if (!patient.nextVisit) return "date unavailable";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(patient.nextVisit);
  if (!match) return "date unavailable";
  const date = new Date(`${patient.nextVisit}T00:00:00Z`);
  if (date.toISOString().slice(0, 10) !== patient.nextVisit) return "date unavailable";
  return <time dateTime={patient.nextVisit} title={patient.nextVisit}>
    {new Intl.DateTimeFormat("en-GB", {
      day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
    }).format(date)}
  </time>;
}

function RefreshStatus({ model }: { model: PatientScreenModel }): ReactNode {
  if (model.preview || model.refreshState === "current") return null;
  const knownAsOf = model.patient.knownAsOf ? ` from ${model.patient.knownAsOf}` : "";
  const text = model.refreshState === "refreshing"
    ? `Checking live readiness. Displaying the stored SQL snapshot${knownAsOf}.`
    : `Live readiness refresh failed. The stored SQL snapshot${knownAsOf} remains visible.`;
  return <div className="sa-meta" role="status">{text}
    {model.refreshState === "failed" && <button type="button" className="ml-2 underline"
      onClick={() => void model.refreshReadiness()}>Retry current check</button>}
  </div>;
}

function PatientTabs({ section, onChange }: {
  section: PatientSection; onChange: (section: PatientSection) => void;
}): ReactNode {
  const sections: PatientSection[] = [
    "Overview", "Facts", "Timeline", "Documents", "Coverage", "Review", "Family",
  ];
  return <nav className="sa-patient-tabs" aria-label="Patient sections">
    {sections.map((item) => <PatientSectionTab key={item} item={item}
      selected={section === item || (item === "Coverage" && section === "Coverage comparison")}
      onChange={onChange} />)}
  </nav>;
}

function PatientSectionTab({ item, selected, onChange }: {
  item: PatientSection; selected: boolean; onChange: (section: PatientSection) => void;
}): ReactNode {
  return <>
    {item === "Coverage" && <span className="sa-patient-tabs-divider" aria-hidden="true" />}
    <button type="button" aria-pressed={selected}
      onClick={() => onChange(item)}>{item}</button>
  </>;
}

function PatientWorkspaceBody({ model }: { model: PatientScreenModel }): ReactNode {
  const className = `sa-workspace-body${
    model.contextOpen ? " sa-workspace-body-with-panel" : ""
  }`;
  return <div className={className}>
    <PatientSectionMain model={model} />
    <PatientContextPanel model={model} />
  </div>;
}

function PatientSectionMain({ model }: { model: PatientScreenModel }): ReactNode {
  return <section className="sa-workspace-main" aria-label="Patient workspace content">
    {model.section === "Family"
      ? <FamilyChecklist patient={model.patient} gates={model.patient.gates}
        language={model.language} setLanguage={model.setLanguage} />
      : <PatientSectionContent section={model.section} patient={model.patient}
        preview={model.preview} onSelectGate={model.onSelectGate}
        onCompareSources={() => model.setSection("Coverage comparison")}
        onBackToCoverage={() => model.setSection("Coverage")}
        onSelectDocuments={() => model.setSection("Documents")} />}
  </section>;
}

function PatientContextPanel({ model }: { model: PatientScreenModel }): ReactNode {
  if (model.selectedGate && !model.preview) return <SelectedEvidencePanel model={model} />;
  if (model.askOpen && !model.preview) return <AskPanel model={model} />;
  return null;
}

function SelectedEvidencePanel({ model }: { model: PatientScreenModel }): ReactNode {
  if (!model.selectedGate) return null;
  return <ContextPanel model={model} label="Selected evidence" onClose={model.closeEvidence}>
    <div className="sa-context-heading"><h2 tabIndex={-1}>Selected evidence</h2>
      <button type="button" className="sa-quiet-button" onClick={model.closeEvidence}>Close</button>
    </div>
    <EvidencePanel patientId={model.patient.patientId} patientName={model.patient.patientName}
      recipientName={model.patient.treatingPractitionerName} selected={model.selectedGate}
      feedback={model.review.feedback} actionsAvailable={model.refreshState === "current"}
      onAction={model.review.act} onUnpin={model.closeEvidence} />
  </ContextPanel>;
}

function AskPanel({ model }: { model: PatientScreenModel }): ReactNode {
  return <ContextPanel model={model} label="Ask the record" id="ask-record"
    onClose={model.toggleAsk}>
    <div className="sa-context-heading"><h2 tabIndex={-1}>Ask the record</h2>
      <button type="button" className="sa-quiet-button" onClick={model.toggleAsk}>Close</button>
    </div>
    <SourceScopeSelect scope={model.sourceScope} setScope={model.setSourceScope}
      disabled={model.chat.busy} />
    <PatientConversation patientId={model.patient.patientId} turns={model.turns}
      sourceScope={model.sourceScope}
      selected={model.selected} onSelect={model.onSelectAnswer} busy={model.chat.busy}
      onSend={(text) => void model.chat.send(text, model.sourceScope)}
      onRetry={() => model.chat.retry(model.sourceScope)} />
    <PatientChatInput question={model.chat.question} setQuestion={model.chat.setQuestion}
      busy={model.chat.busy}
      onSend={() => void model.chat.send(model.chat.question, model.sourceScope)} />
    <p className="ct-copilot-disclaimer">
      Record and coverage facts only. Clinical decisions belong to the treating practitioner.
    </p>
  </ContextPanel>;
}

function ContextPanel({ model, label, id, onClose, children }: {
  model: PatientScreenModel; label: string; id?: string;
  onClose: () => void; children: ReactNode;
}): ReactNode {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const panel = model.contextRef.current;
    if (!(panel instanceof HTMLDialogElement) || panel.open) return;
    panel.showModal();
    panel.querySelector<HTMLElement>("h2")?.focus();
  }, [mobile, model.contextRef]);
  const ref = (element: HTMLElement | null) => { model.contextRef.current = element; };
  if (!mobile) return <aside ref={ref} tabIndex={-1} id={id}
    className="sa-context-panel" aria-label={label}>{children}</aside>;
  return <dialog ref={ref} id={id} className="sa-context-panel" aria-label={label}
    onKeyDown={containDialogFocus}
    onCancel={(event) => { event.preventDefault(); onClose(); }}>{children}</dialog>;
}

function containDialogFocus(event: KeyboardEvent<HTMLDialogElement>): void {
  if (event.key !== "Tab") return;
  const selector = "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),"
    + "textarea:not(:disabled),summary,[tabindex]:not([tabindex='-1'])";
  const targets = [...event.currentTarget.querySelectorAll<HTMLElement>(selector)]
    .filter((element) => element.getClientRects().length > 0);
  const destination = event.shiftKey ? targets.at(-1) : targets[0];
  const boundary = event.shiftKey ? targets[0] : targets.at(-1);
  const outside = !targets.includes(document.activeElement as HTMLElement);
  if (document.activeElement === boundary || outside) {
    event.preventDefault();
    destination?.focus();
  }
}

function SourceScopeSelect({ scope, setScope, disabled }: {
  scope: SourceScope; setScope: (scope: SourceScope) => void; disabled: boolean;
}): ReactNode {
  return <label className="sa-source-scope">Search in
    <select value={scope} disabled={disabled}
      onChange={(event) => setScope(event.target.value as SourceScope)}>
      <option value="patient">Patient record</option><option value="reference">References</option>
    </select>
  </label>;
}

export function PatientAccessUnavailable(): ReactNode {
  return <Page><WorkspaceNav current="census" practitioner="Practitioner" />
    <WorkspaceBar section="Patient access" knownAsOf="Not available" />
    <h1>Patient access is no longer available</h1>
    <p className="sa-data-unavailable">
      Patient content was removed after access could not be confirmed.
    </p>
    <Link href="/" className="sa-quiet-button">Return to authorized worklist</Link>
  </Page>;
}

export function PatientLoading(): ReactNode {
  return <Page><WorkspaceNav current="census" practitioner="Practitioner" />
    <WorkspaceBar section="Patient record" knownAsOf="Loading current record" />
    <p role="status" className="sa-meta">Loading the selected patient record…</p>
  </Page>;
}
