import { DocumentSourceView } from "@/components/document-source-view";
import type { ReactNode } from "react";

export default function ControlledSource(): ReactNode {
  const text = "HER2 immunohistochemistry: grade III, IHC 2+. "
    + "The original signed report remains the source of this recorded result. ".repeat(8);
  return <DocumentSourceView patientId="PAT-DC-04" knownAsOf="2026-09-23T14:14:48"
    returnHref="/test-workspace/PAT-DC-04#documents" source={{
      docId: "DOC-SYNTHETIC-1", page: 0, version: 1, text,
      eventTime: "2026-09-22T09:30:00", recordedAt: "2026-09-22T10:00:00",
      ingestedAt: "2026-09-22T10:10:00", currentStatus: "active",
      statusObservedAt: "2026-09-23T14:14:48", highlight: null,
    }} />;
}
