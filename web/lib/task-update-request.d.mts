export type TaskUpdateAttempt = { payload: string; id: string };
export function taskUpdateKey(patientId: string, taskId: string): string;
export function readTaskUpdate(storage: Storage, key: string, taskId: string): {
  attempt: TaskUpdateAttempt | null; error: boolean;
};
export function storeTaskUpdate(storage: Storage, key: string,
  attempt: TaskUpdateAttempt | null): boolean;
