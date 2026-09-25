import { createReviewTask } from "@/lib/patient";
import { createPatientResultPost } from "@/lib/session-security";

export const POST = createPatientResultPost(async (patientId, body, login) => {
  if (
    typeof body.ruleId !== "string" ||
    !["request_document", "escalate"].includes(String(body.action))
  ) return Response.json({ error: "invalid_argument" }, { status: 400 });
  return createReviewTask(
    patientId, body.ruleId, body.action as "request_document" | "escalate", login
  );
}, "action_unavailable");
