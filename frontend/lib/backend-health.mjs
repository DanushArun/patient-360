/**
 * @param {(sql: string) => Promise<Array<Record<string, unknown>> & {query_id?: string}>} run
 * @param {string | undefined} revision
 */
export async function backendHealth(run, revision) {
  const unavailable = { statusCode: 503,
    body: { status: 'unavailable', service: 'saarthi-web-backend' } };
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(revision ?? '')) return unavailable;
  try {
    const rows = await run("CALL SAARTHI.OPERATIONAL.GET_WEB_WORKSPACE('patients',7)");
    const cell = Object.values(rows[0] ?? {})[0];
    const value = typeof cell === 'string' ? JSON.parse(cell) : cell;
    if (rows.length !== 1 || !value || typeof value !== 'object' || value.error
        || !Array.isArray(value.rows) || value.rows.length === 0
        || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(rows.query_id ?? '')) {
      return unavailable;
    }
    return { statusCode: 200, body: {
      status: 'ready', service: 'saarthi-web-backend', release_revision: revision,
      database: { status: 'ready', query_id: rows.query_id },
    } };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return unavailable;
  }
}
