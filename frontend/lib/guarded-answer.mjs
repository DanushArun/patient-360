import { assertAnswerContract } from './answer-contract.mjs';
import { parseAnswerCandidate } from './answer-candidate.mjs';

/** @param {string} clock @returns {object} */
function emptyTurn(clock) {
  return { text: '', thinking: '', tools: [], tool_results: [], gates: [], suggested: [],
    known_as_of: clock, error: 'answer_validation_unavailable' };
}

/** @param {unknown} value @returns {object} */
function objectValue(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid_answer_object');
  }
  return parsed;
}

/** @param {unknown} value @returns {object} */
export function readGatewayAnswer(value) {
  const artifact = objectValue(value);
  if (artifact.error) {
    const allowed = new Set(['access_withdrawn', 'access_scope_changed', 'no_patient_access', 'no_patient_bound',
      'classification_unavailable', 'answer_validation_unavailable',
      'treating_practitioner_unavailable', 'agent_unreachable', 'invalid_argument']);
    throw new Error(allowed.has(artifact.error) ? artifact.error : 'answer_unavailable');
  }
  assertAnswerContract(artifact);
  return { ...emptyTurn(artifact.known_as_of), error: null, artifact,
    text: artifact.classification === 'CLASS_A' ? artifact.refusal.message
      : artifact.claims.map(claim => claim.text).join('\n\n') };
}

/** @param {object} candidate @param {Function} run @param {string} clock @returns {Promise<object>} */
export async function guardAnswer(candidate, run, clock) {
  const turn = emptyTurn(clock);
  try {
    if (candidate.error || typeof candidate.text !== 'string') return turn;
    const proposed = parseAnswerCandidate(candidate.text);
    const rows = await run(
      'CALL SAARTHI.OPERATIONAL.VALIDATE_ANSWER(PARSE_JSON(?), ?)',
      [JSON.stringify(proposed.claims), clock],
    );
    const checked = objectValue(Object.values(rows[0] ?? {})[0]);
    if (checked.error || checked.known_as_of !== clock) return turn;
    const artifact = { classification: 'CLASS_B', claims: checked.claims,
      known_as_of: clock, overall_status: checked.overall_status,
      limitations: checked.limitations?.length
        ? ['Some proposed claims could not be verified and were withheld.'] : [] };
    assertAnswerContract(artifact);
    return { ...turn, error: null, artifact,
      text: artifact.claims.map((claim) => claim.text).join('\n\n') };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return turn;
  }
}
