"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Gate } from "@/lib/patient";
import type { ReviewAction, ReviewFeedback } from "@/components/review-task-feedback";
import {
  announcePatientAccessWithdrawn,
  PATIENT_ACCESS_EVENT,
  purgesPatientState,
} from "@/lib/workspace-state.mjs";
import {
  confirmedTaskReceipt,
  confirmTaskRequest,
  patientTaskStorageKey,
  purgePatientTaskRequests,
  restoreOrCreateTaskRequest,
}
  from "@/lib/patient-task-idempotency.mjs";

const REVIEW_ERRORS: Record<string, string> = {
  access_withdrawn: "Patient access was withdrawn. Return to the patient list.",
  no_patient_access: "Patient access is no longer available. Return to the authorized worklist.",
  gate_not_found: "This check is no longer current. Refresh readiness before retrying.",
  gate_not_actionable: "This check is no longer actionable. Refresh readiness.",
  action_unavailable: "The review service is unavailable. Please retry.",
  write_unconfirmed: "The task receipt could not be confirmed. Retry the same action to check it.",
  write_readback_unconfirmed: "The request was sent but the task could not be read back, so it may be saved. Reload before retrying; if this persists the Snowflake read procedures are not at the latest version.",
  write_readback_unavailable: "The request was sent but the read-back failed, so it may be saved. Reload before retrying.",
  write_receipt_missing: "The service returned no task receipt. Nothing is confirmed; retry the same action.",
  task_transition_requires_review: "This task transition needs a documented review step first.",
  no_encounter: "No active encounter was found for this patient, so no task can be filed.",
};

export function usePatientReviewTask(patientId: string): {
  feedback: Record<string, ReviewFeedback>;
  act: (gate: Gate, action: ReviewAction) => Promise<void>;
} {
  const [feedback, setFeedback] = useState<Record<string, ReviewFeedback>>({});
  const inFlight = useRef(new Set<string>());
  const attempts = useRef(new Map<string, string>());
  const generation = useRef(0);
  useLayoutEffect(() => {
    generation.current += 1;
    inFlight.current.clear();
    attempts.current.clear();
    setFeedback({});
    return () => {
      generation.current += 1;
      inFlight.current.clear();
      attempts.current.clear();
    };
  }, [patientId]);
  useReviewWithdrawal({ patientId, generation, inFlight, attempts, setFeedback });
  const act = (gate: Gate, action: ReviewAction) => runReviewAction({
    gate, action, patientId, generation, inFlight, attempts, setFeedback,
  });
  return { feedback, act };
}

function useReviewWithdrawal({ patientId, generation, inFlight, attempts, setFeedback }: {
  patientId: string;
  generation: React.MutableRefObject<number>;
  inFlight: React.MutableRefObject<Set<string>>;
  attempts: React.MutableRefObject<Map<string, string>>;
  setFeedback: (feedback: Record<string, ReviewFeedback>) => void;
}): void {
  useEffect(() => {
    const clear = (event: Event) => {
      const detail = (event as CustomEvent<{ patientId?: string }>).detail;
      if (detail?.patientId !== patientId) return;
      generation.current += 1;
      inFlight.current.clear();
      purgePatientTaskRequests(attempts.current, patientId, () => window.sessionStorage);
      setFeedback({});
    };
    window.addEventListener(PATIENT_ACCESS_EVENT, clear);
    return () => window.removeEventListener(PATIENT_ACCESS_EVENT, clear);
  }, [patientId, generation, inFlight, attempts, setFeedback]);
}

type ReviewContext = {
  patientId: string;
  gate: Gate;
  action: ReviewAction;
  generation: React.MutableRefObject<number>;
  inFlight: React.MutableRefObject<Set<string>>;
  attempts: React.MutableRefObject<Map<string, string>>;
  setFeedback: (
    update: (current: Record<string, ReviewFeedback>) => Record<string, ReviewFeedback>
  ) => void;
};

async function runReviewAction(context: ReviewContext): Promise<void> {
  const ruleId = context.gate.rule_id;
  if (!ruleId || context.inFlight.current.has(ruleId)) return;
  const version = context.generation.current;
  const requestKey = patientTaskStorageKey(context.patientId, ruleId, context.action);
  const request = restoreOrCreateTaskRequest(
    context.attempts.current, requestKey, () => crypto.randomUUID(), () => window.sessionStorage,
  );
  context.inFlight.current.add(ruleId);
  updateFeedback(context, { action: context.action, status: "pending" });
  try {
    const result = await submitReviewTask(
      context.patientId, ruleId, context.action, request.requestId,
    );
    if (version !== context.generation.current) return;
    if (result?.status === "success") {
      confirmTaskRequest(context.attempts.current, requestKey, () => window.sessionStorage);
    }
    if (result) {
      const feedback = result.uncertain && !request.persistenceAvailable
        ? { ...result, persistenceUnavailable: true } : result;
      updateFeedback(context, feedback);
    }
    if (!result) context.attempts.current.clear();
  } catch {
    if (version === context.generation.current) updateFeedback(context, {
      action: context.action, status: "error", error: REVIEW_ERRORS.write_unconfirmed,
      uncertain: true, persistenceUnavailable: !request.persistenceAvailable,
    });
  } finally {
    if (version === context.generation.current) context.inFlight.current.delete(ruleId);
  }
}

function updateFeedback(context: ReviewContext, update: ReviewFeedback): void {
  const ruleId = context.gate.rule_id;
  if (!ruleId) return;
  context.setFeedback((current) => ({ ...current, [`${ruleId}:${update.action}`]: update }));
}

async function submitReviewTask(
  patientId: string,
  ruleId: string,
  action: ReviewAction,
  requestId: string,
): Promise<ReviewFeedback | null> {
  const response = await fetch("/api/review-task", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patientId, ruleId, action, requestId }),
    signal: AbortSignal.timeout(30000),
  });
  const body: unknown = await response.json();
  if (purgesPatientState(body)) {
    announcePatientAccessWithdrawn(patientId);
    return null;
  }
  const payload = typeof body === "object" && body !== null
    ? body as Record<string, unknown> : {};
  if (payload.error || !response.ok) {
    return reviewError(action, typeof payload.error === "string" ? payload.error : undefined);
  }
  const receipt = confirmedTaskReceipt(body);
  if (!receipt) return reviewError(action, "write_unconfirmed");
  return { action, status: "success", taskId: receipt.taskId, taskState: receipt.state,
    replay: receipt.replay };
}

function reviewError(action: ReviewAction, code?: string): ReviewFeedback {
  const message = REVIEW_ERRORS[code ?? "action_unavailable"] ?? REVIEW_ERRORS.action_unavailable;
  const definitive = ["access_withdrawn", "no_patient_access", "no_patient_bound",
    "consent_not_valid", "gate_not_found", "gate_not_actionable", "invalid_argument",
    "invalid_origin", "invalid_action", "idempotency_conflict"];
  const uncertain = !code || !definitive.includes(code);
  return { action, status: "error", error: message, uncertain };
}
