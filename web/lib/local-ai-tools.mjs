export const TOOLS = [
  ["SearchPatientDocuments", "Search the already-bound patient's documents in Snowflake.", {
    query: { type: "string" }, known_as_of: { type: "string" },
  }, ["query"]],
  ["SearchReferenceDocuments", "Search Snowflake's separate reference-only corpus.", {
    query: { type: "string" }, jurisdiction: { type: "string" },
    effective_date: { type: "string" },
  }, ["query"]],
  ["CohortQuery", "Run the existing governed cohort aggregate in Snowflake.", {
    question: { type: "string" },
  }, ["question"]],
  ["GetPatientFacts", "Read structured facts for the patient already bound in Snowflake.", {
    domain: {
      type: "string",
      enum: ["demographics", "labs", "coverage", "treatment_plan", "encounters", "identity"],
    },
    known_as_of: { type: "string" },
  }, ["domain"]],
  ["CreateReviewTask", "Create an allowed review task for a SQL-returned rule on this patient.", {
    rule_id: { type: "string" },
    action: { type: "string", enum: ["escalate", "close", "reassign", "request_document"] },
  }, ["rule_id", "action"]],
  ["GetReadiness", "Read SQL-derived readiness gates for the patient already bound in Snowflake.", {
    known_as_of: { type: "string" },
  }, []],
  ["GetTimeline", "Read the timeline for the patient already bound in Snowflake.", {
    known_as_of: { type: "string" },
  }, []],
  ["GetChanges", "Compare two as-of timestamps for the already-bound patient.", {
    from_ts: { type: "string" }, to_ts: { type: "string" },
  }, ["from_ts"]],
].map(([name, description, properties, required]) => ({
  name,
  description,
  arguments: { type: "object", properties, required, additionalProperties: false },
}));

function parseObject(value) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      return { error: "malformed_tool_result" };
    } catch {
      return { error: "malformed_tool_result" };
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? value : { error: "malformed_tool_result" };
}

function firstValue(rows) {
  const row = rows[0];
  if (!row) return { error: "malformed_tool_result" };
  return parseObject(Object.values(row)[0]);
}

function requireString(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("invalid_tool_arguments");
}

function optionalString(value) {
  if (value === undefined || value === null) return null;
  requireString(value);
  return value;
}

async function callProcedure(run, sql, binds = []) {
  try {
    const rows = await run(sql, binds);
    return { ...firstValue(rows), query_id: rows.query_id ?? null };
  } catch {
    return { error: "tool_unavailable" };
  }
}

async function getReadiness(args, run) {
  return callProcedure(run, "CALL SAARTHI.OPERATIONAL.GET_READINESS(?, ?)", [
    null, optionalString(args.known_as_of),
  ]);
}

async function getPatientFacts(args, run) {
  const domains = ["demographics", "labs", "coverage", "treatment_plan", "encounters", "identity"];
  if (!domains.includes(args.domain)) throw new Error("invalid_tool_arguments");
  return callProcedure(run, "CALL SAARTHI.OPERATIONAL.GET_PATIENT_FACTS(?, ?)", [
    args.domain, optionalString(args.known_as_of),
  ]);
}

async function executeRecordTool(name, args, run) {
  if (name === "GetPatientFacts") return getPatientFacts(args, run);
  if (name === "GetReadiness") return getReadiness(args, run);
  if (name === "GetTimeline") {
    return callProcedure(run, "CALL SAARTHI.OPERATIONAL.GET_TIMELINE(?)", [
      optionalString(args.known_as_of),
    ]);
  }
  return callProcedure(run, "CALL SAARTHI.OPERATIONAL.GET_CHANGES(?, ?)", [
    args.from_ts, optionalString(args.to_ts),
  ]);
}

async function executeSearchTool(name, args, run) {
  if (name === "SearchPatientDocuments") {
    requireString(args.query);
    return callProcedure(run, "CALL SAARTHI.OPERATIONAL.SEARCH_PATIENT_DOCUMENTS(?, ?)", [
      args.query, optionalString(args.known_as_of),
    ]);
  }
  if (name === "SearchReferenceDocuments") {
    requireString(args.query);
    return callProcedure(run, "CALL SAARTHI.OPERATIONAL.SEARCH_REFERENCE_DOCUMENTS(?, ?, ?)", [
      args.query, optionalString(args.jurisdiction), optionalString(args.effective_date),
    ]);
  }
  requireString(args.question);
  return callProcedure(run, "CALL SAARTHI.OPERATIONAL.COHORT_QUERY(?)", [args.question]);
}

async function createReviewTask(args, run, patientId) {
  requireString(args.rule_id);
  const actions = ["escalate", "close", "reassign", "request_document"];
  if (!actions.includes(args.action)) throw new Error("invalid_tool_arguments");
  const readiness = await callProcedure(run, "CALL SAARTHI.OPERATIONAL.GET_READINESS(NULL, NULL)");
  if (readiness.error) return readiness;
  const gates = Array.isArray(readiness.gates) ? readiness.gates : [];
  const gate = gates.find((item) => item.rule_id === args.rule_id);
  if (!gate) return { error: "gate_not_found" };
  if (!["fail", "conflicting", "not_evaluated"].includes(gate.outcome)) {
    return { error: "gate_not_actionable" };
  }
  const issueId = `${patientId}:${gate.rule_id}`;
  const labels = { request_document: "Request document", escalate: "Escalate to treating doctor" };
  const label = labels[args.action] ?? args.action;
  const reason = `${label}: ${gate.rule_id}: ${gate.reason ?? gate.outcome}`;
  return callProcedure(run, "CALL SAARTHI.OPERATIONAL.CREATE_REVIEW_TASK(?, ?, ?, ?)", [
    issueId, args.action, reason, `${issueId}:${args.action}`,
  ]);
}

export function validateToolCall(name, input) {
  const args = typeof input === "string" ? JSON.parse(input) : input;
  if (!args || typeof args !== "object" || Array.isArray(args) || "patient_id" in args) {
    throw new Error("patient_selector_forbidden");
  }
  const tool = TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error("unknown_tool");
  for (const key of Object.keys(args)) {
    const property = tool.arguments.properties[key];
    if (!property) throw new Error("invalid_tool_arguments");
    requireString(args[key]);
    if (property.enum && !property.enum.includes(args[key])) {
      throw new Error("invalid_tool_arguments");
    }
  }
  for (const key of tool.arguments.required) requireString(args[key]);
  return args;
}

export async function executeTool(name, input, run, patientId) {
  const args = validateToolCall(name, input);
  if (name === "CreateReviewTask") return createReviewTask(args, run, patientId);
  if (["SearchPatientDocuments", "SearchReferenceDocuments", "CohortQuery"].includes(name)) {
    return executeSearchTool(name, args, run);
  }
  if (["GetPatientFacts", "GetReadiness", "GetTimeline", "GetChanges"].includes(name)) {
    return executeRecordTool(name, args, run);
  }
  throw new Error("unknown_tool");
}
