export type SearchablePatient = { id: string; name: string };

export function filterAuthorizedPatients<T extends SearchablePatient>(
  patients: T[],
  query: string,
  available?: boolean,
): T[];
