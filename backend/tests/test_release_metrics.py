import pytest


def test_claim_when_sql_scientific_notation_matches_same_recorded_value() -> None:
    from backend.verification.metrics import matches_expected_claim

    expected = {'evidence_id': 'E1', 'claim_type': 'textual',
                'text': 'Recorded PLT: 182000 /cumm (event time 2026-10-04T09:00:00).'}
    claim = {'claim_type': 'textual', 'evidence': [{'id': 'E1'}],
             'text': 'Recorded PLT: 1.820000000000000e+05 /cumm '
                     '(event time 2026-10-04T09:00:00).'}
    assert matches_expected_claim(expected, claim) is True


def test_claim_when_scientific_value_differs_rejects_approximate_match() -> None:
    from backend.verification.metrics import matches_expected_claim

    expected = {'evidence_id': 'E1', 'claim_type': 'textual',
                'text': 'Recorded PLT: 182000 /cumm (event time 2026-10-04T09:00:00).'}
    claim = {'claim_type': 'textual', 'evidence': [{'id': 'E1'}],
             'text': 'Recorded PLT: 1.82001e+05 /cumm (event time 2026-10-04T09:00:00).'}
    assert matches_expected_claim(expected, claim) is False


def test_split_when_patient_overlap_rejects() -> None:
    from backend.verification.metrics import verify_split

    case = {"qid": "1", "patient_id": "P1", "layout_ids": ["table"],
            "document_hashes": ["hash"]}
    with pytest.raises(ValueError, match="patient"):
        verify_split([case], [{**case, "qid": "2", "layout_ids": ["letter"]}])


def test_metrics_when_answer_missing_counts_full_denominator() -> None:
    from backend.verification.metrics import score

    gold = [{"qid": "1", "expected_class": "CLASS_B", "required_ids": ["E1"],
             "expected_fragments": ["82000"], "supported": True}]
    assert score(gold, [])['correctness'] == {"correct": 0, "total": 1, "rate": 0.0}


def test_percentile_when_samples_empty_rejects() -> None:
    from backend.verification.metrics import percentile95

    with pytest.raises(ValueError, match="empty"):
        percentile95([])


def test_metrics_when_uncited_statement_is_returned_fails_correctness() -> None:
    from backend.verification.metrics import score

    gold = [{"qid": "1", "expected_class": "CLASS_B", "required_ids": ["E1"],
             "expected_fragments": ["82000"], "supported": True}]
    results = [{"qid": "1", "artifact": {"classification": "CLASS_B", "claims": [
        {"text": "82000", "evidence": []}]}, "elapsed_s": 1, "cold": False}]
    assert score(gold, results)["correctness"]["correct"] == 0


def test_entailment_when_document_judgment_missing_counts_failure() -> None:
    from backend.verification.metrics import score

    gold = [{"qid": "1", "expected_class": "CLASS_B", "required_ids": ["A1"],
             "expected_fragments": ["record"], "supported": True}]
    artifact = {"classification": "CLASS_B", "claims": [{"text": "record", "evidence": [
        {"kind": "document_span", "id": "A1"}]}]}
    runs = [{"qid": "1", "artifact": artifact, "elapsed_s": 1, "cold": False}]
    assert score(gold, runs)["document_entailment"] == {"correct": 0, "total": 1, "rate": 0}


def test_correctness_when_expected_number_is_prefix_rejects_wrong_value() -> None:
    from backend.verification.metrics import correct_answer

    gold = {"expected_class": "CLASS_B", "required_ids": ['E1'], "expected_fragments": ['10']}
    artifact = {"classification": "CLASS_B", "claims": [
        {"text": "Recorded Hb: 100", "evidence": [{"kind": "structured", "id": "E1"}]}]}
    assert correct_answer(gold, artifact) is False


def test_metrics_when_request_errors_counts_answer_missing() -> None:
    from backend.verification.metrics import score

    gold = [{"qid": "1", "expected_class": "CLASS_B", "required_ids": [],
             "expected_fragments": [], "supported": True}]
    runs = [{"qid": "1", "error": "timeout", "elapsed_s": 20, "cold": False}]
    assert score(gold, runs)['missing_answers'] == 1


def test_correctness_when_typed_value_contradicts_gold_rejects_matching_prose() -> None:
    from backend.verification.metrics import correct_answer

    gold = {'expected_class': 'CLASS_B', 'required_ids': ['E1'],
            'expected_fragments': ['82000'], 'expected_claims': [
                {'claim_type': 'numeric', 'asserted_value': 82000, 'evidence_id': 'E1'}]}
    artifact = {'classification': 'CLASS_B', 'claims': [
        {'text': 'Recorded 82000', 'claim_type': 'numeric', 'asserted_value': 999999,
         'evidence': [{'kind': 'structured', 'id': 'E1'}]}]}
    assert correct_answer(gold, artifact) is False


def test_metrics_when_unknown_citation_seen_does_not_label_cross_patient_leak() -> None:
    from backend.verification.metrics import score

    gold = [{'qid': '1', 'expected_class': 'CLASS_B', 'required_ids': ['E1'],
             'expected_fragments': ['record'], 'supported': True, 'foreign_ids': ['F1']}]
    artifact = {'classification': 'CLASS_B', 'claims': [
        {'text': 'record', 'evidence': [{'kind': 'structured', 'id': 'UNKNOWN'}]}]}
    runs = [{'qid': '1', 'artifact': artifact, 'elapsed_s': 1, 'cold': False}]
    metrics = score(gold, runs)
    assert (metrics['scope_leaks'], metrics['unknown_citations']) == (0, 1)


def test_latency_when_warehouse_resuming_excludes_sample_from_warm_cohort() -> None:
    from backend.verification.metrics import score

    gold = [{'qid': '1', 'expected_class': 'CLASS_B', 'required_ids': [],
             'expected_fragments': [], 'supported': False}]
    runs = [{'qid': '1', 'artifact': {}, 'elapsed_s': 20, 'cold': None}]
    assert score(gold, runs)['warm']['samples'] == 0


def test_correctness_when_rule_version_and_outcome_differ_rejects_claim() -> None:
    from backend.verification.metrics import matches_expected_claim

    expected = {'evidence_id': 'E1', 'outcome': 'fail', 'rule_id': 'R1', 'rule_version': 1}
    claim = {'outcome': 'pass', 'rule_id': 'R1', 'rule_version': 99,
             'evidence': [{'id': 'E1'}]}
    assert matches_expected_claim(expected, claim) is False


def test_entailment_when_source_judgment_is_reused_cannot_approve_second_claim() -> None:
    from backend.verification.metrics import score

    gold = [{'qid': '1', 'expected_class': 'CLASS_B', 'required_ids': ['A1'],
             'expected_fragments': ['record'], 'supported': True}]
    artifact = {'classification': 'CLASS_B', 'claims': [
        {'text': text, 'evidence': [{'kind': 'document_span', 'id': 'A1'}]}
        for text in ['record', 'contradicts record']]}
    runs = [{'qid': '1', 'artifact': artifact, 'elapsed_s': 1, 'cold': False,
             'document_adjudication': [{'id': 'A1', 'entailed': True}]}]
    assert score(gold, runs)['document_entailment']['correct'] == 0


def test_entailment_when_current_claim_has_bound_adjudication_accepts_only_that_claim() -> None:
    from backend.verification.metrics import document_checks, fingerprint

    artifact = {'claims': [{'text': 'record', 'evidence': [
        {'kind': 'document_span', 'id': 'A1'}]}]}
    judgment = {'id': 'A1', 'claim_index': 0, 'reviewer': 'synthetic-evidence-reviewer',
                'artifact_sha256': fingerprint(artifact),
                'claim_sha256': fingerprint(artifact['claims'][0]), 'entailed': True}
    assert document_checks(artifact, [judgment]) == [True]
