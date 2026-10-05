import json
from pathlib import Path

import pytest

from backend.scripts.run_evaluation_benchmark import attach_adjudication, captured_runs


def test_gold_when_only_prose_fragments_supplied_rejects(tmp_path: Path) -> None:
    from backend.verification import metrics

    gold = [{'qid': 'Q1', 'expected_class': 'CLASS_B', 'required_ids': ['E1'],
             'expected_fragments': ['82000'], 'supported': True}]
    with pytest.raises(ValueError, match='expected_claims'):
        metrics.verify_gold(gold)


def test_gold_when_claim_has_only_citation_rejects() -> None:
    from backend.verification import metrics

    gold = [{'qid': 'Q1', 'expected_class': 'CLASS_B', 'required_ids': ['E1'],
             'expected_claims': [{'evidence_id': 'E1'}], 'supported': True}]
    with pytest.raises(ValueError, match='factual'):
        metrics.verify_gold(gold)


def test_gold_when_canonical_claim_is_supplied_accepts() -> None:
    from backend.verification import metrics

    gold = [{'qid': 'Q1', 'expected_class': 'CLASS_B', 'required_ids': ['E1'],
             'expected_claims': [{'evidence_id': 'E1', 'text': 'Recorded PLT: 82000 /cumm'}],
             'supported': True}]
    assert metrics.verify_gold(gold) is None


def test_capture_when_freeze_changed_rejects(tmp_path: Path) -> None:
    path = tmp_path / 'capture.json'
    path.write_text(json.dumps({'freeze': {'gold': 'old'}, 'runs': [], 'events': []}))
    with pytest.raises(ValueError, match='freeze differs'):
        captured_runs(path, {'gold': 'new'})


def test_capture_when_freeze_matches_preserves_runs_and_receipts(tmp_path: Path) -> None:
    path = tmp_path / 'capture.json'
    payload = {'freeze': {'gold': 'hash'}, 'runs': [{'qid': 'Q1', 'error': 'timeout'}],
               'events': [{'query_id': 'actual-receipt'}]}
    path.write_text(json.dumps(payload))
    assert captured_runs(path, payload['freeze']) == (payload['runs'], payload['events'])


def test_adjudication_when_question_unknown_rejects(tmp_path: Path) -> None:
    path = tmp_path / 'judgments.jsonl'
    path.write_text(json.dumps({'qid': 'unknown', 'citations': []}))
    with pytest.raises(ValueError, match='unknown captured question'):
        attach_adjudication([{'qid': 'Q1'}], path)


def test_correctness_when_no_claim_expected_rejects_unexpected_factual_answer() -> None:
    from backend.verification.metrics import correct_answer

    gold = {'expected_class': 'CLASS_B', 'expected_claims': [], 'required_ids': [],
            'expected_fragments': ['not received'], 'supported': False}
    artifact = {'classification': 'CLASS_B', 'limitations': ['Final report not received'],
        'claims': [{'text': 'Final report is negative', 'claim_type': 'status',
            'asserted_value': 'negative', 'evidence': [{'kind': 'structured', 'id': 'E1'}]}]}
    assert correct_answer(gold, artifact) is False


def test_correctness_when_no_claim_expected_accepts_recorded_missingness_only() -> None:
    from backend.verification.metrics import correct_answer

    gold = {'expected_class': 'CLASS_B', 'expected_claims': [], 'required_ids': [],
            'expected_fragments': ['not received'], 'supported': False}
    artifact = {'classification': 'CLASS_B', 'limitations': ['Final report not received'],
                'claims': []}
    assert correct_answer(gold, artifact) is True
