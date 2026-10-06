"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Gate } from "@/lib/patient";
import { ReviewTaskDraft } from "@/components/review-task-draft";
import {
  ReviewFeedbackList,
  type ReviewAction,
  type ReviewFeedback,
} from "@/components/review-task-feedback";
import { buttonStyle } from "@/components/sa";
import styles from "./review-task-draft.module.css";

type ActionButtonsProps = {
  patientId: string;
  patientName?: string;
  recipientName?: string | null;
  gate: Gate;
  feedback: Partial<Record<ReviewAction, ReviewFeedback>>;
  actionsAvailable: boolean;
  onAction: (gate: Gate, action: ReviewAction) => Promise<void>;
};

type DraftState = { action: ReviewAction; previousTaskId?: string } | null;

export function ActionButtons(props: ActionButtonsProps): ReactNode {
  const { patientId, patientName, recipientName, gate, feedback, actionsAvailable, onAction } =
    props;
  const [draft, setDraft] = useState<DraftState>(null);
  const focusAfterClose = useRef<ReviewAction | null>(null);
  const actionButtonRefs = useRef(new Map<ReviewAction, HTMLButtonElement>());
  const pending = Object.values(feedback).some((item) => item?.status === "pending");
  const disabled = pending || !actionsAvailable;

  useLayoutEffect(() => {
    if (draft || !focusAfterClose.current) return;
    actionButtonRefs.current.get(focusAfterClose.current)?.focus();
    focusAfterClose.current = null;
  }, [draft]);

  const prepare = (_gate: Gate, action: ReviewAction): void => {
    setDraft({ action, previousTaskId: feedback[action]?.taskId });
  };
  const cancel = (): void => {
    focusAfterClose.current = draft?.action ?? null;
    setDraft(null);
  };
  const activeDraft = visibleDraft(draft, feedback);
  const registerButton = (action: ReviewAction, button: HTMLButtonElement | null): void => {
    registerActionButton(actionButtonRefs.current, action, button);
  };

  return <>
    <div className="sa-field-label" style={{ marginTop: 16 }}>Act on this</div>
    {!actionsAvailable && <UnavailableActionStatus />}
    <ActionEntry {...props} draft={activeDraft} disabled={disabled} onCancel={cancel}
      onPrepare={prepare} registerButton={registerButton} />
    <ReviewFeedbackList gate={gate} feedback={feedback} />
  </>;
}

function visibleDraft(draft: DraftState,
  feedback: ActionButtonsProps["feedback"]): DraftState {
  if (!draft) return null;
  const state = feedback[draft.action];
  return state?.status !== "success" || state.taskId === draft.previousTaskId ? draft : null;
}

function registerActionButton(buttons: Map<ReviewAction, HTMLButtonElement>,
  action: ReviewAction, button: HTMLButtonElement | null): void {
  if (button) buttons.set(action, button);
  else buttons.delete(action);
}

function UnavailableActionStatus(): ReactNode {
  return <div className="sa-meta" role="status">
    Waiting for the current readiness check before filing a task.
  </div>;
}

function ActionEntry(props: ActionButtonsProps & {
  draft: DraftState;
  disabled: boolean;
  onCancel: () => void;
  onPrepare: (gate: Gate, action: ReviewAction) => void;
  registerButton: (action: ReviewAction, button: HTMLButtonElement | null) => void;
}): ReactNode {
  const draft = props.draft;
  if (draft) return <ReviewTaskDraft patientId={props.patientId}
    patientName={props.patientName} recipientName={props.recipientName} gate={props.gate}
    action={draft.action} pending={props.disabled} onCancel={props.onCancel}
    onCreate={() => void props.onAction(props.gate, draft.action)} />;
  return <div className={`sa-review-actions ${styles.actionRow}`}>
    <ReviewActionButton label="Request document" action="request_document" gate={props.gate}
      disabled={props.disabled} registerRef={props.registerButton} onAction={props.onPrepare} />
    <ReviewActionButton label="Escalate to treating doctor" action="escalate" gate={props.gate}
      disabled={props.disabled} registerRef={props.registerButton} onAction={props.onPrepare} />
  </div>;
}

function ReviewActionButton({ label, action, gate, disabled, registerRef, onAction }: {
  label: string;
  action: ReviewAction;
  gate: Gate;
  disabled: boolean;
  registerRef: (action: ReviewAction, button: HTMLButtonElement | null) => void;
  onAction: (gate: Gate, action: ReviewAction) => void;
}): ReactNode {
  return <button className={styles.actionButton} ref={(button) => registerRef(action, button)}
    style={buttonStyle}
    disabled={disabled} onClick={() => onAction(gate, action)}>{label}</button>;
}
