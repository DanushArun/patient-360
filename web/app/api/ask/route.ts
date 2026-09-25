import { askPatient } from "@/lib/patient";
import { createPatientActionPost } from "@/lib/session-security";

export const POST = createPatientActionPost(async (patientId, body, login) => {
  if (typeof body.question !== "string" || !body.question.trim()) {
    return Response.json({ error: "invalid_argument" }, { status: 400 });
  }
  return askPatient(patientId, body.question.trim(), login);
}, "agent_unreachable");
