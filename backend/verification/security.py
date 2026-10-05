"""Live positive controls, explicit foreign evidence checks and connection isolation."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from typing import Any

from backend.verification.session import Session, connect, require_success


def security_status(probes: dict[str, dict[str, Any]]) -> str:
    if any(probes.get(name, {}).get('status') != 'PASS' for name in ('A', 'B', 'C', 'D')):
        return 'FAIL'
    if probes['C'].get('in_flight_cancel_verified') is not True:
        return 'PARTIAL'
    return 'PASS'


def strings(value: Any) -> set[str]:
    if isinstance(value, dict):
        return set().union(*(strings(item) for item in value.values()))
    if isinstance(value, list):
        return set().union(*(strings(item) for item in value))
    return {value} if isinstance(value, str) else set()


def assert_no_foreign(payload: dict, foreign_ids: set[str]) -> None:
    if strings(payload) & foreign_ids:
        raise AssertionError("foreign evidence leaked")


def assert_distinct_sessions(ids: list[int], expected: int) -> None:
    if len(ids) != expected or len(set(ids)) != expected:
        raise AssertionError("connection session reuse")


def assert_denial(payload: dict) -> None:
    if payload.get("error") not in {"access_withdrawn", "no_patient_bound", "no_patient_access"}:
        raise AssertionError("expected access denial")
    if any(payload.get(key) for key in ("rows", "facts", "claims", "results")):
        raise AssertionError("denial retained data")


def positive(session: Session, patient: str) -> dict:
    require_success(session.call("BIND_PATIENT", [patient]))
    result = require_success(session.call("GET_PATIENT_FACTS", ["labs", None]))
    if not result.get("facts"):
        raise AssertionError("positive control returned no facts")
    return result


def cross_patient(session: Session, foreign: str) -> dict:
    positive(session, foreign)
    documents = require_success(session.call("GET_WEB_PATIENT_DATA", ["documents", None]))
    foreign_ids = {row["DOC_ID"] for row in documents.get("rows", [])}
    if not foreign_ids:
        raise AssertionError("foreign document positive control empty")
    document_id = sorted(foreign_ids)[0]
    control = require_success(session.call("GET_WEB_PATIENT_DATA", ["document", document_id]))
    if not control.get("rows"):
        raise AssertionError("foreign source positive control empty")
    positive(session, "PAT-DC-04")
    denied = require_success(session.call("GET_WEB_PATIENT_DATA", ["document", document_id]))
    if denied.get("rows"):
        raise AssertionError("protected foreign source returned rows")
    search = require_success(session.call("SEARCH_PATIENT_DOCUMENTS", [foreign, None]))
    assert_no_foreign(search, foreign_ids)
    return {"foreign_doc_id": document_id, "foreign_rows": 0,
            "search_results": len(search.get("results", []))}


def concurrent_worker(config: tuple[int, Barrier]) -> dict:
    index, barrier = config
    patient = "PAT-DC-04" if index % 2 == 0 else "PAT-DC-07"
    other = "PAT-DC-07" if index % 2 == 0 else "PAT-DC-04"
    with connect() as session:
        foreign = positive(session, other)
        foreign_ids = {row["event_id"] for row in foreign["facts"]}
        documents = require_success(session.call("GET_WEB_PATIENT_DATA", ["documents", None]))
        foreign_documents = {row["DOC_ID"] for row in documents.get("rows", [])}
        if not foreign_documents:
            raise AssertionError("concurrent foreign document positive control empty")
        foreign_ids.update(foreign_documents | {other})
        positive(session, patient)
        barrier.wait(timeout=30)
        payload = require_success(session.call("GET_PATIENT_FACTS", ["labs", None]))
        if not payload.get("facts"):
            raise AssertionError("concurrent positive control empty")
        assert_no_foreign(payload, foreign_ids)
        control = require_success(session.call("SEARCH_PATIENT_DOCUMENTS", [patient, None]))
        if not control.get("results"):
            raise AssertionError("concurrent search positive control empty")
        assert_no_foreign(control, foreign_ids)
        search = require_success(session.call("SEARCH_PATIENT_DOCUMENTS", [other, None]))
        assert_no_foreign(search, foreign_ids)
        identity = session.query("SELECT CURRENT_SESSION() AS ID")
        return {"patient": patient, "session_id": identity[0]["ID"],
                "binding_id": payload["binding_id"],
                "search_results": len(search.get("results", [])),
                "search_positive_results": len(control["results"]),
                "events": session.events}


def concurrent_probe() -> list[dict]:
    barrier = Barrier(10)
    with ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(concurrent_worker, [(i, barrier) for i in range(10)]))
    assert_distinct_sessions([row["session_id"] for row in results], 10)
    if len({row["binding_id"] for row in results}) != 10:
        raise AssertionError("binding reuse")
    return results


def revoked_consent(admin: Session, session: Session) -> dict:
    positive(session, "PAT-DC-04")
    rows = admin.query("SELECT CONSENT_ID, STATUS, REVOKED_AT FROM SAARTHI.GOVERNANCE.CONSENT "
                       "WHERE PATIENT_ID=%s AND STATUS='active'", ("PAT-DC-04",))
    if not rows:
        raise AssertionError("revocation positive control empty")
    try:
        admin.query("UPDATE SAARTHI.GOVERNANCE.CONSENT SET STATUS='revoked', "
                    "REVOKED_AT=CURRENT_TIMESTAMP() WHERE PATIENT_ID=%s AND STATUS='active'",
                    ("PAT-DC-04",), "revoke_synthetic_consent")
        payload = session.call("GET_PATIENT_FACTS", ["labs", None])
        assert_denial(payload)
        again = session.call("GET_PATIENT_FACTS", ["labs", None])
        assert_denial(again)
        return {"subsequent_requests_denied": 2, "in_flight_cancel_verified": False}
    finally:
        for row in rows:
            admin.query("UPDATE SAARTHI.GOVERNANCE.CONSENT SET STATUS=%s,REVOKED_AT=%s "
                        "WHERE CONSENT_ID=%s AND STATUS='revoked'",
                        (row["STATUS"], row["REVOKED_AT"], row["CONSENT_ID"]), "restore_consent")
        positive(session, "PAT-DC-04")
