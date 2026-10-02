import type { ReactNode } from "react";
import type { Gate } from "@/lib/patient";

export type ReviewAction = "request_document" | "escalate";
export type ReviewFeedback = {
  action: ReviewAction;
  status: "pending" | "success" | "error";
  taskId?: string;
  replay?: boolean;
  taskState?: string;
  uncertain?: boolean;
  persistenceUnavailable?: boolean;
  error?: string;
};

export function ReviewFeedbackList({ gate, feedback }: {
  gate: Gate; feedback: Partial<Record<ReviewAction, ReviewFeedback>>;
}): ReactNode {
  return <>
    {(["request_document", "escalate"] as const).map((action) => <ReviewFeedbackItem
      key={action} action={action} state={feedback[action]} gate={gate} />)}
  </>;
}

function ReviewFeedbackItem({ action, state, gate }: {
  action: ReviewAction; state?: ReviewFeedback; gate: Gate;
}): ReactNode {
  if (!state) return null;
  const verb = action === "request_document" ? "Document request" : "Escalation";
  return <div className="sa-review-feedback" role="status" aria-live="polite">
    {state.status === "pending" && `Filing ${verb.toLowerCase()} for ${gate.rule_id}…`}
    {state.status === "success" && <>
      <strong>{state.replay ? "Task already filed" : "Task filed"}</strong>
      <div>{verb} · {gate.rule_id} · {state.taskState ?? "State unavailable"}</div>
      <div>Task ID <code>{state.taskId}</code></div>
    </>}
    {state.status === "error" && <>
      <strong>{state.uncertain
        ? "Task status not confirmed" : "Task not filed"} · {verb}</strong>
      <div>{state.error}</div>
      {state.persistenceUnavailable && <div>
        Keep this page open and retry. Reload recovery is unavailable because
        {" "}browser storage is blocked.
      </div>}
    </>}
  </div>;
}
