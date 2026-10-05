from pathlib import Path
import pytest


def test_verified_queries_when_repository_definition_read_has_seven_selects() -> None:
    from backend.verification.native import verified_queries

    source = Path('backend/sql/semantic/01_semantic_view.sql').read_text()
    queries = verified_queries(source)
    assert len(queries) == 7 and all(q['sql'].startswith('SELECT ') for q in queries)


def test_incremental_when_second_pass_changes_assertions_rejects_duplicate() -> None:
    from backend.verification.native import require_stable

    with pytest.raises(AssertionError, match='changed'):
        require_stable([{'ID': 'A1'}], [{'ID': 'A1'}, {'ID': 'A2'}])


def test_incremental_when_first_pass_does_no_new_work_rejects_empty_proof() -> None:
    from backend.verification.native import require_progress

    rows = [{'ASSERTION_ID': 'A1', 'VERIFICATION_STATUS': 'verified'}]
    with pytest.raises(AssertionError, match='new verified'):
        require_progress(rows, rows)


def test_incremental_when_new_assertion_is_unverified_rejects_positive_work() -> None:
    from backend.verification.native import require_progress

    with pytest.raises(AssertionError, match='new verified'):
        require_progress([], [{'ASSERTION_ID': 'A1', 'VERIFICATION_STATUS': 'conflicting'}])


def test_incremental_when_new_verified_assertion_exists_counts_positive_work() -> None:
    from backend.verification.native import require_progress

    after = [{'ASSERTION_ID': 'A1', 'VERIFICATION_STATUS': 'verified'}]
    assert require_progress([], after) == ['A1']


def test_install_when_database_exists_rejects_destructive_rehearsal() -> None:
    from backend.verification.preflight import require_empty_database

    with pytest.raises(AssertionError, match='disposable'):
        require_empty_database([{'name': 'SAARTHI'}])


def test_install_when_manifest_loaded_grants_follow_agent_and_mcp() -> None:
    source = Path('backend/sql/setup.sql').read_text()
    grants = source.index("EXECUTE IMMEDIATE FROM './governance/03_grants.sql'")
    assert grants > source.index("EXECUTE IMMEDIATE FROM './agent/saarthi_mcp.sql'")


def test_grants_when_app_is_configured_has_no_raw_agent_or_internal_helpers() -> None:
    source = Path('backend/sql/governance/03_grants.sql').read_text()
    prohibited = ('GRANT USAGE ON ALL PROCEDURES', 'GRANT USAGE ON FUTURE PROCEDURES',
                  'GRANT USAGE ON AGENT', 'GRANT USAGE ON PROCEDURE '
                  'SAARTHI.OPERATIONAL.ANSWER_GATEWAY_FINALIZE')
    assert not any(token in source for token in prohibited)


def test_search_when_serving_suspended_rejects_preflight() -> None:
    from backend.verification.preflight import require_search_ready

    with pytest.raises(AssertionError, match='RUNNING'):
        require_search_ready({'serving_state': 'SUSPENDED'}, 'patient')


def test_search_when_patient_service_reads_reference_corpus_rejects_preflight() -> None:
    from backend.verification.preflight import require_search_ready

    row = {'serving_state': 'RUNNING', 'indexing_state': 'RUNNING',
           'source_data_num_rows': 1, 'indexing_error': None,
           'definition': "SELECT * FROM SAARTHI.DOCUMENTS.DOC_CHUNK WHERE doc_scope='reference'"}
    with pytest.raises(AssertionError, match='corpus'):
        require_search_ready(row, 'patient')


def test_search_normalization_when_literal_case_differs_preserves_distinction() -> None:
    from backend.verification.preflight import normalize_search_query

    assert normalize_search_query("doc_scope='PATIENT'") != normalize_search_query(
        "doc_scope='patient'")


def test_backend_health_when_preview_html_returned_rejects_release() -> None:
    from backend.verification.preflight import require_backend_health

    with pytest.raises(AssertionError, match='JSON'):
        require_backend_health(b'<html>Recorded preview</html>', 'a' * 40)


def test_backend_health_when_revision_different_rejects_release() -> None:
    import json
    from backend.verification.preflight import require_backend_health

    body = {'status': 'ready', 'service': 'saarthi-web-backend',
            'release_revision': 'b' * 40,
            'database': {'status': 'ready', 'query_id': '01c78441-0004-0e08-0001-fe5a00170f02'}}
    with pytest.raises(AssertionError, match='revision'):
        require_backend_health(json.dumps(body).encode(), 'a' * 40)


def test_backend_health_when_query_receipt_missing_rejects_release() -> None:
    import json
    from backend.verification.preflight import require_backend_health

    body = {'status': 'ready', 'service': 'saarthi-web-backend',
            'release_revision': 'a' * 40, 'database': {'status': 'ready', 'query_id': None}}
    with pytest.raises(AssertionError, match='query receipt'):
        require_backend_health(json.dumps(body).encode(), 'a' * 40)


def test_backend_health_when_revision_and_sql_receipt_match_accepts_release() -> None:
    import json
    from backend.verification.preflight import require_backend_health

    body = {'status': 'ready', 'service': 'saarthi-web-backend',
            'release_revision': 'a' * 40,
            'database': {'status': 'ready', 'query_id': '01c78441-0004-0e08-0001-fe5a00170f02'}}
    assert require_backend_health(json.dumps(body).encode(), 'a' * 40) == body
