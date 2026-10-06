"use client";

import { formatClock } from "@/lib/display-format.mjs";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Field, Page, WorkspaceBar, WorkspaceNav, buttonStyle } from "@/components/sa";
import type { Gate, PatientData, ReviewTask } from "@/lib/patient";
import { TaskActions } from "@/components/task-actions";
import { RecordChangeHistory, readRecordChanges, type RecordChange }
  from "@/components/record-change-history";
import { EvidenceHistory } from "@/components/evidence-history";
import { usePatientAccess } from "@/components/patient-access-boundary";
import { announcePatientAccessWithdrawn, purgesPatientState } from "@/lib/workspace-state.mjs";

type State = "loading" | "ready" | "error";
type Owner = { id: string; name: string };
type HistoryLoadState = { tasks: ReviewTask[]; owners: Owner[]; state: State;
  changes: RecordChange[] | null };
const displayState = (state: string): string => state.replaceAll("_", " ");

function TaskLifecycle({ task, patientId, owners, onSaved }: {
  task: ReviewTask; patientId: string; owners: Owner[]; onSaved: () => void;
}): ReactNode {
  return <article className="sa-history-item">
    <div className="sa-history-line">
      <span className="sa-history-dot" aria-hidden="true" />
      <span>{task.isEvent ? "Recorded action" : "Review task"} · {displayState(task.state)}</span>
    </div>
    <strong>{task.action.replaceAll("_", " ")}</strong>
    <p>{task.reason || "No reason was returned with this task."}</p>
    <div className="sa-meta">
      Owner {task.owner} · created <span className="sa-num">{task.createdAt}</span>
      · current state {displayState(task.state)}
    </div>
    <div className="sa-meta">Task <code>{task.taskId}</code></div>
    {task.isEvent && <div className="sa-meta">Action by {task.actor}</div>}
    <TaskActions patientId={patientId} task={task} owners={owners} onSaved={onSaved} />
  </article>;
}

async function readTaskHistory(patientId: string, rule: string, signal: AbortSignal): Promise<{
  tasks: ReviewTask[]; owners: Owner[]; changes: RecordChange[] | null;
} | null> {
  const url = `/api/patient/${encodeURIComponent(patientId)}/review-tasks`
    + `?ruleId=${encodeURIComponent(rule)}`;
  const response = await fetch(url, { cache: "no-store", signal });
  const body = await response.json() as {
    tasks?: ReviewTask[]; owners?: Owner[]; changes?: unknown; purge_patient_state?: boolean;
  };
  if (purgesPatientState(body)) {
    announcePatientAccessWithdrawn(patientId);
    return null;
  }
  if (!response.ok || !Array.isArray(body.tasks)) throw new Error("task_history_unavailable");
  return { tasks: body.tasks, owners: Array.isArray(body.owners) ? body.owners : [],
    changes: readRecordChanges(body.changes)?.filter((change) =>
      change.after.rule_id === rule) ?? null };
}

function useTaskHistory(patientId: string, rule: string, revision: number): HistoryLoadState {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [changes, setChanges] = useState<RecordChange[] | null>(null);
  const [state, setState] = useState<State>("loading");
  const [loadedKey, setLoadedKey] = useState("");
  const key = JSON.stringify([patientId, rule, revision]);
  useEffect(() => {
    if (!rule) { setTasks([]); setLoadedKey(key); setState("ready"); return; }
    const controller = new AbortController();
    setState("loading");
    void readTaskHistory(patientId, rule,
      AbortSignal.any([controller.signal, AbortSignal.timeout(20000)])).then((result) => {
      if (controller.signal.aborted || !result) return;
      setTasks(result.tasks);
      setOwners(result.owners);
      setChanges(result.changes);
      setLoadedKey(key); setState("ready");
    }).catch(() => {
      if (!controller.signal.aborted) { setLoadedKey(key); setState("error"); }
    });
    return () => controller.abort();
  }, [patientId, rule, revision]);
  return { tasks: loadedKey === key ? tasks : [], owners: loadedKey === key ? owners : [],
    state: loadedKey === key ? state : "loading",
    changes: loadedKey === key ? changes : null };
}

function AccessUnavailable(): ReactNode {
  return <Page><WorkspaceNav current="history" />
    <WorkspaceBar section="Patient history" knownAsOf="Not available" />
    <h1>Patient access is no longer available</h1>
    <p className="sa-data-unavailable">
      Patient content was removed after access could not be confirmed.
    </p>
    <Link href="/" className="sa-quiet-button">Return to authorized worklist</Link>
  </Page>;
}

export default function HistoryClient({ patient }: { patient: PatientData }): ReactNode {
  const accessAvailable = usePatientAccess(patient.patientId);
  const initial = patient.gates.find((gate) => gate.outcome !== "pass")?.rule_id
    ?? patient.gates[0]?.rule_id ?? "";
  const [rule, setRule] = useState(initial);
  const [revision, setRevision] = useState(0);
  if (!accessAvailable) return <AccessUnavailable />;
  return <HistoryWorkspace patient={patient} rule={rule} setRule={setRule}
    revision={revision} onSaved={() => setRevision((current) => current + 1)} />;
}

function HistoryWorkspace({ patient, rule, setRule, revision, onSaved }: {
  patient: PatientData; rule: string; setRule: (value: string) => void;
  revision: number; onSaved: () => void;
}): ReactNode {
  const history = useTaskHistory(patient.patientId, rule, revision);
  const selectedGate = patient.gates.find((gate) => gate.rule_id === rule);
  return <Page>
    <WorkspaceNav current="history" />
    <WorkspaceBar section={`${patient.patientName} · History`}
      knownAsOf={patient.knownAsOf ? `Known as of ${formatClock(patient.knownAsOf)}` : "Not available"} />
    <HistoryHeader patient={patient} />
    <div className="sa-history-layout">
      <section>
        <RuleSelector gates={patient.gates} rule={rule} onChange={setRule}
          selected={selectedGate} />
        <TaskHistoryList patientId={patient.patientId} history={history} onSaved={onSaved} />
        {history.state === "ready" && <RecordChangeHistory changes={history.changes} />}
      </section>
      <aside className="sa-history-aside"><EvidenceHistory patientId={patient.patientId} /></aside>
    </div>
  </Page>;
}

function HistoryHeader({ patient }: { patient: PatientData }): ReactNode {
  return <header className="sa-screen-header">
    <div><p className="sa-eyebrow">Coordinator workspace · patient history</p>
      <h1>{patient.patientName}</h1>
      <p>Trace a readiness result through its review tasks. The record and task lifecycle remain
        separate from clinical decision-making.</p>
    </div>
    <div className="sa-header-fields">
      <Field label="Patient" value={patient.patientId} />
      <Field label="Consent" value={patient.consentId ?? "None"} />
      <Field label="Known as of" value={patient.knownAsOf ? formatClock(patient.knownAsOf) : "Not available"} />
    </div>
  </header>;
}

function RuleSelector({ gates, rule, onChange, selected }: {
  gates: Gate[]; rule: string; onChange: (value: string) => void; selected?: Gate;
}): ReactNode {
  return <>
    <label className="sa-field-label">Readiness check<select value={rule}
      onChange={(event) => onChange(event.target.value)}>
      {gates.map((gate) => <option key={gate.rule_id} value={gate.rule_id}>
        {gate.rule_id} · {gate.outcome.replace("_", " ")}
      </option>)}
    </select></label>
    {selected && <div className="sa-history-rule">
      <div><strong>{selected.rule_id} v{selected.rule_version}</strong>
        <p>{selected.reason ?? "No reason is available for this check."}</p></div>
      <span className="sa-status-history">{selected.outcome.replace("_", " ")}</span>
    </div>}
  </>;
}

function TaskHistoryList({ patientId, history, onSaved }: {
  patientId: string; history: HistoryLoadState; onSaved: () => void;
}): ReactNode {
  return <>
    <div className="sa-history-section-head"><h2>Task lifecycle</h2>
      <Link href={`/patient/${patientId}`} style={{ ...buttonStyle, width: "auto" }}>Open patient record</Link>
    </div>
    {history.state === "loading" && <div className="sa-loading-lines" role="status">
      <span /><span /><span />
    </div>}
    {history.state === "error" && <HistoryError onRetry={onSaved} />}
    {history.state === "ready" && !history.tasks.length && <HistoryEmpty />}
    {history.state === "ready" && history.tasks.map((task) => <TaskLifecycle key={task.taskId}
      task={task} patientId={patientId} owners={history.owners} onSaved={onSaved} />)}
  </>;
}

function HistoryError({ onRetry }: { onRetry: () => void }): ReactNode {
  return <div className="sa-limitation">
    Task history could not be loaded. <button type="button" onClick={onRetry}>Retry</button>
  </div>;
}

function HistoryEmpty(): ReactNode {
  return <div className="sa-empty-state">
    <strong>No task has been filed for this check.</strong>
    <span>
      Any future document request or escalation will appear here with its owner and state.
    </span>
  </div>;
}
