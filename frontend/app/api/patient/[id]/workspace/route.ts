import { apiError, apiErrorStatus, validateWorkspaceQuery } from "@/lib/api-contracts.mjs";
import { loadWorkspaceView } from "@/lib/workspace-read";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: RouteContext<"/api/patient/[id]/workspace">,
): Promise<Response> {
  const query = validateWorkspaceQuery(new URL(request.url).searchParams);
  if (!query) return Response.json(apiError("invalid_argument"), { status: 400 });
  try {
    const { id } = await context.params;
    return Response.json(await loadWorkspaceView(id, query));
  } catch (error) {
    const failure = apiError(error, "workspace_data_unavailable");
    // Missing financial consent withholds this read only; clinical access to the patient stands.
    if (failure.error === "consent_not_valid") failure.purge_patient_state = false;
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
}
