// Live copilot planner: turns a spoken or typed request into a short list of screen steps
// from a closed vocabulary (docs/design/copilot-concepts/README.md). Nothing here
// reads or asserts a clinical fact (R1). It only decides where to look on screen; every status,
// value and date still comes from the governed reads the dashboard already uses. A patient
// named in a request is only ever suggested: the step waits for a human click (COPILOT-SPEC §0).

import { matchRecordTool, recordToolQuestion } from "./copilot-tools.mjs";
import { matchCohortIntent } from "./copilot-cohort.mjs";

/** @typedef {"Overview" | "Facts" | "Timeline" | "Documents" | "Coverage" | "Review" | "Family"}
 *   LiveSection */
/** @typedef {{ id: string, name: string }} RosterEntry */
/** @typedef {{ route: "census" | "queue" | "patient" | "other",
 *   patient: RosterEntry | null, section: string | null, roster: RosterEntry[] }} PlanContext */
/** @typedef {"document" | "check" | "fact"} FindKind */
/** @typedef {{ type: "select_patient", candidates: RosterEntry[] }
 *   | { type: "go", to: "census" | "queue" }
 *   | { type: "section", section: LiveSection }
 *   | { type: "find", kind: FindKind, terms: string[], codes: string[], phrase: string,
 *       open: boolean }
 *   | { type: "collect" }
 *   | { type: "ask", scope: "patient" | "cohort", question: string }
 *   | { type: "mark", scope: "patient" | "cohort" }} LiveStep */

const SECTION_WORDS = /** @type {[LiveSection, RegExp][]} */ ([
  ["Documents", /\b(documents?|reports?|files?|pdfs?|letters?|scans?|paperwork|uploads?)\b/],
  ["Facts", /\b(facts?|labs?|lab (values|results)|blood (counts?|work|tests?))\b/],
  ["Timeline", /\b(timeline|chronolog\w*)\b/],
  ["Coverage", /\b(coverage|insurance|pre-?auth\w*|schemes?|payers?)\b/],
  ["Review", /\b(review tasks?|tasks?|follow-?ups?)\b/],
  ["Family", /\b(family|caregivers?|family checklist)\b/],
  ["Overview", /\b(overview|record checks?|readiness)\b/],
]);

// Where each record tool's evidence lives on the patient screen.
const TOOL_SECTION = /** @type {Record<string, LiveSection>} */ ({
  readiness: "Overview", labs: "Facts", documents: "Documents", coverage: "Coverage",
  timeline: "Timeline", conflicts: "Overview", tasks: "Review", visit: "Overview",
});
const FIND_SECTION = /** @type {Record<FindKind, LiveSection>} */ ({
  document: "Documents", check: "Overview", fact: "Facts",
});

const CONTROL = /^(stop|cancel|never ?mind|abort|forget it)\.?$/;
const NAV_CENSUS = /\b(day ?care( list)?|census|work ?list|home ?page|dashboard|today'?s list|patient list|all (my )?patients)\b/;
const NAV_QUEUE = /\b(review queue|the queue|queue)\b/;
const NAV_BACK = /^(go |take me )?back\b|\b(previous (view|page|screen)|where i was)\b/;
const OPEN_VERB = /^(open|show( me)?|go to|goto|take me to|switch to|navigate to|bring up|pull up|view|display|jump to|load|see)\b\s*/;
const FIND_VERB = /^(find|locate|where('s| is| are)|look (for|up)|highlight|search( for)?|point (to|at))\b\s*/;
const COLLECT = /\b(bring|pull|add|attach|put|take|drop|send|move|copy|pin)\b.*\b(chat|conversation|copilot|composer|thread)\b/;
const QUESTION = /^(what|what's|whats|which|who|whom|whose|why|when|where|how|is|are|was|were|do|does|did|has|have|had|can|could|should|would|will|any|list|summari[sz]e|tell|explain|give|check|compare|count)\b|\?\s*$/;
const STATE_WORDS = /\b(missing|block\w*|gaps?|conflict\w*|disagree\w*|pending|outstanding|issues?|problems?|wrong|stopping|holding|status|ready|readiness)\b/;
const COHORT_WORDS = /\b(who|which patients|how many|everyone|anyone|patients|today'?s list|day ?care list|census|worklist)\b/;
const PRONOUN = /\b(her|his|their|this patient|the patient|this record|this visit)\b/;
const CLAUSE_SPLIT = /\s*(?:[.;]\s+|,?\s+(?:and then|then|and also|and)\s+(?=(?:show|open|find|bring|pull|add|attach|tell|check|what|which|who|ask|summari[sz]e|list|go|take|explain|highlight|look|put|is|are|does|do|has|give|locate|compare)\b))/i;

const DOCUMENT_WORDS = /\b(report|reports|document|documents|letter|scan|pdf|note|notes|form|summary|discharge|cbc|histopath\w*|biopsy|echo|referral|consent|prescription)\b/;
const CHECK_WORDS = /\b(check|checks|rule|rules|gate|gates|blocker|blocking|threshold)\b|\b[a-z]{3,5}-[a-z0-9]{2,8}-\d{3}\b/;
const FACT_WORDS = /\b(value|values|result|results|level|levels|count|counts|reading|readings|measurement)\b/;

const FILLER = new Set(["the", "a", "an", "this", "that", "these", "those", "his", "her", "their",
  "my", "me", "please", "patient", "patients", "patient's", "record", "records", "chart", "file",
  "profile", "page", "into", "in", "to", "on", "for", "from", "of", "and", "it", "chat",
  "conversation", "copilot", "composer", "thread", "latest", "last", "most", "recent", "new",
  "bring", "pull", "add", "attach", "put", "take", "drop", "send", "move", "copy", "pin", "up",
  "open", "show", "find", "locate", "where", "is", "are", "look", "for", "highlight", "search",
  "with", "about", "all", "one", "can", "you", "i", "want", "need", "see", "view", "display",
  "go", "get", "just", "now", "here", "over", "there", "s"]);

/** Lowercase, straight apostrophes, single spaces. */
export function normalizeRequest(text) {
  return String(text ?? "").replace(/[‘’ʼ]/g, "'").replace(/\s+/g, " ").trim();
}

function words(text) {
  return text.toLowerCase().replace(/[^a-z0-9'\- ]/g, " ").split(/\s+/)
    .map((word) => word.replace(/'s$/, "").replace(/^'+|'+$/g, "")).filter(Boolean);
}

function compact(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function editDistance(left, right) {
  if (Math.abs(left.length - right.length) > 1) return 2;
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1,
        previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[right.length];
}

/**
 * Patients from the authorised roster that a request names. Never more than three, and the
 * caller must still ask a person to choose: a name is a suggestion, not a binding.
 * @param {string} text
 * @param {RosterEntry[]} roster
 * @returns {RosterEntry[]}
 */
export function matchPatients(text, roster) {
  const spoken = words(text);
  const spokenCompact = compact(text);
  const scored = roster.map((patient) => {
    const id = compact(patient.id);
    if (id.length >= 5 && spokenCompact.includes(id)) return { patient, score: 10 };
    const name = words(patient.name).filter((token) => token.length >= 3);
    let score = 0;
    for (const token of name) {
      if (spoken.includes(token)) score += 2;
      // Speech recognition drops or swaps a letter in longer names ("Rakesh" -> "Rakash").
      else if (token.length >= 5 && spoken.some((word) => word.length >= 4
        && editDistance(word, token) === 1)) score += 1;
    }
    return { patient, score };
  }).filter((entry) => entry.score > 0);
  const best = Math.max(0, ...scored.map((entry) => entry.score));
  return scored.filter((entry) => entry.score === best).slice(0, 3).map((entry) => entry.patient);
}

function nameTokens(candidates) {
  return new Set(candidates.flatMap((patient) => words(patient.name)));
}

// Words that only name a place on screen. A request made of these alone opens the section;
// with one specific word beside them ("lab report") it looks for that item.
const PLACE_NOUNS = new Set(["report", "reports", "document", "documents", "letter", "letters",
  "scan", "scans", "file", "files", "pdf", "pdfs", "paperwork", "upload", "uploads", "result",
  "results", "labs", "facts", "fact", "values", "value", "timeline", "history", "coverage",
  "insurance", "overview", "readiness", "checks", "review", "tasks", "family", "summary",
  "details", "information", "info", "section", "tab"]);

/** What to look for: the specific words (place nouns never decide a match on their own),
 * the phrase as said, and any lab concept codes the words name ("platelets" -> PLT). */
function objectTerms(clause, names) {
  // A misheard name ("Rakash") is still the name, not something to look for.
  const isName = (word) => names.has(word) || (word.length >= 4 && [...names].some((name) =>
    name.length >= 5 && editDistance(word, name) === 1));
  const all = words(clause).filter((word) => !FILLER.has(word) && !isName(word)
    && word.length > 1);
  const specific = all.filter((term) => !PLACE_NOUNS.has(term));
  const codes = (matchRecordTool(clause.toLowerCase())?.concepts ?? [])
    .map((code) => code.toLowerCase());
  return { terms: specific, phrase: all.join(" "), codes };
}

function findKind(clause, section) {
  const lower = clause.toLowerCase();
  if (CHECK_WORDS.test(lower)) return "check";
  if (DOCUMENT_WORDS.test(lower)) return "document";
  if (FACT_WORDS.test(lower)) return "fact";
  if (section === "Facts") return "fact";
  if (section === "Overview") return "check";
  if (matchRecordTool(lower)?.concepts.length) return "fact";
  return "document";
}

function sectionNamed(clause) {
  const lower = clause.toLowerCase();
  return SECTION_WORDS.find(([, pattern]) => pattern.test(lower))?.[0] ?? null;
}

/** The user's own words, tidied for the record: no leading conjunction or politeness. */
function questionText(clause) {
  const trimmed = clause.replace(/^(and|also|then|please|can you|could you|now)\s+/i, "")
    .replace(/\s+(please|for me)\s*$/i, "").trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** @param {string} clause @returns {"census" | "queue" | "back" | null} */
function destination(clause) {
  const lower = clause.toLowerCase();
  const leading = /^((go|take me|head) )?(back )?(to )?|^return to /;
  if (NAV_QUEUE.test(lower) && !QUESTION.test(lower)) return "queue";
  if (NAV_CENSUS.test(lower) && (OPEN_VERB.test(lower) || NAV_BACK.test(lower)
    || leading.test(lower) && words(lower.replace(leading, "")).length <= 3)) return "census";
  if (NAV_BACK.test(lower)) return "back";
  return null;
}

/**
 * Plan a request against what is on screen now.
 * @param {string} input
 * @param {PlanContext} context
 * @returns {{ steps: LiveStep[], control: "cancel" | "back" | null, reply: string | null,
 *   patientNamed: boolean }}
 */
export function planRequest(input, context) {
  const text = normalizeRequest(input);
  const lower = text.toLowerCase();
  const empty = { steps: [], control: null, reply: null, patientNamed: false };
  if (!text) return empty;
  if (CONTROL.test(lower)) return { ...empty, control: "cancel" };

  const candidates = matchPatients(text, context.roster);
  const names = nameTokens(candidates);
  const current = context.patient;
  const steps = /** @type {LiveStep[]} */ ([]);
  let patientId = current?.id ?? null;
  let onCensus = context.route === "census";
  let section = context.route === "patient" ? context.section : null;
  const openSection = (next) => {
    if (next && next !== section) steps.push({ type: "section", section: next });
    section = next ?? section;
  };

  const namesOther = candidates.length > 0
    && !(candidates.length === 1 && candidates[0].id === current?.id);
  if (namesOther) {
    steps.push({ type: "select_patient", candidates });
    patientId = candidates.length === 1 ? candidates[0].id : "chosen";
    section = null;
    onCensus = false;
  }

  for (const clause of text.split(CLAUSE_SPLIT).map((part) => part.trim()).filter(Boolean)) {
    const lowerClause = clause.toLowerCase();
    const place = destination(clause);
    if (place === "back") {
      if (!steps.length) return { ...empty, control: "back" };
      continue;
    }
    if (place === "census" || place === "queue") {
      if (!(place === "census" && onCensus) && context.route !== place) {
        steps.push({ type: "go", to: place });
      }
      patientId = null;
      section = null;
      onCensus = place === "census";
      continue;
    }

    const collect = COLLECT.test(lowerClause);
    const opening = OPEN_VERB.test(lowerClause);
    const finding = FIND_VERB.test(lowerClause);
    const remainder = lowerClause.replace(OPEN_VERB, "").replace(FIND_VERB, "");
    // "Show me the latest lab results" asks the record; "open the lab report" goes to it.
    const showing = /^(show( me)?|display|give me|tell me|list)\b/.test(lowerClause)
      && Boolean(matchRecordTool(remainder));
    const asks = !collect && (QUESTION.test(lowerClause) || showing
      || (opening && (QUESTION.test(remainder) || STATE_WORDS.test(remainder)))
      || (!opening && !finding));

    if (!asks) {
      const { terms, phrase, codes } = objectTerms(clause, names);
      const named = sectionNamed(clause);
      if (!patientId) {
        return { ...empty, reply: candidates.length || !context.roster.length
          ? "Open a patient first, then ask again."
          : "Say whose record to open, for example “Open Fatima Begum's documents”.",
          patientNamed: candidates.length > 0 };
      }
      if (!terms.length && !collect) {
        openSection(named);
        continue;
      }
      const kind = findKind(clause, named);
      openSection(named && named !== "Overview" && FIND_SECTION[kind] !== named
        ? named : FIND_SECTION[kind]);
      steps.push({ type: "find", kind, terms, codes, phrase: phrase || kind,
        open: opening && !collect });
      if (collect) steps.push({ type: "collect" });
      continue;
    }

    const cohort = !patientId || (COHORT_WORDS.test(lowerClause) && !candidates.length
      && !PRONOUN.test(lowerClause));
    if (cohort && (matchCohortIntent(clause).kind !== "unknown" || !patientId)) {
      if (!onCensus && context.route !== "census") steps.push({ type: "go", to: "census" });
      onCensus = true;
      patientId = null;
      steps.push({ type: "ask", scope: "cohort", question: questionText(clause) });
      steps.push({ type: "mark", scope: "cohort" });
      continue;
    }
    const tool = matchRecordTool(lowerClause);
    openSection(tool ? TOOL_SECTION[tool.tool] : null);
    // An instruction ("show what's missing") is asked in the wording the SQL classifier
    // recognises as record-state language; ambiguous wording is refused as Class A by design.
    // A question in the person's own words is sent as they wrote it.
    // "Show me …" is record-state wording the classifier recognises; keep the person's words.
    const question = opening && !/^show me\b/.test(lowerClause) && tool
      && !QUESTION.test(lowerClause)
      ? recordToolQuestion(tool.tool) ?? questionText(clause) : questionText(clause);
    steps.push({ type: "ask", scope: "patient", question });
    steps.push({ type: "mark", scope: "patient" });
  }

  return { steps, control: null, reply: steps.length ? null
    : "Say what to open or ask, for example “Show Fatima Begum's documents”.",
  patientNamed: candidates.length > 0 };
}

/** Steps that move what the person is looking at. Manual work pauses these, never the rest. */
export function stepMovesView(step) {
  return ["select_patient", "go", "section", "find", "collect"].includes(step.type);
}

/** Present-tense label while a step is pending or running. */
export function stepLabel(step) {
  switch (step.type) {
    case "select_patient": return step.candidates.length === 1
      ? `Confirm ${step.candidates[0].name}` : "Choose the patient";
    case "go": return step.to === "census" ? "Open Day care" : "Open the review queue";
    case "section": return `Open ${step.section}`;
    case "find": return `Find “${step.phrase}”`;
    case "collect": return "Add it to the chat";
    case "ask": return step.scope === "cohort" ? "Read the day-care checks" : "Ask the record";
    case "mark": return "Mark what the answer cites";
    default: return "Step";
  }
}

/**
 * Rank on-screen items for a find step. A specific word found in an item's text scores one
 * point, a lab concept code three. The earliest item wins a tie, because lists on screen are
 * newest first. With no words at all ("bring the documents"), the first item is the answer.
 * @param {{ text: string }[]} items
 * @param {string[]} terms
 * @param {string[]} [codes]
 * @returns {number} index of the best item, or -1 when nothing matches
 */
export function rankItems(items, terms, codes = []) {
  if (!terms.length && !codes.length) return items.length ? 0 : -1;
  const weighted = [...terms.map((term) => [term, 1]), ...codes.map((code) => [code, 3])]
    .map(([term, weight]) => [String(term).toLowerCase().replace(/[_-]+/g, " "), weight])
    .filter(([term]) => term.length > 1);
  let best = -1;
  let bestScore = 0;
  items.forEach((item, index) => {
    const haystack = ` ${item.text.toLowerCase().replace(/[_-]+/g, " ")} `;
    const score = weighted.reduce((total, [term, weight]) => total
      + (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(haystack)
        ? weight : 0), 0);
    if (score > bestScore) { best = index; bestScore = score; }
  });
  return best;
}
