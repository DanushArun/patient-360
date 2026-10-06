import type { ReactNode } from "react";
import { Clock } from "@/components/ui/clock";
import type { AgentTurn, AnswerClaim } from "@/lib/patient";
import Link from "next/link";

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
  return <li className="space-y-1" data-source-kind={source.kind}>
    <div><strong>[{index + 1}]</strong> {type} · {source.id}</div>
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
  return <li className="space-y-2">
    <p>{claim.text}</p>
    <div className="sa-meta">Claim type: {claim.claim_type}</div>
    {claim.rule_id && Number.isInteger(claim.rule_version) && <div className="sa-meta">
      Rule: {claim.rule_id} · version {claim.rule_version}
    </div>}
    {claim.provenance_note && <div className="sa-limitation">{claim.provenance_note}</div>}
    {claim.asserted_value !== undefined && claim.asserted_value !== null
      && <div className="sa-meta">Recorded value: {String(claim.asserted_value)}</div>}
    <div className="sa-meta">{claim.evidence.length
      ? "Citations " + claim.evidence.map((_, index) => `[${citationOffset + index + 1}]`).join(" ")
      : "No citation supplied for this claim."}</div>
  </li>;
}

function statusLabel(status: string): string {
  return status === "supported" ? "Supported" : status === "partial" ? "Partial" : "Refused";
}

export function PatientAnswerArtifact({ turn, patientId, sourceScope }: {
  turn: AgentTurn; patientId: string; sourceScope?: "patient" | "reference";
}): ReactNode {
  const artifact = turn.error ? undefined : turn.artifact;
  if (!artifact && !turn.error) return null;
  return <section className="mt-4 space-y-3" aria-label="Answer evidence artifact">
    <div className="sa-field-label">Answer evidence</div>
    {artifact && <>
      <div className="sa-meta">Answer status: {statusLabel(artifact.overall_status)}</div>
      <div className="sa-meta">Question class: {artifact.classification}</div>
      <div className="sa-meta">Known as of <Clock value={artifact.known_as_of} fallback="Unavailable" /></div>
      {artifact.refusal && <div className="sa-limitation">
        {artifact.refusal.message}<br />
        Evidence packet addressed to {artifact.refusal.practitioner.name}
        {artifact.refusal.evidence_packet_offered ? " is offered." : "."}
      </div>}
      <ol className="space-y-3">{(artifact.classification === "CLASS_A"
        ? [] : artifact.claims).map((claim, index) =>
        <Claim key={`${claim.claim_type}-${index}`} claim={claim}
          citationOffset={artifact.claims.slice(0, index).reduce((count, item) =>
            count + item.evidence.length, 0)}
          />)}</ol>
      {artifact.classification !== "CLASS_A" && <CitationIndex claims={artifact.claims}
        patientId={patientId} knownAsOf={artifact.known_as_of} sourceScope={sourceScope} />}
      {artifact.limitations.map((limitation, index) =>
        <div key={index} className="sa-limitation">{limitation}</div>)}
    </>}
    {turn.error && <div role="alert" className="sa-limitation">
      Answer unavailable: {turn.error}
    </div>}
  </section>;
}

function CitationIndex({ claims, patientId, knownAsOf, sourceScope }: {
  claims: AnswerClaim[]; patientId: string; knownAsOf: string | null;
  sourceScope?: "patient" | "reference";
}): ReactNode {
  const sources = claims.flatMap((claim) => claim.evidence.map(source =>
    ({ source, recordedText: claim.text })));
  if (!sources.length) return null;
  return <section className="sa-citation-index" aria-label="Citation index">
    <h3>Citation index</h3>
    <ol>{sources.map(({ source, recordedText }, index) => <Citation key={`${source.id}-${index}`}
      source={source as Evidence} index={index} patientId={patientId}
      recordedText={recordedText}
      knownAsOf={knownAsOf} sourceScope={sourceScope} />)}</ol>
  </section>;
}
