import Link from "next/link";
import type { ReactNode } from "react";
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
      <section aria-label="Review tasks" className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Task</th><th scope="col">Patient and visit</th>
            <th scope="col">Task status</th><th scope="col">Owner</th>
            <th scope="col">Task created</th><th scope="col">Record check</th>
            <th scope="col">Review</th></tr></thead>
          <tbody>{rows.map((row) => <QueueTableRow key={row.task?.taskId ?? row.issue?.key}
            row={row} />)}</tbody>
        </table>
        {!rows.length && <EmptyQueue patients={queue.patients.length} />}
      </section>
      {queue.unavailable.length > 0 && <UnavailableRecords patients={queue.unavailable} />}
    </div>
  </Page>;
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
