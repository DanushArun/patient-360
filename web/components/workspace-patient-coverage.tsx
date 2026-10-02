"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { StatusChip, type Outcome } from "@/components/sa";
import { formatRecordDate } from "@/lib/workspace-record-date.mjs";
import { authorizationSourceHref } from "@/lib/workspace-authorization-read.mjs";
import {
  useWorkspaceAuthorizationComparison,
  type AuthorizationLetter,
  type AuthorizationRecord,
  type CoverageComparison,
} from "@/components/use-workspace-authorization-comparison";
import styles from "./workspace-patient-coverage.module.css";

export function PatientCoverage({ patientId, patientName, nextVisit, scheduledAt, cycleNumber,
  knownAsOf, preview, onSelectGate,
  onCompareSources }: {
  patientId: string; patientName: string; nextVisit: string | null;
  scheduledAt: string | null; cycleNumber: number | null;
  knownAsOf: string | null; preview: boolean;
  onSelectGate: (ruleId: string) => void;
  onCompareSources?: () => void;
}): ReactNode {
  const { current, retry } = useWorkspaceAuthorizationComparison(patientId, knownAsOf, preview);
  if (preview) return <p className={styles.message} role="status">
    Coverage source records are not included in this recorded preview.
  </p>;
  if (current.state === "loading") return <p className={styles.message} role="status">
    Loading authorized coverage records…
  </p>;
  if (current.state === "access") return <p className={styles.message} role="alert">
    Patient access changed. Coverage details were cleared.
  </p>;
  if (current.state === "error") return <p className={styles.message} role="alert">
    Coverage records could not be loaded. <button type="button" onClick={() =>
      retry()}>Retry</button>
  </p>;
  if (current.state === "empty") return <p className={styles.message} role="status">
    No authorization comparison data was returned.
  </p>;
  return <CoverageRecords patientId={patientId} patientName={patientName} nextVisit={nextVisit}
    scheduledAt={scheduledAt} cycleNumber={cycleNumber} cutoff={knownAsOf} data={current.data}
    onSelectGate={onSelectGate} onCompareSources={onCompareSources} />;
}

function CoverageRecords({ patientId, patientName, nextVisit, scheduledAt, cycleNumber, cutoff,
  data, onSelectGate, onCompareSources }: {
  patientId: string; patientName: string; nextVisit: string | null;
  scheduledAt: string | null; cycleNumber: number | null;
  cutoff: string | null; data: CoverageComparison | null;
  onSelectGate: (ruleId: string) => void;
  onCompareSources?: () => void;
}): ReactNode {
  const rule = data?.rule;
  const auth = data?.authorizations ?? [];
  const letters = data?.letters ?? [];
  const invalidCutoff = Boolean(cutoff && (data?.requested_known_as_of !== cutoff
    || data?.known_as_of !== cutoff));
  if (invalidCutoff) return <p role="alert" className={styles.message}>
    Returned cutoff does not match the requested snapshot. No source values are shown.
  </p>;
  const outcome = isOutcome(rule?.outcome) ? rule.outcome : null;
  return <section className={styles.coverage} aria-label="Coverage sources">
    <div className={styles.heading}><h2>Coverage and authorization</h2>
      {outcome && <StatusChip outcome={outcome} />}</div>
    <CoverageContext patientName={patientName} payer={auth[0]?.payer_name}
      nextVisit={nextVisit} scheduledAt={scheduledAt} cycleNumber={cycleNumber} />
    <p className={styles.meta}>Record cutoff {formatRecordDate(data?.known_as_of ?? cutoff)}
      {data?.observed_at ? ` · authorization row observed ${formatRecordDate(data.observed_at)}`
        : ""}</p>
    {(data?.authorizations_truncated || data?.letters_truncated) &&
      <p className={styles.message} role="status">
        More source records exist than are shown here. Compare only the listed records.
      </p>}
    <AuthorizationTable patientId={patientId} cutoff={data?.known_as_of ?? cutoff}
      auth={auth} letters={letters} rule={rule} outcome={outcome} />
    <p className={styles.noWinner}>{rule?.outcome === "conflicting"
      ? "No single validity date is asserted while sources disagree."
      : "Validity remains shown as individual source values."}</p>
    <CoverageActions ruleId={rule?.rule_id} onSelectGate={onSelectGate}
      onCompareSources={onCompareSources} />
  </section>;
}

function CoverageContext({ patientName, payer, nextVisit, scheduledAt, cycleNumber }: {
  patientName: string; payer?: string | null; nextVisit: string | null;
  scheduledAt: string | null; cycleNumber: number | null;
}): ReactNode {
  return <dl className={styles.context}>
    <Property label="Patient" value={patientName} />
    <Property label="Payer" value={payer ?? "Not returned"} />
    <Property label="Scheduled visit" value={scheduledAt ? formatRecordDate(scheduledAt)
      : nextVisit ?? "Not recorded"} />
    <Property label="Cycle" value={cycleNumber === null ? "Not recorded" : String(cycleNumber)} />
  </dl>;
}

function AuthorizationTable({ patientId, cutoff, auth, letters, rule, outcome }: {
  patientId: string; cutoff: string | null; auth: AuthorizationRecord[];
  letters: AuthorizationLetter[]; rule: CoverageComparison["rule"]; outcome: Outcome | null;
}): ReactNode {
  return <div className={styles.tableWrap}><table>
    <thead><tr><th>Field</th><th>Structured record</th><th>Authorization letter</th>
      <th>Evidence / check</th></tr></thead>
    <tbody>
      <ValidityRow patientId={patientId} cutoff={cutoff} auth={auth} letters={letters}
        rule={rule} outcome={outcome} />
      <ClockRows patientId={patientId} cutoff={cutoff} auth={auth} letters={letters} />
    </tbody>
  </table></div>;
}

function ValidityRow({ patientId, cutoff, auth, letters, rule, outcome }: {
  patientId: string; cutoff: string | null; auth: AuthorizationRecord[];
  letters: AuthorizationLetter[]; rule: CoverageComparison["rule"];
  outcome: Outcome | null;
}): ReactNode {
  return <tr><th scope="row">Valid through</th>
    <td>{auth.length ? auth.map((row) => <AuthorizationDate key={row.auth_id} row={row} />)
      : "No authorization row returned"}</td>
    <td>{letters.length ? letters.map((letter) => <LetterDate key={letter.assertion_id}
      letter={letter} patientId={patientId} cutoff={cutoff} />)
      : "No verified valid-through assertion returned"}</td>
    <td>{outcome ? <StatusChip outcome={outcome} /> : "Rule result unavailable"}
      <small>{rule?.rule_id ?? "COV-AUTH-001"} v{rule?.rule_version ?? "—"}</small></td>
  </tr>;
}

function ClockRows({ patientId, cutoff, auth, letters }: {
  patientId: string; cutoff: string | null; auth: AuthorizationRecord[];
  letters: AuthorizationLetter[];
}): ReactNode {
  return <>
    <tr><th scope="row">Decision / source event</th>
      <td>{auth.map((row) => <span key={row.auth_id}>{row.decided_at
        ? formatDate(row.decided_at) : "No decision timestamp recorded"}</span>)}</td>
      <td>{letters.map((letter) => <span key={letter.assertion_id}>
        {letter.event_time ? formatDate(letter.event_time)
          : "Event time not recorded"}</span>)}</td>
      <td>{letters.map((letter) => <span key={letter.assertion_id}>
        {letter.source_recorded_at ? formatDate(letter.source_recorded_at)
          : "Source recorded date unavailable"}</span>)}</td>
    </tr>
    <tr><th scope="row">Received</th>
      <td>Ingestion clock unavailable on authorization row</td>
      <td>{letters.map((letter) => <span key={letter.assertion_id}>
        {letter.ingested_at ? formatDate(letter.ingested_at)
          : "Ingestion date unavailable"}</span>)}</td>
      <td>{letters.map((letter) => <LetterSource key={letter.assertion_id}
        letter={letter} patientId={patientId} cutoff={cutoff} />)}</td>
    </tr>
  </>;
}

function CoverageActions({ ruleId, onSelectGate, onCompareSources }: {
  ruleId?: string; onSelectGate: (ruleId: string) => void;
  onCompareSources?: () => void;
}): ReactNode {
  return <>
    <button type="button" className="sa-primary-action" disabled={!onCompareSources}
      onClick={onCompareSources}>Compare sources</button>
    {!onCompareSources && <p className={styles.message}>
      Source comparison navigation is unavailable in this view.
    </p>}
    <section className={styles.taskSection} aria-label="Review task">
      <h3>Review task</h3><p>No review task state was returned in this coverage read.</p>
      <button type="button" className="sa-quiet-button" disabled={!ruleId}
        onClick={() => ruleId && onSelectGate(ruleId)}>Prepare review task</button>
    </section>
  </>;
}

function AuthorizationDate({ row }: { row: AuthorizationRecord }): ReactNode {
  return <span>{row.expires_at ? formatDate(row.expires_at) : "No expiry date recorded"}
    <small>{row.auth_id ?? "Authorization ID unavailable"}
      {row.status ? ` · ${row.status}` : " · status unavailable"}
      {row.letter_status ? ` / letter status ${row.letter_status}` : ""}</small>
  </span>;
}

function LetterDate({ letter, patientId, cutoff }: {
  letter: AuthorizationLetter; patientId: string; cutoff: string | null;
}): ReactNode {
  return <span>{letter.value ?? "Verified date unavailable"}<small>
    {letter.verification_status === "verified" ? "Present · verified · " : ""}
    <LetterSource letter={letter} patientId={patientId} cutoff={cutoff} />
  </small></span>;
}

function LetterSource({ letter, patientId, cutoff }: {
  letter: AuthorizationLetter; patientId: string; cutoff: string | null;
}): ReactNode {
  const href = authorizationSourceHref(letter, patientId, cutoff);
  return href && letter.source_link_status === "verified_assertion_exact_page_span"
    ? <Link href={href} className="sa-inline-link">Open page
    {Number.isInteger(letter.page_index) ? ` ${Number(letter.page_index) + 1}` : ""}
  </Link> : "Source link unavailable";
}

function formatDate(value: string): string {
  return formatRecordDate(value).split(",")[0];
}

function Property({ label, value }: { label: string; value: string }): ReactNode {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function isOutcome(value?: string): value is Outcome {
  return ["pass", "fail", "not_evaluated", "conflicting"].includes(value ?? "");
}
