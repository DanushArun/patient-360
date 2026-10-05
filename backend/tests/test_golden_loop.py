import pytest


def test_retry_when_first_response_dropped_reuses_identity() -> None:
    from backend.verification.golden import retry_dropped_response

    calls = []

    def write(key: str) -> dict:
        calls.append(key)
        return {'task_id': 'T1'}

    assert retry_dropped_response(write, 'same-request') == {'task_id': 'T1'}
    assert calls == ['same-request', 'same-request']


def test_retry_when_server_changes_task_rejects_nonidempotent_write() -> None:
    from backend.verification.golden import retry_dropped_response

    calls = []

    def write(key: str) -> dict:
        calls.append(key)
        return {'task_id': str(len(calls))}

    with pytest.raises(AssertionError, match='idempotent'):
        retry_dropped_response(write, 'same-request')


def test_rule_when_new_document_is_absent_from_evidence_rejects_stale_outcome() -> None:
    from backend.verification.golden import require_rule_causality

    rules = [{'RULE_VERSION': 1, 'OUTCOME': 'conflicting', 'EVIDENCE_IDS': ['OLD']}]
    expected = {'expected_rule_version': 1, 'expected_outcome': 'conflicting'}
    with pytest.raises(AssertionError, match='new document'):
        require_rule_causality(['NEW'], rules, expected)


def test_rule_when_expected_outcome_is_wrong_rejects_receipt() -> None:
    from backend.verification.golden import require_rule_causality

    rules = [{'RULE_VERSION': 1, 'OUTCOME': 'pass', 'EVIDENCE_IDS': ['NEW']}]
    expected = {'expected_rule_version': 1, 'expected_outcome': 'conflicting'}
    with pytest.raises(AssertionError, match='outcome'):
        require_rule_causality(['NEW'], rules, expected)


def test_upload_when_existing_stage_file_is_skipped_rejects_old_bytes() -> None:
    from backend.verification.golden import require_uploaded

    with pytest.raises(AssertionError, match='new upload'):
        require_uploaded([{'status': 'SKIPPED', 'target': 'report.pdf'}], 'report.pdf')
