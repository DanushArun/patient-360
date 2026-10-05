export function backendHealth(
  run: (sql: string) => Promise<Record<string, unknown>[] & { query_id?: string }>,
  revision: string | undefined,
): Promise<{ statusCode: number; body: Record<string, unknown> }>;
