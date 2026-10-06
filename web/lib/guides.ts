// In-app guides. Wording follows the glossary and status table in
// docs/design/INTERFACE-GUIDELINES.md, so a guide always describes what the screens show.

export type GuideBlock =
  | { kind: "text"; text: string }
  | { kind: "states"; rows: { status: "blocked" | "conflict" | "waiting" | "advisory" | "ready";
      meaning: string; action: string }[] }
  | { kind: "outcomes"; rows: { outcome: "pass" | "fail" | "not_evaluated" | "conflicting";
      meaning: string }[] }
  | { kind: "terms"; rows: { term: string; meaning: string }[] }
  | { kind: "steps"; rows: string[] }
  | { kind: "examples"; rows: { say: string; does: string }[] }
  | { kind: "keys"; rows: { keys: string; does: string }[] };

export type GuideSection = { heading: string; blocks: GuideBlock[] };
export type Guide = { slug: string; title: string; summary: string; icon: GuideIcon;
  sections: GuideSection[] };
export type GuideIcon = "states" | "blocked" | "navigation" | "copilot" | "glossary";

export const GUIDES: Guide[] = [
  {
    slug: "record-states",
    title: "Record states",
    summary: "What Blocked, Waiting on evidence, Conflict, Advisory and Ready mean, and what to do next.",
    icon: "states",
    sections: [
      { heading: "Visit status on the day-care list", blocks: [
        { kind: "text", text: "Every visit on the day-care list shows one status. It is the most "
          + "serious outcome among that patient's record checks. A record check is one versioned SQL "
          + "rule evaluated against the record. No model decides a status." },
        { kind: "states", rows: [
          { status: "blocked", meaning: "A blocker-level record check failed: a value is outside its "
            + "limit or a required measurement is too old.",
            action: "Open the patient, read the check's reason and evidence, and arrange what is missing." },
          { status: "conflict", meaning: "Two sources disagree, for example the pre-authorisation table "
            + "and the insurer's letter. Saarthi keeps both and never picks one.",
            action: "Compare the sources and reconcile them with the team that owns the record." },
          { status: "waiting", meaning: "A required input has not been received yet.",
            action: "Request the document or result. Not received is never the same as negative." },
          { status: "advisory", meaning: "Every blocker passed. An advisory check flagged something to "
            + "note, such as an HbA1c above its threshold.",
            action: "Review the advisory. It does not stop the visit on its own." },
          { status: "ready", meaning: "Every applicable record check passed.",
            action: "Nothing is outstanding in the record. Clinical decisions still rest with the "
              + "treating practitioner." },
        ] },
      ] },
      { heading: "Outcome of a single record check", blocks: [
        { kind: "outcomes", rows: [
          { outcome: "pass", meaning: "The rule's condition is met by the recorded evidence." },
          { outcome: "fail", meaning: "The rule's condition is not met. The reason names the value and "
            + "the limit." },
          { outcome: "conflicting", meaning: "The evidence the rule needs disagrees between sources." },
          { outcome: "not_evaluated", meaning: "The rule could not run on the evidence available. The "
            + "reason always says what was missing." },
        ] },
      ] },
      { heading: "Evidence states", blocks: [
        { kind: "terms", rows: [
          { term: "Present", meaning: "A value was received and read." },
          { term: "Pending", meaning: "Ordered or awaited, with no result yet." },
          { term: "Not received", meaning: "Expected but absent. Never read this as normal or negative." },
          { term: "Explicitly negative", meaning: "The source states the finding is absent." },
          { term: "Conflicting", meaning: "Two readings of the same thing disagree." },
          { term: "Unreadable", meaning: "The source could not be read reliably." },
          { term: "Superseded", meaning: "Replaced by a later version of the same record." },
        ] },
      ] },
    ],
  },
  {
    slug: "blocked-visits",
    title: "Working a blocked visit",
    summary: "Read a failed check, trace it to its source, and act on it without leaving the record.",
    icon: "blocked",
    sections: [
      { heading: "Read the check", blocks: [
        { kind: "steps", rows: [
          "Open the patient from the day-care list. The Overview lists every check that needs attention.",
          "Each row gives the reason in plain words, the rule ID and version (for example "
            + "SURV-LVEF-002 v1) and the evidence IDs it used.",
          "Select View check to see the evidence with its three clocks: when it happened, when the "
            + "source recorded it, and when Saarthi received it.",
          "Open the source document to see the exact page the value came from.",
        ] },
      ] },
      { heading: "Act on it", blocks: [
        { kind: "steps", rows: [
          "Missing or old evidence: use Request document, or create a review task for the person who "
            + "can supply it.",
          "Two sources disagree: open Compare sources on the Coverage tab and reconcile them.",
          "New evidence has arrived: use Recompute readiness to re-run the versioned rules.",
          "A clinical question (should treatment go ahead, what dose): this belongs to the treating "
            + "practitioner. Prepare an evidence packet for them instead.",
        ] },
      ] },
      { heading: "What Saarthi never does", blocks: [
        { kind: "text", text: "It never clears a patient for treatment, never shows a confidence "
          + "percentage, and never turns a missing result into a normal one. Every status comes from "
          + "a versioned rule you can open and read." },
      ] },
    ],
  },
  {
    slug: "navigating",
    title: "Finding your way around",
    summary: "The day-care list, the review queue, a patient's record tabs and the keyboard shortcuts.",
    icon: "navigation",
    sections: [
      { heading: "Day care", blocks: [
        { kind: "text", text: "Tomorrow's visits grouped by record state: Needs review, Waiting on "
          + "evidence, Advisory and Checks met. Change the visit date, switch to the Visits list, or "
          + "search by patient name or check. Each card shows the main reason and its rule." },
      ] },
      { heading: "Review queue", blocks: [
        { kind: "text", text: "Open review tasks across your patients: who owns each one, what it is "
          + "waiting for, and the check it came from." },
      ] },
      { heading: "A patient's record", blocks: [
        { kind: "terms", rows: [
          { term: "Overview", meaning: "Checks that need attention, the current visit and recent records." },
          { term: "Facts", meaning: "Structured values: labs, demographics, coverage, treatment plan, "
            + "encounters and identity links across hospitals." },
          { term: "Timeline", meaning: "Every event in date order, with its source." },
          { term: "Documents", meaning: "Received reports with their verification state, and expected "
            + "documents not yet received." },
          { term: "Coverage", meaning: "Scheme eligibility and pre-authorisation, with a source "
            + "comparison when they disagree." },
          { term: "Review", meaning: "Review tasks for this patient." },
          { term: "Family", meaning: "A checklist for the family in their language, built from the same "
            + "record checks." },
        ] },
      ] },
      { heading: "Shortcuts", blocks: [
        { kind: "keys", rows: [
          { keys: "⌘K / Ctrl+K", does: "Open the chat and start typing." },
          { keys: "Esc", does: "Close the chat or a panel; stop listening." },
          { keys: "Click anywhere", does: "Pause the copilot if it is moving the screen." },
        ] },
      ] },
    ],
  },
  {
    slug: "copilot",
    title: "Using the copilot",
    summary: "Ask about a record, let the copilot open things for you, and know what it will refuse.",
    icon: "copilot",
    sections: [
      { heading: "Ask about the record", blocks: [
        { kind: "text", text: "Open the chat with ⌘K. Ask what is recorded, missing or conflicting. "
          + "Every answer cites its source and shows the time it was known as of." },
        { kind: "examples", rows: [
          { say: "What is missing in the record?", does: "Lists the checks that need attention." },
          { say: "What does the echo show?", does: "Shows LVEF readings with their dates." },
          { say: "Is her pre-authorisation approved?", does: "Shows coverage, including any conflict." },
          { say: "Who is blocked today?", does: "On the day-care list, marks the blocked patients." },
        ] },
      ] },
      { heading: "Let it do the clicking", blocks: [
        { kind: "text", text: "With the Copilot switch on, the bar at the bottom of the screen can "
          + "open records, switch tabs, find a document and bring it into the chat. Press the "
          + "microphone and speak, or type the same request in the chat." },
        { kind: "examples", rows: [
          { say: "Open Anjali's record", does: "Highlights the patient and asks you to confirm. It never "
            + "opens a record on its own." },
          { say: "Bring the lab report into the chat", does: "Finds the report and attaches it to your "
            + "next question." },
          { say: "Go back to day care", does: "Returns to the list." },
        ] },
        { kind: "steps", rows: [
          "Pause stops further steps; Stop cancels; Hide tucks the bar away and turns the microphone off.",
          "If you click or scroll yourself, it pauses at once. Your hands always win.",
          "Each request leaves a list of what was done in the chat, with Return to previous view.",
        ] },
      ] },
      { heading: "What it will refuse", blocks: [
        { kind: "text", text: "Questions that need clinical judgement, such as whether treatment should "
          + "go ahead, what dose to give, or what a result means for the patient, are refused for "
          + "every user. This follows the NMC Telemedicine Practice Guidelines 2020. Saarthi offers "
          + "an evidence packet for the named treating practitioner instead." },
      ] },
    ],
  },
  {
    slug: "glossary",
    title: "Glossary",
    summary: "The words Saarthi uses, each with one meaning.",
    icon: "glossary",
    sections: [
      { heading: "Terms", blocks: [
        { kind: "terms", rows: [
          { term: "Record check", meaning: "One versioned SQL rule evaluated for a patient (rule ID and version)." },
          { term: "Blocked", meaning: "A blocker-level record check failed." },
          { term: "Waiting on evidence", meaning: "A required input has not been received. Never negative." },
          { term: "Conflict", meaning: "Two sources disagree. A person must reconcile them." },
          { term: "Not evaluated", meaning: "The check could not run on the evidence available; the reason is shown." },
          { term: "Known as of", meaning: "The clock an answer or check was computed against." },
          { term: "Evidence packet", meaning: "Facts assembled for the named treating practitioner when a question needs clinical judgement." },
          { term: "Verified", meaning: "A value read independently by two different AI model families that agreed exactly." },
          { term: "Synthetic data", meaning: "Every patient in this workspace is invented. No real patient data is used." },
        ] },
      ] },
    ],
  },
];

export function guideBySlug(slug: string): Guide | null {
  return GUIDES.find((guide) => guide.slug === slug) ?? null;
}
