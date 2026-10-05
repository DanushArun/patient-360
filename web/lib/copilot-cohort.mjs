// Cohort questions on the day-care list ("who is blocked today?"), answered deterministically
// from the care-team-scoped census rows. No language model decides anything here (R1): the
// census status comes from versioned SQL rules, and this module only filters and counts it.

const STATUS_WORDS = [
  ["blocked", /\b(block|blocked|blocking|blocker|can'?t be treated|cannot be treated|not ready|on hold)\b/],
  ["conflict", /\b(conflict|conflicts|conflicting|disagree|disagreement|mismatch|discrepan\w*)\b/],
  ["waiting", /\b(wait|waiting|missing|not received|pending|outstanding|awaiting)\b/],
  ["advisory", /\b(advisory|advisories|caution|warning|warnings)\b/],
  ["ready", /\b(ready|cleared|good to go|checks met|all clear)\b/],
];

const TOPICS = [
  ["CLIN-PLT", "platelets", /\b(platelets?|plt)\b/],
  ["CLIN-ANC", "neutrophils (ANC)", /\b(anc|neutrophils?|neutropenia)\b/],
  ["SURV-LVEF", "cardiac function (LVEF)", /\b(lvef|echo\w*|cardiac|heart function)\b/],
  ["COV-", "coverage and pre-authorisation", /\b(pre-?auth\w*|authori[sz]ation|coverage|insurance|pm-?jay|scheme)\b/],
  ["DOC-HER2", "HER2 testing", /\b(her2|fish)\b/],
  ["DOC-PATH", "pathology reports", /\bpatholog\w*\b/],
  ["ENDO-HBA1C", "HbA1c", /\b(hba1c|diabet\w*|glucose)\b/],
  ["ENDO-DEXA", "bone density (DEXA)", /\b(dexa|bone density|t-?score)\b/],
  ["CLIN-CRCL", "renal function (CrCl)", /\b(crcl|creatinine|renal|kidney)\b/],
  ["CLIN-BILI", "liver function", /\b(bilirubin|liver|hepatic|ast)\b/],
];

const OVERVIEW = /\b(who|which|list|show|how many|summary|overview|today|everyone|patients|census|status)\b/;

const STATUS_TITLES = {
  blocked: "Blocked", conflict: "Conflict", waiting: "Waiting on evidence",
  advisory: "Ready with an advisory", ready: "Ready",
};

/**
 * @param {string} question
 * @returns {{kind: "status" | "topic" | "overview" | "unknown",
 *   status: string | null, rulePrefix: string | null, topic: string | null}}
 */
export function matchCohortIntent(question) {
  const text = question.toLowerCase();
  const status = STATUS_WORDS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
  const topic = TOPICS.find(([, , pattern]) => pattern.test(text)) ?? null;
  const kind = topic ? "topic" : status ? "status" : OVERVIEW.test(text) ? "overview" : "unknown";
  return { kind, status, rulePrefix: topic?.[0] ?? null, topic: topic?.[1] ?? null };
}

/**
 * @param {{patientId: string, name: string, status: string, headline: string | null,
 *   headlineRule: string | null, otherIssues: number, scheduled: string}[]} chairs
 * @param {ReturnType<typeof matchCohortIntent>} intent
 */
export function answerCohort(chairs, intent) {
  if (intent.kind === "unknown") {
    return { title: null, rows: [], counts: countByStatus(chairs), basis: null };
  }
  let rows = chairs;
  if (intent.status) rows = rows.filter((chair) => chair.status === intent.status);
  if (intent.rulePrefix) {
    rows = rows.filter((chair) => chair.headlineRule?.startsWith(intent.rulePrefix));
  }
  const parts = [intent.status ? STATUS_TITLES[intent.status] : null,
    intent.topic ? `main issue: ${intent.topic}` : null].filter(Boolean);
  return {
    title: parts.length ? parts.join(" · ") : "All visits",
    rows,
    counts: countByStatus(chairs),
    // Said plainly so a short list is never read as "nobody else has this issue".
    basis: intent.rulePrefix
      ? "Matched on each visit's main record issue. Open a patient to see every record check."
      : null,
  };
}

function countByStatus(chairs) {
  const counts = { blocked: 0, conflict: 0, waiting: 0, advisory: 0, ready: 0 };
  for (const chair of chairs) if (chair.status in counts) counts[chair.status] += 1;
  return counts;
}
