import type { ReactNode } from "react";
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

function Citation({ source, index, patientId, knownAsOf, sourceScope }: {
  source: Evidence; index: number; patientId: string; knownAsOf: string | null;
  sourceScope?: "patient" | "reference";
}): ReactNode {
  const href = knownAsOf && sourceScope !== "reference"
    ? sourceHref(patientId, knownAsOf, source) : null;
  const documentType = sourceScope === "reference" ? "Reference document" : "Patient document";
  const type = source.kind === "document_span" ? documentType : "Structured record";
  return <li className="space-y-1">
    <div><strong>[{index + 1}]</strong> {type} · {source.id}</div>
    {source.kind === "document_span" && Number.isInteger(source.page_index)
      && <div className="sa-meta">Page {Number(source.page_index) + 1}</div>}
    {source.kind === "document_span" && Number.isInteger(source.char_start)
      && Number.isInteger(source.char_end)
      && <div className="sa-meta">Text span {source.char_start}–{source.char_end}</div>}
    {href && <Link className="sa-quiet-button" prefetch={false} href={href}>
      Open cited source
    </Link>}
    {!href && source.kind === "document_span"
      && <div className="sa-meta">Exact page or text location is unavailable.</div>}
  </li>;
}

function Claim({ claim, citationOffset, patientId, knownAsOf, sourceScope }: {
  claim: AnswerClaim; citationOffset: number; patientId: string; knownAsOf: string | null;
  sourceScope?: "patient" | "reference";
}): ReactNode {
  return <li className="space-y-2">
    <p>{claim.text}</p>
    <div className="sa-meta">Claim type: {claim.claim_type}</div>
    {claim.asserted_value !== undefined && claim.asserted_value !== null
      && <div className="sa-meta">Recorded value: {String(claim.asserted_value)}</div>}
    {claim.evidence.length > 0
      ? <ol className="space-y-2">{claim.evidence.map((source, citationIndex) =>
        <Citation key={`${source.id}-${citationIndex}`} source={source as Evidence}
          index={citationOffset + citationIndex}
          patientId={patientId} knownAsOf={knownAsOf} sourceScope={sourceScope} />)}</ol>
      : <div className="sa-meta">No citation supplied for this claim.</div>}
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
      <div className="sa-meta">Known as of: {artifact.known_as_of ?? "Unavailable"}</div>
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
          patientId={patientId} knownAsOf={artifact.known_as_of} sourceScope={sourceScope} />)}</ol>
      {artifact.limitations.map((limitation, index) =>
        <div key={index} className="sa-limitation">{limitation}</div>)}
    </>}
    {turn.error && <div role="alert" className="sa-limitation">
      Answer unavailable: {turn.error}
    </div>}
  </section>;
}
