-- Bounded presentation of SQL tool outputs; no clinical calculations or model judgments.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.ANSWER_GATEWAY_CONTEXT_PACK(
    PACKET VARIANT, KNOWN_AS_OF VARCHAR)
RETURNS VARIANT LANGUAGE JAVASCRIPT EXECUTE AS OWNER AS
$$
var truncated = false;
function bound(value, depth) {
    if (depth > 8) {
        truncated = true;
        return {state: 'unreadable'};
    }
    if (typeof value === 'string') {
        if (value.length > 2000) truncated = true;
        return value.slice(0, 2000);
    }
    if (Array.isArray(value)) {
        if (value.length > 20) truncated = true;
        return value.slice(0, 20).map(function(item) { return bound(item, depth + 1); });
    }
    if (value && typeof value === 'object') {
        var result = Object.create(null);
        var keys = Object.keys(value);
        if (keys.length > 32) truncated = true;
        keys.slice(0, 32).forEach(function(key) { result[key] = bound(value[key], depth + 1); });
        return result;
    }
    return value;
}
function tool(name) {
    var value = PACKET && PACKET[name];
    if (!value || typeof value !== 'object') return {state: 'not_received'};
    if (value.error) return {state: 'unavailable'};
    return bound(value, 0);
}
var result = {
    schema_version: 'saarthi.context.v1', known_as_of: KNOWN_AS_OF,
    access_scope: PACKET && PACKET.access_scope,
    record_facts: {
        labs: tool('labs'), coverage: tool('coverage'), demographics: tool('demographics'),
        treatment_plan: tool('treatment_plan'), encounters: tool('encounters'),
        identity: tool('identity')
    },
    readiness: tool('readiness'), patient_documents: tool('patient_documents'),
    reference_documents: tool('reference_documents'), limitations: []
};
if (truncated) result.limitations.push('Context shortened; use exact evidence IDs for validation.');
if (JSON.stringify(result).length > 64000) {
    return {error: 'context_size_limit', known_as_of: KNOWN_AS_OF};
}
return result;
$$;
