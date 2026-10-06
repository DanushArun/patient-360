import { buildCensus, fetchCensus, oldestKnownAsOf } from "@/lib/census";
import { answerCohort, matchCohortIntent } from "@/lib/copilot-cohort.mjs";
import { withReadSession } from "@/lib/snowflake";
import { routeQuestion } from "@/lib/question-routing.mjs";
import {
  apiError, apiErrorStatus, isSameOrigin, MAX_QUESTION_LENGTH, readJsonBody,
} from "@/lib/api-contracts.mjs";

// Cohort questions on the day-care list. Class A questions are refused by the same SQL
// classifier the patient copilot uses; everything else is a deterministic filter over the
// census the caller is already scoped to (care team + consent, enforced by the procedure).
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json(apiError("invalid_origin"), { status: 403 });
  }
  let question: string;
  try {
    const body = await readJsonBody(request) as { question?: unknown };
    if (typeof body?.question !== "string" || !body.question.trim()
      || body.question.length > MAX_QUESTION_LENGTH) throw new Error("invalid_argument");
    question = body.question.trim();
  } catch (error) {
    const failure = apiError(error, "invalid_argument");
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
  try {
    const turn = await withReadSession((run) => routeQuestion(question, run, async () => {
      const rows = await fetchCensus(7);
      const answer = answerCohort(buildCensus(rows), matchCohortIntent(question));
      return { kind: "cohort", known_as_of: oldestKnownAsOf(rows), error: null, ...answer };
    }, () => {}, async (knownAsOf) => cohortRefusal(knownAsOf)));
    return Response.json(turn);
  } catch (error) {
    const failure = apiError(error, "record_service_unavailable");
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
}

// Class A on the day-care list. No patient is bound here, so the patient gateway's refusal
// (which builds an evidence packet for one patient's treating practitioner) cannot run. The
// refusal names who decides and offers the record-state question that can be answered.
function cohortRefusal(knownAsOf: string) {
  return { kind: "cohort", known_as_of: knownAsOf, error: null, title: null, rows: [],
    basis: null, refused: true,
    text: "That needs clinical judgement, which belongs to each patient's treating "
      + "practitioner. I can show the record state: who is blocked, waiting on evidence, in "
      + "conflict or has every check met. Open a patient to prepare an evidence packet for "
      + "their practitioner." };
}
