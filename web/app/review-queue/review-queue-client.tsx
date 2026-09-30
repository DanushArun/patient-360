"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { CensusChip, Page, WorkspaceNav } from "@/components/sa";

export type Issue = {
  issue_id: string; patient_id: string; patient_name: string; gate: string; rule_id: string;
  outcome: "pass" | "fail" | "not_evaluated" | "conflicting"; state: string;
  severity: "blocker" | "advisory"; days_to_visit: number; owner_practitioner_name: string | null; rule_version: number;
};

const statusFor = (issue: Issue) => issue.outcome === "fail" ? "blocked"
  : issue.outcome === "conflicting" ? "conflict"
    : issue.outcome === "not_evaluated" ? "waiting" : "ready";

function QueueRow({ issue, onAcknowledge, onResolve }: { issue: Issue; onAcknowledge: () => void; onResolve: () => void }): ReactNode {
  const unowned = !issue.owner_practitioner_name;
  return <article className={`sa-queue-row${unowned ? " sa-queue-unowned" : ""}`}>
    <div className="sa-queue-main">
      <div className="sa-queue-patient">{issue.patient_name}</div>
      <div className="sa-meta"><code>{issue.patient_id}</code> · {issue.gate}</div>
      <div className="sa-queue-detail">{issue.severity === "blocker" ? "Blocker" : "Advisory"} · visit in {issue.days_to_visit} day{issue.days_to_visit === 1 ? "" : "s"}</div>
    </div>
    <div className="sa-queue-state"><CensusChip status={statusFor(issue)} />
      <span className="sa-meta"><code>{issue.rule_id}</code> v{issue.rule_version} · {issue.state.replace("_", " ")}</span></div>
    <div className="sa-queue-owner"><span className="sa-field-label">Owner</span>
      <span className={unowned ? "sa-unowned" : ""}>{issue.owner_practitioner_name ?? "Unowned — needs assignment"}</span></div>
    <div className="sa-queue-actions">
      <Link className="sa-primary-action" href={`/patient/${issue.patient_id}`}>Open record</Link>
      {issue.state === "open" && <button type="button" className="sa-quiet-button" onClick={onAcknowledge}>Acknowledge</button>}
      {issue.state !== "resolved" && <button type="button" className="sa-quiet-button" onClick={onResolve}>Mark resolved</button>}
    </div>
  </article>;
}

export default function ReviewQueueClient({ initialIssues }: { initialIssues: Issue[] }): ReactNode {
  const [issues, setIssues] = useState(initialIssues);
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("open");
  const [owner, setOwner] = useState("all");
  const displayed = useMemo(() => issues.filter((issue) => {
    const haystack = `${issue.patient_name} ${issue.patient_id} ${issue.gate} ${issue.rule_id}`.toLowerCase();
    return (status === "all" || issue.state === status || (status === "open" && issue.state === "evidence_received"))
      && (owner === "all" || (owner === "unowned" ? !issue.owner_practitioner_name : !!issue.owner_practitioner_name))
      && haystack.includes(term.trim().toLowerCase());
  }).sort((a, b) => a.days_to_visit - b.days_to_visit || Number(b.severity === "blocker") - Number(a.severity === "blocker")), [issues, owner, status, term]);
  const unowned = displayed.filter((issue) => !issue.owner_practitioner_name).length;
  const blockers = displayed.filter((issue) => issue.severity === "blocker").length;
  const nearVisit = displayed.filter((issue) => issue.days_to_visit <= 2).length;
  const [feedback, setFeedback] = useState("");
  const update = (id: string, state: string) => {
    setIssues((all) => all.map((issue) => issue.issue_id === id ? { ...issue, state } : issue));
    setFeedback(`Issue ${state} in this preview. This change has not been saved to the record.`);
  };
  return <Page>
    <WorkspaceNav current="queue" />
    <header className="sa-screen-header">
      <div><p className="sa-eyebrow">Coordinator workspace</p><h1>Review queue</h1>
        <p>Open record gaps are ordered by visit urgency. Ownership and state remain visible in the row.</p></div>
    </header>
      <div className="sa-queue-summary" aria-label="Queue summary">
        <div><span>Matching items</span><strong className="sa-num">{displayed.length}</strong><small>Current filter</small></div>
        <div><strong className="sa-num">{blockers}</strong><span>Blockers</span><small>Within current filter</small></div>
        <div><strong className="sa-num">{unowned}</strong><span>Unowned</span><small>Needs assignment</small></div>
        <div><strong className="sa-num">{nearVisit}</strong><span>Within 2 days</span><small>Upcoming visits</small></div>
      </div>
    <div className="sa-queue-filters" aria-label="Review queue filters">
      <label><span>Find patient or rule</span><input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Name, ID, category, or rule" /></label>
      <label><span>State</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="open">Open</option><option value="all">All states</option><option value="resolved">Resolved</option></select></label>
      <label><span>Assignment</span><select value={owner} onChange={(event) => setOwner(event.target.value)}><option value="all">All assignments</option><option value="unowned">Unowned</option><option value="owned">Assigned</option></select></label>
    </div>
    <div className="sa-list-caption"><h2>Review issues</h2><span>{displayed.length} {displayed.length === 1 ? "item" : "items"} · ordered by visit</span></div>
    {feedback && <div className="sa-review-feedback" role="status">{feedback}</div>}
    <section aria-live="polite" className="sa-queue-list">
      {displayed.length ? <><div className="sa-queue-column-head" aria-hidden="true"><span>Patient / visit</span><span>Readiness / rule</span><span>Owner</span><span>Actions</span></div>{displayed.map((issue) => <QueueRow key={issue.issue_id} issue={issue}
        onAcknowledge={() => update(issue.issue_id, "acknowledged")}
        onResolve={() => update(issue.issue_id, "resolved")} />)}</>
        : <div className="sa-empty-state"><strong>No matching review issues.</strong><span>Try a different filter, or return to the day-care list.</span><Link href="/">Open day-care list</Link></div>}
    </section>
    <p className="sa-meta" style={{ marginTop: 20 }}>Queue interactions shown here are a local workflow preview. Assignment and resolution require the documented review-task service before they can be saved.</p>
  </Page>;
}
