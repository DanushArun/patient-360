import Link from "next/link";
import type { ReactNode } from "react";
import type { DocumentSource } from "@/lib/document-source.mjs";
import { Page, WorkspaceNav } from "@/components/sa";

type SourceProps = {
  patientId: string; source: DocumentSource; returnHref: string; knownAsOf: string;
};

const CONTEXT_LENGTH = 360;

function citedExcerpt(source: DocumentSource): ReactNode {
  const span = source.highlight;
  if (!span) return source.text;
  const before = span.before.slice(-CONTEXT_LENGTH);
  const after = span.after.slice(0, CONTEXT_LENGTH);
  return <>
    {before.length < span.before.length && <span aria-hidden="true">…</span>}
    {before}<mark>{span.cited}</mark>{after}
    {after.length < span.after.length && <span aria-hidden="true">…</span>}
  </>;
}

export function DocumentSourceView(props: SourceProps): ReactNode {
  const { patientId, source, returnHref, knownAsOf } = props;
  const span = source.highlight;
  return <Page>
    <WorkspaceNav patientId={patientId} />
    <Link href={returnHref} prefetch={false}>← Back to patient record</Link>
    <header className="sa-screen-header"><div>
      <h1>Source document</h1>
      <p>Patient {patientId} · Document {source.docId} · Page {source.page + 1}
        {" · "}Version {source.version}</p>
    </div></header>
    <p className="sa-meta">Known as of: {knownAsOf}</p>
    <dl>
      <div><dt>Event time</dt><dd>{source.eventTime ?? "Not recorded"}</dd></div>
      <div><dt>Source recorded</dt><dd>{source.recordedAt ?? "Not recorded"}</dd></div>
      <div><dt>Ingested</dt><dd>{source.ingestedAt ?? "Not recorded"}</dd></div>
    </dl>
    {source.currentStatus && <p className="sa-meta">
      Current document status: {source.currentStatus}
      {source.statusObservedAt && <> · observed {source.statusObservedAt}</>}
      {source.currentStatus !== "active" && "; retained source, excluded from current evidence."}
    </p>}
    <p className="sa-meta">Extracted source text. {span
      ? "The exact citation is highlighted with up to 360 characters of surrounding context."
      : "No exact citation span was supplied; this is the full source page."}</p>
    <pre className="sa-page-text sa-source-page-text" tabIndex={0}>
      {citedExcerpt(source)}
    </pre>
  </Page>;
}
