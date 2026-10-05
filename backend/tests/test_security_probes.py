from typing import Iterator

import pytest


def test_foreign_document_when_returned_fails_isolation() -> None:
    from backend.verification.security import assert_no_foreign

    with pytest.raises(AssertionError, match="foreign evidence"):
        assert_no_foreign({"results": [{"doc_id": "FOREIGN"}]}, {"FOREIGN"})


def test_connections_when_session_reused_fails_concurrency() -> None:
    from backend.verification.security import assert_distinct_sessions

    with pytest.raises(AssertionError, match="session reuse"):
        assert_distinct_sessions([1, 2, 1], 3)


def test_denial_when_payload_contains_rows_fails_revocation() -> None:
    from backend.verification.security import assert_denial

    with pytest.raises(AssertionError, match="retained data"):
        assert_denial({"error": "access_withdrawn", "facts": [{"value": 10}]})


def test_security_report_when_inflight_cancellation_unproved_is_partial() -> None:
    from backend.verification.security import security_status

    probes = {name: {'status': 'PASS'} for name in ('A', 'B', 'C', 'D')}
    probes['C']['in_flight_cancel_verified'] = False
    assert security_status(probes) == 'PARTIAL'


def test_security_report_when_required_probe_missing_fails() -> None:
    from backend.verification.security import security_status

    assert security_status({'A': {'status': 'PASS'}}) == 'FAIL'


def test_security_report_when_every_probe_and_cancellation_proved_passes() -> None:
    from backend.verification.security import security_status

    probes = {name: {'status': 'PASS'} for name in ('A', 'B', 'C', 'D')}
    probes['C']['in_flight_cancel_verified'] = True
    assert security_status(probes) == 'PASS'


class SearchIsolationSession:
    def __init__(self, search_patient: str | None) -> None:
        self.patient = ''
        self.search_patient = search_patient
        self.events = []

    def call(self, name: str, arguments: list) -> dict:
        if name == 'BIND_PATIENT':
            self.patient = arguments[0]
            return {'binding_id': self.patient}
        if name == 'GET_PATIENT_FACTS':
            return {'facts': [{'event_id': self.patient + '-EVENT'}],
                    'binding_id': self.patient + '-BINDING'}
        if name == 'GET_WEB_PATIENT_DATA':
            return {'rows': [{'DOC_ID': self.patient + '-DOC'}]}
        if name == 'SEARCH_PATIENT_DOCUMENTS':
            return {'results': ([{'doc_id': self.search_patient + '-DOC'}]
                                if self.search_patient else [])}
        raise AssertionError('Unexpected procedure: ' + name)

    def query(self, sql: str) -> list[dict]:
        return [{'ID': 100}]


def worker_session(monkeypatch: pytest.MonkeyPatch, patient: str | None) -> None:
    from contextlib import contextmanager
    from backend.verification import security

    @contextmanager
    def connect() -> Iterator[SearchIsolationSession]:
        yield SearchIsolationSession(patient)

    monkeypatch.setattr(security, 'connect', connect)


def test_concurrent_worker_when_search_leaks_foreign_document_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from threading import Barrier
    from backend.verification.security import concurrent_worker

    worker_session(monkeypatch, 'PAT-DC-07')
    with pytest.raises(AssertionError, match='foreign evidence'):
        concurrent_worker((0, Barrier(1)))


def test_concurrent_worker_when_search_scoped_records_search_count(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from threading import Barrier
    from backend.verification.security import concurrent_worker

    worker_session(monkeypatch, 'PAT-DC-04')
    assert concurrent_worker((0, Barrier(1)))['search_results'] == 1


def test_concurrent_worker_when_search_positive_control_empty_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from threading import Barrier
    from backend.verification.security import concurrent_worker

    worker_session(monkeypatch, None)
    with pytest.raises(AssertionError, match='search positive control empty'):
        concurrent_worker((0, Barrier(1)))
