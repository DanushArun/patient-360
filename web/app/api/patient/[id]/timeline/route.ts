import { loadPatientTimeline } from "@/lib/patient";
import { apiError, apiErrorStatus } from "@/lib/api-contracts.mjs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await context.params;
    return Response.json(await loadPatientTimeline(id));
  } catch (error) {
    const failure = apiError(error, "timeline_unavailable");
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
}
