import type { AgentTurn } from './patient';
export function readGatewayAnswer(value: unknown): AgentTurn;
export function guardAnswer(
  candidate: AgentTurn,
  run: (sql: string, binds?: (string | number | null)[]) => Promise<Record<string, unknown>[]>,
  clock: string,
): Promise<AgentTurn>;
