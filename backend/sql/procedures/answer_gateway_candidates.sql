-- Parses only DATA_AGENT_RUN text blocks; thinking/tool payloads never become answer prose.
-- Response shape: docs.snowflake.com/en/sql-reference/functions/data_agent_run-snowflake-cortex
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.ANSWER_GATEWAY_CANDIDATES(PAYLOAD VARIANT)
RETURNS VARIANT LANGUAGE JAVASCRIPT EXECUTE AS OWNER AS
$$
/** @param {unknown} value @returns {boolean} */
function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** @param {object} value @param {string[]} allowed @returns {boolean} */
function keys(value, allowed) {
    return Object.keys(value).every(key => allowed.includes(key));
}
/** @param {unknown} evidence @returns {object} */
function citation(evidence) {
    if (!object(evidence) || !keys(evidence, ['kind','id'])
        || !['structured', 'document_span', 'reference_clause'].includes(evidence.kind)
        || typeof evidence.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(evidence.id)) {
        throw new Error('invalid_candidate');
    }
    return {kind: evidence.kind, id: evidence.id};
}
/** @param {unknown} claim @returns {object} */
function typedClaim(claim) {
    if (!object(claim) || !keys(claim, ['text','claim_type','asserted_value','evidence'])
        || typeof claim.text !== 'string' || !claim.text.trim()
        || claim.text.length > 4000
        || !['numeric','date','status','textual'].includes(claim.claim_type)
        || !Array.isArray(claim.evidence) || claim.evidence.length !== 1) {
        throw new Error('invalid_candidate');
    }
    if (claim.asserted_value !== undefined && claim.asserted_value !== null
        && !['string','number'].includes(typeof claim.asserted_value)) {
        throw new Error('invalid_candidate');
    }
    if (claim.claim_type === 'numeric' && (typeof claim.asserted_value !== 'number'
        || !Number.isFinite(claim.asserted_value))) throw new Error('invalid_candidate');
    if (['date','status'].includes(claim.claim_type)
        && (typeof claim.asserted_value !== 'string' || !claim.asserted_value.trim())) {
        throw new Error('invalid_candidate');
    }
    if (claim.claim_type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(claim.asserted_value)
        || !Number.isFinite(Date.parse(claim.asserted_value))
        || new Date(claim.asserted_value).toISOString().slice(0,10) !== claim.asserted_value)) {
        throw new Error('invalid_candidate');
    }
    const result = {text: claim.text, claim_type: claim.claim_type,
        evidence: claim.evidence.map(citation)};
    if (result.evidence[0].kind === 'reference_clause' && claim.claim_type !== 'textual') {
        throw new Error('invalid_candidate');
    }
    if (claim.claim_type !== 'textual') result.asserted_value = claim.asserted_value;
    return result;
}
/** @param {unknown} payload @returns {object} */
function parse(payload) {
    if (!object(payload) || !Array.isArray(payload.content)) return {error: 'invalid_candidate'};
    const text = payload.content.filter(item => object(item) && item.type === 'text'
        && typeof item.text === 'string').map(item => item.text).join('\n').trim();
    if (text.length > 64000) return {error: 'invalid_candidate'};
    const json = text.replace(/^```(?:json)?\s*|\s*```$/g, '');
    if (json.startsWith('{') || json.startsWith('[') || text.startsWith('```')) {
        const proposed = JSON.parse(json);
        if (!object(proposed) || !keys(proposed, ['claims'])
            || !Array.isArray(proposed.claims) || proposed.claims.length > 16) {
            return {error: 'invalid_candidate'};
        }
        return {mode: 'typed', claims: proposed.claims.map(typedClaim)};
    }
    const tokens = text.match(/[A-Za-z0-9_-]+/g) || [];
    const prefixed = /^(?:CE|EVT|AST|AS|ASSERT)-[A-Za-z0-9_-]+$/;
    const rowId = /^ROW-(?:PATIENT|COVERAGE|PLAN|ENCOUNTER|IDENTITY)--[A-Za-z0-9_-]+$/;
    const ruleId = /^RULE--[A-Za-z0-9_-]+--[A-Za-z0-9_-]+--[1-9][0-9]*$/;
    const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
    const ids = [...new Set(tokens.filter(id => id.length <= 128
        && (prefixed.test(id) || uuid.test(id) || rowId.test(id) || ruleId.test(id))))];
    return ids.length > 128 ? {error: 'invalid_candidate'} : {mode: 'legacy', ids: ids};
}
try { return parse(PAYLOAD); }
catch (error) {
    if (!(error instanceof Error)) throw error;
    return {error: 'invalid_candidate'};
}
$$;
