import { loadPatient } from "@/lib/patient";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/patient/[id]">) {
  try {
    const { id } = await context.params;
    return Response.json(await loadPatient(id));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "patient_unavailable" }, { status: 403 });
  }
}
