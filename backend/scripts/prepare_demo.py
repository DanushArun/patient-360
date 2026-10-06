"""Make the live account demo-ready for today, then prove it. Re-runnable.

Moves every synthetic day-care visit to tomorrow 09:30 with its evidence at the same
relative age (load_daycare_cohort.sql), loads the demo hero PAT-DC-12
(backend/sql/demo/load_demo_hero.sql), realigns generated report dates with their
events, runs the R7 two-family extraction on any new page, reconciles evidence and
recomputes readiness. Then it checks the outcome every demo beat depends on and writes
evidence/qa/demo-prep-latest.json. Nothing here decides a clinical outcome (R1): it
loads synthetic evidence and calls the same procedures the scheduled tasks call.

Run on the demo account (ACCOUNTADMIN, key-pair from the environment):
    .venv/bin/python -m backend.scripts.prepare_demo            # prepare + verify
    .venv/bin/python -m backend.scripts.prepare_demo --verify   # verify only, no writes
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from snowflake.connector.errors import Error as SnowflakeError

from backend.scripts.install_clean_account import execute_sql
from backend.verification.report import write_report
from backend.verification.session import ROOT, Session, connect

COHORT = ROOT / "backend/sql/data/load_daycare_cohort.sql"
HERO = ROOT / "backend/sql/demo/load_demo_hero.sql"
DOC_DATES = ROOT / "backend/sql/demo/reanchor_cohort_documents.sql"
REPORT = ROOT / "evidence/qa/demo-prep-latest.json"
HERO_ID = "PAT-DC-12"
HERO_DOCS = ["DOC-LAB-DC-12", "DOC-ECHO-DC-12", "DOC-PATH-DC-12", "DOC-BIOPSY-DC-12",
             "DOC-PA-DC-12"]

# Non-pass outcomes each upcoming visit must show; anything else must pass. Hero first.
EXPECTED = {
    "PAT-DC-12": {"SURV-LVEF-002": "fail", "COV-AUTH-001": "conflicting"},
    "PAT-DC-01": {},
    "PAT-DC-02": {"SURV-LVEF-001": "fail"},
    "PAT-DC-03": {"CLIN-ANC-001": "fail", "CLIN-PLT-001": "fail"},
    "PAT-DC-04": {"CLIN-PLT-001": "fail"},
    "PAT-DC-05": {"CLIN-ANC-001": "fail"},
    "PAT-DC-06": {"COV-AUTH-001": "not_evaluated"},
    "PAT-DC-07": {"COV-AUTH-001": "conflicting"},
    "PAT-DC-08": {"CLIN-ANC-001": "not_evaluated", "CLIN-PLT-001": "not_evaluated"},
    "PAT-DC-09": {"ENDO-HBA1C-001": "fail"},
    "PAT-DC-10": {"DOC-HER2-001": "not_evaluated"},
    "PAT-DC-11": {},
}


def run_file(session: Session, path: Path) -> None:
    execute_sql(session, path.read_text(), str(path.relative_to(ROOT)))


def long_call(session: Session, procedure: str) -> dict:
    """A task-body procedure can run for minutes over the whole cohort; Session.call caps
    every statement at 120 s (the cap that cut the earlier full refresh short)."""
    cursor = session.connection.cursor()
    try:
        cursor.execute(f"CALL SAARTHI.OPERATIONAL.{procedure}()", timeout=1800)
        value = cursor.fetchone()[0]
        session.events.append({"label": procedure, "query_id": cursor.sfqid, "status": "PASS"})
        return json.loads(value) if isinstance(value, str) else value
    finally:
        cursor.close()


def prepare(session: Session, report: dict) -> None:
    session.query("ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = 1800")
    run_file(session, COHORT)
    # The deep-case patient keeps its history; only its next visit moves to tomorrow.
    session.query("UPDATE SAARTHI.CORE.ENCOUNTER SET scheduled_time = "
                  "DATEADD(minute, 570, DATEADD(day, 1, CURRENT_DATE()))::TIMESTAMP_NTZ "
                  "WHERE encounter_id = 'EVT-CHEMO-07' AND status = 'scheduled'",
                  label="reanchor_deep_case_visit")
    run_file(session, HERO)
    run_file(session, DOC_DATES)
    for row in session.query("SHOW DYNAMIC TABLES IN DATABASE SAARTHI"):
        name = f"{row['database_name']}.{row['schema_name']}.{row['name']}"
        session.query(f"ALTER DYNAMIC TABLE {name} REFRESH", label="refresh_dynamic_table")
    report["chunked"] = long_call(session, "CHUNK_DOCUMENTS_PROC")
    extracted = []
    for _ in range(6):  # 10 pages per call; stop when nothing is left to read
        result = long_call(session, "EXTRACT_ASSERTIONS_PROC")
        extracted.append(result)
        if not result.get("assertions_created") or result.get("error"):
            break
    report["extracted"] = extracted
    report["reconciled"] = long_call(session, "RECONCILE_EVIDENCE_PROC")
    report["refreshed"] = long_call(session, "REFRESH_READINESS_PROC")


def verify(session: Session, report: dict) -> list[str]:
    failures: list[str] = []
    visits = session.query(
        "SELECT patient_id, encounter_id, scheduled_time FROM SAARTHI.CORE.ENCOUNTER "
        "WHERE status = 'scheduled' AND scheduled_time::DATE = DATEADD(day, 1, CURRENT_DATE())")
    on_list = {row["PATIENT_ID"]: row["ENCOUNTER_ID"] for row in visits}
    report["visits_tomorrow"] = len(on_list)
    for patient in EXPECTED:
        if patient not in on_list:
            failures.append(f"{patient}: no visit scheduled for tomorrow")
    rows = session.query(
        "SELECT r.patient_id, r.rule_id, r.outcome, r.reason FROM SAARTHI.OPERATIONAL.READINESS_STATE r "
        "JOIN SAARTHI.CORE.ENCOUNTER e ON e.encounter_id = r.encounter_id "
        "WHERE e.status = 'scheduled' AND e.scheduled_time::DATE = DATEADD(day, 1, CURRENT_DATE())")
    outcomes: dict[str, dict[str, dict]] = {}
    for row in rows:
        outcomes.setdefault(row["PATIENT_ID"], {})[row["RULE_ID"]] = {
            "outcome": row["OUTCOME"], "reason": row["REASON"]}
    report["outcomes"] = outcomes
    for patient, expected in EXPECTED.items():
        got = outcomes.get(patient, {})
        if not got:
            failures.append(f"{patient}: no readiness rows")
            continue
        for rule, state in got.items():
            want = expected.get(rule, "pass")
            if state["outcome"] != want:
                failures.append(f"{patient} {rule}: {state['outcome']} (expected {want}): "
                                f"{state['reason']}")
        for rule in expected:
            if rule not in got:
                failures.append(f"{patient} {rule}: not evaluated at all")
    docs = session.query(
        "SELECT d.doc_id, COUNT(a.assertion_id) AS assertions, "
        "COUNT_IF(a.verification_status = 'verified') AS verified, "
        "COUNT_IF(a.verification_status = 'conflicting') AS conflicting "
        "FROM SAARTHI.DOCUMENTS.DOCUMENT d LEFT JOIN SAARTHI.EVIDENCE.ASSERTION a ON a.doc_id = d.doc_id "
        "WHERE d.patient_id = %s GROUP BY d.doc_id", (HERO_ID,))
    report["hero_documents"] = docs
    by_doc = {row["DOC_ID"]: row for row in docs}
    for doc in HERO_DOCS:
        if doc not in by_doc:
            failures.append(f"{doc}: not loaded")
        elif not by_doc[doc]["VERIFIED"]:
            failures.append(f"{doc}: no verified assertions ({by_doc[doc]['ASSERTIONS']} extracted)")
    stale = session.query(
        "SELECT p.doc_id, REGEXP_SUBSTR(p.text, 'Report date: ([0-9-]{10})', 1, 1, 'e') AS printed, "
        "TO_CHAR(d.effective_at, 'YYYY-MM-DD') AS recorded FROM SAARTHI.DOCUMENTS.DOC_PAGE p "
        "JOIN SAARTHI.DOCUMENTS.DOCUMENT d ON d.doc_id = p.doc_id "
        "WHERE d.patient_id RLIKE 'PAT-DC-[0-9]{2}' AND d.status = 'active' "
        "AND REGEXP_SUBSTR(p.text, 'Report date: ([0-9-]{10})', 1, 1, 'e') != "
        "TO_CHAR(d.effective_at, 'YYYY-MM-DD')")
    for row in stale:
        failures.append(f"{row['DOC_ID']}: printed {row['PRINTED']} but recorded {row['RECORDED']}")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true", help="check only; write nothing")
    args = parser.parse_args()
    report: dict = {"status": "FAIL", "mode": "verify" if args.verify else "prepare",
                    "started_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    try:
        with connect("ACCOUNTADMIN") as session:
            try:
                if not args.verify:
                    prepare(session, report)
                failures = verify(session, report)
                report["failures"] = failures
                report["status"] = "PASS" if not failures else "FAIL"
            finally:
                report["events"] = session.events
    except (AssertionError, ValueError, OSError, SnowflakeError) as error:
        report["error"] = str(error)
    write_report(REPORT, report)
    print(json.dumps({key: report.get(key) for key in
                      ("status", "visits_tomorrow", "failures", "error")}, indent=1, default=str))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
