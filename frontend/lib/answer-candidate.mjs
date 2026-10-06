import Ajv2020 from 'ajv/dist/2020.js';

const evidence = { type: 'object', additionalProperties: false,
  required: ['kind', 'id'], properties: {
    kind: { enum: ['structured', 'document_span', 'reference_clause'] },
    id: { type: 'string', minLength: 1, maxLength: 160 },
  } };
const schema = { type: 'object', additionalProperties: false, required: ['claims'],
  properties: { claims: { type: 'array', maxItems: 16, items: {
    type: 'object', additionalProperties: false, required: ['text', 'claim_type', 'evidence'],
    properties: {
      text: { type: 'string', minLength: 1, maxLength: 4000 },
      claim_type: { enum: ['numeric', 'date', 'status', 'textual'] },
      asserted_value: { type: ['number', 'string', 'null'] },
      evidence: { type: 'array', minItems: 1, maxItems: 1, items: evidence },
    },
  } } } };
const validate = new Ajv2020({ strict: true, allowUnionTypes: true }).compile(schema);

/** @param {string} text @returns {{claims: object[]}} */
export function parseAnswerCandidate(text) {
  if (typeof text !== 'string' || text.length > 64000) {
    throw new Error('answer_candidate_invalid');
  }
  const body = text.trim().replace(/^```json\s*|\s*```$/g, '');
  if (/^[{[]/.test(body)) {
    const candidate = JSON.parse(body);
    if (!validate(candidate) || candidate.claims.some(claim =>
      claim.evidence[0].kind === 'reference_clause' && claim.claim_type !== 'textual')) {
      throw new Error('answer_candidate_invalid');
    }
    return candidate;
  }
  const ids = [...new Set(body.match(/\bEVT-[A-Z0-9]+(?:-[A-Z0-9]+)+\b/g) ?? [])];
  if (!ids.length || ids.length > 16) throw new Error('answer_candidate_uncited');
  return { claims: ids.map(id => ({ text: 'Recorded evidence', claim_type: 'textual',
    evidence: [{ kind: 'structured', id }] })) };
}
