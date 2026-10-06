"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { ReviewTask } from "@/lib/patient";
import { announcePatientAccessWithdrawn, purgesPatientState } from "@/lib/workspace-state.mjs";

type HistoryState = "loading" | "ready" | "error";

export function TaskRow({ task }: { task: ReviewTask }): ReactNode {
  const name = task.isEvent ? `${task.action || "Task"} event`
    : task.action === "request_document" ? "Document request"
    : task.action === "escalate" ? "Treating doctor escalation" : task.action;
  return <div className="sa-timeline-event">
    <div className="sa-timeline-title">{name} · {task.state || "State unavailable"}</div>
    <div className="sa-meta">Owner {task.owner || "Unassigned"} · Recorded{" "}
      <time dateTime={task.createdAt || undefined}>
        {task.createdAt || "time unavailable"}
      </time>
    </div>
    <div className="sa-meta">{task.reason}</div>
    {task.isEvent && task.actor && <div className="sa-meta">Recorded by {task.actor}</div>}
    <div className="sa-meta">Task ID <code>{task.taskId}</code></div>
  </div>;
}

export function ReviewHistory({ patientId, ruleId, refreshKey }: {
  patientId: string;
  ruleId: string;
  refreshKey: string;
}): ReactNode {
  const { tasks, state, retry } = useReviewHistory(patientId, ruleId, refreshKey);
  return <section aria-label="Review task history" style={{ marginTop: 16 }}>
    <div className="sa-field-label">Review history · {ruleId}</div>
    {state === "loading" && <div className="sa-meta" role="status">Loading filed tasks…</div>}
    {state === "error" && <div role="alert">
      <p className="sa-meta">
        Task history could not be loaded. The filing result above is still visible.
      </p>
      <button type="button" className="sa-quiet-button"
        onClick={retry}>
        Retry task history
      </button>
    </div>}
    {state === "ready" && (tasks.length
      ? tasks.map((task) => <TaskRow key={task.taskId} task={task} />)
      : <div className="sa-meta">No task has been filed for this check.</div>)}
  </section>;
}

function useReviewHistory(patientId: string, ruleId: string, refreshKey: string): {
  tasks: ReviewTask[]; state: HistoryState; retry: () => void;
} {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [state, setState] = useState<HistoryState>("loading");
  const [retryKey, setRetryKey] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const key = JSON.stringify([patientId, ruleId, refreshKey, retryKey]);
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    setTasks([]);
    const url = `/api/patient/${encodeURIComponent(patientId)}/review-tasks`
      + `?ruleId=${encodeURIComponent(ruleId)}`;
    fetch(url, { cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) })
      .then(async (response) => {
      const result = await response.json() as {
        tasks?: ReviewTask[]; error?: string; purge_patient_state?: boolean;
      };
      if (controller.signal.aborted) return;
      if (purgesPatientState(result)) {
        announcePatientAccessWithdrawn(patientId);
        return;
      }
      if (!response.ok || !Array.isArray(result.tasks)) {
        throw new Error(result.error ?? "task_history_unavailable");
      }
      setTasks(result.tasks); setLoadedKey(key); setState("ready");
    }).catch(() => {
      if (!controller.signal.aborted) { setLoadedKey(key); setState("error"); }
    });
    return () => controller.abort();
  }, [patientId, ruleId, refreshKey, retryKey]);
  return { tasks: loadedKey === key ? tasks : [],
    state: loadedKey === key ? state : "loading",
    retry: () => setRetryKey((key) => key + 1) };
}
