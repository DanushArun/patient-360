import { askPatient } from "@/lib/patient";
import { loginFromAuthorization, unauthorized } from "@/lib/request-auth";

export async function POST(request: Request) {
  const login = loginFromAuthorization(request.headers.get("authorization"));
  if (!login) return unauthorized();
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return Response.json({ error: "invalid_argument" }, { status: 400 });
    const { patientId, question } = body as Record<string, unknown>;
    if (typeof patientId !== "string" || typeof question !== "string" || !question.trim()) {
      return Response.json({ error: "invalid_argument" }, { status: 400 });
    }
    return Response.json(await askPatient(patientId, question.trim(), login));
  } catch (error) {
    if (error instanceof Error && error.message === "professional_login_invalid") return unauthorized();
    return Response.json({ error: "agent_unreachable" }, { status: 502 });
  }
}
