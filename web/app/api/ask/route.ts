import { askPatient } from "@/lib/patient";
import {
  apiError, apiErrorStatus, isSameOrigin, readJsonBody, validateAskBody,
} from "@/lib/api-contracts.mjs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json(apiError("invalid_origin"), { status: 403 });
  }
  // Body parsing is a client concern: malformed or oversized input is 400/413, never an
  // upstream (502) failure.
  let body: ReturnType<typeof validateAskBody>;
  try {
    body = validateAskBody(await readJsonBody(request));
  } catch (error) {
    const failure = apiError(error, "invalid_argument");
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
  if (!body) {
    return Response.json(apiError("invalid_argument"), { status: 400 });
  }
  // R6: the reference corpus is a separate service. Never answer a reference-scoped question
  // from the patient corpus (the scope used to be validated and then silently dropped).
  if (body.sourceScope === "reference") {
    const failure = apiError("reference_scope_unavailable");
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
  try {
    return Response.json(await askPatient(body.patientId, body.question));
  } catch (error) {
    const failure = apiError(error, "agent_unreachable");
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
}
