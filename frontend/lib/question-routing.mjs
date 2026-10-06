import { readGatewayAnswer } from './guarded-answer.mjs';

function parseClassifierResult(rows) {
  const row = Array.isArray(rows) ? rows[0] : null;
  const value = Object.values(row ?? {})[0];
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

/** @param {string} knownAsOf @returns {object} */
function routingFailure(knownAsOf) {
  return {
    text: "I couldn't safely route that question. Ask what is documented, missing, or conflicting in the record.",
    thinking: "",
    tools: [],
    suggested: [],
    gates: [],
    known_as_of: knownAsOf,
    error: "classification_unavailable",
  };
}

/**
 * @param {(phase: string) => void} [onPhase] reports real progress: "routing" before the
 *   classifier runs, then "refusing" for a Class A question. The answer callback reports
 *   its own later phases.
 * @param {((knownAsOf: string) => Promise<object>) | null} [refuse] how to refuse a Class A question.
 *   Defaults to the patient-bound gateway refusal; a caller with no bound patient (the
 *   day-care list) must supply its own, because that procedure requires a binding.
 */
export async function routeQuestion(question, run, answer, onPhase = () => {}, refuse = null) {
  onPhase("routing");
  const clock = await run(
    `SELECT TO_VARCHAR(CURRENT_TIMESTAMP()::TIMESTAMP_NTZ, 'YYYY-MM-DD"T"HH24:MI:SS')`
      + " AS KNOWN_AS_OF",
  );
  const knownAsOf = clock[0]?.KNOWN_AS_OF;
  if (typeof knownAsOf !== "string"
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(knownAsOf)) {
    throw new Error("answer_clock_unavailable");
  }
  let rows;
  try {
    rows = await run("CALL SAARTHI.OPERATIONAL.CLASSIFY_QUESTION(?)", [question]);
  } catch {
    return routingFailure(knownAsOf);
  }
  const classification = parseClassifierResult(rows)?.classification;
  if (classification === "CLASS_A") {
    onPhase("refusing");
    if (refuse) return refuse(knownAsOf);
    const refusal = await run('CALL SAARTHI.OPERATIONAL.ANSWER_GATEWAY_REFUSAL(?)', [knownAsOf]);
    return readGatewayAnswer(Object.values(refusal[0] ?? {})[0]);
  }
  if (classification !== "CLASS_B") return routingFailure(knownAsOf);
  return answer(knownAsOf);
}
