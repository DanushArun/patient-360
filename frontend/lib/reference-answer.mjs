// Reference answers (SPEC R6): passages from the reference corpus, quoted, never written.
// Cortex Search ranks the pages; this module picks the sentences on each page that match the
// question, by a fixed term-overlap rule, and quotes them verbatim with their source. No model
// writes or paraphrases any of it (R1), and nothing here is a finding about the patient.

const STOP = new Set(("a an and are as at be by can do does for from has have how i in is it its "
  + "me my of on or she he her his patient patients should that the their them there these this "
  + "to was what when where which who why will with you your about any say says said tell show "
  + "guideline guidelines reference references document documents label labels list lists "
  + "state states stated give gives under page section").split(" "));

const MAX_PASSAGES = 4;
const MAX_QUOTE = 420;

/** Lower-case word stems (first six letters) that carry the question's meaning. */
export function questionTerms(question) {
  const words = String(question).toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return [...new Set(words.filter((word) => word.length > 2 && !STOP.has(word))
    .map((word) => word.slice(0, 6)))];
}

function score(text, terms) {
  const words = new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .map((word) => word.slice(0, 6)));
  return terms.filter((term) => words.has(term)).length;
}

/** PDF text arrives with layout whitespace; quote it as one readable line. */
function tidy(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

/** Sentences, verbatim. A full stop ends one only when it follows a word of two or more
 * letters or digits, so "U.S." or "e.g." stays inside its sentence. */
function sentencesOf(text) {
  const out = [];
  let start = 0;
  const boundary = /([.;!?])\s+(?=[A-Z0-9“"(])/g;
  for (const match of text.matchAll(boundary)) {
    const before = text.slice(Math.max(0, match.index - 4), match.index);
    if (match[1] === "." && /(^|[\s.])([A-Za-z]|e\.g|i\.e|vs|Dr|No|Fig)$/.test(before)) continue;
    out.push(text.slice(start, match.index + 1).trim());
    start = match.index + match[0].length;
  }
  out.push(text.slice(start).trim());
  return out.filter(Boolean);
}

/** The best-matching run of sentences on a page, verbatim, at most MAX_QUOTE characters. */
export function bestQuote(pageText, terms) {
  const text = tidy(pageText);
  if (!text) return null;
  const sentences = sentencesOf(text);
  let best = 0;
  let bestScore = -1;
  sentences.forEach((sentence, index) => {
    const value = score(sentence, terms);
    if (value > bestScore) { best = index; bestScore = value; }
  });
  if (bestScore <= 0) return null;
  let quote = sentences[best];
  for (let next = best + 1; next < sentences.length
    && quote.length + sentences[next].length + 1 <= MAX_QUOTE; next += 1) {
    if (score(sentences[next], terms) === 0) break;
    quote += ` ${sentences[next]}`;
  }
  if (quote.length > MAX_QUOTE) {
    const cut = quote.lastIndexOf(" ", MAX_QUOTE - 1);
    quote = `${quote.slice(0, cut > 0 ? cut : MAX_QUOTE - 1)}…`;
  }
  return { quote, matched: bestScore };
}

/** Words that name the document itself ("trastuzumab" in the trastuzumab label) appear on
 * every page, so they cannot pick a passage. They count only when nothing else is asked. */
function contentTerms(terms, entry) {
  const title = new Set(questionTerms(`${entry.document_title} ${entry.filename}`));
  const rest = terms.filter((term) => !title.has(term));
  return rest.length ? rest : terms;
}

/** Catalog entries keyed by the corpus doc_id ("REF-" + first 24 hex of the file's SHA-256). */
export function catalogIndex(catalog) {
  const index = new Map();
  for (const entry of catalog?.entries ?? []) {
    if (typeof entry?.sha256 === "string") index.set(`REF-${entry.sha256.slice(0, 24)}`, entry);
  }
  return index;
}

/**
 * @param {{ question: string, hits: Array<Record<string, unknown>>, catalog: object,
 *   knownAsOf: string }} input
 * @returns {import("./patient").AnswerArtifact}
 */
export function composeReferenceAnswer({ question, hits, catalog, knownAsOf }) {
  const terms = questionTerms(question);
  const index = catalogIndex(catalog);
  const seen = new Set();
  const passages = [];
  for (const hit of Array.isArray(hits) ? hits : []) {
    const docId = typeof hit?.doc_id === "string" ? hit.doc_id : null;
    const page = Number.isInteger(hit?.page_index) ? hit.page_index : null;
    const entry = docId ? index.get(docId) : null;
    // A passage whose source cannot be named is not quoted: an unattributed guideline line
    // is worse than none.
    if (!docId || page === null || !entry || seen.has(`${docId}:${page}`)) continue;
    const picked = bestQuote(hit.text, contentTerms(terms, entry));
    if (!picked) continue;
    seen.add(`${docId}:${page}`);
    passages.push({ hit, entry, page, ...picked });
  }
  // Cortex Search's ranking is kept as the order; nothing is re-ranked here.
  const chosen = passages.slice(0, MAX_PASSAGES);
  const claims = chosen.map(({ hit, entry, page, quote }) => ({
    text: `“${quote}”`,
    claim_type: "textual",
    provenance_note: `${entry.publisher} · ${entry.document_title}, page ${page + 1}`,
    evidence: [{
      kind: "reference_clause",
      id: String(hit.id ?? `${hit.doc_id}:${page}`),
      doc_id: hit.doc_id,
      page_index: page,
      publisher: entry.publisher,
      document_title: entry.document_title,
      version: entry.version,
      jurisdiction: String(hit.jurisdiction ?? (entry.publisher.startsWith("U.S.") ? "US" : "IN")),
      // The catalog records no effective date for these documents; none is invented.
      effective_date: entry.effective_date ?? "Not stated in the document",
      clause: quote,
    }],
  }));
  const limitations = [
    "Reference guidance, quoted from the source. It is not a finding about this patient.",
    "Clinical decisions belong to the treating practitioner.",
  ];
  if (!claims.length) limitations.unshift("No passage in the reference documents matches this question.");
  return {
    classification: "CLASS_B",
    overall_status: claims.length ? "supported" : "partial",
    known_as_of: knownAsOf,
    claims,
    limitations,
  };
}
