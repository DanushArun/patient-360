"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { StatusChip, Page, WorkspaceNav } from "@/components/sa";
import type { LiveReviewQueue, QueueIssue as Issue, QueueTask } from "@/lib/review-queue.mjs";

function TaskDetails({ tasks }: { tasks: QueueTask[] }) {
  if (!tasks.length) return <><span className="sa-field-label">Review task</span><span>No task created</span></>;
  return <>{tasks.map(task => <div key={task.taskId}>
    <span className="sa-field-label">Task owner</span><div>{task.owner ?? "Unassigned"}</div>
    <span className="sa-meta">{task.state?.replaceAll("_", " ") ?? "State not recorded"} · {task.action?.replaceAll("_", " ") ?? "Action not recorded"}</span>
    <details className="sa-meta"><summary>Task details</summary><p>{task.reason}</p><code>{task.taskId}</code><p>{task.createdAt}</p></details>
  </div>)}</>;
}

function QueueRow({ issue }: { issue: Issue }): ReactNode {
  return <article className="sa-queue-row">
    <div className="sa-queue-main">
      <div className="sa-queue-patient">{issue.patientName}</div>
      <div className="sa-meta"><code>{issue.patientId}</code> · {issue.gate}</div>
      <div className="sa-queue-detail">{issue.severity === "blocker" ? "Blocker" : issue.severity === "advisory" ? "Advisory" : "Severity not recorded"} · Visit <time dateTime={issue.scheduled}>{issue.scheduled.slice(0, 10)}</time></div>
    </div>
    <div className="sa-queue-state"><StatusChip outcome={issue.outcome} />
      <span className="sa-meta"><code>{issue.ruleId}</code> v{issue.ruleVersion}</span>
      <details className="sa-meta"><summary>Result details</summary><p>{issue.reason ?? "Reason not recorded"}</p><p>Known as of <time dateTime={issue.knownAsOf}>{issue.knownAsOf}</time></p></details>
    </div>
    <div className="sa-queue-owner"><TaskDetails tasks={issue.tasks} /></div>
    <div className="sa-queue-actions">
      <Link className="sa-primary-action" href={`/patient/${encodeURIComponent(issue.patientId)}`} prefetch={false}>Open record</Link>
      {issue.tasks.length > 0 && <Link className="sa-quiet-button" href={`/history/${encodeURIComponent(issue.patientId)}`} prefetch={false}>Manage tasks</Link>}
    </div>
  </article>;
}

export default function ReviewQueueClient({ queue, loadedAt }: { queue: LiveReviewQueue; loadedAt: string }): ReactNode {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("all");
  const [assignment, setAssignment] = useState("all");
  const displayed = useMemo(() => queue.issues.filter((issue) => {
    const haystack = `${issue.patientName} ${issue.patientId} ${issue.gate} ${issue.ruleId}`.toLowerCase();
    const assigned = issue.tasks.some(task => task.ownerId !== null);
    return (status === "all" || issue.outcome === status)
      && haystack.includes(term.trim().toLowerCase())
      && (assignment === "all" || (assignment === "assigned" && assigned)
        || (assignment === "unassigned" && issue.tasks.some(task => task.ownerId === null))
        || (assignment === "no_task" && !issue.tasks.length));
  }), [queue.issues, status, term, assignment]);
  const patientCount = new Set(displayed.map(issue => issue.patientId)).size;
  const blockers = displayed.filter((issue) => issue.severity === "blocker" && issue.outcome !== "pass").length;
  const nearVisit = displayed.filter((issue) => issue.daysToVisit !== null && issue.daysToVisit >= 0 && issue.daysToVisit <= 2).length;
  return <Page>
    <WorkspaceNav current="queue" patients={queue.patients} />
    <div className="ct-topbar"><span>Workspace <span>/</span> <strong>Review queue</strong></span><span>Care readiness & evidence</span></div>
    <header className="sa-screen-header">
      <div><p className="sa-eyebrow">Coordinator workspace</p><h1>Review queue</h1>
        <p>Readiness gaps, visit dates and care-team follow-up.</p></div>
      <button type="button" className="sa-quiet-button" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}>{refreshing ? "Refreshing…" : "Refresh queue"}</button>
    </header>
      <div className="sa-queue-summary" aria-label="Queue summary">
        <div><span>Matching items</span><strong className="sa-num">{displayed.length}</strong><small>Current filter</small></div>
        <div><strong className="sa-num">{blockers}</strong><span>Blocker checks</span><small>Within current filter</small></div>
        <div><strong className="sa-num">{patientCount}</strong><span>Patients with issues</span><small>Within current filter</small></div>
        <div><strong className="sa-num">{nearVisit}</strong><span>Within 2 days</span><small>Checks for upcoming visits</small></div>
      </div>
    <div className="sa-queue-filters" aria-label="Review queue filters">
      <label><span>Find patient or rule</span><input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Name, ID, category, or rule" /></label>
      <label><span>Readiness</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All results</option><option value="fail">Failed</option><option value="conflicting">Conflicting</option><option value="not_evaluated">Not evaluated</option><option value="pass">Passed · task remains</option></select></label>
      <label><span>Assignment</span><select value={assignment} onChange={event => setAssignment(event.target.value)}><option value="all">All assignments</option><option value="assigned">Assigned task</option><option value="unassigned">Unassigned task</option><option value="no_task">No task created</option></select></label>
    </div>
    <div className="sa-list-caption"><h2>Review issues</h2><span>{displayed.length} {displayed.length === 1 ? "item" : "items"} · ordered by visit</span></div>
    <section aria-live="polite" aria-busy={refreshing} className="sa-queue-list">
      {displayed.length ? <><div className="sa-queue-column-head" aria-hidden="true"><span>Patient / visit</span><span>Readiness / rule</span><span>Owner / task state</span><span>Record</span></div>{displayed.map((issue) => <QueueRow key={issue.key} issue={issue} />)}</>
        : <div className="sa-empty-state"><strong>{!queue.patients.length ? "No accessible patients." : queue.issues.length ? "No matching review issues." : "No readiness gaps or linked open tasks."}</strong><span>{!queue.patients.length ? "An active treating or coordinator care-team membership and valid consent are required." : queue.issues.length ? "Try a different filter." : "For the available SQL results."}</span><Link href="/" prefetch={false}>Open day-care list</Link></div>}
    </section>
    {queue.otherTasks.length > 0 && <section aria-label="Other review tasks"><h2 className="sa-list-caption">Other open review tasks</h2>{queue.otherTasks.map(task => <article className="sa-queue-row" key={task.taskId}>
      <div><strong>{queue.patients.find(patient => patient.id === task.patientId)?.name}</strong><p className="sa-meta">{task.patientId} · {task.ruleId}</p></div>
      <div className="sa-meta">No matching result for the selected visit</div><div className="sa-queue-owner"><TaskDetails tasks={[task]} /></div>
      <Link className="sa-primary-action" href={`/patient/${encodeURIComponent(task.patientId)}`} prefetch={false}>Open record</Link>
    </article>)}</section>}
    {queue.unavailable.length > 0 && <section aria-label="Unavailable readiness"><h2 className="sa-list-caption">Records to check</h2>{queue.unavailable.map(patient => <p className="sa-meta" key={patient.id}><Link href={`/patient/${encodeURIComponent(patient.id)}`} prefetch={false}>{patient.name} · {patient.id}</Link> — {patient.reason}</p>)}</section>}
    <p className="sa-meta" style={{ marginTop: 20 }}>Loaded from Snowflake · <time dateTime={loadedAt}>{loadedAt}</time>. Result timestamps are shown under Result details.</p>
  </Page>;
}
