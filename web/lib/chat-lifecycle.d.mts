export function invalidateChatRequest(refs: {
  activeRequest: { current: AbortController | null };
  sequence: { current: number };
}): void;
export function updateChatContext(context: {
  patientId: string;
  storageKey: string;
  activePatient: { current: string };
  activeStorageKey: { current: string };
  activeRequest: { current: AbortController | null };
  sequence: { current: number };
  lastQuestions: { current: Record<'patient' | 'reference', string> };
}): boolean;
export function clearPatientTurns(
  storage: Pick<Storage, 'removeItem'>,
  patientId: string,
): void;
