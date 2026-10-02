"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ReviewTask } from "@/lib/patient";
import { announcePatientAccessWithdrawn, purgesPatientState } from "@/lib/workspace-state.mjs";

import { persistTaskAttempt, useTaskUpdateRecovery }
  from "@/components/use-task-update-recovery";

type Owner = { id: string; name: string };
type Action = "acknowledge" | "reassign" | "resolve";
type TaskUpdateBody = { error?: string; read_back_confirmed?: boolean };
type SaveRuntime = {
  patientId: string; task: ReviewTask; action: Action; owner: string; reason: string;
  onSaved: () => void; setMessage: (message: string) => void;
  setReason: (reason: string) => void; attempt: { current: { payload: string; id: string } | null };
  setLocked: (locked: boolean) => void; isCurrent: () => boolean;
};

async function submitTaskUpdate(
  runtime: SaveRuntime,
  payload: string,
  requestId: string,
): Promise<void> {
  const response = await fetch(
    `/api/patient/${encodeURIComponent(runtime.patientId)}/review-tasks`,
    { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...JSON.parse(payload), requestId }),
      signal: AbortSignal.timeout(30000) },
  );
  const body = await response.json() as TaskUpdateBody & { purge_patient_state?: boolean };
  if (!runtime.isCurrent()) return;
  if (purgesPatientState(body)) {
    announcePatientAccessWithdrawn(runtime.patientId);
    return;
  }
  if (!response.ok || body.error) return handleTaskError(runtime, body.error);
  if (body.read_back_confirmed !== true) {
    runtime.setMessage(
      "The task receipt could not be confirmed. The draft and request key are retained.",
    );
    return;
  }
  runtime.setMessage("Task update saved.");
  runtime.setReason("");
  runtime.attempt.current = null;
  persistTaskAttempt(runtime.patientId, runtime.task.taskId, null);
  runtime.setLocked(false);
  runtime.onSaved();
}

function handleTaskError(runtime: SaveRuntime, error?: string): void {
  if (error === "stale_task") {
    runtime.attempt.current = null;
    persistTaskAttempt(runtime.patientId, runtime.task.taskId, null);
    runtime.setLocked(false);
    runtime.setMessage("This task changed. Reloaded its latest state; review it before retrying.");
    runtime.onSaved();
    return;
  }
  runtime.setMessage(
    "The task receipt is unavailable. The request stays available for the same-key retry.",
  );
}

type TaskSaveContext = Omit<SaveRuntime,
  "setMessage" | "setReason" | "attempt" | "setLocked" | "isCurrent"> & {
  setReason: (reason: string) => void;
  setAction: (action: Action) => void; setOwner: (owner: string) => void;
};

function useTaskSave(runtime: TaskSaveContext): {
  busy: boolean; locked: boolean; message: string; save: () => Promise<void>;
} {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [locked, setLocked] = useState(false);
  const active = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const attempt = useRef<{ payload: string; id: string } | null>(null);
  useTaskUpdateRecovery({ patientId: runtime.patientId, taskId: runtime.task.taskId,
    attempt, report: setMessage, restore: (saved) => {
      const payload = JSON.parse(saved.payload) as {
        action: Action; ownerId: string | null; reason: string;
      };
      runtime.setAction(payload.action); runtime.setOwner(payload.ownerId ?? "");
      runtime.setReason(payload.reason); setLocked(true);
      setMessage("Unconfirmed task update restored. Retry to confirm the same request.");
    } });
  const save = (): Promise<void> => runTaskSave({ ...runtime, active, mounted, attempt,
    setBusy, setMessage, setLocked });
  return { busy, locked, message, save };
}

type TaskSaveRuntime = TaskSaveContext & {
  active: { current: boolean }; mounted: { current: boolean };
  attempt: { current: { payload: string; id: string } | null };
  setBusy: (busy: boolean) => void; setMessage: (message: string) => void;
  setLocked: (locked: boolean) => void;
};

async function runTaskSave(runtime: TaskSaveRuntime): Promise<void> {
  const { active, mounted, attempt, setBusy, setMessage, setLocked } = runtime;
  if (active.current) return;
  active.current = true;
  const payload = attempt.current?.payload ?? JSON.stringify({
    taskId: runtime.task.taskId, action: runtime.action,
    ownerId: runtime.owner || null, reason: runtime.reason.trim(),
    version: runtime.task.issueVersion });
  if (attempt.current?.payload !== payload) {
    attempt.current = { payload, id: crypto.randomUUID() };
  }
  setBusy(true);
  setLocked(true);
  const persisted = persistTaskAttempt(runtime.patientId, runtime.task.taskId, attempt.current);
  setMessage(persisted ? "" : "Reload retry is unavailable; keep this page open.");
  try {
    await submitTaskUpdate({ ...runtime, setMessage, attempt, setLocked,
      isCurrent: () => mounted.current }, payload, attempt.current.id);
  } catch {
    if (mounted.current) setMessage("Save could not be confirmed. Retry the same action safely.");
  } finally {
    active.current = false;
    if (mounted.current) setBusy(false);
  }
}

export function TaskActions({ patientId, task, owners, onSaved }: {
  patientId: string; task: ReviewTask; owners: Owner[]; onSaved: () => void;
}): ReactNode {
  const [action, setAction] = useState<Action>("acknowledge");
  const [owner, setOwner] = useState(task.ownerId ?? "");
  const [reason, setReason] = useState("");
  const effectiveAction = action === "acknowledge" && task.state !== "open"
    ? "reassign" : action;
  const saveState = useTaskSave({ patientId, task, action: effectiveAction, owner, reason,
    onSaved, setReason, setAction, setOwner });
  if (task.isEvent || ["closed", "resolved", "cancelled"].includes(task.state)
    || !owners.length) return null;
  return <details className="sa-task-actions"><summary>Update task</summary>
    <p className="sa-meta">Task changes do not change the clinical readiness result.</p>
    <TaskUpdateForm task={task} owners={owners} action={effectiveAction} setAction={setAction}
      owner={owner} setOwner={setOwner} reason={reason} setReason={setReason}
      busy={saveState.busy} locked={saveState.locked} onSave={() => void saveState.save()} />
    <p className="sa-meta" role="status">{saveState.message}</p>
  </details>;
}

function TaskUpdateForm({ task, owners, action, setAction, owner, setOwner, reason, setReason,
  busy, locked, onSave }: {
  task: ReviewTask; owners: Owner[]; action: Action; setAction: (action: Action) => void;
  owner: string; setOwner: (owner: string) => void; reason: string;
  setReason: (reason: string) => void; busy: boolean; locked: boolean; onSave: () => void;
}): ReactNode {
  return <div className="sa-task-form">
    <label className="sa-field-label">Action<select value={action}
      onChange={(event) => setAction(event.target.value as Action)} disabled={busy || locked}>
      {task.state === "open" && <option value="acknowledge">Acknowledge</option>}
      <option value="reassign">Reassign</option><option value="resolve">Resolve task</option>
    </select></label>
    {action === "reassign" && <label className="sa-field-label">Care-team owner<select
      value={owner} onChange={(event) => setOwner(event.target.value)} disabled={busy || locked}>
      <option value="">Select owner</option>
      {owners.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
    </select></label>}
    <label className="sa-field-label">Reason<textarea value={reason} maxLength={2000}
      onChange={(event) => setReason(event.target.value)} disabled={busy || locked} /></label>
    <button type="button" className="sa-primary-action" onClick={onSave}
      disabled={busy || reason.trim().length < 3 || (action === "reassign" && !owner)}>
      {busy ? "Saving…" : locked ? "Retry task update" : "Save task update"}
    </button>
  </div>;
}
