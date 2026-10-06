export type LiveSection = "Overview" | "Facts" | "Timeline" | "Documents" | "Coverage" | "Review"
  | "Family";
export type RosterEntry = { id: string; name: string };
export type PlanContext = { route: "census" | "queue" | "patient" | "other";
  patient: RosterEntry | null; section: string | null; roster: RosterEntry[] };
export type FindKind = "document" | "check" | "fact";
export type LiveStep =
  | { type: "select_patient"; candidates: RosterEntry[] }
  | { type: "go"; to: "census" | "queue" }
  | { type: "section"; section: LiveSection }
  | { type: "find"; kind: FindKind; terms: string[]; codes: string[]; phrase: string;
    open: boolean }
  | { type: "collect" }
  | { type: "ask"; scope: "patient" | "cohort"; question: string }
  | { type: "mark"; scope: "patient" | "cohort" };
export function normalizeRequest(text: string): string;
export function matchPatients(text: string, roster: RosterEntry[]): RosterEntry[];
export function planRequest(input: string, context: PlanContext): { steps: LiveStep[];
  control: "cancel" | "back" | null; reply: string | null; patientNamed: boolean };
export function stepMovesView(step: LiveStep): boolean;
export function stepLabel(step: LiveStep): string;
export function rankItems(items: { text: string }[], terms: string[], codes?: string[]): number;
