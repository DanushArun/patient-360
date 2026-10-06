import { loadReviewTasks, loadTaskOwners, transitionReviewTask } from "@/lib/patient";
import { apiError, apiErrorStatus, isSameOrigin, readJsonBody } from "@/lib/api-contracts.mjs";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const ruleId = new URL(request.url).searchParams.get("ruleId");
  if (!ruleId || !/^[A-Z0-9-]+$/.test(ruleId)) {
    return Response.json(apiError("invalid_argument"), { status: 400 });
  }
  try {
    const { id } = await context.params;
    const tasks = await loadReviewTasks(id, ruleId);
    const owners = await loadTaskOwners(id);
    return Response.json({ tasks, owners });
  } catch (error) {
    const failure = apiError(error, "task_history_unavailable");
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) {
    return Response.json(apiError("invalid_origin"), { status: 403 });
  }
  let input: Record<string, unknown>;
  try {
    input = await readJsonBody(request) as Record<string, unknown>;
  } catch (error) {
    const failure = apiError(error, "invalid_argument");
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
  const { taskId, action, ownerId, reason, version, requestId } = input ?? {};
  if (typeof taskId !== "string" || !["acknowledge", "reassign", "resolve"].includes(String(action))
    || typeof reason !== "string" || reason.trim().length < 3 || reason.length > 2000
    || typeof version !== "number" || !Number.isInteger(version) || version < 0
    || typeof requestId !== "string" || !/^[a-zA-Z0-9-]{8,80}$/.test(requestId)
    || (action === "reassign" && typeof ownerId !== "string")) {
    return Response.json(apiError("invalid_argument"), { status: 400 });
  }
  try {
    const { id } = await context.params;
    return Response.json(await transitionReviewTask(id, taskId, String(action),
      typeof ownerId === "string" ? ownerId : null, reason.trim(), version, requestId));
  } catch (error) {
    const failure = apiError(error, "task_update_unavailable");
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
}
