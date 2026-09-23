import { loadPatientTimeline } from "@/lib/patient";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await context.params;
    return Response.json(await loadPatientTimeline(id));
  } catch (error) {
    const code = error instanceof Error ? error.message : "timeline_unavailable";
    const status = code.includes("access") || code.includes("bind failed") ? 403 : 502;
    return Response.json({ error: code }, { status });
  }
}
