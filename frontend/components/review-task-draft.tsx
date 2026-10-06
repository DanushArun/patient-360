import { useEffect, useRef, type ReactNode } from "react";
import type { Gate } from "@/lib/patient";
import type { ReviewAction } from "@/components/review-task-feedback";
import styles from "./review-task-draft.module.css";

type DraftProps = {
  patientId: string;
  patientName?: string;
  recipientName?: string | null;
  gate: Gate;
  action: ReviewAction;
  pending: boolean;
  onCancel: () => void; onCreate: () => void;
};

export function ReviewTaskDraft(props: DraftProps): ReactNode {
  const { patientId, patientName, recipientName, gate, action, pending, onCancel, onCreate } =
    props;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const documentRequest = action === "request_document";
  return <section aria-label="Follow-up draft" className={styles.draft}>
    <h3 ref={heading} tabIndex={-1}>
      {documentRequest ? "Request a document" : "Escalate this check"}
    </h3>
    <p className="sa-meta" role="status">Draft · Not created</p>
    <dl>
      <div><dt>Patient</dt><dd>{patientLabel(patientName, patientId)}</dd></div>
      <div><dt>Record check</dt><dd>
        {gate.rule_id ?? "Rule ID unavailable"}
        {gate.rule_version ? ` · v${gate.rule_version}` : ""} · {gate.outcome}
      </dd></div>
      <div><dt>Reason</dt><dd>{gate.reason ?? "No reason returned for this check."}</dd></div>
      <div><dt>Source anchors</dt><dd>{gate.evidence_ids?.length
        ? gate.evidence_ids.join(", ") : "No source evidence received for this check."}</dd></div>
      <div><dt>Intended recipient</dt><dd>
        {recipientName?.trim() || "Recipient verified when saving"}
      </dd></div>
    </dl>
    <p className="sa-meta">Creating a follow-up does not change the record check.</p>
    <div className={`sa-review-actions ${styles.actions}`}>
      <button type="button" className="sa-quiet-button" disabled={pending} onClick={onCancel}>
        Cancel
      </button>
      <button type="button" className="sa-primary-action" disabled={pending} onClick={onCreate}>
        {pending ? "Saving…" : documentRequest ? "Create document request" : "Create escalation"}
      </button>
    </div>
  </section>;
}

function patientLabel(patientName: string | undefined, patientId: string): string {
  const name = patientName?.trim();
  return name ? `${name} · ${patientId}` : patientId;
}
