import pytest
from pathlib import Path


def test_document_gold_when_verified_fact_matches_freezes_actual_assertion_id() -> None:
    from backend.verification.evaluation_inputs import document_gold

    selector = {'qid': 'H1', 'asserted_value': 182000}
    rows = [{'ASSERTION_ID': 'actual-sql-id', 'VALUE': '182000',
             'PASS1_VALUE': '182000', 'PASS2_VALUE': '182000'}]
    assert document_gold(selector, rows)['required_ids'] == ['actual-sql-id']


def test_document_gold_when_two_passes_disagree_refuses_freeze() -> None:
    from backend.verification.evaluation_inputs import document_gold

    rows = [{'ASSERTION_ID': 'id', 'VALUE': '182000',
             'PASS1_VALUE': '182000', 'PASS2_VALUE': '18200'}]
    with pytest.raises(ValueError, match='two_pass'):
        document_gold({'qid': 'H1', 'asserted_value': 182000}, rows)


def test_document_gold_when_verified_fact_ambiguous_refuses_freeze() -> None:
    from backend.verification.evaluation_inputs import document_gold

    with pytest.raises(ValueError, match='unique'):
        document_gold({'qid': 'H1', 'asserted_value': 182000}, [])


def test_freeze_when_another_writer_holds_lock_refuses_queries(tmp_path: Path) -> None:
    from backend.verification.evaluation_inputs import freeze_gold
    from backend.verification.session import Session

    (tmp_path / '.freeze.lock').write_text('other writer')
    with pytest.raises(ValueError, match='in progress'):
        freeze_gold(Session(None), tmp_path)
