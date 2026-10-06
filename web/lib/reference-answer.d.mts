import type { AnswerArtifact } from "./patient";
export function questionTerms(question: string): string[];
export function bestQuote(pageText: string, terms: string[]): { quote: string; matched: number } | null;
export function catalogIndex(catalog: unknown): Map<string, Record<string, string | null>>;
export function composeReferenceAnswer(input: {
  question: string; hits: Record<string, unknown>[]; catalog: unknown; knownAsOf: string;
}): AnswerArtifact;
