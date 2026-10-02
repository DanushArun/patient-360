import Link from "next/link";
import type { ReactNode } from "react";
import { withPatientSession, procedureValue } from "@/lib/snowflake";
import { documentRequest, documentReturn, readDocumentPage } from "@/lib/document-source.mjs";
import type { DocumentQuery } from "@/lib/document-source.mjs";
import { apiError } from "@/lib/api-contracts.mjs";
import { DocumentSourceView } from "@/components/document-source-view";
import { Page, WorkspaceNav } from "@/components/sa";
import { withUiReadDeadline } from "@/lib/ui-read-deadline.mjs";

export const dynamic = "force-dynamic";
type RouteProps = {
  params: Promise<{ id: string; doc: string }>;
  searchParams: Promise<DocumentQuery>;
};

export default async function DocumentPage(props: RouteProps): Promise<ReactNode> {
  const { id, doc } = await props.params;
  const query = await props.searchParams;
  const returnHref = documentReturn(id, query.return);
  try {
    const request = documentRequest(doc, query);
    const result = await withUiReadDeadline(withPatientSession(id, async (run) =>
      procedureValue(await run(
        "CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA('document',?)", [request.argument]))));
    if (!Array.isArray(result.rows) || typeof result.known_as_of !== "string") {
      throw new Error("source_unavailable");
    }
    const source = readDocumentPage(result.rows, request);
    return <DocumentSourceView patientId={id} source={source}
      returnHref={returnHref} knownAsOf={result.known_as_of} />;
  } catch (error) {
    return <SourceFailure error={error} returnHref={returnHref} />;
  }
}

function SourceFailure({ error, returnHref }: {
  error: unknown; returnHref: string;
}): ReactNode {
  const failure = apiError(error);
  const message = failure.category === "access" ? "Current patient access does not permit viewing."
    : failure.category === "configuration" ? "The database connection is not configured."
    : error instanceof Error && error.message === "source_invalid"
      ? "The citation or source metadata is invalid. No source text was displayed."
      : "The source could not be loaded. Retry after returning to the patient record.";
  return <Page><WorkspaceNav /><h1>Source page unavailable</h1><p role="alert">{message}</p>
    <Link href={returnHref} prefetch={false}>Return to patient record</Link></Page>;
}
