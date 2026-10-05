import { backendHealth } from '@/lib/backend-health.mjs';
import { query } from '@/lib/snowflake';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const result = await backendHealth((sql) => query(sql), process.env.SAARTHI_RELEASE_REVISION);
  return Response.json(result.body, {
    status: result.statusCode,
    headers: { 'Cache-Control': 'no-store' },
  });
}
