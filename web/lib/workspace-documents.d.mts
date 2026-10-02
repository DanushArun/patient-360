export type DocumentLibraryRow = {
  id: string;
  kind: "received" | "expected";
  document: Record<string, unknown> | null;
  title: string;
  state: string;
  stateCode: string;
  verification: string;
  verificationObservedAt: string | null;
  sourceFacility: string;
  ruleId: string | null;
  reason: string | null;
};

export function documentStateLabel(state: unknown): string;
export function documentLibraryRows(
  documents: Record<string, unknown>[],
  expectedDocuments: Record<string, unknown>[],
): DocumentLibraryRow[];
export function documentSourceHref(
  patientId: string,
  documentId: string,
  knownAsOf: string | null,
): string | null;
