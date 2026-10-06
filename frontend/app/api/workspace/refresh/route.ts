import { invalidatePatient, WORKSPACE_SCOPE } from "@/lib/read-cache";
import { apiError, isSameOrigin } from "@/lib/api-contracts.mjs";

// Explicit refresh: drop cached cross-patient reads (census, roster, review queue) so the
// next render re-reads them. Clears cache only; reads and writes nothing in Snowflake.
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return Response.json(apiError("invalid_origin"), { status: 403 });
  invalidatePatient(WORKSPACE_SCOPE);
  return new Response(null, { status: 204 });
}
