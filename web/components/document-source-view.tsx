import Link from "next/link";
import { formatClock } from "@/lib/display-format.mjs";
import { Clock } from "@/components/ui/clock";
import type { ReactNode } from "react";
import type { DocumentSource } from "@/lib/document-source.mjs";
import { Page, WorkspaceBar, WorkspaceNav } from "@/components/sa";

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
    <WorkspaceBar section="Source document" knownAsOf={`Known as of ${formatClock(knownAsOf)}`} />
    <Link href={returnHref} prefetch={false}>← Back to patient record</Link>
    <header className="sa-screen-header"><div>
      <h1>Source document</h1>
      <p>Patient {patientId} · Document {source.docId} · Page {source.page + 1}
        {" · "}Version {source.version}</p>
    </div></header>
    <p className="sa-meta">Known as of <Clock value={knownAsOf} /></p>
    <dl>
      <div><dt>Event time</dt><dd><Clock value={source.eventTime} /></dd></div>
      <div><dt>Source recorded</dt><dd><Clock value={source.recordedAt} /></dd></div>
      <div><dt>Ingested</dt><dd><Clock value={source.ingestedAt} /></dd></div>
    </dl>
    {source.currentStatus && <p className="sa-meta">
      Current document status: {source.currentStatus}
      {source.statusObservedAt && <> · observed <Clock value={source.statusObservedAt} /></>}
      {source.currentStatus !== "active" && "; retained source, excluded from current evidence."}
    </p>}
    <p className="sa-meta">Extracted source text. {span
      ? "The exact citation is highlighted with up to 360 characters of surrounding context."
      : "Page-level evidence; no precise excerpt is highlighted. This is the full source page."}</p>
    <pre className="sa-page-text sa-source-page-text" tabIndex={0}>
      {citedExcerpt(source)}
    </pre>
  </Page>;
}
