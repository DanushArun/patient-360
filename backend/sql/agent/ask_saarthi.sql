-- =============================================================================
-- STEP 19b - ask_saarthi: the guarded entry point the apps call
-- =============================================================================
-- Every question from the Streamlit and web apps enters here. The agent is one
-- step in the middle, not the whole path:
--
--   1. classify_question - keyword-first Class A/B routing. Class A (clinical
--                          judgement, dosing, prognosis) is refused HERE,
--                          before the agent runs: no tool call, no retrieval.
--                          A refusal that depends on the agent choosing to
--                          refuse is not a control (classify_question.sql).
--   2. SAARTHI_AGENT     - Class B only, via DATA_AGENT_RUN.
--   3. answer guard      - every sentence is checked before it is shown
--                          (R1: the LLM never decides):
--        a. every number or date must appear in one of this turn's tool
--           results (server-computed facts); a number that came from nowhere
--           is the model's, and the sentence is removed;
--        b. a sentence stating a number must cite at least one evidence id;
--        c. every cited id must exist and belong to the bound patient - a
--           made-up or other-patient id removes the sentence and writes a
--           SECURITY_EVENT;
--        d. sentences citing a clinical event or an extracted document value
--           also go through validate_answer (existence, scope, known_as_of,
--           verification status, polarity via AI_FILTER).
--      Removed sentences are counted with their reasons, never restated.
--   4. ANSWER_RUN        - one row per question: class, status, cited evidence
--                          ids (pointers, not content - DPDP), guard results.
--
-- RESPONSE: the agent's own envelope ({content: [...], ...}) with the text
-- blocks rewritten, plus saarthi_guard {classification, answer_status,
-- stripped, answer_run_id, ...}. Both frontends read content[] unchanged.
--
-- MCP calls SAARTHI_AGENT directly and does not pass through here; see
-- agent/saarthi_mcp.sql. The guard is plain Python so
-- backend/tests/test_ask_guard.py runs it without an account.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.ask_saarthi(QUESTION VARCHAR)
  RETURNS VARIANT
  LANGUAGE PYTHON
  RUNTIME_VERSION = '3.11'
  PACKAGES = ('snowflake-snowpark-python')
  HANDLER = 'run'
  COMMENT = 'Guarded entry point: classify -> agent (Class B only) -> answer guard + validate_answer -> ANSWER_RUN.'
  EXECUTE AS OWNER
AS
$$
import json
import re
import time
import uuid

AGENT = "SAARTHI.OPERATIONAL.SAARTHI_AGENT"
MODEL = "SAARTHI_AGENT (claude-opus-5 orchestration)"

ID_RE = re.compile(r"\b[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+\b")
UUID_RE = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.I)
DATE_RE = re.compile(r"\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?\b")
NUM_RE = re.compile(r"(?<![\w.])-?\d[\d,]*(?:\.\d+)?")
SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z*(\[\"'])")
REMOVED_PREFIX = "_Removed by the answer check"


# ------------------------------------------------------------- pure guard ----

def evidence_ids(text):
    """Tokens that look like record ids: hyphenated with a digit, or UUIDs."""
    ids = {m.group(0) for m in UUID_RE.finditer(text)}
    for m in ID_RE.finditer(text):
        tok = m.group(0)
        if any(c.isdigit() for c in tok) and not DATE_RE.fullmatch(tok):
            ids.add(tok)
    return ids


def facts_in(text):
    """(dates, numbers) stated in text. Ids are removed first, so EVT-DC-04 adds no 04."""
    for i in sorted(evidence_ids(text), key=len, reverse=True):
        text = text.replace(i, " ")
    dates = {d.group(0)[:10] for d in DATE_RE.finditer(text)}
    text = DATE_RE.sub(" ", text)
    text = re.sub(r"\bv(\d+)\b", r" \1 ", text)          # rule version v2 -> 2
    nums = set()
    for m in NUM_RE.finditer(text):
        try:
            nums.add(float(m.group(0).replace(",", "")))
        except ValueError:
            pass
    return dates, nums


def fact_pool(tool_texts):
    """Every date, number and id the server returned this turn."""
    dates, nums, ids = set(), set(), set()
    for t in tool_texts:
        d, n = facts_in(t)
        dates |= d
        nums |= n
        ids |= evidence_ids(t)
    # 1.5 x10^9/L and 1,500 /uL are the same number: accept either scale.
    nums |= {round(v * 1000, 6) for v in list(nums) if 0 < abs(v) < 1000}
    return dates, nums, ids


def number_known(v, pool):
    return v in pool or any(abs(v - p) <= 0.005 * max(abs(p), 1) for p in pool)


def units(text):
    """An answer as checkable units: lines, then sentences within a line."""
    return [SENTENCE_SPLIT.split(line) if line.strip() else [line] for line in text.split("\n")]


def check_unit(unit, pool, id_status):
    """None if the unit may be shown, else why it was removed.
    id_status: id -> own | other_patient | missing, for ids not in the pool."""
    pool_dates, pool_nums, pool_ids = pool
    ids = evidence_ids(unit)
    dates, nums = facts_in(unit)
    nums = {v for v in nums if not (float(v).is_integer() and 0 <= v <= 1)}  # "1 blocker", "0 missing"
    for i in ids - pool_ids:
        status = id_status.get(i, "missing")
        if status == "other_patient":
            return "cited evidence belonging to a different patient"
        if status == "missing":
            return "cited an evidence id that does not exist in the record"
    if (nums or dates) and not ids:
        return "stated a number or date without citing evidence"
    if any(d not in pool_dates for d in dates):
        return "stated a date that is not in any tool result"
    if any(not number_known(v, pool_nums) for v in nums):
        return "stated a number that is not in any tool result"
    return None


def guard_text(text, pool, id_status):
    """(kept_text, removal_reasons, kept_claims)."""
    kept_lines, removed, claims = [], [], []
    for parts in units(text):
        kept = []
        for u in parts:
            reason = check_unit(u, pool, id_status) if u.strip() else None
            if reason:
                removed.append(reason)
                continue
            kept.append(u)
            if u.strip() and evidence_ids(u):
                claims.append({"text": u.strip(), "evidence": sorted(evidence_ids(u))})
        if kept or not any(p.strip() for p in parts):
            kept_lines.append(" ".join(kept))
    return "\n".join(kept_lines).strip(), removed, claims


def removal_note(reasons):
    counts = {}
    for r in reasons:
        counts[r] = counts.get(r, 0) + 1
    return (f"\n\n{REMOVED_PREFIX} (R1: every number comes from the record):_\n"
            + "\n".join(f"- {n} statement(s) {r}" for r, n in counts.items()))


def refusal_text(practitioner):
    who = practitioner or "the treating practitioner"
    return ("This asks for a clinical judgement - whether to treat, change a dose, or what to expect - "
            f"which only {who} can make, so SAARTHI does not answer it (Class A).\n\n"
            f"I can prepare an evidence packet for {who} with the record state that bears on it: the "
            "readiness gates, each with its rule, version and evidence. Or ask a record question, for "
            "example \"What is missing before the next cycle?\" or \"Is the pathology report final?\"")


def tool_texts(response):
    return [json.dumps(b.get("tool_result") or {}) for b in response.get("content") or []
            if b.get("type") == "tool_result"]


def answer_status(texts, removed):
    shown = any((b.get("text") or "").strip() for b in texts)
    if not shown:
        return "withheld" if removed else "supported"
    return "partial" if removed else "supported"


# --------------------------------------------------------------- database ----

def one(session, sql, params=None):
    rows = session.sql(sql, params=params or []).collect()
    return rows[0].as_dict() if rows else None


def resolve_ids(session, ids, patient_id):
    """Ids the tools did not return this turn: own / other_patient / missing."""
    status = {}
    for i in ids:
        row = one(session, """
            SELECT COUNT(*) AS n, MAX(IFF(owner = ?, 1, 0)) AS own FROM (
                          SELECT patient_id AS owner FROM SAARTHI.CORE.CLINICAL_EVENT WHERE event_id = ?
                UNION ALL SELECT patient_id FROM SAARTHI.CORE.DT_HARMONIZED_EVENTS WHERE event_id = ?
                UNION ALL SELECT COALESCE(patient_id, ?) FROM SAARTHI.DOCUMENTS.DOCUMENT WHERE doc_id = ?
                UNION ALL SELECT subject FROM SAARTHI.EVIDENCE.ASSERTION WHERE assertion_id = ?
                UNION ALL SELECT patient_id FROM SAARTHI.CORE.AUTHORIZATION WHERE auth_id = ?
                UNION ALL SELECT patient_id FROM SAARTHI.CORE.COVERAGE WHERE coverage_id = ?
                UNION ALL SELECT patient_id FROM SAARTHI.CORE.ID_MAP WHERE map_id = ?
                UNION ALL SELECT patient_id FROM SAARTHI.CORE.TREATMENT_PLAN WHERE plan_id = ?
                UNION ALL SELECT patient_id FROM SAARTHI.CORE.ENCOUNTER WHERE encounter_id = ?
                UNION ALL SELECT patient_id FROM SAARTHI.GOVERNANCE.CONSENT WHERE consent_id = ?
                UNION ALL SELECT ? FROM SAARTHI.OPERATIONAL.RULE_CATALOG WHERE rule_id = ?
                UNION ALL SELECT ? FROM SAARTHI.OPERATIONAL.REGIMEN_REGISTRY WHERE regimen_code = ?
            )""", [patient_id, i, i, patient_id, i, i, i, i, i, i, i, i, patient_id, i, patient_id, i])
        status[i] = "missing" if not row or not row["N"] else ("own" if row["OWN"] else "other_patient")
    return status


def security_event(session, practitioner_id, reason, detail):
    session.sql("""INSERT INTO SAARTHI.GOVERNANCE.SECURITY_EVENT (event_id, practitioner_id, event_type, detail)
                   SELECT ?, ?, 'validator_strip', PARSE_JSON(?)""",
                [str(uuid.uuid4()), practitioner_id, json.dumps(dict(detail, reason=reason))]).collect()


def record_run(session, run_id, question, cls, ctx, status, claims, guard, started):
    ids = sorted({i for c in claims for i in c["evidence"]})
    session.sql("""
        INSERT INTO SAARTHI.EVIDENCE.ANSWER_RUN (run_id, question, question_class, practitioner_id, patient_id,
            consent_id, known_as_of, answer_status, claims_json, evidence_ids, model_version,
            validation_results, latency_ms)
        SELECT ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP()::TIMESTAMP_NTZ, ?, PARSE_JSON(?), PARSE_JSON(?), ?,
               PARSE_JSON(?), ?""",
                [run_id, question, cls, ctx.get("PRACTITIONER_ID"), ctx.get("PATIENT_ID"), ctx.get("CONSENT_ID"),
                 status, json.dumps(claims), json.dumps(ids), MODEL, json.dumps(guard),
                 int((time.time() - started) * 1000)]).collect()


def ids_in(session, table, column, ids):
    if not ids:
        return set()
    rows = session.sql(f"SELECT {column} AS i FROM {table} WHERE ARRAY_CONTAINS({column}::VARIANT, PARSE_JSON(?))",
                       [json.dumps(sorted(ids))]).collect()
    return {r["I"] for r in rows}


def run(session, QUESTION):
    started, run_id = time.time(), str(uuid.uuid4())
    ctx = one(session, """
        SELECT b.patient_id, b.consent_id, pr.practitioner_id, pr.name AS practitioner_name
          FROM (SELECT CURRENT_USER() AS u) me
          LEFT JOIN SAARTHI.GOVERNANCE.PRACTITIONER pr ON UPPER(pr.snowflake_user) = UPPER(me.u)
          LEFT JOIN SAARTHI.GOVERNANCE.PATIENT_BINDING b
                 ON b.session_id = CURRENT_SESSION() AND b.released_at IS NULL
         ORDER BY b.bound_at DESC NULLS LAST LIMIT 1""") or {}

    # 1. Class A never reaches the agent.
    cls = json.loads(session.call("SAARTHI.OPERATIONAL.CLASSIFY_QUESTION", QUESTION))
    if cls.get("classification") != "CLASS_B":
        guard = {"classification": "A", "method": cls.get("method"), "answer_status": "refused",
                 "stripped": [], "answer_run_id": run_id, "agent_called": False}
        record_run(session, run_id, QUESTION, "A", ctx, "refused", [], guard, started)
        return {"role": "assistant", "status": "refused", "saarthi_guard": guard,
                "content": [{"type": "text", "text": refusal_text(ctx.get("PRACTITIONER_NAME"))}]}

    # 2. The agent answers.
    payload = json.dumps({"messages": [{"role": "user", "content": [{"type": "text", "text": QUESTION}]}]})
    raw = session.sql("SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN(?, ?) AS R", [AGENT, payload]).collect()[0]["R"]
    response = json.loads(raw) if isinstance(raw, str) else raw

    # 3. The guard checks every sentence.
    pool = fact_pool(tool_texts(response))
    texts = [b for b in response.get("content") or [] if b.get("type") == "text"]
    cited = set()
    for b in texts:
        cited |= evidence_ids(b.get("text") or "")
    id_status = resolve_ids(session, cited - pool[2], ctx.get("PATIENT_ID"))
    for i, st in id_status.items():
        if st != "own":
            security_event(session, ctx.get("PRACTITIONER_ID"),
                           "cross_patient_evidence" if st == "other_patient" else "fabricated_evidence_id",
                           {"evidence_id": i, "answer_run_id": run_id})
    removed, claims = [], []
    for b in texts:
        kept, why, found = guard_text(b.get("text") or "", pool, id_status)
        b["text"] = kept
        removed += why
        claims += found

    structured = ids_in(session, "SAARTHI.CORE.DT_HARMONIZED_EVENTS", "event_id", cited)
    spans = ids_in(session, "SAARTHI.EVIDENCE.ASSERTION", "assertion_id", cited)
    to_validate = []
    for c in claims:
        ev = ([{"kind": "structured", "id": i} for i in c["evidence"] if i in structured]
              + [{"kind": "document_span", "id": i} for i in c["evidence"] if i in spans])
        if ev:
            to_validate.append({"text": c["text"], "evidence": ev})
    validation = {}
    if to_validate:
        # CALL with PARSE_JSON: session.call would pass the claims as VARCHAR,
        # and VALIDATE_ANSWER takes a VARIANT (found live).
        raw_v = session.sql("CALL SAARTHI.OPERATIONAL.VALIDATE_ANSWER(PARSE_JSON(?), NULL::VARCHAR)",
                            [json.dumps(to_validate)]).collect()[0][0]
        validation = json.loads(raw_v) if isinstance(raw_v, str) else raw_v
        if validation.get("error"):
            raise RuntimeError("validate_answer refused: " + validation["error"])
        passed = {c["text"] for c in validation.get("claims") or []}
        failed = [c["text"] for c in to_validate if c["text"] not in passed]
        for f in failed:
            for b in texts:
                if f in b["text"]:
                    b["text"] = b["text"].replace(f, "").strip()
            removed.append("failed validate_answer")
        claims = [c for c in claims if c["text"] not in failed]

    status = answer_status(texts, removed)
    if status == "withheld":
        response["content"] = [b for b in response.get("content") or [] if b.get("type") != "text"]
        response["content"].append({"type": "text", "text": "The answer could not be verified against the "
                                                            "record and was withheld." + removal_note(removed)})
    elif removed and texts:
        texts[-1]["text"] = (texts[-1]["text"] + removal_note(removed)).strip()

    guard = {"classification": "B", "method": cls.get("method"), "answer_status": status,
             "stripped": removed, "claims_kept": len(claims), "answer_run_id": run_id,
             "validate_answer": {"claims_checked": len(to_validate),
                                 "overall_status": validation.get("overall_status")}}
    record_run(session, run_id, QUESTION, "B", ctx, status, claims, guard, started)
    response["saarthi_guard"] = guard
    return response
$$;
