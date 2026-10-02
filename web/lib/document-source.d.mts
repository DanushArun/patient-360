export type DocumentQuery = {
  page?: string; start?: string; end?: string; known_as_of?: string; return?: string;
};
export type DocumentRequest = {
  docId: string; page: number; cutoff: string | null;
  start?: string; end?: string; argument: string;
};
export type DocumentSource = {
  docId: string; page: number; version: number; text: string;
  eventTime: string | null; recordedAt: string | null; ingestedAt: string | null;
  currentStatus: string | null; statusObservedAt: string | null;
  highlight: { before: string; cited: string; after: string } | null;
};
export function documentRequest(docId: string, query: DocumentQuery): DocumentRequest;
export function documentReturn(patientId: string, destination?: string): string;
export function readDocumentPage(
  rows: Record<string, unknown>[], request: DocumentRequest
): DocumentSource;
