export type ChairStatus = "blocked" | "conflict" | "waiting" | "advisory" | "ready";

export interface Gate {
  OUTCOME: string | null;
  SEVERITY: string | null;
  REASON: string | null;
  RULE_ID: string | null;
}

export function classifyGates(gates: Gate[]): ChairStatus;
export function orderIssues(gates: Gate[]): Gate[];
export function describeGates(gates: Gate[], head: Gate | undefined): string;
