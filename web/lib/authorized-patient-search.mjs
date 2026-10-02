export function filterAuthorizedPatients(patients, query, available = true) {
  if (!available) return [];
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return patients;
  return patients.filter(({ id, name }) =>
    `${name} ${id}`.toLowerCase().includes(normalizedQuery));
}
