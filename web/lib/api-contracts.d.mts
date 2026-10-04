export type ApiFailure = {
  error: string;
  category: "invalid" | "access" | "conflict" | "configuration" | "uncertain" | "unavailable";
  purge_patient_state: boolean;
};

export const MAX_QUESTION_LENGTH: number;
export const MAX_REQUEST_BODY_BYTES: number;
export function readJsonBody(request: Request): Promise<unknown>;
export function validateAskBody(
  body: unknown,
): { patientId: string; question: string; sourceScope: "patient" | "reference" } | null;
export function validateReviewTaskBody(
  body: unknown,
): {
  patientId: string; ruleId: string; action: "request_document" | "escalate";
  requestId?: string;
} | null;
export function validateWorkspaceQuery(params: URLSearchParams): {
  view: "facts" | "documents" | "coverage_comparison";
  domain:
    | "demographics"
    | "labs"
    | "coverage"
    | "treatment_plan"
    | "encounters"
    | "identity"
    | null;
  knownAsOf: string | null;
  documentId: string | null;
} | null;
export function isSameOrigin(request: Request): boolean;
export function apiError(error: unknown, fallback?: string): ApiFailure;
export function apiErrorStatus(code: string): number;
export function isValidPatientId(id: unknown): boolean;
