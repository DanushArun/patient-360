export type RecordTool = "readiness" | "labs" | "documents" | "coverage" | "timeline"
  | "conflicts" | "tasks" | "visit";
export type RecordRead = "snapshot" | "labs" | "documents" | "coverage" | "schemes"
  | "timeline" | "tasks";
export type RecordToolMatch = {
  tool: RecordTool; concepts: string[]; ruleIds: string[]; eventIds: string[];
  documentIds: string[]; group: string | null;
};
export type RecordTone = "positive" | "neutral" | "warning" | "critical";
export type RecordItem = {
  id: string; label: string; value: string; state: string; tone: RecordTone;
  note?: string | null; ruleId?: string | null; documentId?: string | null;
};
export type RecordAction = { label: string; section: string };
export type RecordAnswer = {
  tool: RecordTool; title: string; summary: string; items: RecordItem[]; more: number;
  actions: RecordAction[]; known_as_of: string | null; sources: string[]; basis: string | null;
};
export function matchRecordTool(question: string,
  references?: { kind: string; id: string }[]): RecordToolMatch | null;
export function readsFor(tool: RecordTool): RecordRead[];
export function gateState(gate: { outcome: string; severity?: string }):
  { state: string; tone: RecordTone };
export function composeRecordAnswer(match: RecordToolMatch, reads: Record<string, unknown>):
  RecordAnswer;
export function followOns(tool: RecordTool): string[];
export const RECORD_TOOL_STARTERS: string[];

export function recordToolQuestion(tool: RecordTool): string | null;
