import type { ReactNode } from "react";
import type { AgentTurn } from "@/lib/patient";
import Link from "next/link";

function SourceValue({ value, patientId }: { value: unknown; patientId: string }): ReactNode {
  if (value === null || value === undefined) return <span>Not supplied</span>;
  if (typeof value !== "object") return <span>{String(value)}</span>;
  if (Array.isArray(value)) return <div className="space-y-3">
    {value.map((item, index) => <SourceValue key={index} value={item} patientId={patientId} />)}
  </div>;
  const source = value as Record<string, unknown>;
  return <><dl className="space-y-1">
    {Object.entries(value).map(([key, item]) => <div key={key}>
      <dt className="sa-meta">{key.replaceAll("_", " ")}</dt>
      <dd className="whitespace-pre-wrap break-words"><SourceValue value={item} patientId={patientId} /></dd>
    </div>)}
  </dl>{typeof source.doc_id === "string" && Number.isInteger(source.page_index) &&
    <Link className="sa-quiet-button" prefetch={false} href={`/patient/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(source.doc_id)}?page=${source.page_index}&start=${source.char_start ?? ""}&end=${source.char_end ?? ""}`}>Open cited source page</Link>}</>;
}

export function PatientAnswerArtifact({ turn, patientId }: { turn: AgentTurn; patientId: string }): ReactNode {
  if (!turn.artifact && !turn.tool_results?.length) return null;
  return <section className="mt-4 space-y-3" aria-label="Answer evidence artifact">
    <div className="sa-field-label">Answer evidence</div>
    {turn.artifact && <div className="sa-meta">Evidence state: {turn.artifact.overall_status}</div>}
    {turn.artifact?.claims.map((claim, index) => <details key={index}>
      <summary>{claim.text}</summary>
      <SourceValue value={claim.evidence} patientId={patientId} />
    </details>)}
    {turn.artifact?.limitations.map((limitation, index) =>
      <div key={index} className="sa-limitation">{limitation}</div>)}
    {turn.tool_results?.map(({ name, result }, index) => <details key={`${name}-${index}`}>
      <summary>{name === "SearchReferenceDocuments" ? "Reference corpus"
        : name === "SearchPatientDocuments" ? "Patient document corpus" : name}</summary>
      <div className="sa-meta">SQL-returned source data; not an additional validated claim.</div>
      <SourceValue value={result} patientId={patientId} />
    </details>)}
  </section>;
}
