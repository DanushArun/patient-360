import { loadReviewTasks } from "@/lib/patient";
import { createPatientGet } from "@/lib/session-security";

export const dynamic = "force-dynamic";

export const GET = async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const ruleId = new URL(request.url).searchParams.get("ruleId");
  if (!ruleId || !/^[A-Z0-9-]+$/.test(ruleId)) {
    return Response.json({ error: "invalid_argument" }, { status: 400 });
  }
  return createPatientGet((id, login) => loadReviewTasks(id, ruleId, login), "task_history_unavailable")(
    request, context,
  );
};
