import { withPatientSession, withPatientSessionAndContext } from "./snowflake";
import type { ProfessionalLogin } from "./session-security";

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
  event_time: string;
  source_recorded_at: string;
  ingested_at: string;
  event_id: string;
};

export type PatientTimeline = { timeline: TimelineEvent[]; known_as_of: string };

export type ReviewTask = {
  taskId: string;
  issueId: string;
  owner: string;
  state: string;
  action: string;
  reason: string;
  createdAt: string;
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

export async function loadPatientSnapshot(patientId: string, login: ProfessionalLogin): Promise<PatientData> {
  return loadPatient(patientId, login);
}

export async function loadPatient(patientId: string, login: ProfessionalLogin): Promise<PatientData> {
  return withPatientSessionAndContext(patientId, async (run, context) => {
    const rows = await run("CALL SAARTHI.OPERATIONAL.GET_READINESS(NULL, NULL)");
    const result = parseValue(Object.values(rows[0] ?? {})[0]);
    if (result.error) throw new Error(String(result.error));
    return {
      ...context,
      knownAsOf: typeof result.known_as_of === "string" ? result.known_as_of : null,
      gates: Array.isArray(result.gates) ? result.gates as Gate[] : [],
    };
  }, login);
}

export async function loadPatientTimeline(patientId: string, login: ProfessionalLogin): Promise<PatientTimeline> {
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
  }, login);
}

export async function loadReviewTasks(patientId: string, ruleId: string, login: ProfessionalLogin): Promise<ReviewTask[]> {
  return withPatientSession(patientId, async (run) => {
    const rows = await run("CALL SAARTHI.OPERATIONAL.GET_WEB_REVIEW_TASKS(?)", [ruleId]);
    return rows.map((row) => ({
      taskId: String(row.TASK_ID), issueId: String(row.ISSUE_ID),
      owner: String(row.OWNER ?? "Unassigned"), state: String(row.STATE ?? "unknown"),
      action: String(row.DECISION ?? "unknown"), reason: String(row.REASON ?? ""),
      createdAt: String(row.CREATED_AT ?? ""),
    }));
  }, login);
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
  text: string;
  thinking: string;
  tools: { name: string; query_id: string | null; took_patient_id: boolean }[];
  suggested: string[];
  gates: Gate[];
  known_as_of: string | null;
  error: string | null;
};

export function parseAgentResponse(input: unknown): AgentTurn {
  const turn: AgentTurn = {
    text: "", thinking: "", tools: [], suggested: [], gates: [],
    known_as_of: null, error: null,
  };
  const payload = parseValue(input);
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

export async function askPatient(patientId: string, question: string, login: ProfessionalLogin): Promise<AgentTurn> {
  return withPatientSessionAndContext(patientId, async (run) => {
    const rows = await run("CALL SAARTHI.OPERATIONAL.ASK_SAARTHI(?)", [question]);
    if (!rows[0]) return { ...parseAgentResponse(null), error: "agent_unreachable" };
    return parseAgentResponse(Object.values(rows[0])[0]);
  }, login);
}

export async function createReviewTask(
  patientId: string,
  ruleId: string,
  action: "request_document" | "escalate",
  login: ProfessionalLogin,
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
  }, login);
}
