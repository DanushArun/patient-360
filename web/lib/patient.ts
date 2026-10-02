import { withPatientSession, withPatientSessionAndContext, procedureRows, procedureValue } from "./snowflake";
import { askLocalModel, completeWithOllama } from "./local-ai.mjs";
import { routeQuestion } from "./question-routing.mjs";
import { sourceIds } from "./local-ai-artifact.mjs";
import { randomUUID } from "node:crypto";

// Both providers ask Snowflake to classify before inference. Patient scope
// comes from the bound request session, never from model-produced selectors.
// ASK_SAARTHI is currently a thin entry point; its unmerged guard is deferred.

export type Gate = {
  gate: string;
  outcome: "pass" | "fail" | "not_evaluated" | "conflicting";
  rule_id?: string;
  rule_version?: number;
  severity?: string;
  reason?: string;
  evidence_ids?: string[];
  derived?: string;
  provenance_note?: string;
  known_as_of?: string;
};

export type PatientData = {
  patientId: string;
  patientName: string;
  consentId: string | null;
  practitionerName: string;
  treatingPractitionerName?: string | null;
  language: string | null;
  nextVisit: string | null;
  scheduledAt: string | null;
  cycleNumber: number | null;
  regimen: string | null;
  knownAsOf: string | null;
  gates: Gate[];
};

export type TimelineEvent = {
  concept: string;
  value: number | null;
  is_derived: boolean;
  value_state?: string;
  value_text?: string | null;
  unit?: string | null;
  derivation?: string | null;
  abnormal_flag?: string | null;
  valid_until?: string | null;
  source_event_ids?: string[];
  source_assertion_ids?: string[];
  source_document_ids?: string[];
  source_links_observed_at?: string | null;
  event_time: string;
  source_recorded_at: string;
  ingested_at: string;
  event_id: string;
};

export type PatientTimeline = {
  timeline: TimelineEvent[];
  known_as_of: string;
  provenance_observed_at?: string;
  total_events?: number;
  timeline_limit?: number;
  truncated?: boolean;
};

export type ReviewTask = {
  taskId: string;
  issueId: string;
  owner: string;
  state: string;
  action: string;
  reason: string;
  createdAt: string;
  ownerId: string | null;
  issueVersion: number;
  isEvent: boolean;
  actor: string;
};

function parseValue(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export async function loadPatientSnapshot(patientId: string): Promise<PatientData> {
  return withPatientSessionAndContext(patientId, async (run, context) => {
    const rows = procedureRows(await run("CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA('snapshot',NULL)"));
    const gates = rows.map(snapshotGate).sort((a,b) => a.gate.localeCompare(b.gate) || (a.rule_id ?? "").localeCompare(b.rule_id ?? ""));
    const knownAsOf = gates[0]?.known_as_of ?? null;
    if (gates.some((gate) => !gate.known_as_of)) {
      throw new Error("readiness_snapshot_missing_as_of");
    }
    return {
      ...context,
      knownAsOf,
      gates,
    };
  });
}

export async function refreshPatient(patientId: string): Promise<PatientData> {
  return withPatientSessionAndContext(patientId, async (run, context) => {
    const result = procedureValue(await run("CALL SAARTHI.OPERATIONAL.REFRESH_BOUND_READINESS()"));
    if (!Array.isArray(result.gates) || typeof result.known_as_of !== "string") throw new Error("readiness_unavailable");
    return { ...context, knownAsOf: result.known_as_of, gates: result.gates as Gate[] };
  });
}

export async function loadTaskOwners(patientId: string) {
  return withPatientSession(patientId, async run => procedureRows(await run(
    "CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA('owners',NULL)"
  )).map(row => ({ id: String(row.PRACTITIONER_ID), name: String(row.NAME) })));
}

export async function transitionReviewTask(patientId: string, taskId: string,
  action: string, ownerId: string | null, reason: string, version: number, requestId: string) {
  return withPatientSession(patientId, async run => procedureValue(await run(
    "CALL SAARTHI.OPERATIONAL.UPDATE_WEB_REVIEW_TASK(?,?,?,?,?,?)",
    [taskId, action, ownerId, reason, version, requestId]
  )));
}

export async function loadPatientTimeline(patientId: string): Promise<PatientTimeline> {
  return withPatientSession(patientId, async (run) => {
    const rows = await run("CALL SAARTHI.OPERATIONAL.GET_TIMELINE(NULL)");
    const result = parseValue(Object.values(rows[0] ?? {})[0]);
    if (result.error) throw new Error(String(result.error));
    if (!Array.isArray(result.timeline) || typeof result.known_as_of !== "string") {
      throw new Error("timeline_unavailable");
    }
    const timeline = result.timeline.map((raw): TimelineEvent => {
      const event = parseValue(raw);
      return {
        concept: String(event.concept ?? "Unlabelled event"),
        value: typeof event.value === "number" ? event.value : null,
        is_derived: event.is_derived === true,
        event_time: String(event.event_time ?? ""),
        source_recorded_at: String(event.source_recorded_at ?? ""),
        ingested_at: String(event.ingested_at ?? ""),
        event_id: String(event.event_id ?? ""),
      };
    });
    return { timeline, known_as_of: result.known_as_of };
  });
}

export async function loadReviewTasks(patientId: string, ruleId: string): Promise<ReviewTask[]> {
  return withPatientSession(patientId, async (run) => {
    const rows = procedureRows(await run("CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA('tasks',?)", [ruleId]));
    return rows.map((row) => ({
      taskId: String(row.TASK_ID), issueId: String(row.ISSUE_ID),
      owner: String(row.OWNER ?? "Unassigned"), state: String(row.STATE ?? "unknown"),
      action: String(row.DECISION ?? "unknown"), reason: String(row.REASON ?? ""),
      createdAt: String(row.CREATED_AT ?? ""),
      ownerId: row.OWNER_PRACTITIONER_ID ? String(row.OWNER_PRACTITIONER_ID) : null,
      issueVersion: Number(row.ISSUE_VERSION ?? 0), isEvent: row.IS_EVENT === true,
      actor: String(row.ACTOR ?? row.ACTOR_PRACTITIONER_ID ?? ""),
    })).sort((a,b) => b.createdAt.localeCompare(a.createdAt) || a.taskId.localeCompare(b.taskId));
  });
}

function snapshotGate(row: Record<string, unknown>): Gate {
  const outcome = String(row.OUTCOME) as Gate["outcome"];
  if (!(["pass", "fail", "not_evaluated", "conflicting"] as string[]).includes(outcome)) {
    throw new Error("readiness_snapshot_invalid_outcome");
  }
  const evidence = parseValue(row.EVIDENCE_IDS);
  const gate: Gate = {
    gate: String(row.GATE),
    rule_id: String(row.RULE_ID),
    rule_version: Number(row.RULE_VERSION),
    outcome,
    reason: typeof row.REASON === "string" ? row.REASON : undefined,
    severity: typeof row.SEVERITY === "string" ? row.SEVERITY : undefined,
    evidence_ids: Array.isArray(evidence) ? evidence.map(String) : [],
    known_as_of: typeof row.KNOWN_AS_OF === "string" ? row.KNOWN_AS_OF : undefined,
  };
  if (!gate.known_as_of) throw new Error("readiness_snapshot_missing_as_of");
  return gate;
}

export type AgentTurn = {
  run_id?: string;
  history_saved?: boolean;
  text: string;
  thinking: string;
  tools: { name: string; query_id: string | null; took_patient_id: boolean }[];
  suggested: string[];
  gates: Gate[];
  known_as_of: string | null;
  error: string | null;
  artifact?: AnswerArtifact;
  tool_results?: { name: string; result: Record<string, unknown> }[];
};

export type AnswerArtifact = {
  classification: "CLASS_A" | "CLASS_B";
  claims: AnswerClaim[];
  limitations: string[];
  overall_status: "supported" | "partial" | "refused";
  known_as_of: string | null;
  binding_id?: string | null;
  consent_id?: string | null;
  refusal?: {
    reason_code: "class_a_clinical_judgment";
    message: string;
    practitioner: { practitioner_id: string; name: string; nmc_registration_no: string };
    evidence_packet_offered?: boolean;
    evidence_packet_id?: string | null;
  };
  rule_versions?: Record<string, number>;
};

export type AnswerClaim = {
  text: string;
  claim_type: "numeric" | "date" | "status" | "textual";
  asserted_value?: number | string | null;
  evidence: {
    kind: "structured" | "document_span";
    id: string;
    doc_id?: string;
    page_index?: number;
    derived?: string;
  }[];
};

export function parseAgentResponse(input: unknown): AgentTurn {
  const turn: AgentTurn = {
    text: "", thinking: "", tools: [], suggested: [], gates: [],
    known_as_of: null, error: null,
  };
  const payload = parseValue(input);
  if (payload.code === "399504") {
    turn.error = "ai_features_unavailable";
    return turn;
  }
  if (!Array.isArray(payload.content)) {
    turn.error = "malformed_agent_json";
    return turn;
  }
  const texts: string[] = [];
  for (const raw of payload.content) {
    if (!raw || typeof raw !== "object") continue;
    const block = raw as Record<string, unknown>;
    if (block.type === "text" && typeof block.text === "string") texts.push(block.text);
    if (block.type === "thinking") {
      const thought = parseValue(block.thinking);
      if (typeof thought.text === "string") turn.thinking += thought.text;
    }
    if (block.type === "tool_use") {
      const use = parseValue(block.tool_use);
      const toolInput = parseValue(use.input);
      turn.tools.push({
        name: String(use.name ?? "unknown"), query_id: null,
        took_patient_id: "patient_id" in toolInput,
      });
    }
    if (block.type === "tool_result") {
      const toolResult = parseValue(block.tool_result);
      const name = toolResult.name;
      for (const item of Array.isArray(toolResult.content) ? toolResult.content : []) {
        const content = parseValue(item);
        const body = parseValue(content.json);
        const parsed = parseValue(body.result);
        if (Object.keys(parsed).length) {
          turn.tool_results ??= [];
          turn.tool_results.push({ name: String(name ?? "Tool"), result: parsed });
        }
        const tool = turn.tools.find((candidate) => candidate.name === name && !candidate.query_id);
        if (tool) tool.query_id = typeof body.query_id === "string" ? body.query_id : null;
        if (Array.isArray(parsed.gates)) turn.gates = parsed.gates as Gate[];
        if (typeof parsed.known_as_of === "string") turn.known_as_of = parsed.known_as_of;
      }
    }
    if (block.type === "suggested_queries") {
      turn.suggested = (Array.isArray(block.suggested_queries) ? block.suggested_queries : [])
        .map((item) => parseValue(item).query)
        .filter((query): query is string => typeof query === "string");
    }
  }
  turn.text = texts.join("\n\n").trim();
  if (!turn.text) turn.error = "nothing_found";
  return turn;
}

export async function askPatient(patientId: string, question: string): Promise<AgentTurn> {
  return withPatientSessionAndContext(patientId, async (run) => {
    let turn: AgentTurn;
    if (process.env.SAARTHI_LLM_PROVIDER === "ollama") {
      turn = await askLocalModel(question, patientId, run, completeWithOllama);
    } else {
      turn = await routeQuestion(question, run, async () => {
      const rows = await run("CALL SAARTHI.OPERATIONAL.ASK_SAARTHI(?)", [question]);
      if (!rows[0]) return { ...parseAgentResponse(null), error: "agent_unreachable" };
      return parseAgentResponse(Object.values(rows[0])[0]);
      });
    }
    try {
      const record = procedureValue(await run("CALL SAARTHI.OPERATIONAL.RECORD_WEB_ANSWER(?,?,PARSE_JSON(?)::ARRAY,?,?)", [
        question, turn.known_as_of, JSON.stringify([...new Set(sourceIds(turn.tool_results ?? []))].slice(0,100)),
        randomUUID(), turn.error ? "error" : "recorded",
      ]));
      turn.run_id = String(record.run_id); turn.history_saved = true;
    } catch { turn.history_saved = false; }
    return turn;
  });
}

export async function loadEvidenceHistory(patientId: string) {
  return withPatientSession(patientId, async run => ({
    answers: procedureRows(await run("CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA('answers',NULL)")),
    packets: procedureRows(await run("CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA('packets',NULL)")),
  }));
}

export async function prepareEvidencePacket(patientId: string, question: string, packetId: string) {
  return withPatientSession(patientId, async run => procedureValue(await run(
    "CALL SAARTHI.OPERATIONAL.PREPARE_WEB_PACKET(?,?)", [question, packetId]
  )));
}

export async function createReviewTask(
  patientId: string,
  ruleId: string,
  action: "request_document" | "escalate"
): Promise<{ task_id?: string; idempotent_replay?: boolean; error?: string }> {
  return withPatientSessionAndContext(patientId, async (run) => {
    const readiness = await run("CALL SAARTHI.OPERATIONAL.GET_READINESS(NULL, NULL)");
    const readinessResult = parseValue(Object.values(readiness[0] ?? {})[0]);
    if (readinessResult.error) return { error: String(readinessResult.error) };
    const gate = (Array.isArray(readinessResult.gates) ? readinessResult.gates : [])
      .find((candidate) => candidate.rule_id === ruleId) as Gate | undefined;
    if (!gate) return { error: "gate_not_found" };
    if (!["fail", "conflicting", "not_evaluated"].includes(gate.outcome)) {
      return { error: "gate_not_actionable" };
    }
    const label = action === "request_document"
      ? "Request document" : "Escalate to treating doctor";
    const issueId = `${patientId}:${gate.rule_id || gate.gate}`;
    const reason = `${label} — ${gate.rule_id}: ${gate.reason || gate.outcome}`;
    const rows = await run(
      "CALL SAARTHI.OPERATIONAL.CREATE_REVIEW_TASK(?, ?, ?, ?)",
      [issueId, action, reason, `${issueId}:${action}`]
    );
    return parseValue(Object.values(rows[0] ?? {})[0]) as {
      task_id?: string; idempotent_replay?: boolean; error?: string;
    };
  });
}
