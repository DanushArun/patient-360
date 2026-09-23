"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { ReviewTask } from "@/lib/patient";

type HistoryState = "loading" | "ready" | "error";

function TaskRow({ task }: { task: ReviewTask }): ReactNode {
  const name = task.action === "request_document" ? "Document request"
    : task.action === "escalate" ? "Treating doctor escalation" : task.action;
  return <div className="sa-timeline-event">
    <div className="sa-timeline-title">{name} · {task.state}</div>
    <div className="sa-meta">Owner {task.owner} · Created {task.createdAt}</div>
    <div className="sa-meta">{task.reason}</div>
    <div className="sa-meta">Task ID <code>{task.taskId}</code></div>
  </div>;
}

export function ReviewHistory({ patientId, ruleId, refreshKey }: {
  patientId: string;
  ruleId: string;
  refreshKey: string;
}): ReactNode {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [state, setState] = useState<HistoryState>("loading");
  useEffect(() => {
    let current = true;
    setState("loading");
    const url = `/api/patient/${encodeURIComponent(patientId)}/review-tasks`
      + `?ruleId=${encodeURIComponent(ruleId)}`;
    fetch(url, { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { tasks?: ReviewTask[]; error?: string };
      if (!response.ok || !result.tasks) {
        throw new Error(result.error ?? "task_history_unavailable");
      }
      if (current) { setTasks(result.tasks); setState("ready"); }
    }).catch(() => { if (current) setState("error"); });
    return () => { current = false; };
  }, [patientId, ruleId, refreshKey]);
  return <section aria-label="Review task history" style={{ marginTop: 16 }}>
    <div className="sa-field-label">Review history · {ruleId}</div>
    {state === "loading" && <div className="sa-meta" role="status">Loading filed tasks…</div>}
    {state === "error" && <div className="sa-meta" role="alert">
      Task history could not be loaded. The filing result above is still visible.
    </div>}
    {state === "ready" && (tasks.length
      ? tasks.map((task) => <TaskRow key={task.taskId} task={task} />)
      : <div className="sa-meta">No task has been filed for this check.</div>)}
  </section>;
}
