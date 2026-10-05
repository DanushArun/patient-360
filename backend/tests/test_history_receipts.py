from copy import deepcopy

import pytest


def test_history_when_prior_receipt_changes_rejects_mutation() -> None:
    from backend.verification.history import require_preserved

    before = [{'TASK_ID': 'E1', 'REASON': 'Acknowledged', 'STATE': 'acknowledged'}]
    after = deepcopy(before)
    after[0]['REASON'] = 'Rewritten'
    with pytest.raises(AssertionError, match='changed'):
        require_preserved(before, after)


def test_history_when_prior_receipt_disappears_rejects_deletion() -> None:
    from backend.verification.history import require_preserved

    with pytest.raises(AssertionError, match='missing'):
        require_preserved([{'TASK_ID': 'E1'}], [])


def test_history_when_new_receipt_appends_preserves_old_receipt() -> None:
    from backend.verification.history import require_preserved

    original = [{'TASK_ID': 'E1', 'REASON': 'Acknowledged'}]
    assert require_preserved(original, original + [{'TASK_ID': 'E2'}]) == 1


def test_history_when_duplicate_receipt_ids_exist_rejects_ambiguous_proof() -> None:
    from backend.verification.history import require_preserved

    with pytest.raises(AssertionError, match='duplicate'):
        require_preserved([{'TASK_ID': 'E1'}], [{'TASK_ID': 'E1'}, {'TASK_ID': 'E1'}])


def test_history_when_stale_version_is_accepted_rejects_write() -> None:
    from backend.verification.history import require_stale_denial

    with pytest.raises(AssertionError, match='stale'):
        require_stale_denial({'task_id': 'T1', 'state': 'resolved'})


def test_history_when_direct_update_is_unauthorized_accepts_security_denial() -> None:
    from types import SimpleNamespace
    from snowflake.connector.errors import ProgrammingError
    from backend.verification.history import deny_direct_mutation

    def denied(*args: object) -> None:
        raise ProgrammingError(msg='Insufficient privileges', errno=3001)

    assert deny_direct_mutation(SimpleNamespace(query=denied), 'T1')['status'] == 'PASS'


def test_history_when_direct_update_has_syntax_error_does_not_count_denial() -> None:
    from types import SimpleNamespace
    from snowflake.connector.errors import ProgrammingError
    from backend.verification.history import deny_direct_mutation

    def broken(*args: object) -> None:
        raise ProgrammingError(msg='Invalid identifier', errno=904)

    with pytest.raises(ProgrammingError, match='Invalid identifier'):
        deny_direct_mutation(SimpleNamespace(query=broken), 'T1')
