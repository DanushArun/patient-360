export type PatientSection = "Overview" | "Facts" | "Timeline" | "Documents"
  | "Coverage" | "Review" | "Family";
export function resolvePatientSection(value: string | null): PatientSection;
export function isLatestPatientResponse(
  requestPatientId: string,
  activePatientId: string,
  requestVersion: number,
  latestVersion: number,
): boolean;
export function ruleOutcomeLabel(outcome: string): string;
export function groupWorklistByState<T extends { status: string }>(rows: T[]): {
  key: string;
  label: string;
  rows: T[];
}[];
export const PATIENT_ACCESS_EVENT: string;
export function purgesPatientState(payload: unknown): boolean;
export function announcePatientAccessWithdrawn(patientId: string): void;
