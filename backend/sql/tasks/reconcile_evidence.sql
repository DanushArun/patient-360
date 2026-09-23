-- =============================================================================
-- STEP 16d - TASK reconcile_evidence: the bridge from documents to gates
-- =============================================================================
-- SPEC.md §12 / R3 / R7. Runs after extract_assertions. Deterministic - no AI.
-- Until this existed, a parsed and two-pass-verified PDF could never change a
-- readiness gate: ASSERTION rows were written and nothing read them
-- (implementation audit, 23 Sept, P0 #3). For every document it now:
--
--   1. Reads the report date and specimen printed on the page ("Report date:
--      2025-03-27", "Specimen: SPEC-SURGICAL-001") from DOC_CHUNK - the
--      un-RAP'd index, readable in a background task - and sets
--      DOCUMENT.effective_at. An undated document is never promoted: a value
--      of unknown age cannot make a freshness gate pass (R3).
--   2. Re-checks pass 1 against pass 2 by VALUE ("2,60,904" and
--      "2,60,904 /CUMM" agree). A real disagreement marked verified is
--      downgraded to conflicting.
--   3. Reconciles each verified value with the structured record for the same
--      patient, concept and date:
--        equal       -> EVIDENCE_LINK supports      (document corroborates)
--        different   -> EVIDENCE_LINK conflicts_with. If another document
--                       supports the record, this reading is downgraded to
--                       conflicting (a bad copy, e.g. a rotated photo that
--                       both passes misread identically). If nothing supports
--                       it, evaluate_gates reports the gate conflicting.
--        no record   -> PROMOTED: a CLINICAL_EVENT 'EXT-<assertion_id>' with a
--                       supports link back to the assertion, so the gate reads
--                       it and the answer can cite the sentence it came from.
--   4. Links HER2 readings that differ across specimens
--      (discordant_across_specimens) - surfaced, never resolved. (The first
--      version wrote that as an eighth missingness_state; R3 has seven.)
--
-- Idempotent: links and promoted events are keyed, so a re-run adds nothing.
-- The parsing is plain Python so backend/tests/test_reconcile.py runs it
-- without an account.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.reconcile_evidence_proc()
  RETURNS VARIANT
  LANGUAGE PYTHON
  RUNTIME_VERSION = '3.11'
  PACKAGES = ('snowflake-snowpark-python')
  HANDLER = 'run'
  COMMENT = 'Task body for reconcile_evidence. Dates documents, corroborates or conflicts extracted values against the record, promotes verified new values to CLINICAL_EVENT.'
  EXECUTE AS OWNER
AS
$$
import json
import re
from datetime import datetime

MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep",
                                      "oct", "nov", "dec"], start=1)}
DATE_LABEL = re.compile(r"(?i)\b(?:report(?:ed)?(?:\s+(?:date|on))?|collected(?:\s+(?:on|date))?|"
                        r"sample(?:\s+date)?|date\s+of\s+report|date)\s*[:\-]\s*"
                        r"(\d{4}-\d{2}-\d{2}|\d{1,2}[\-/.]\d{1,2}[\-/.]\d{2,4}|\d{1,2}[\s\-][A-Za-z]{3,9}[\s\-,]*\d{2,4})")
SPECIMEN = re.compile(r"(?i)\bspecimen\s*(?:id|no\.?)?\s*[:\-]\s*([A-Za-z0-9][A-Za-z0-9\-/]+)")
NUMBER = re.compile(r"-?\d[\d,]*(?:\.\d+)?")
IHC = re.compile(r"(?i)\b([0-3])\s*\+|\b(0)\b")
EVENT_TYPE = {"analyte": "lab", "biomarker": "pathology", "procedure": "imaging"}


# ---------------------------------------------------------------- parsing ----

def parse_date(text):
    """First labelled report date on the page, day-first as Indian labs print it."""
    m = DATE_LABEL.search(text or "")
    if not m:
        return None
    raw = m.group(1).strip()
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
            return datetime.strptime(raw, "%Y-%m-%d")
        parts = re.split(r"[\-/.\s,]+", raw)
        if len(parts) == 3 and parts[1][:3].lower() in MONTHS:
            d, mo, y = int(parts[0]), MONTHS[parts[1][:3].lower()], int(parts[2])
        else:
            d, mo, y = (int(p) for p in parts)
        if y < 100:
            y += 2000
        return datetime(y, mo, d)
    except (ValueError, KeyError):
        return None


def parse_specimen(text):
    m = SPECIMEN.search(text or "")
    return m.group(1) if m else None


def parse_number(value):
    """'2,60,604' -> 260604.0; '2,60,904 /CUMM' -> 260904.0; '35.0%' -> 35.0."""
    m = NUMBER.search(value or "")
    if not m:
        return None
    try:
        return float(m.group(0).replace(",", ""))
    except ValueError:
        return None


def parse_ihc(value):
    m = IHC.search(value or "")
    if not m:
        return None
    return (m.group(1) or m.group(2)) + ("+" if m.group(1) else "")


def same_value(a, b):
    """Counts must match exactly; decimals within 0.5%. A misread 604 -> 904 is a difference."""
    if a is None or b is None:
        return False
    if float(a).is_integer() and float(b).is_integer():
        return a == b
    return abs(a - b) <= 0.005 * max(abs(a), abs(b), 1e-9)


def passes_agree(p1, p2, concept_type):
    if concept_type == "biomarker":
        return parse_ihc(p1) == parse_ihc(p2)
    n1, n2 = parse_number(p1), parse_number(p2)
    return same_value(n1, n2) if n1 is not None and n2 is not None else (p1 or "").strip() == (p2 or "").strip()


def reading(a):
    """Normalised value of an assertion: ('num', float) | ('ihc', '2+') | None."""
    if a["CONCEPT_NAME"] == "HER2_IHC":
        s = parse_ihc(a["VALUE"])
        return ("ihc", s) if s else None
    n = parse_number(a["VALUE"])
    return ("num", n) if n is not None else None


def event_reading(e, kind):
    if kind == "ihc":
        return parse_ihc((e["VALUE_TEXT"] or "").replace("ihc=", ""))
    return e["VALUE_NUM"]


def matches(kind, a_val, e_val):
    return a_val == e_val if kind == "ihc" else same_value(a_val, e_val)


# ----------------------------------------------------------------- run -------

def rows(session, sql, params=None):
    return [r.as_dict() for r in session.sql(sql, params=params or []).collect()]


def run(session):
    out = {"documents_dated": 0, "pass_disagreements": 0, "supports": 0, "conflicts": 0,
           "downgraded": 0, "promoted": 0, "undated_not_promoted": 0, "discordant_links": 0}
    text = {r["DOC_ID"]: r["T"] for r in rows(session, """
        SELECT doc_id, LISTAGG(text, '\n') WITHIN GROUP (ORDER BY page_index, chunk_index) AS t
          FROM SAARTHI.DOCUMENTS.DOC_CHUNK WHERE doc_scope = 'patient' GROUP BY doc_id""")}
    docs = {r["DOC_ID"]: r for r in rows(session, """
        SELECT doc_id, patient_id, effective_at FROM SAARTHI.DOCUMENTS.DOCUMENT
         WHERE scope = 'patient' AND patient_id IS NOT NULL""")}

    # 1. date and specimen from the page
    specimen = {}
    for doc_id, d in docs.items():
        specimen[doc_id] = parse_specimen(text.get(doc_id))
        if d["EFFECTIVE_AT"] is None:
            when = parse_date(text.get(doc_id))
            if when:
                session.sql("UPDATE SAARTHI.DOCUMENTS.DOCUMENT SET effective_at = ? WHERE doc_id = ?",
                            [when, doc_id]).collect()
                d["EFFECTIVE_AT"] = when
                out["documents_dated"] += 1

    assertions = rows(session, """
        SELECT a.assertion_id, a.doc_id, a.concept_id, a.value, a.unit, a.verification_status,
               a.pass1_value, a.pass2_value, o.canonical_name AS concept_name, o.concept_type
          FROM SAARTHI.EVIDENCE.ASSERTION a
          JOIN SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY o ON o.concept_id = a.concept_id
         WHERE a.missingness_state = 'present'
           AND a.verification_status IN ('verified', 'conflicting')
           AND o.concept_type IN ('analyte', 'biomarker', 'procedure')""")
    links = {(r["ASSERTION_ID"], r["TARGET_ID"], r["RELATION"]) for r in rows(session,
             "SELECT assertion_id, target_id, relation FROM SAARTHI.EVIDENCE.EVIDENCE_LINK")}

    def link(assertion_id, target_type, target_id, relation):
        if (assertion_id, target_id, relation) in links:
            return False
        session.sql("""INSERT INTO SAARTHI.EVIDENCE.EVIDENCE_LINK (link_id, assertion_id, target_type, target_id, relation)
                       SELECT UUID_STRING(), ?, ?, ?, ?""", [assertion_id, target_type, target_id, relation]).collect()
        links.add((assertion_id, target_id, relation))
        return True

    def downgrade(assertion_id):
        session.sql("UPDATE SAARTHI.EVIDENCE.ASSERTION SET verification_status = 'conflicting' "
                    "WHERE assertion_id = ? AND verification_status = 'verified'", [assertion_id]).collect()

    # 2. pass 1 vs pass 2 by value
    for a in assertions:
        if a["VERIFICATION_STATUS"] == "verified" and a["PASS2_VALUE"] is not None \
                and not passes_agree(a["PASS1_VALUE"], a["PASS2_VALUE"], a["CONCEPT_TYPE"]):
            downgrade(a["ASSERTION_ID"])
            a["VERIFICATION_STATUS"] = "conflicting"
            out["pass_disagreements"] += 1

    record = rows(session, """
        SELECT ce.event_id, ce.patient_id, o.canonical_name AS concept_name, ce.value_num, ce.value_text,
               ce.event_time, ce.specimen_id
          FROM SAARTHI.CORE.CLINICAL_EVENT ce
          JOIN SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY o ON o.concept_id = ce.concept_id
         WHERE ce.event_id NOT LIKE 'EXT-%'""")

    # 3. corroborate, conflict, or promote. Every decision is returned, so a
    # run is auditable without re-deriving it.
    conflicted, decisions = [], []

    def decide(a, action):
        decisions.append({"assertion_id": a["ASSERTION_ID"], "concept": a["CONCEPT_NAME"],
                          "value": a["VALUE"], "action": action})

    for a in assertions:
        d = docs.get(a["DOC_ID"])
        r = reading(a)
        if a["VERIFICATION_STATUS"] != "verified" or d is None or r is None:
            decide(a, "skipped: " + ("not verified" if a["VERIFICATION_STATUS"] != "verified" else
                                     "no patient document" if d is None else "value unreadable"))
            continue
        kind, val = r
        when = d["EFFECTIVE_AT"]
        same_day = [e for e in record if e["PATIENT_ID"] == d["PATIENT_ID"]
                    and e["CONCEPT_NAME"] == a["CONCEPT_NAME"] and when is not None
                    and e["EVENT_TIME"] and e["EVENT_TIME"].date() == when.date()]
        if kind == "ihc" and specimen.get(a["DOC_ID"]):
            same_spec = [e for e in same_day if e["SPECIMEN_ID"] == specimen[a["DOC_ID"]]]
            same_day = same_spec or same_day
        if same_day:
            agree = [e for e in same_day if matches(kind, val, event_reading(e, kind))]
            for e in agree:
                out["supports"] += link(a["ASSERTION_ID"], "clinical_event", e["EVENT_ID"], "supports")
            if not agree:
                for e in same_day:
                    out["conflicts"] += link(a["ASSERTION_ID"], "clinical_event", e["EVENT_ID"], "conflicts_with")
                conflicted.append((a, same_day))
            decide(a, ("supports " if agree else "conflicts with ")
                   + ", ".join(e["EVENT_ID"] for e in (agree or same_day)))
            continue
        if when is None:
            out["undated_not_promoted"] += 1
            decide(a, "not promoted: document has no report date")
            continue
        event_id = "EXT-" + a["ASSERTION_ID"]
        encounter = rows(session, """
            SELECT encounter_id FROM SAARTHI.CORE.ENCOUNTER WHERE patient_id = ?
             ORDER BY IFF(scheduled_time >= ?, 0, 1), ABS(DATEDIFF('hour', ?, scheduled_time)) LIMIT 1""",
                         [d["PATIENT_ID"], when, when])
        session.sql("""
            MERGE INTO SAARTHI.CORE.CLINICAL_EVENT t
            USING (SELECT ? AS event_id) s ON t.event_id = s.event_id
            WHEN NOT MATCHED THEN INSERT (event_id, patient_id, encounter_id, event_type, concept_id, display,
                value_num, value_text, unit, original_value, original_unit, specimen_id, accession_id, status,
                negation, event_time, source_recorded_at, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'final', FALSE, ?, ?, CURRENT_TIMESTAMP())""",
                    [event_id, event_id, d["PATIENT_ID"], encounter[0]["ENCOUNTER_ID"] if encounter else None,
                     EVENT_TYPE[a["CONCEPT_TYPE"]], a["CONCEPT_ID"], a["CONCEPT_NAME"] + " (verified from document)",
                     val if kind == "num" else None, f"ihc={val}" if kind == "ihc" else None,
                     a["UNIT"], a["VALUE"], a["UNIT"], specimen.get(a["DOC_ID"]), "DOC:" + a["DOC_ID"],
                     when, when]).collect()
        out["promoted"] += link(a["ASSERTION_ID"], "clinical_event", event_id, "supports")
        decide(a, "promoted to " + event_id)

    # A reading contradicted by the record while another document supports the
    # record is a bad copy: never asserted.
    supported = {t for (_, t, rel) in links if rel == "supports"}
    for a, events in conflicted:
        if any(e["EVENT_ID"] in supported for e in events):
            downgrade(a["ASSERTION_ID"])
            out["downgraded"] += 1
            decide(a, "downgraded to conflicting: another document supports the record value")

    # 4. HER2 across specimens
    her2 = [a for a in assertions if a["CONCEPT_NAME"] == "HER2_IHC" and a["VERIFICATION_STATUS"] == "verified"
            and a["DOC_ID"] in docs and specimen.get(a["DOC_ID"])]
    for i, a in enumerate(her2):
        for b in her2[i + 1:]:
            if docs[a["DOC_ID"]]["PATIENT_ID"] == docs[b["DOC_ID"]]["PATIENT_ID"] \
                    and specimen[a["DOC_ID"]] != specimen[b["DOC_ID"]] and reading(a) != reading(b):
                out["discordant_links"] += link(a["ASSERTION_ID"], "assertion", b["ASSERTION_ID"],
                                                "discordant_across_specimens")
    out["decisions"] = decisions
    out["reconciled_at"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    return out
$$;

CREATE OR REPLACE TASK SAARTHI.OPERATIONAL.TASK_RECONCILE_EVIDENCE
  WAREHOUSE = SAARTHI_AI_WH
  AFTER SAARTHI.OPERATIONAL.TASK_EXTRACT_ASSERTIONS
AS
  CALL SAARTHI.OPERATIONAL.reconcile_evidence_proc();
