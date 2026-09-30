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

function routingFailure() {
  return {
    text: "I couldn't safely route that question. Ask what is documented, missing, or conflicting in the record.",
    thinking: "",
    tools: [],
    suggested: [],
    gates: [],
    known_as_of: null,
    error: "classification_unavailable",
  };
}

function clinicalRefusal() {
  return {
    text: "This question requires the treating practitioner's judgment. I can list documented " +
      "findings, missing records, or conflicting sources if you ask about the record.",
    thinking: "",
    tools: [],
    suggested: [],
    gates: [],
    known_as_of: null,
    error: null,
  };
}

export async function routeQuestion(question, run, answer) {
  let rows;
  try {
    rows = await run("CALL SAARTHI.OPERATIONAL.CLASSIFY_QUESTION(?)", [question]);
  } catch {
    return routingFailure();
  }
  const classification = parseClassifierResult(rows)?.classification;
  if (classification === "CLASS_A") return clinicalRefusal();
  if (classification !== "CLASS_B") return routingFailure();
  return answer();
}
