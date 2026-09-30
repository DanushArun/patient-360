import type { AgentTurn } from "./patient.js";

type SnowflakeRun = (
  sql: string,
  binds?: (string | number | null)[],
) => Promise<Record<string, unknown>[]>;

type LocalMessage = {
  role: string;
  content: string;
};

type LocalResponse = {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
};

export function askLocalModel(
  question: string,
  patientId: string,
  run: SnowflakeRun,
  complete: (messages: LocalMessage[], schema?: unknown) => Promise<LocalResponse>,
): Promise<AgentTurn>;

export function completeWithOllama(
  messages: LocalMessage[],
  schema?: unknown,
): Promise<LocalResponse>;
