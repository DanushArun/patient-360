import { assertAnswerContract } from './answer-contract.mjs';

const GATE_OUTCOMES = new Set(['pass', 'fail', 'not_evaluated', 'conflicting']);

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @returns {value is string[]} */
function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** @param {Record<string, unknown>} value @returns {boolean} */
function hasValidGateLabels(value) {
  const fields = ['rule_id', 'reason', 'severity', 'known_as_of', 'provenance_note', 'derived'];
  return fields.every((key) => value[key] === undefined || typeof value[key] === 'string');
}

/** @param {unknown} value @returns {boolean} */
function isGate(value) {
  return isRecord(value) && typeof value.gate === 'string'
    && GATE_OUTCOMES.has(value.outcome)
    && hasValidGateLabels(value)
    && (value.rule_version === undefined || (Number.isInteger(value.rule_version)
      && value.rule_version > 0))
    && (value.evidence_ids === undefined || isStringArray(value.evidence_ids));
}

/** @param {unknown} value @returns {boolean} */
function isTool(value) {
  return isRecord(value) && typeof value.name === 'string'
    && (typeof value.query_id === 'string' || value.query_id === null)
    && typeof value.took_patient_id === 'boolean';
}

/** @param {unknown} value @returns {boolean} */
function isArtifact(value) {
  try {
    assertAnswerContract(value);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message === 'answer_contract_invalid') return false;
    throw error;
  }
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function hasTurnIdentity(value) {
  return isRecord(value) && typeof value.id === 'string'
    && (value.role === 'user' || value.role === 'assistant')
    && typeof value.text === 'string'
    && typeof value.thinking === 'string';
}

/** @param {Record<string, unknown>} value @returns {boolean} */
function hasTurnDisplayFields(value) {
  return Array.isArray(value.tools) && value.tools.every(isTool)
    && isStringArray(value.suggested)
    && Array.isArray(value.gates) && value.gates.every(isGate)
    && (typeof value.known_as_of === 'string' || value.known_as_of === null)
    && (typeof value.error === 'string' || value.error === null);
}

/** @param {unknown} value @returns {boolean} */
function isToolResult(value) {
  return isRecord(value) && typeof value.name === 'string' && isRecord(value.result);
}

/** @param {Record<string, unknown>} value @returns {boolean} */
function hasTurnEvidence(value) {
  return (value.artifact === undefined || isArtifact(value.artifact))
    && (value.tool_results === undefined || (Array.isArray(value.tool_results)
      && value.tool_results.every(isToolResult)));
}

/** @param {unknown} value @returns {boolean} */
function isTurn(value) {
  return hasTurnIdentity(value) && hasTurnDisplayFields(value) && hasTurnEvidence(value);
}

/** @param {unknown} value @returns {value is object[]} */
function isTurnArray(value) {
  return Array.isArray(value) && value.every(isTurn);
}

/** @param {{getItem: (key: string) => string | null}} storage @param {string} key
 * @returns {{turns: object[], error?: unknown}} */
export function readStoredTurns(storage, key) {
  try {
    const raw = storage.getItem(key);
    const parsed = JSON.parse(raw ?? '[]');
    if (!isTurnArray(parsed)) {
      return { turns: [], error: new Error('Stored conversation has an invalid shape.') };
    }
    return { turns: parsed };
  } catch (error) {
    return { turns: [], error };
  }
}

/** @param {{setItem: (key: string, value: string) => void}} storage
 * @param {string} key @param {unknown[]} turns @returns {{error?: unknown}} */
export function writeStoredTurns(storage, key, turns) {
  try {
    storage.setItem(key, JSON.stringify(turns));
    return {};
  } catch (error) {
    return { error };
  }
}
