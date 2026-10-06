import type { ReactNode } from "react";
import { Clock } from "@/components/ui/clock";
import type { AgentTurn, AnswerClaim } from "@/lib/patient";
import { formatRecordDate } from "@/lib/workspace-record-date.mjs";
import Link from "next/link";

// A validated answer, laid out for a clinician: the cited facts first, one clock, and the
// provenance (sources, caveats) one click away. Nothing is dropped: every source and every
// limitation the server returned is still rendered, inside a disclosure.

type Evidence = AnswerClaim["evidence"][number] & {
  page_index?: number;
  char_start?: number;
  char_end?: number;
};

function sourceHref(patientId: string, knownAsOf: string, source: Evidence): string | null {
  if (source.kind !== "document_span" || !source.doc_id || !Number.isInteger(source.page_index)
      || !Number.isInteger(source.char_start) || !Number.isInteger(source.char_end)
      || Number(source.page_index) < 0 || Number(source.char_start) < 0
      || Number(source.char_end) <= Number(source.char_start)) return null;
  const query = new URLSearchParams({ page: String(source.page_index),
    known_as_of: knownAsOf, return: "ask", start: String(source.char_start),
    end: String(source.char_end) });
  return `/patient/${encodeURIComponent(patientId)}/documents/`
    + `${encodeURIComponent(source.doc_id)}?${query}`;
}

const ISO = /\b(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(\.\d+)?\b/g;

/** Record times in prose read as "3 Oct 2026, 23:03", never as raw ISO strings. */
function readableTimes(text: string): string {
  return text.replace(ISO, (_, day: string, time: string) => formatRecordDate(`${day}T${time}`));
}

function humanKey(key: string): string {
  const text = key.replace(/_(at|display|id)$/, "").replaceAll("_", " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The server's claim sentence, made readable. The wording of a value is never changed. */
export function readableClaim(text: string): string {
  const row = /^Recorded SQL row: (\{[\s\S]*\})\s*$/.exec(text);
  if (row) {
    try {
      const fields = Object.entries(JSON.parse(row[1]) as Record<string, unknown>)
        .filter(([key, value]) => key !== "version" && value !== null && value !== "");
      return fields.map(([key, value]) => `${humanKey(key)}: ${readableTimes(String(value))}`)
        .join(" · ");
    } catch { /* not JSON after all: show the sentence as written */ }
  }
  const check = /^SQL record check (\S+) version (\d+): ([a-z_]+)\.\s*This is not treatment clearance\.?$/i
    .exec(text);
  if (check) {
    const outcome = check[3].replaceAll("_", " ");
    return `Record check ${check[1]}: ${outcome.charAt(0).toUpperCase()}${outcome.slice(1)}`;
  }
  return readableTimes(text.replace(/\(event time ([^)]+)\)/g, "($1)"));
}

function ReferenceMetadata({ source }: { source: Evidence }): ReactNode {
  return <div className="sa-meta">
    <div>{source.publisher} · {source.document_title} · {source.version}</div>
    <div>Effective date: {source.effective_date} · Jurisdiction: {source.jurisdiction}</div>
    <div>Reference guidance; does not establish a finding about this patient.</div>
  </div>;
}

function StructuredSource({ source, recordedText }: {
  source: Evidence; recordedText: string;
}): ReactNode {
  return <details className="sa-meta">
    <summary>View cited SQL record</summary>
    <div>Table: {source.table ?? "not_received"}</div>
    <div>Event time: {source.event_time ?? "not_received"}</div>
    <div>Source recorded at: {source.source_recorded_at ?? "not_received"}</div>
    <div>Ingested at: {source.ingested_at ?? "not_received"}</div>
    {source.derived && <div>SQL derivation: {source.derived}</div>}
    <p>{recordedText}</p>
  </details>;
}

function Citation({ source, recordedText, index, patientId, knownAsOf, sourceScope }: {
  source: Evidence; index: number; patientId: string; knownAsOf: string | null;
  recordedText: string;
  sourceScope?: "patient" | "reference";
}): ReactNode {
  const href = knownAsOf && sourceScope !== "reference"
    ? sourceHref(patientId, knownAsOf, source) : null;
  const documentType = sourceScope === "reference" ? "Reference document" : "Patient document";
  const type = source.kind === "reference_clause" ? "Reference quotation"
    : source.kind === "document_span" ? documentType : "Structured record";
  return <li data-source-kind={source.kind}>
    <div><strong>{index + 1}</strong> {type} · <code>{source.id}</code></div>
    {source.kind === "structured"
      && <StructuredSource source={source} recordedText={recordedText} />}
    {source.kind === "reference_clause" && <ReferenceMetadata source={source} />}
    {source.kind !== "structured" && Number.isInteger(source.page_index)
      && <div className="sa-meta">Page {Number(source.page_index) + 1}</div>}
    {source.kind === "document_span" && Number.isInteger(source.char_start)
      && Number.isInteger(source.char_end)
      && <div className="sa-meta">Text span {source.char_start}–{source.char_end}</div>}
    {href && <Link className="sa-quiet-button" prefetch={false} href={href}>
      Open cited source
    </Link>}
    {!href && source.kind === "document_span"
      && <div className="sa-meta">{sourceScope === "reference"
        ? "Reference source viewer is unavailable."
        : "Exact page or text location is unavailable."}</div>}
  </li>;
}

function Claim({ claim, citationOffset }: {
  claim: AnswerClaim; citationOffset: number;
}): ReactNode {
  return <li>
    <span>{readableClaim(claim.text)}</span>
    {claim.evidence.length > 0 && <sup className="sa-answer-refs">
      {claim.evidence.map((_, index) => citationOffset + index + 1).join(",")}</sup>}
    {claim.rule_id && Number.isInteger(claim.rule_version) && <small className="sa-answer-rule">
      Rule: {claim.rule_id} · version {claim.rule_version}</small>}
    {claim.provenance_note && <small className="sa-answer-note">{claim.provenance_note}</small>}
    {!claim.evidence.length && <small className="sa-answer-note">No citation supplied.</small>}
  </li>;
}

export function PatientAnswerArtifact({ turn, patientId, sourceScope }: {
  turn: AgentTurn; patientId: string; sourceScope?: "patient" | "reference";
}): ReactNode {
  const artifact = turn.error ? undefined : turn.artifact;
  if (!artifact && !turn.error) return null;
  if (turn.error) return <section className="sa-answer" aria-label="Answer evidence artifact">
    <div role="alert" className="sa-limitation">Answer unavailable: {turn.error}</div>
  </section>;
  if (!artifact) return null;
  const clock = <span>Known as of <Clock value={artifact.known_as_of} fallback="Unavailable" /></span>;

  if (artifact.classification === "CLASS_A") {
    const name = artifact.refusal?.practitioner.name ?? "the treating practitioner";
    return <section className="sa-answer sa-answer-referral" aria-label="Answer evidence artifact">
      <p><strong>Clinical decision for {name}.</strong> Saarthi answers record questions only.
        {artifact.refusal?.evidence_packet_offered
          ? " An evidence packet can be prepared for them below." : ""}</p>
      <footer className="sa-answer-foot">{clock}<span>Answer status: Refused</span></footer>
    </section>;
  }

  return <section className="sa-answer" aria-label="Answer evidence artifact">
    {artifact.claims.length > 0
      ? <ul className="sa-answer-claims">{artifact.claims.map((claim, index) =>
        <Claim key={`${claim.claim_type}-${index}`} claim={claim}
          citationOffset={artifact.claims.slice(0, index).reduce((count, item) =>
            count + item.evidence.length, 0)} />)}</ul>
      : <p>Nothing in the record answers this question.</p>}
    <footer className="sa-answer-foot">{clock}
      {artifact.overall_status !== "supported" && <span>Answer status: Partial</span>}</footer>
    <CitationIndex claims={artifact.claims} patientId={patientId}
      knownAsOf={artifact.known_as_of} sourceScope={sourceScope} />
    {artifact.limitations.length > 0 && <details className="sa-answer-more">
      <summary>Notes ({artifact.limitations.length})</summary>
      <ul>{artifact.limitations.map((limitation, index) =>
        <li key={index}>{readableTimes(limitation)}</li>)}</ul>
    </details>}
  </section>;
}

function CitationIndex({ claims, patientId, knownAsOf, sourceScope }: {
  claims: AnswerClaim[]; patientId: string; knownAsOf: string | null;
  sourceScope?: "patient" | "reference";
}): ReactNode {
  const sources = claims.flatMap((claim) => claim.evidence.map(source =>
    ({ source, recordedText: claim.text })));
  if (!sources.length) return null;
  return <details className="sa-answer-more sa-citation-index" aria-label="Citation index">
    <summary>Sources ({sources.length})</summary>
    <ol>{sources.map(({ source, recordedText }, index) => <Citation key={`${source.id}-${index}`}
      source={source as Evidence} index={index} patientId={patientId}
      recordedText={recordedText}
      knownAsOf={knownAsOf} sourceScope={sourceScope} />)}</ol>
  </details>;
}
