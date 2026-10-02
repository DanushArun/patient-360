import { loadReviewTasks, loadTaskOwners, transitionReviewTask } from "@/lib/patient";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const ruleId = new URL(request.url).searchParams.get("ruleId");
  if (!ruleId || !/^[A-Z0-9-]+$/.test(ruleId)) {
    return Response.json({ error: "invalid_argument" }, { status: 400 });
  }
  try {
    const { id } = await context.params;
    const tasks = await loadReviewTasks(id, ruleId);
    const owners = await loadTaskOwners(id);
    return Response.json({ tasks, owners });
  } catch (error) {
    const code = error instanceof Error ? error.message : "task_history_unavailable";
    const status = code.includes("access") || code.includes("bind failed") ? 403 : 502;
    return Response.json({ error: code }, { status });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const { taskId, action, ownerId, reason, version, requestId } = await request.json();
    if (typeof taskId !== "string" || !["acknowledge", "reassign", "resolve"].includes(action)
      || typeof reason !== "string" || reason.trim().length < 3 || reason.length > 2000
      || !Number.isInteger(version) || version < 0 || typeof requestId !== "string"
      || !/^[a-zA-Z0-9-]{8,80}$/.test(requestId)
      || (action === "reassign" && typeof ownerId !== "string")) {
      return Response.json({ error: "invalid_argument" }, { status: 400 });
    }
    return Response.json(await transitionReviewTask(id, taskId, action, ownerId ?? null, reason.trim(), version, requestId));
  } catch (error) {
    const code = error instanceof Error ? error.message : "task_update_unavailable";
    const allowed = ["stale_task", "invalid_transition", "owner_not_authorized", "no_patient_access", "access_withdrawn", "binding_mismatch"];
    return Response.json({ error: allowed.includes(code) ? code : "task_update_unavailable" },
      { status: code === "no_patient_access" || code === "access_withdrawn" ? 403 : 409 });
  }
}
