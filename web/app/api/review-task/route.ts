import { createReviewTask } from "@/lib/patient";
import { loginFromAuthorization, unauthorized } from "@/lib/request-auth";

export async function POST(request: Request) {
  const login = loginFromAuthorization(request.headers.get("authorization"));
  if (!login) return unauthorized();
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return Response.json({ error: "invalid_argument" }, { status: 400 });
    const { patientId, ruleId, action } = body as Record<string, unknown>;
    if (
      typeof patientId !== "string" || typeof ruleId !== "string" ||
      !["request_document", "escalate"].includes(String(action))
    ) return Response.json({ error: "invalid_argument" }, { status: 400 });
    const result = await createReviewTask(
      patientId, ruleId, action as "request_document" | "escalate", login
    );
    if (result.error) {
      const status = result.error === "no_patient_access" ? 403 : 409;
      return Response.json(result, { status });
    }
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "professional_login_invalid") return unauthorized();
    return Response.json({ error: "action_unavailable" }, { status: 502 });
  }
}
