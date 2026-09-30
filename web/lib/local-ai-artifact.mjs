import { isDeepStrictEqual } from "node:util";

const evidenceSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["structured", "document_span"] },
    id: { type: "string" },
    table: { type: "string" },
    doc_id: { type: "string" },
    page_index: { type: "integer" },
    char_start: { type: "integer" },
    char_end: { type: "integer" },
    verification_status: { type: "string" },
    derived: { type: "string" },
    event_time: { type: "string" },
    source_recorded_at: { type: "string" },
    source_facility: { type: "string" },
    source_quality: { type: "string" },
  },
  required: ["kind", "id"],
  additionalProperties: false,
};

export const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    claims: { type: "array", maxItems: 5, items: {
      type: "object",
      properties: {
        text: { type: "string", maxLength: 400 },
        claim_type: { type: "string", enum: ["numeric", "date", "status", "textual"] },
        asserted_value: { type: ["number", "string", "null"] },
        asserted_unit: { type: ["string", "null"] },
        evidence: { type: "array", minItems: 1, items: evidenceSchema },
      },
      required: ["text", "claim_type", "evidence"],
      additionalProperties: false,
    } },
  },
  required: ["claims"],
  additionalProperties: false,
};

export function sourceIds(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(sourceIds);
  return Object.entries(value).flatMap(([key, item]) => {
    if (["event_id", "assertion_id"].includes(key) &&
        typeof item === "string") return [item];
    if (key === "evidence_ids" && Array.isArray(item)) {
      return item.filter((id) => typeof id === "string");
    }
    return sourceIds(item);
  });
}

function eligibleClaim(claim, ids) {
  if (!claim || typeof claim !== "object" || typeof claim.text !== "string" ||
      !claim.text.trim() || claim.text.length > 400 || !Array.isArray(claim.evidence) ||
      !claim.evidence.length) return false;
  if (!["numeric", "date", "status", "textual"].includes(claim.claim_type)) return false;
  if (claim.claim_type !== "textual" && claim.asserted_value == null) return false;
  return claim.evidence.every((evidence) => evidence && ids.has(evidence.id) &&
    ["structured", "document_span"].includes(evidence.kind));
}

function structuredFacts(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(structuredFacts);
  if (typeof value.event_id === "string") return [value];
  return Object.values(value).flatMap(structuredFacts);
}

function canonicalClaim(claim, results) {
  if (!Array.isArray(claim?.evidence) || claim.evidence.length !== 1) return null;
  const evidence = claim.evidence[0];
  if (evidence.kind !== "structured") return claim;
  const fact = structuredFacts(results).find((item) => item.event_id === evidence.id);
  if (!fact || !fact.event_time || !fact.source_recorded_at) return null;
  const value = typeof fact.value === "number" ? fact.value : fact.value_text;
  if (typeof value !== "number" && typeof value !== "string") return null;
  return {
    text: `${fact.concept ?? "Recorded fact"}: ${value}`,
    claim_type: typeof value === "number" ? "numeric" : "status",
    asserted_value: value,
    evidence: [{ kind: "structured", id: evidence.id, table: "DT_HARMONIZED_EVENTS",
      event_time: fact.event_time, source_recorded_at: fact.source_recorded_at,
      ...(fact.ingested_at ? { ingested_at: fact.ingested_at } : {}),
      ...(fact.is_derived && fact.derivation ? { derived: fact.derivation } : {}),
    }],
  };
}

function parseValidation(rows) {
  const value = Object.values(rows[0] ?? {})[0];
  const result = typeof value === "string" ? JSON.parse(value) : value;
  if (!result || !Array.isArray(result.claims) || !Array.isArray(result.limitations)) {
    throw new Error("malformed_validation_result");
  }
  return result;
}

export async function validateClaims(input, context) {
  const { results, run, knownAsOf } = context;
  const ids = new Set(sourceIds(results));
  const candidates = Array.isArray(input.claims) ? input.claims.slice(0, 5) : [];
  const claims = candidates.map((claim) => canonicalClaim(claim, results));
  const eligible = claims.filter((claim) => eligibleClaim(claim, ids));
  const limitations = eligible.length === claims.length ? [] : ["unsupported_claim_stripped"];
  if (!Array.isArray(input.claims)) limitations.push("unstructured_answer_stripped");
  if (!eligible.length) return { claims: [], limitations };
  if (!knownAsOf) return { claims: [], limitations: [...limitations, "answer_as_of_unavailable"] };
  try {
    const rows = await run("CALL SAARTHI.OPERATIONAL.VALIDATE_ANSWER(PARSE_JSON(?), ?)", [
      JSON.stringify(eligible), knownAsOf,
    ]);
    const validated = parseValidation(rows);
    const approved = validated.claims.filter((claim) =>
      eligible.some((candidate) => isDeepStrictEqual(candidate, claim)));
    return { claims: approved, limitations: [...limitations, ...validated.limitations] };
  } catch {
    return { claims: [], limitations: [...limitations, "answer_validation_unavailable"] };
  }
}

function toolSummary({ name, result }) {
  if (name === "CreateReviewTask" && typeof result.task_id === "string") {
    return `Review task: ${result.task_id}${result.idempotent_replay ? " (existing task)" : ""}`;
  }
  if (!Array.isArray(result.gates)) return [];
  return result.gates.map((gate) =>
    `${gate.rule_id ?? gate.gate}: ${gate.outcome}. ${gate.reason ?? ""}`.trim());
}

export function buildArtifact(validated, results, turn) {
  const limitations = [...validated.limitations];
  if (!turn.known_as_of) limitations.push("answer_as_of_unavailable");
  const citations = validated.claims.map((claim) =>
    `${claim.text} (${claim.evidence.map(({ id }) => id).join(", ")})`);
  const summaries = results.flatMap(toolSummary);
  if (!citations.length && !summaries.length) {
    limitations.push("No verified answer claims returned.");
  }
  turn.artifact = {
    classification: "CLASS_B", claims: validated.claims, limitations,
    overall_status: limitations.length ? "partial" : "supported",
    known_as_of: turn.known_as_of,
    binding_id: results.find(({ result }) => result.binding_id)?.result.binding_id ?? null,
    rule_versions: Object.fromEntries(turn.gates.filter((gate) => gate.rule_version)
      .map((gate) => [gate.rule_id, gate.rule_version])),
  };
  turn.tool_results = results;
  turn.text = [...citations, ...summaries, ...limitations].join("\n");
}
