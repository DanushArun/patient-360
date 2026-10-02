import { loadPatientSnapshot, refreshPatient } from "@/lib/patient";
import { apiError, apiErrorStatus, isSameOrigin } from "@/lib/api-contracts.mjs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/patient/[id]">,
): Promise<Response> {
  try {
    const { id } = await context.params;
    return Response.json(await loadPatientSnapshot(id));
  } catch (error) {
    const failure = apiError(error);
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/patient/[id]">,
): Promise<Response> {
  if (!isSameOrigin(request)) {
    return Response.json(apiError("invalid_origin"), { status: 403 });
  }
  try {
    const { id } = await context.params;
    return Response.json(await refreshPatient(id));
  } catch (error) {
    const failure = apiError(error, "readiness_refresh_unavailable");
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
}
