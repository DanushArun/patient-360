"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import {
  authorizationExcerptSpan,
  authorizationSourceHref,
} from "@/lib/workspace-authorization-read.mjs";
import { formatRecordDate } from "@/lib/workspace-record-date.mjs";
import {
  useWorkspaceAuthorizationComparison,
  type AuthorizationLetter,
  type AuthorizationRecord,
  type CoverageComparison,
} from "@/components/use-workspace-authorization-comparison";
import styles from "./workspace-authorization-comparison.module.css";

export function WorkspaceAuthorizationComparison({ patientId, patientName, knownAsOf,
  preview, onBack, onEscalate }: {
  patientId: string; patientName?: string; knownAsOf: string | null; preview?: boolean;
  onBack: () => void; onEscalate: (ruleId: string) => void;
}): ReactNode {
  const isPreview = preview ?? false;
  const { current, retry } = useWorkspaceAuthorizationComparison(patientId, knownAsOf, isPreview);
  if (isPreview) return <ReadMessage
    text="Authorization source records are not included in this recorded preview." />;
  if (current.state === "loading") return <ReadMessage
    text="Loading authorization source records…" />;
  if (current.state === "access") return <ReadMessage alert
    text="Patient access changed. Authorization details were cleared." />;
  if (current.state === "error") return <ReadError onRetry={retry} />;
  if (current.state === "empty" || !current.data) return <ReadMessage
    text="No authorization comparison data was returned." />;
  return <AuthorizationComparisonContent patientId={patientId} patientName={patientName}
    cutoff={knownAsOf} data={current.data} onBack={onBack} onEscalate={onEscalate} />;
}

export function AuthorizationComparisonContent({ patientId, patientName, cutoff, data,
  onBack, onEscalate }: {
  patientId: string; patientName?: string; cutoff: string | null;
  data: CoverageComparison; onBack: () => void; onEscalate: (ruleId: string) => void;
}): ReactNode {
  if (hasCutoffMismatch(data, cutoff)) return <ReadMessage alert
    text="Returned cutoff does not match the requested snapshot. No source values are shown." />;
  const authorizations = data.authorizations ?? [];
  const letters = data.letters ?? [];
  const conflict = data.rule?.outcome === "conflicting";
  return <section className={styles.screen} aria-label="Authorization source comparison">
    <ComparisonHeading conflict={conflict} data={data} cutoff={cutoff} />
    {(data.authorizations_truncated || data.letters_truncated) && <p role="status"
      className={styles.notice}>
      The returned source list is truncated. Only listed records are shown.
    </p>}
    <ComparisonBody patientId={patientId} patientName={patientName} data={data}
      cutoff={cutoff} authorizations={authorizations} letters={letters} />
    <p className={styles.noWinner}>{conflict ? "No single valid-through date is asserted."
      : "Source values remain shown separately."}</p>
    <ComparisonActions ruleId={data.rule?.rule_id} onBack={onBack}
      onEscalate={onEscalate} />
  </section>;
}

function ComparisonHeading({ conflict, data, cutoff }: {
  conflict: boolean; data: CoverageComparison; cutoff: string | null;
}): ReactNode {
  return <header className={styles.heading}>
    <h2>{conflict ? "Authorization dates disagree" : "Compare authorization sources"}</h2>
    <p>{ruleLabel(data.rule)} <Outcome outcome={data.rule?.outcome} /></p>
    {data.rule?.reason && <p className={styles.reason}>{data.rule.reason}</p>}
    <p className={styles.temporal}>{temporalDescription(data, cutoff)}</p>
    <p className={styles.temporal}>{ruleCutoffDescription(data.rule?.known_as_of)}</p>
  </header>;
}

function ComparisonBody({ patientId, patientName, data, cutoff, authorizations, letters }: {
  patientId: string; patientName?: string; data: CoverageComparison; cutoff: string | null;
  authorizations: AuthorizationRecord[]; letters: AuthorizationLetter[];
}): ReactNode {
  const sourceCutoff = data.known_as_of ?? cutoff;
  return <div className={styles.columns}>
    <div className={styles.comparison}>
      <ComparedRecords patientId={patientId} cutoff={sourceCutoff}
        authorizations={authorizations} letters={letters} />
      <SourceTimeline authorizations={authorizations} letters={letters}
        observedAt={data.observed_at} />
    </div>
    <LetterSources patientId={patientId} patientName={patientName}
      cutoff={sourceCutoff} letters={letters} />
  </div>;
}

function ComparisonActions({ ruleId, onBack, onEscalate }: {
  ruleId?: string; onBack: () => void; onEscalate: (ruleId: string) => void;
}): ReactNode {
  return <div className={styles.actions}>
    <button type="button" className="sa-primary-action" disabled={!ruleId}
      onClick={() => ruleId && onEscalate(ruleId)}>Prepare review task</button>
    <button type="button" className="sa-quiet-button" onClick={onBack}>
      Back to coverage
    </button>
  </div>;
}

function ComparedRecords({ patientId, cutoff, authorizations, letters }: {
  patientId: string; cutoff: string | null; authorizations: AuthorizationRecord[];
  letters: AuthorizationLetter[];
}): ReactNode {
  return <section className={styles.section} aria-labelledby="compared-records">
    <h2 id="compared-records">Compared records</h2>
    <div className={styles.tableWrap}><table className={styles.recordsTable}>
      <thead><tr><th scope="col">Record</th><th scope="col">Valid through</th>
        <th scope="col">Source</th></tr></thead>
      <tbody>
        {authorizations.map((record, index) => <AuthorizationRow key={record.auth_id ?? index}
          record={record} />)}
        {letters.map((letter, index) => <LetterRow
          key={letter.assertion_id ?? index} letter={letter}
          patientId={patientId} cutoff={cutoff} />)}
        {!authorizations.length && !letters.length && <tr>
          <td colSpan={3}>No authorization or verified letter values were returned.</td>
        </tr>}
      </tbody>
    </table></div>
  </section>;
}

function AuthorizationRow({ record }: { record: AuthorizationRecord }): ReactNode {
  return <tr><th scope="row">Structured authorization</th>
    <td>{dateOnly(record.expires_at, "No expiry date recorded")}</td>
    <td>{record.payer_name ?? "Payer not returned"}
      <small>{record.auth_id ?? "Authorization ID unavailable"}</small></td>
  </tr>;
}

function LetterRow({ letter, patientId, cutoff }: {
  letter: AuthorizationLetter; patientId: string; cutoff: string | null;
}): ReactNode {
  return <tr><th scope="row">Original authorization letter</th>
    <td>{letter.value ?? "Verified valid-through value unavailable"}
      <small>{letter.verification_status === "verified" ? "Present · verified"
        : "Verification status unavailable"}</small>
    </td><td>{letter.source_facility ?? "Source facility not returned"}
      <small>{letter.assertion_id ?? "Assertion ID unavailable"}</small>
      <ExactSourceLink letter={letter} patientId={patientId} cutoff={cutoff} />
    </td>
  </tr>;
}

function SourceTimeline({ authorizations, letters, observedAt }: {
  authorizations: AuthorizationRecord[]; letters: AuthorizationLetter[];
  observedAt?: string;
}): ReactNode {
  return <section className={styles.section} aria-labelledby="source-timeline">
    <h2 id="source-timeline">Source timeline</h2>
    <div className={styles.tableWrap}><table className={styles.timelineTable}>
      <thead><tr><th scope="col">Clock</th><th scope="col">Structured authorization</th>
        <th scope="col">Authorization letter</th></tr></thead>
      <tbody>
        <TimelineRow label="Decision / event" authorizations={authorizations}
          letters={letters} field="event" />
        <TimelineRow label="Recorded by source" authorizations={authorizations}
          letters={letters} field="recorded" />
        <TimelineRow label="Received by SAARTHI" authorizations={authorizations}
          letters={letters} field="ingested" />
        <tr><th scope="row">Comparison read observed</th>
          <td>{observedAt ? formatRecordDate(observedAt) : "Observation time not returned"}</td>
          <td>{observedAt ? formatRecordDate(observedAt) : "Observation time not returned"}</td>
        </tr>
      </tbody>
    </table></div>
  </section>;
}

function TimelineRow({ label, authorizations, letters, field }: {
  label: string; authorizations: AuthorizationRecord[]; letters: AuthorizationLetter[];
  field: "event" | "recorded" | "ingested";
}): ReactNode {
  return <tr><th scope="row">{label}</th>
    <td>{authorizations.map((record) => <span key={record.auth_id}>
      {authorizationClock(record, field)}</span>)}</td>
    <td>{letters.map((letter) => <span key={letter.assertion_id}>
      {letterClock(letter, field)}</span>)}</td>
  </tr>;
}

function LetterSources({ patientId, patientName, cutoff, letters }: {
  patientId: string; patientName?: string; cutoff: string | null;
  letters: AuthorizationLetter[];
}): ReactNode {
  return <section className={styles.documentPanel} aria-labelledby="patient-document">
    <header><h2 id="patient-document">Original authorization letter</h2></header>
    {!letters.length ? <p>
      No verified valid-through assertion was returned. No letter excerpt is shown.
    </p> : letters.map((letter, index) => <LetterExcerpt
        key={letter.assertion_id ?? index} letter={letter}
        patientId={patientId} patientName={patientName} cutoff={cutoff} />)}
  </section>;
}

function LetterExcerpt({ letter, patientId, patientName, cutoff }: {
  letter: AuthorizationLetter; patientId: string; patientName?: string; cutoff: string | null;
}): ReactNode {
  const span = authorizationExcerptSpan(letter);
  return <article className={styles.letter}>
    <header><span>PATIENT DOCUMENT · Page {pageNumber(letter)}</span>
      <span>{letter.doc_id ?? "Document ID unavailable"}</span>
    </header>
    <p>{letter.source_facility ?? "Source facility not returned"}</p>
    <p>{patientName ? `Patient: ${patientName} · ${patientId}` : `Patient ID: ${patientId}`}</p>
    <ClockList letter={letter} />
    {letter.excerpt ? <blockquote>{span ? <>
      {span.before}<mark>{span.cited}</mark>{span.after}
    </> : letter.excerpt}</blockquote>
      : <p>Source excerpt not returned. Open the page for the verified text.</p>}
    <p>Verified assertion value: {letter.value ?? "Value unavailable"}</p>
    <ExactSourceLink letter={letter} patientId={patientId} cutoff={cutoff} />
  </article>;
}

function ClockList({ letter }: { letter: AuthorizationLetter }): ReactNode {
  return <dl className={styles.clocks}>
    <Clock label="Event time" value={letter.event_time} />
    <Clock label="Source recorded" value={letter.source_recorded_at} />
    <Clock label="Ingested" value={letter.ingested_at} />
  </dl>;
}

function Clock({ label, value }: { label: string; value?: string | null }): ReactNode {
  return <div><dt>{label}</dt><dd>{value ? formatRecordDate(value) : "Not returned"}</dd></div>;
}

function ExactSourceLink({ letter, patientId, cutoff }: {
  letter: AuthorizationLetter; patientId: string; cutoff: string | null;
}): ReactNode {
  const href = authorizationSourceHref(letter, patientId, cutoff, "coverage-comparison");
  if (!href) return <span className={styles.linkUnavailable}>Exact source link unavailable</span>;
  return <Link href={href} className={styles.sourceLink}>
    Open exact source span · page {pageNumber(letter)}
  </Link>;
}

function ReadMessage({ text, alert = false }: { text: string; alert?: boolean }): ReactNode {
  return <p className={styles.message} role={alert ? "alert" : "status"}>{text}</p>;
}

function ReadError({ onRetry }: { onRetry: () => void }): ReactNode {
  return <p className={styles.message} role="alert">Authorization records could not be loaded.
    <button type="button" onClick={onRetry}>Retry</button>
  </p>;
}

function Outcome({ outcome }: { outcome?: string }): ReactNode {
  return <span className={styles.outcome}>{outcomeLabel(outcome)}</span>;
}

function ruleLabel(rule?: CoverageComparison["rule"]): string {
  return `${rule?.rule_id ?? "COV-AUTH-001"} v${rule?.rule_version ?? "—"} ·`;
}

function outcomeLabel(outcome?: string): string {
  if (outcome === "conflicting") return "Conflicting";
  if (outcome === "not_evaluated") return "Not evaluated";
  if (outcome === "pass") return "Pass";
  if (outcome === "fail") return "Fail";
  return "Outcome unavailable";
}

function temporalDescription(data: CoverageComparison, cutoff: string | null): string {
  if (data.as_of_semantics !== "authorization_current_at_query_document_ingestion_cutoff") {
    return `Record cutoff ${formatRecordDate(data.known_as_of ?? cutoff)}. `
      + "Cutoff semantics were not returned.";
  }
  return `Authorization rows reflect current query state; letters are limited to sources `
    + `received by ${formatRecordDate(data.known_as_of ?? cutoff)}.`;
}

function ruleCutoffDescription(value?: string): string {
  return value ? `SQL rule snapshot: ${formatRecordDate(value)}.`
    : "SQL rule snapshot time not returned.";
}

function hasCutoffMismatch(data: CoverageComparison, cutoff: string | null): boolean {
  return Boolean(cutoff && (data.known_as_of !== cutoff || data.requested_known_as_of !== cutoff));
}

function authorizationClock(record: AuthorizationRecord, field: string): string {
  if (field === "event") return record.decided_at ? formatRecordDate(record.decided_at)
    : record.requested_at ? formatRecordDate(record.requested_at) : "Decision time not returned";
  if (field === "recorded") return "Source-recorded time not returned";
  return "Ingestion time not returned";
}

function letterClock(letter: AuthorizationLetter, field: string): string {
  const value = field === "event" ? letter.event_time
    : field === "recorded" ? letter.source_recorded_at : letter.ingested_at;
  return value ? formatRecordDate(value) : "Not returned";
}

function dateOnly(value: string | null | undefined, empty: string): string {
  return value ? formatRecordDate(value).split(",")[0] : empty;
}

function pageNumber(letter: AuthorizationLetter): string {
  return Number.isInteger(letter.page_index)
    ? String(Number(letter.page_index) + 1) : "unavailable";
}
