import { loadPatientTimeline } from "@/lib/patient";
import { loginFromAuthorization, unauthorized } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const login = loginFromAuthorization(request.headers.get("authorization"));
  if (!login) return unauthorized();
  try {
    const { id } = await context.params;
    return Response.json(await loadPatientTimeline(id, login));
  } catch (error) {
    const code = error instanceof Error ? error.message : "timeline_unavailable";
    if (code === "professional_login_invalid") return unauthorized();
    const status = code.includes("access") || code.includes("bind failed") ? 403 : 502;
    return Response.json({ error: code }, { status });
  }
}
