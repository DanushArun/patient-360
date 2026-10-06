export type StoredTurn = { id: string; role: 'user' | 'assistant'; text: string };
export function readStoredTurns(
  storage: { getItem: (key: string) => string | null },
  key: string,
): { turns: StoredTurn[]; error?: unknown };
export function writeStoredTurns(
  storage: { setItem: (key: string, value: string) => void },
  key: string,
  turns: unknown[],
): { error?: unknown };
