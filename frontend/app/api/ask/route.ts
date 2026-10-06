import { askPatient, type AskPhase, type AskTooling } from "@/lib/patient";
import {
  apiError, apiErrorStatus, contextPreamble, isSameOrigin, readJsonBody, validateAskBody,
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
  // R6: the reference corpus is a separate service. A reference-scoped question is answered
  // from it alone, and never carries attached patient items into the search.
  const scope = body.sourceScope === "reference" ? "reference" : "patient";
  const context = scope === "reference" ? [] : body.context ?? [];
  const question = contextPreamble(context) + body.question;
  const tooling: AskTooling = { question: body.question, references: context };
  if (request.headers.get("accept")?.includes("application/x-ndjson")) {
    return streamAnswer(body.patientId, question, tooling, scope);
  }
  try {
    return Response.json(await askPatient(body.patientId, question, undefined, tooling, scope));
  } catch (error) {
    const failure = apiError(error, "agent_unreachable");
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
}

// One JSON object per line: {"phase": ...} as each real gateway step starts, then exactly one
// {"result": ...} or {"error": ..., "status": ...}. Phases are emitted by the server code that
// performs the step, so the progress shown is never simulated.
function streamAnswer(patientId: string, question: string, tooling: AskTooling,
  scope: "patient" | "reference"): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (value: object) => controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      try {
        const result = await askPatient(patientId, question, (phase: AskPhase) => send({ phase }),
          tooling, scope);
        send({ result });
      } catch (error) {
        const failure = apiError(error, "agent_unreachable");
        send({ ...failure, status: apiErrorStatus(failure.error) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
