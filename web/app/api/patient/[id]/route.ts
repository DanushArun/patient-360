import { loadPatient } from "@/lib/patient";
import { loginFromAuthorization, unauthorized } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext<"/api/patient/[id]">) {
  const login = loginFromAuthorization(request.headers.get("authorization"));
  if (!login) return unauthorized();
  try {
    const { id } = await context.params;
    return Response.json(await loadPatient(id, login));
  } catch (error) {
    if (error instanceof Error && error.message === "professional_login_invalid") return unauthorized();
    return Response.json({ error: error instanceof Error ? error.message : "patient_unavailable" }, { status: 403 });
  }
}
