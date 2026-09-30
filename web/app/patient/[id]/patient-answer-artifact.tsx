import type { ReactNode } from "react";
import type { AgentTurn } from "@/lib/patient";

function SourceValue({ value }: { value: unknown }): ReactNode {
  if (value === null || value === undefined) return <span>Not supplied</span>;
  if (typeof value !== "object") return <span>{String(value)}</span>;
  if (Array.isArray(value)) return <div className="space-y-3">
    {value.map((item, index) => <SourceValue key={index} value={item} />)}
  </div>;
  return <dl className="space-y-1">
    {Object.entries(value).map(([key, item]) => <div key={key}>
      <dt className="sa-meta">{key.replaceAll("_", " ")}</dt>
      <dd className="whitespace-pre-wrap break-words"><SourceValue value={item} /></dd>
    </div>)}
  </dl>;
}

export function PatientAnswerArtifact({ turn }: { turn: AgentTurn }): ReactNode {
  if (!turn.artifact) return null;
  return <section className="mt-4 space-y-3" aria-label="Answer evidence artifact">
    <div className="sa-field-label">Verified answer artifact</div>
    <div className="sa-meta">Evidence state: {turn.artifact.overall_status}</div>
    {turn.artifact.claims.map((claim, index) => <details key={index}>
      <summary>{claim.text}</summary>
      <SourceValue value={claim.evidence} />
    </details>)}
    {turn.artifact.limitations.map((limitation, index) =>
      <div key={index} className="sa-limitation">{limitation}</div>)}
    {turn.tool_results?.map(({ name, result }, index) => <details key={`${name}-${index}`}>
      <summary>{name === "SearchReferenceDocuments" ? "Reference corpus"
        : name === "SearchPatientDocuments" ? "Patient document corpus" : name}</summary>
      <div className="sa-meta">SQL-returned source data; not an additional validated claim.</div>
      <SourceValue value={result} />
    </details>)}
  </section>;
}
