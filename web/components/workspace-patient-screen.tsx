"use client";

import Link from "next/link";
import { formatClock } from "@/lib/display-format.mjs";
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { Page, WorkspaceBar, WorkspaceNav } from "@/components/sa";
import type { RosterPatient } from "@/components/patient-roster";
import type { Gate, PatientData } from "@/lib/patient";
import type { PatientSection } from "@/lib/workspace-state.mjs";
import { RECORD_TOOL_STARTERS } from "@/lib/copilot-tools.mjs";
import {
  EvidencePanel,
  type Turn,
} from "@/app/patient/[id]/patient-evidence";
import type { ReviewAction, ReviewFeedback } from "@/components/review-task-feedback";
import type { AskPhase, SourceScope } from "@/components/workspace-patient-copilot";
import type { ContextReference } from "@/lib/api-contracts.mjs";
import { createPortal } from "react-dom";
import { useOptionalCopilot } from "@/components/copilot/copilot-provider";
import {
  CopilotComposer, CopilotProgress, CopilotStarters, useStickToBottom,
} from "@/components/copilot/copilot-parts";
import copilotStyles from "@/components/copilot/copilot.module.css";
import { LiveReceipt, receiptHostsAsk, receiptVisible } from "@/components/copilot/copilot-live-ui";
import { PatientChatInput, PatientConversation } from "@/components/workspace-patient-copilot";
import { FamilyChecklist } from "@/components/workspace-patient-family";
import { PatientSectionContent } from "@/components/workspace-patient-views";
import { formatRecordDate } from "@/lib/workspace-record-date.mjs";
import { RefreshCw, UserRound } from "lucide-react";
import styles from "./workspace-patient-screen.module.css";

type ChatModel = {
  question: string;
  setQuestion: (value: string) => void;
  busy: boolean;
  send: (text: string, scope: SourceScope, retry?: boolean,
    context?: ContextReference[]) => Promise<void>;
  retry: (scope: SourceScope) => void;
  stop?: () => void;
  phases?: AskPhase[];
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
      preview={model.preview} onAsk={model.preview ? undefined : model.toggleAsk}
      // References are reached from the copilot's "Search in" control, not a second entry point.
      onReferences={undefined} />
    <WorkspaceBar section={model.patient.patientName} knownAsOf={
      <time dateTime={model.patient.knownAsOf ?? undefined}
        title={model.patient.knownAsOf ?? "Timestamp unavailable"}>
        Known as of {formatRecordDate(model.patient.knownAsOf)}
      </time>
    } actions={!model.preview && <button type="button" className="sa-quiet-button sa-refresh-button"
      disabled={model.refreshState === "refreshing"}
      data-refreshing={model.refreshState === "refreshing" || undefined}
      onClick={() => void model.refreshReadiness()}>
      <RefreshCw size={14} aria-hidden /> Refresh record</button>} />
    <PatientHeader patient={model.patient} preview={model.preview} onAsk={model.toggleAsk} />
    <RefreshStatus model={model} />
    {!model.preview && <div className="sa-recompute-toolbar"><button type="button"
      className="sa-quiet-button"
      disabled={model.refreshState === "refreshing"}
      onClick={() => void model.refreshReadiness(true)}>Recompute readiness</button>
      <span>Evaluate the versioned SQL rules against verified evidence.</span></div>}
    <PatientTabs section={model.section} onChange={model.setSection} />
    <PatientWorkspaceBody model={model} />
    {!model.preview && <DockedPatientConversation model={model} />}
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
  const knownAsOf = model.patient.knownAsOf ? ` from ${formatClock(model.patient.knownAsOf)}` : "";
  const text = model.refreshState === "refreshing"
    ? `Checking live readiness. Displaying the stored SQL snapshot${knownAsOf}.`
    : `Live readiness refresh failed. The stored SQL snapshot${knownAsOf} remains visible.`;
  return <div className="sa-snapshot-notice"
    role={model.refreshState === "failed" ? "alert" : "status"}>{text}
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
        language={model.language} setLanguage={model.setLanguage} preview={model.preview} />
      : <PatientSectionContent section={model.section} patient={model.patient}
        preview={model.preview} onSelectGate={model.onSelectGate}
        onCompareSources={() => model.setSection("Coverage comparison")}
        onBackToCoverage={() => model.setSection("Coverage")} />}
  </section>;
}

function PatientContextPanel({ model }: { model: PatientScreenModel }): ReactNode {
  if (model.selectedGate && !model.preview) return <SelectedEvidencePanel model={model} />;
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

const PATIENT_STARTERS = RECORD_TOOL_STARTERS.slice(0, 3);
// Questions the loaded corpus can answer: the Herceptin label and the ICMR diabetes guideline.
// The PM-JAY manual is loaded as unreadable (no text pages), so no starter points at it.
// Each is phrased as "what does the document state", which the question classifier routes
// as a record question; asking what to do for a patient is refused, here as everywhere.
const REFERENCE_STARTERS = [
  "What does the Herceptin label state about LVEF monitoring?",
  "What does the trastuzumab label list under warnings?",
  "What HbA1c target does the ICMR diabetes guideline give?",
];

/** The patient conversation, rendered into the docked copilot (COPILOT-EXPERIENCE §2). The
 * page keeps owning the conversation state, so patient switching, consent withdrawal and
 * history clearing behave exactly as before. */
function DockedPatientConversation({ model }: { model: PatientScreenModel }): ReactNode {
  const copilot = useOptionalCopilot();
  const stream = useStickToBottom();
  const live = copilot?.live;
  if (!copilot?.open || !copilot.slot || !live) return null;
  const reference = model.sourceScope === "reference";
  const send = (text: string) => {
    stream.pin();
    // A reference question goes straight to the reference corpus: the live copilot only ever
    // asks the patient record, so routing it there would cross corpora (R6).
    if (reference) { void model.chat.send(text, "reference"); return; }
    // With the live copilot on, a request can also move the screen: open a section, find an
    // item, bring it here. The question itself still goes through the same governed path.
    if (live.enabled && live.start(text, "chat")) { model.chat.setQuestion(""); return; }
    const context = copilot.chips.map(({ kind, id }) => ({ kind, id }));
    copilot.clearChips();
    void model.chat.send(text, model.sourceScope, false, context);
  };
  const run = live.run;
  const progress = <CopilotProgress phases={model.chat.phases ?? []} busy={model.chat.busy}
    embedded />;
  // One progress indicator per question: under the receipt's "Ask" step when a live run is
  // asking, otherwise on its own after the question.
  const progressInReceipt = model.chat.busy && receiptHostsAsk(run);
  const anchor = live.anchor?.scope === "patient" && live.anchor.runId === run?.id
    ? live.anchor.index : model.turns.length;
  const empty = !model.turns.length && !model.chat.busy && !receiptVisible(run);
  return createPortal(<>
    {copilot.inspector && <PatientInspector model={model} />}
    <div ref={stream.ref} className={copilotStyles.stream}>
      {empty && <div className={copilotStyles.empty}>
        {reference ? <>
          <h2>Ask the reference documents</h2>
          <p>Passages from published guidelines and labels, quoted with their source and page.
            They describe guidance, not this patient.</p>
          <CopilotStarters starters={REFERENCE_STARTERS} onPick={send} />
        </> : <>
          <h2>Ask about {model.patient.patientName}&apos;s record</h2>
          <p>What is recorded, missing or conflicting, with the source for every claim. Clinical
            decisions are referred to {model.patient.treatingPractitionerName
              ?? "the treating practitioner"}.</p>
          <CopilotStarters starters={PATIENT_STARTERS} onPick={send} />
        </>}
      </div>}
      <PatientConversation patientId={model.patient.patientId} patient={model.patient}
        turns={model.turns} sourceScope={model.sourceScope} showEmptyHint={false}
        selected={model.selected} onSelect={model.onSelectAnswer} busy={model.chat.busy}
        onSend={send} onRetry={() => { stream.pin(); model.chat.retry(model.sourceScope); }}
        onOpenSection={(section) => model.setSection(section as PatientSection)}
        activity={{ index: anchor, render: (anchored) => <LiveReceipt anchored={anchored}
          askProgress={progressInReceipt ? progress : null} /> }} />
      {!progressInReceipt && <CopilotProgress phases={model.chat.phases ?? []}
        busy={model.chat.busy} />}
    </div>
    <CopilotComposer label="Question about the selected patient"
      placeholder={reference ? "Ask the reference documents…"
        : `Ask about ${model.patient.patientName}'s record…`}
      value={model.chat.question} setValue={model.chat.setQuestion} busy={model.chat.busy}
      onSend={() => send(model.chat.question)}
      onStop={() => { live.cancel(); model.chat.stop?.(); }}
      chips={copilot.chips} onDetach={copilot.detach} picking={copilot.picking}
      onPick={() => copilot.setPicking(!copilot.picking)}
      leading={<SourceScopeSelect scope={model.sourceScope} setScope={model.setSourceScope}
        disabled={model.chat.busy} />} />
    <p className={copilotStyles.disclaimer}>
      Record and coverage facts only. Clinical decisions belong to the treating practitioner.
    </p>
  </>, copilot.slot);
}

/** What this conversation has touched (the ChatGPT inspector, as a record audit). */
function PatientInspector({ model }: { model: PatientScreenModel }): ReactNode {
  const answers = model.turns.filter((turn) => turn.role === "assistant" && !turn.error);
  const checks = [...new Set(answers.flatMap((turn) => turn.gates.map((gate) =>
    gate.rule_id ?? gate.gate)))];
  const sources = [...new Set(answers.flatMap((turn) => turn.artifact?.claims.flatMap((claim) =>
    claim.evidence.map((item) => item.id)) ?? []))];
  const refused = answers.filter((turn) => turn.artifact?.classification === "CLASS_A").length;
  return <div className={copilotStyles.inspector} aria-label="Conversation context">
    <section><h3>In scope</h3><ul>
      <li>{model.patient.patientName} · <code>{model.patient.patientId}</code></li>
      <li>Consent <code>{model.patient.consentId}</code></li>
      <li>Known as of {formatRecordDate(model.patient.knownAsOf)}</li></ul></section>
    <section><h3>Record checks discussed</h3><ul>
      {checks.length ? checks.map((id) => <li key={id}><code>{id}</code></li>)
        : <li>None yet</li>}</ul></section>
    <section><h3>Patient sources cited</h3><ul>
      {sources.length ? sources.slice(0, 12).map((id) => <li key={id}><code>{id}</code></li>)
        : <li>None yet</li>}</ul></section>
    <section><h3>Referred to the treating practitioner</h3><ul>
      <li>{refused} {refused === 1 ? "question" : "questions"}</li></ul></section>
  </div>;
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
    <select className={copilotStyles.scopeSelect} value={scope} disabled={disabled}
      onChange={(event) => setScope(event.target.value as SourceScope)}>
      <option value="patient">Patient record</option>
      <option value="reference">Reference documents</option>
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
