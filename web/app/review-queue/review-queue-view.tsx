"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Page, WorkspaceNav } from "@/components/sa";
import type { LiveReviewQueue, QueueIssue, QueueTask } from "@/lib/review-queue.mjs";
import styles from "./review-queue.module.css";

type ReviewQueueViewProps = { queue: LiveReviewQueue; loadedAt: string };
type QueueRow = { task: QueueTask | null; issue: QueueIssue | null };

export function ReviewQueueView({ queue, loadedAt }: ReviewQueueViewProps): ReactNode {
  const rows = collectRows(queue);
  return <Page>
    <WorkspaceNav current="queue" />
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div><h1>Review queue</h1><p>Tasks and record checks for authorized patients.</p></div>
        <a className={styles.dayCare} href="/review-queue">Refresh queue</a>
      </header>
      <QueueProvenance loadedAt={loadedAt} issues={queue.issues} />
      <QueueWorkspace rows={rows} patients={queue.patients.length} />
      {queue.unavailable.length > 0 && <UnavailableRecords patients={queue.unavailable} />}
    </div>
  </Page>;
}


function QueueWorkspace({ rows, patients }: { rows: QueueRow[]; patients: number }): ReactNode {
  const [view, setView] = useState("active");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const visible = view === "active" ? rows.filter((row) => row.issue?.outcome !== "pass"
    && Boolean(row.issue) || row.task?.state !== "closed") : rows;
  const selected = visible.find((row) => row.task?.taskId === selectedKey) ?? visible[0] ?? null;
  if (!rows.length) return <EmptyQueue patients={patients} />;
  return <>
    <nav className={styles.views} aria-label="Review queue views">
      <button type="button" aria-pressed={view === "active"}
        onClick={() => setView("active")}>Active issues</button>
      <button type="button" aria-pressed={view === "visit"}
        onClick={() => setView("visit")}>By visit</button>
    </nav>
    {view === "visit" ? <section aria-label="Review tasks" className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr><th>Task</th><th>Patient and visit</th><th>Task status</th><th>Owner</th>
          <th>Task created</th><th>Record check</th><th>Review</th></tr></thead>
        <tbody>{[...rows].sort((a, b) => (a.issue?.scheduled ?? "")
          .localeCompare(b.issue?.scheduled ?? "")).map((row) =>
          <QueueTableRow key={row.task?.taskId ?? row.issue?.key} row={row} />)}</tbody>
      </table>
    </section> : <div className={styles.boardLayout}>
      <QueueBoard rows={visible} selectedKey={selected?.task?.taskId ?? null}
        onSelect={setSelectedKey} />
      {selected && <TaskInspector row={selected} />}
    </div>}
  </>;
}

function QueueBoard({ rows, selectedKey, onSelect }: {
  rows: QueueRow[]; selectedKey: string | null; onSelect: (key: string) => void;
}): ReactNode {
  const groups = ["Open", "Evidence received", "Closed", "Other task states"];
  return <section className={styles.board} aria-label="Task board">
    {groups.map((group) => {
      const tasks = rows.filter((row) => row.task && taskGroup(row.task.state) === group);
      if (group === "Other task states" && !tasks.length) return null;
      return <div className={styles.column} key={group}>
        <h2>{group} <span>{tasks.length}</span></h2>
        {tasks.map((row) => <button type="button" key={row.task!.taskId}
          className={styles.taskCard} aria-pressed={row.task!.taskId === selectedKey}
          onClick={() => onSelect(row.task!.taskId)}>
          <strong>{humanize(row.task!.action) || "Review task"}</strong>
          <span>{row.issue?.patientName ?? row.task!.patientId}</span>
          <span className={styles.secondary}>{row.task!.reason ?? "Reason not recorded"}</span>
          <span className={styles.secondary}>{row.task!.owner ?? "Unassigned"}</span>
          <span className={styles.taskState}>{humanize(row.task!.state)}</span>
        </button>)}
        {!tasks.length && <p className={styles.columnEmpty}>No tasks in this state</p>}
        {group === "Open" && rows.filter((row) => !row.task).map((row) =>
          <div className={styles.uncreated} key={row.issue!.key}>
            <strong>{row.issue!.patientName}</strong><p>No task created · {row.issue!.reason}</p>
            <PatientLink patientId={row.issue!.patientId} />
          </div>)}
      </div>;
    })}
  </section>;
}

function taskGroup(state: string | null): string {
  if (state === "closed") return "Closed";
  if (state === "evidence_received") return "Evidence received";
  if (["open", "acknowledged", "escalated", "requested"].includes(state ?? "")) return "Open";
  return "Other task states";
}

function TaskInspector({ row }: { row: QueueRow }): ReactNode {
  const patientId = row.task?.patientId ?? row.issue!.patientId;
  return <aside className={styles.inspector} aria-label="Task details">
    <h2>Task details</h2>
    <h3>{humanize(row.task?.action ?? null) || "Readiness result needs review"}</h3>
    <dl>
      <dt>Patient</dt><dd><PatientCell patientId={patientId} issue={row.issue} /></dd>
      <dt>Task status</dt><dd>{titleCase(humanize(row.task?.state ?? null)) || "No task"}</dd>
      <dt>Owner</dt><dd>{row.task?.owner ?? "Unassigned"}</dd>
      <dt>Task created</dt><dd><Timestamp value={row.task?.createdAt ?? null} /></dd>
    </dl>
    <p>{row.task?.reason ?? "No task created"}</p>
    <h3>Record check</h3><ReadinessCell issue={row.issue} />
    <p className={styles.secondary}>Task completion does not change the rule outcome.</p>
    <PatientLink patientId={patientId} />
    <Link className={styles.reviewLink} href={`/history/${encodeURIComponent(patientId)}`}
      prefetch={false}>Open task history</Link>
  </aside>;
}

export function ReviewQueueFailure(): ReactNode {
  return <Page>
    <WorkspaceNav current="queue" />
    <div className={styles.workspace}>
      <header className={styles.header}><h1>Review queue</h1></header>
      <div className={styles.empty} role="alert">
        <strong>The review queue is unavailable.</strong>
        <p>Queue data could not be read. Retry after the workspace connection recovers.</p>
        <a className={styles.dayCare} href="/review-queue">Retry</a>
      </div>
    </div>
  </Page>;
}

export function ReviewQueueLoading(): ReactNode {
  return <Page>
    <WorkspaceNav current="queue" />
    <div className={styles.workspace}>
      <header className={styles.header}><h1>Review queue</h1></header>
      <p className={styles.empty} role="status" aria-busy="true">
        Loading authorized tasks and record checks…
      </p>
    </div>
  </Page>;
}

function collectRows(queue: LiveReviewQueue): QueueRow[] {
  const linked = queue.issues.flatMap((issue) => issue.tasks.map((task) => ({ task, issue })));
  const taskIds = new Set(linked.map(({ task }) => task.taskId));
  const other = queue.otherTasks.filter((task) => !taskIds.has(task.taskId))
    .map((task) => ({ task, issue: null }));
  const missingTask = queue.issues.filter((issue) => issue.tasks.length === 0)
    .map((issue) => ({ task: null, issue }));
  return [...linked, ...other, ...missingTask];
}

function QueueTableRow({ row }: { row: QueueRow }): ReactNode {
  if (!row.task) return <ReadinessRow issue={row.issue!} />;
  return <tr>
    <td data-label="Task"><strong>{humanize(row.task.action) || "Review task"}</strong>
      <span className={styles.secondary}>{row.task.reason || "Reason not recorded"}</span></td>
    <td data-label="Patient and visit"><PatientCell patientId={row.task.patientId}
      issue={row.issue} /></td>
    <td data-label="Task status">{humanize(row.task.state) || "State not recorded"}</td>
    <td data-label="Owner">{row.task.owner || "Unassigned"}</td>
    <td data-label="Task created"><Timestamp value={row.task.createdAt} /></td>
    <td data-label="Record check"><ReadinessCell issue={row.issue} /></td>
    <td data-label="Review"><PatientLink patientId={row.task.patientId} /></td>
  </tr>;
}

function ReadinessRow({ issue }: { issue: QueueIssue }): ReactNode {
  return <tr>
    <td data-label="Task"><strong>No task created</strong>
      <span className={styles.secondary}>Readiness result needs review</span></td>
    <td data-label="Patient and visit">
      <PatientCell patientId={issue.patientId} issue={issue} />
    </td>
    <td data-label="Task status">No task</td><td data-label="Owner">—</td>
    <td data-label="Task created">—</td>
    <td data-label="Record check"><ReadinessCell issue={issue} /></td>
    <td data-label="Review"><PatientLink patientId={issue.patientId} /></td>
  </tr>;
}

function PatientCell({ patientId, issue }: {
  patientId: string;
  issue: QueueIssue | null;
}): ReactNode {
  const patientName = issue?.patientName ?? patientId;
  return <><strong>{patientName}</strong><span className={styles.secondary}>{patientId}</span>
    {issue && <time className={styles.secondary} dateTime={issue.scheduled}>
      Visit {issue.scheduled.slice(0, 10)}
    </time>}</>;
}

function ReadinessCell({ issue }: { issue: QueueIssue | null }): ReactNode {
  if (!issue) return <span>No matching result for this visit</span>;
  return <><strong>{issue.gate} · {issue.ruleId} v{issue.ruleVersion}</strong>
    <span className={styles.secondary}>Rule outcome</span>
    <span className={styles.outcome} data-outcome={issue.outcome}>
      {titleCase(humanize(issue.outcome)) || "Outcome not recorded"}
    </span>
    {issue.reason && <span className={styles.secondary}>{issue.reason}</span>}
    <span className={styles.secondary}>Known as of <Timestamp value={issue.knownAsOf} /></span>
  </>;
}

function PatientLink({ patientId }: { patientId: string }): ReactNode {
  return <Link className={styles.reviewLink}
    href={`/patient/${encodeURIComponent(patientId)}#review`}
    prefetch={false}>Open patient review</Link>;
}

function QueueProvenance({ loadedAt, issues }: {
  loadedAt: string;
  issues: QueueIssue[];
}): ReactNode {
  const timestamps = [...new Set(issues.map((issue) => issue.knownAsOf))];
  return <p className={styles.provenance}>
    <span>Queue loaded <Timestamp value={loadedAt} /></span>
    {timestamps.length > 0 && <span>Record checks as of {timestamps.map((value, index) =>
      <span key={value}>{index > 0 ? ", " : ""}<Timestamp value={value} /></span>)}</span>}
  </p>;
}

function UnavailableRecords({ patients }: { patients: LiveReviewQueue["unavailable"] }): ReactNode {
  return <section className={styles.unavailable} aria-labelledby="unavailable-title">
    <h2 id="unavailable-title">Readiness unavailable</h2>
    <ul>{patients.map((patient) => <li key={patient.id}>
      <PatientLink patientId={patient.id} /><span>{patient.name} · {patient.reason}</span>
    </li>)}</ul>
  </section>;
}

function EmptyQueue({ patients }: { patients: number }): ReactNode {
  return <p className={styles.empty} role="status">{patients
    ? "No review tasks or readiness gaps in the available records."
    : "No authorized patient records are available."}</p>;
}

function Timestamp({ value }: { value: string | null }): ReactNode {
  if (!value) return <span>Not recorded</span>;
  return <time dateTime={value}>{value.replace("T", " ")}</time>;
}

function humanize(value: string | null): string {
  return value?.replaceAll("_", " ") ?? "";
}

function titleCase(value: string): string {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : "";
}
