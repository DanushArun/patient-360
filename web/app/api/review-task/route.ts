import { createReviewTask } from "@/lib/patient";
import {
  apiError, apiErrorStatus, isSameOrigin, readJsonBody, validateReviewTaskBody,
} from "@/lib/api-contracts.mjs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json(apiError("invalid_origin"), { status: 403 });
  }
  let body: ReturnType<typeof validateReviewTaskBody>;
  try {
    body = validateReviewTaskBody(await readJsonBody(request));
  } catch (error) {
    const failure = apiError(error, "invalid_argument");
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
  if (!body) {
    return Response.json(apiError("invalid_argument"), { status: 400 });
  }
  try {
    const result = await createReviewTask(
      body.patientId, body.ruleId, body.action, body.requestId);
    if (result.error) {
      const failure = apiError(result.error, "action_unavailable");
      return Response.json({ ...result, ...failure },
        { status: failure.error === "action_unavailable" ? 409 : apiErrorStatus(failure.error) });
    }
    return Response.json(result);
  } catch (error) {
    const failure = apiError(error, "action_unavailable");
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
}
