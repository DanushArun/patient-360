import type { ReactNode } from "react";
import type { Gate } from "@/lib/patient";

type SourceSpan = {
  patient_id: string; scope: string;
  assertion_id: string; doc_id: string; version: number; page_index: number;
  char_start: number; char_end: number; excerpt_start: number; excerpt: string;
  known_as_of: string; verification_status: string;
  event_time?: string; source_recorded_at?: string; ingested_at?: string;
};

export function readGateSourceSpans(gate: Gate, patientId: string): SourceSpan[] {
  const input: unknown = gate.source_spans;
  if (!Array.isArray(input) || !gate.known_as_of
    || !Array.isArray(gate.evidence_ids) || !gate.evidence_ids.length) return [];
  return input.filter((source) => validSpan(source)
    && source.patient_id === patientId && source.scope === "patient"
    && source.known_as_of === gate.known_as_of
    && gate.evidence_ids!.includes(source.assertion_id));
}

function validSpan(value: unknown): value is SourceSpan {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const source = value as SourceSpan;
  const numbers = [source.page_index, source.char_start, source.char_end, source.excerpt_start];
  if (!numbers.every((number) => Number.isSafeInteger(number) && number >= 0)) return false;
  return typeof source.assertion_id === "string" && source.assertion_id.length > 0
    && typeof source.doc_id === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(source.doc_id)
    && Number.isInteger(source.version) && source.version > 0 && source.page_index <= 9999
    && typeof source.excerpt === "string" && source.excerpt.length <= 20000
    && typeof source.known_as_of === "string" && Number.isFinite(Date.parse(source.known_as_of))
    && source.char_end > source.char_start && source.char_start >= source.excerpt_start
    && source.char_end - source.excerpt_start <= source.excerpt.length
    && source.verification_status === "verified";
}

export function GateSourceExcerpt({ gate, patientId }: {
  gate: Gate; patientId: string;
}): ReactNode {
  const sources = readGateSourceSpans(gate, patientId);
  if (!sources.length) return <p className="sa-meta">
    An exact source excerpt was not returned for this check.
  </p>;
  return <section aria-label="Exact check sources" className="sa-gate-source-excerpt">
    <h3>Exact source</h3>
    {sources.map((source) => <SourceExcerpt key={source.assertion_id}
      source={source} patientId={patientId} />)}
  </section>;
}

function SourceExcerpt({ source, patientId }: {
  source: SourceSpan; patientId: string;
}): ReactNode {
  const start = source.char_start - source.excerpt_start;
  const end = source.char_end - source.excerpt_start;
  const query = new URLSearchParams({ page: String(source.page_index),
    known_as_of: source.known_as_of, start: String(source.char_start),
    end: String(source.char_end), return: "overview" });
  const href = `/patient/${encodeURIComponent(patientId)}/documents/${source.doc_id}?${query}`;
  return <article>
    <p className="sa-meta">{source.doc_id} · Version {source.version}
      {" · "}Page {source.page_index + 1} · Verified assertion {source.assertion_id}</p>
    <pre className="sa-source-page-text" tabIndex={0}>{source.excerpt.slice(0, start)}
      <mark>{source.excerpt.slice(start, end)}</mark>{source.excerpt.slice(end)}</pre>
    <dl>{["event_time", "source_recorded_at", "ingested_at"].map((clock) =>
      <div key={clock}><dt>{clock.replaceAll("_", " ")}</dt>
        <dd>{typeof source[clock as keyof SourceSpan] === "string"
          ? source[clock as keyof SourceSpan] : "Not returned"}</dd></div>)}</dl>
    <a className="sa-quiet-button" href={href}>Open full cited page</a>
  </article>;
}
