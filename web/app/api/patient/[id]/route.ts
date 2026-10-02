import { loadPatient, refreshPatient } from "@/lib/patient";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/patient/[id]">) {
  try {
    const { id } = await context.params;
    return Response.json(await loadPatient(id));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "patient_unavailable" }, { status: 403 });
  }
}

export async function POST(request: Request, context: RouteContext<"/api/patient/[id]">) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    return Response.json(await refreshPatient(id));
  } catch {
    return Response.json({ error: "readiness_refresh_unavailable" }, { status: 502 });
  }
}
