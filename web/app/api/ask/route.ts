import { askPatient } from "@/lib/patient";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return Response.json({ error: "invalid_argument" }, { status: 400 });
    const { patientId, question } = body as Record<string, unknown>;
    if (typeof patientId !== "string" || typeof question !== "string" || !question.trim()) {
      return Response.json({ error: "invalid_argument" }, { status: 400 });
    }
    return Response.json(await askPatient(patientId, question.trim()));
  } catch {
    return Response.json({ error: "agent_unreachable" }, { status: 502 });
  }
}
