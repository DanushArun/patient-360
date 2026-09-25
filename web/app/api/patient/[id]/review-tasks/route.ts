import { loadReviewTasks } from "@/lib/patient";
import { loginFromAuthorization, unauthorized } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const login = loginFromAuthorization(request.headers.get("authorization"));
  if (!login) return unauthorized();
  const ruleId = new URL(request.url).searchParams.get("ruleId");
  if (!ruleId || !/^[A-Z0-9-]+$/.test(ruleId)) {
    return Response.json({ error: "invalid_argument" }, { status: 400 });
  }
  try {
    const { id } = await context.params;
    return Response.json({ tasks: await loadReviewTasks(id, ruleId, login) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "task_history_unavailable";
    if (code === "professional_login_invalid") return unauthorized();
    const status = code.includes("access") || code.includes("bind failed") ? 403 : 502;
    return Response.json({ error: code }, { status });
  }
}
