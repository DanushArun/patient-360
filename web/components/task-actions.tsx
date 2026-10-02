"use client";
import { useRef, useState } from "react";
import type { ReviewTask } from "@/lib/patient";

export function TaskActions({ patientId, task, owners, onSaved }: {
  patientId: string; task: ReviewTask; owners: { id: string; name: string }[]; onSaved: () => void;
}) {
  const [action, setAction] = useState("acknowledge");
  const [owner, setOwner] = useState(task.ownerId ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const attempt = useRef<{ payload: string; id: string } | null>(null);
  if (task.isEvent || ["closed", "resolved", "cancelled"].includes(task.state) || !owners.length) return null;
  const effectiveAction = action === "acknowledge" && task.state !== "open" ? "reassign" : action;
  async function save() {
    if (busy) return;
    const payload = JSON.stringify({ taskId: task.taskId, action: effectiveAction, ownerId: owner || null,
      reason: reason.trim(), version: task.issueVersion });
    if (attempt.current?.payload !== payload) attempt.current = { payload, id: crypto.randomUUID() };
    setBusy(true); setMessage("");
    try {
      const res = await fetch(`/api/patient/${encodeURIComponent(patientId)}/review-tasks`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...JSON.parse(payload), requestId: attempt.current.id }),
      });
      const body = await res.json();
      if (!res.ok || body.error) {
        if (body.error === "stale_task") { setMessage("This task changed. Reloaded its latest state; review it before retrying."); onSaved(); }
        else setMessage("The task was not saved. Check your access and selected owner, then retry.");
        return;
      }
      setMessage("Saved to Snowflake."); setReason(""); attempt.current = null; onSaved();
    } catch { setMessage("Save could not be confirmed. Retry the same action safely."); }
    finally { setBusy(false); }
  }
  return <details className="sa-task-actions"><summary>Update task</summary>
    <p className="sa-meta">Task changes do not change the clinical readiness result.</p>
    <div className="sa-task-form">
      <label className="sa-field-label">Action<select value={effectiveAction} onChange={e => setAction(e.target.value)} disabled={busy}>
        {task.state === "open" && <option value="acknowledge">Acknowledge</option>}
        <option value="reassign">Reassign</option><option value="resolve">Resolve task</option>
      </select></label>
      {effectiveAction === "reassign" && <label className="sa-field-label">Care-team owner<select value={owner} onChange={e => setOwner(e.target.value)} disabled={busy}>
        <option value="">Select owner</option>{owners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>}
      <label className="sa-field-label">Reason<textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} disabled={busy} /></label>
      <button type="button" className="sa-primary-action" onClick={() => void save()}
        disabled={busy || reason.trim().length < 3 || (effectiveAction === "reassign" && !owner)}>{busy ? "Saving…" : "Save task update"}</button>
    </div><p className="sa-meta" role="status">{message}</p>
  </details>;
}
