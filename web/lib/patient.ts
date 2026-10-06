import { cachedRead, invalidatePatient } from "./read-cache";
import { humanizeClocks } from "./display-format.mjs";
import { withPatientSession, withPatientSessionAndContext, procedureRows, procedureValue } from "./snowflake";
import { readGatewayAnswer, guardAnswer } from "./guarded-answer.mjs";
import { routeQuestion } from "./question-routing.mjs";
import { randomUUID } from "node:crypto";
import { deriveValueState } from "./workspace-patient-facts.mjs";
import { confirmWriteReceipt } from "./write-receipts.mjs";

// Both providers ask Snowflake to classify before inference. Patient scope
// comes from the bound request session, never from model-produced selectors.
// Candidate prose stays server-side; only the SQL validator's canonical claims leave this module.

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
  /** Exact verified-assertion page spans for citations that are document assertions. */
  source_spans?: unknown[];
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
  event_type?: string | null;
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

export function loadPatientSnapshot(patientId: string): Promise<PatientData> {
  return cachedRead(patientId, `snapshot`, () => loadPatientSnapshotUncached(patientId));
}

async function loadPatientSnapshotUncached(patientId: string): Promise<PatientData> {
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
  try {
    return await refreshPatientUncached(patientId);
  } finally {
    invalidatePatient(patientId);
  }
}

async function refreshPatientUncached(patientId: string): Promise<PatientData> {
  return withPatientSessionAndContext(patientId, async (run, context) => {
    const result = procedureValue(await run("CALL SAARTHI.OPERATIONAL.REFRESH_BOUND_READINESS()"));
    if (!Array.isArray(result.gates) || typeof result.known_as_of !== "string") throw new Error("readiness_unavailable");
    return { ...context, knownAsOf: result.known_as_of, gates: result.gates as Gate[] };
  });
}

export function loadTaskOwners(patientId: string) {
  return cachedRead(patientId, `owners`, () => loadTaskOwnersUncached(patientId));
}

async function loadTaskOwnersUncached(patientId: string) {
  return withPatientSession(patientId, async run => procedureRows(await run(
    "CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA('owners',NULL)"
  )).map(row => ({ id: String(row.PRACTITIONER_ID), name: String(row.NAME) })));
}

export async function transitionReviewTask(patientId: string, taskId: string,
  action: string, ownerId: string | null, reason: string, version: number, requestId: string) {
  try {
    return await transitionReviewTaskUncached(patientId, taskId, action, ownerId, reason, version, requestId);
  } finally {
    invalidatePatient(patientId);
  }
}

async function transitionReviewTaskUncached(patientId: string, taskId: string,
  action: string, ownerId: string | null, reason: string, version: number, requestId: string) {
  return withPatientSession(patientId, async run => {
    const receipt = procedureValue(await run(
      "CALL SAARTHI.OPERATIONAL.UPDATE_WEB_REVIEW_TASK(?,?,?,?,?,?)",
      [taskId, action, ownerId, reason, version, requestId]
    ));
    // The write is only reported saved once the task is read back from Snowflake. A replay
    // carries no version, so it is confirmed on identity alone.
    return confirmWriteReceipt({
      receipt, idKey: "task_id",
      readBack: async () => procedureRows(await run(
        "CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA('tasks',?)", [taskId])),
      matches: (row) => row.TASK_ID === receipt.task_id && row.IS_EVENT !== true
        && (receipt.version === undefined || Number(row.ISSUE_VERSION) === receipt.version),
    });
  });
}

export function loadPatientTimeline(patientId: string): Promise<PatientTimeline> {
  return cachedRead(patientId, `timeline`, () => loadPatientTimelineUncached(patientId));
}

async function loadPatientTimelineUncached(patientId: string): Promise<PatientTimeline> {
  return withPatientSession(patientId, async (run) => {
    const rows = await run("CALL SAARTHI.OPERATIONAL.GET_TIMELINE(NULL)");
    const result = parseValue(Object.values(rows[0] ?? {})[0]);
    if (result.error) throw new Error(String(result.error));
    if (!Array.isArray(result.timeline) || typeof result.known_as_of !== "string") {
      throw new Error("timeline_unavailable");
    }
    const ids = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
    const text = (value: unknown): string | null =>
      typeof value === "string" && value.trim() ? value : null;
    const timeline = result.timeline.map((raw): TimelineEvent => {
      const event = parseValue(raw);
      return {
        // The SQL coalesces concept, display and code; the event type is the last honest label.
        concept: text(event.concept) ?? text(event.display) ?? text(event.code)
          ?? (text(event.event_type) ? String(event.event_type).replace(/_/g, " ") : "Unlabelled event"),
        event_type: text(event.event_type),
        value: typeof event.value === "number" ? event.value : null,
        value_text: text(event.value_text),
        unit: text(event.unit),
        abnormal_flag: text(event.abnormal_flag),
        // R3: never default a missing state to a negative claim; derive it from the value.
        value_state: deriveValueState(event.value_state,
          typeof event.value === "number" ? event.value : null, event.value_text),
        is_derived: event.is_derived === true,
        derivation: text(event.derivation),
        valid_until: text(event.valid_until),
        event_time: String(event.event_time ?? ""),
        source_recorded_at: String(event.source_recorded_at ?? ""),
        ingested_at: String(event.ingested_at ?? ""),
        event_id: String(event.event_id ?? ""),
        source_event_ids: ids(event.source_event_ids),
        source_assertion_ids: ids(event.source_assertion_ids),
        source_document_ids: ids(event.source_document_ids),
        source_links_observed_at: text(event.source_links_observed_at),
      };
    });
    return {
      timeline,
      known_as_of: result.known_as_of,
      ...(typeof result.provenance_observed_at === "string"
        ? { provenance_observed_at: result.provenance_observed_at } : {}),
      ...(typeof result.total_events === "number" ? { total_events: result.total_events } : {}),
      ...(typeof result.timeline_limit === "number" ? { timeline_limit: result.timeline_limit } : {}),
      ...(typeof result.truncated === "boolean" ? { truncated: result.truncated } : {}),
    };
  });
}

export function loadReviewTasks(patientId: string, ruleId: string): Promise<ReviewTask[]> {
  return cachedRead(patientId, `tasks:${ruleId}`, () => loadReviewTasksUncached(patientId, ruleId));
}

async function loadReviewTasksUncached(patientId: string, ruleId: string): Promise<ReviewTask[]> {
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
  const spans = parseValue(row.SOURCE_SPANS);
  const gate: Gate = {
    gate: String(row.GATE),
    rule_id: String(row.RULE_ID),
    rule_version: Number(row.RULE_VERSION),
    outcome,
    reason: typeof row.REASON === "string" ? humanizeClocks(row.REASON) : undefined,
    severity: typeof row.SEVERITY === "string" ? row.SEVERITY : undefined,
    evidence_ids: Array.isArray(evidence) ? evidence.map(String) : [],
    ...(Array.isArray(spans) ? { source_spans: spans } : {}),
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
  rule_id?: string;
  rule_version?: number;
  outcome?: "pass" | "fail" | "not_evaluated" | "conflicting";
  provenance_note?: string;
  evidence: {
    kind: "structured" | "document_span" | "reference_clause";
    id: string;
    doc_id?: string;
    table?: string;
    event_time?: string;
    source_recorded_at?: string;
    ingested_at?: string;
    page_index?: number;
    derived?: string;
    publisher?: string;
    document_title?: string;
    version?: string;
    effective_date?: string;
    jurisdiction?: string;
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

/** Real request phases, in order, reported to the copilot's progress display. */
export type AskPhase = "access" | "routing" | "refusing" | "reading" | "validating" | "saving";

export async function askPatient(patientId: string, question: string,
  onPhase: (phase: AskPhase) => void = () => {}): Promise<AgentTurn> {
  try {
    return await askPatientUncached(patientId, question, onPhase);
  } finally {
    invalidatePatient(patientId);
  }
}

async function askPatientUncached(patientId: string, question: string,
  onPhase: (phase: AskPhase) => void = () => {}): Promise<AgentTurn> {
  onPhase("access");
  return withPatientSessionAndContext(patientId, async (run) => {
    const turn: AgentTurn = await routeQuestion(question, run, async (clock: string) => {
      onPhase("reading");
      const rows = await run("CALL SAARTHI.OPERATIONAL.ASK_SAARTHI(?)", [question]);
      const payload = parseValue(Object.values(rows[0] ?? {})[0]);
      if (payload.classification || payload.error) return readGatewayAnswer(payload);
      onPhase("validating");
      return guardAnswer(parseAgentResponse(payload), run, clock);
    }, (phase: string) => onPhase(phase as AskPhase));
    onPhase("saving");
    try {
      const record = procedureValue(await run("CALL SAARTHI.OPERATIONAL.RECORD_WEB_ANSWER(?,?,PARSE_JSON(?)::ARRAY,?,?)", [
        question, turn.known_as_of, JSON.stringify([...new Set(
          turn.artifact?.claims.flatMap((claim) => claim.evidence.map((item) => item.id)) ?? [],
        )].slice(0, 100)),
        randomUUID(), turn.error ? "error" : "recorded",
      ]));
      turn.run_id = String(record.run_id); turn.history_saved = true;
    } catch { turn.history_saved = false; }
    return turn;
  });
}

export function loadEvidenceHistory(patientId: string) {
  return cachedRead(patientId, `evidence`, () => loadEvidenceHistoryUncached(patientId));
}

async function loadEvidenceHistoryUncached(patientId: string) {
  return withPatientSession(patientId, async run => ({
    answers: procedureRows(await run("CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA('answers',NULL)")),
    packets: procedureRows(await run("CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA('packets',NULL)")),
  }));
}

export async function prepareEvidencePacket(patientId: string, question: string, packetId: string) {
  try {
    return await prepareEvidencePacketUncached(patientId, question, packetId);
  } finally {
    invalidatePatient(patientId);
  }
}

async function prepareEvidencePacketUncached(patientId: string, question: string, packetId: string) {
  return withPatientSession(patientId, async run => {
    const receipt = procedureValue(await run(
      "CALL SAARTHI.OPERATIONAL.PREPARE_WEB_PACKET(?,?)", [question, packetId]
    ));
    return confirmWriteReceipt({
      receipt, idKey: "packet_id",
      readBack: async () => procedureRows(await run(
        "CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA('packets',?)", [String(receipt.packet_id ?? "")])),
      matches: (row) => row.PACKET_ID === receipt.packet_id,
    });
  });
}

export type ReviewTaskReceipt = {
  task_id?: string; state?: string; idempotent_replay?: boolean;
  read_back_confirmed?: true; error?: string;
};

export async function createReviewTask(
  patientId: string,
  ruleId: string,
  action: "request_document" | "escalate",
  requestId?: string,
): Promise<ReviewTaskReceipt> {
  try {
    return await createReviewTaskUncached(patientId, ruleId, action, requestId);
  } finally {
    invalidatePatient(patientId);
  }
}

async function createReviewTaskUncached(
  patientId: string,
  ruleId: string,
  action: "request_document" | "escalate",
  requestId?: string,
): Promise<ReviewTaskReceipt> {
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
    // One key per click attempt (the client keeps it across retries of that attempt and mints a
    // new one after a confirmed save). The old constant `${issue}:${action}` key replayed a
    // resolved task as "success" forever. De-duplication of still-open tasks is done in SQL.
    const key = `${issueId}:${action}:${requestId ?? randomUUID()}`;
    const rows = await run(
      "CALL SAARTHI.OPERATIONAL.CREATE_REVIEW_TASK(?, ?, ?, ?)",
      [issueId, action, reason, key]
    );
    const receipt = parseValue(Object.values(rows[0] ?? {})[0]) as ReviewTaskReceipt;
    if (receipt.error) return receipt;
    let state: string | undefined;
    const confirmed = await confirmWriteReceipt({
      receipt: receipt as Record<string, unknown>, idKey: "task_id",
      readBack: async () => procedureRows(await run(
        "CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA('tasks',?)", [ruleId])),
      matches: (row) => {
        if (row.TASK_ID !== receipt.task_id || row.IS_EVENT === true) return false;
        state = typeof row.STATE === "string" ? row.STATE : undefined;
        return true;
      },
    });
    return { ...confirmed, ...(state ? { state } : {}) } as ReviewTaskReceipt;
  });
}
