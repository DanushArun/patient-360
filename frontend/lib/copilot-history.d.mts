export type CopilotHistoryEntry = {
  patientId: string;
  scope: 'patient' | 'reference';
  title: string;
  storageKey: string;
  updatedAt: number;
};
export function listCopilotHistory(storage: Storage, authorizedPatientIds: string[], now?: number): CopilotHistoryEntry[];
export function touchCopilotHistory(storage: Storage, storageKey: string, updatedAt?: number): void;
export function formatHistoryAge(updatedAt: number, now?: number): string;
