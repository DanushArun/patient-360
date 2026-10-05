"""Frozen synthetic missing-report and conflicting-authorisation challenge inputs."""
from __future__ import annotations


def rule_cases(base: dict, group: str) -> tuple[list[dict], list[dict]]:
    cases, gold = [], []
    encounter = 'ENC-' + base['patient_id'][4:]
    expected = [('DOC-PATH-001', 'not_evaluated'), ('COV-AUTH-001', 'conflicting')]
    for index, (rule, outcome) in enumerate(expected, 11):
        identifier = f'RULE--{encounter}--{rule}--1'
        qid = f"{group.upper()}-{base['patient_id']}-{index:02d}"
        cases.append({**base, 'qid': qid,
                      'question': f'What outcome is recorded for SQL record check {rule}?'})
        gold.append({'qid': qid, 'expected_class': 'CLASS_B', 'supported': True,
            'missing_conflict': True, 'required_ids': [identifier], 'allowed_ids': [identifier],
            'expected_fragments': [], 'expected_claims': [{'evidence_id': identifier,
                'claim_type': 'textual', 'outcome': outcome, 'rule_id': rule, 'rule_version': 1,
                'text': f'SQL record check {rule} version 1: {outcome}. '
                        'This is not treatment clearance.'}]})
    return cases, gold


def workflow_rows(patient: str) -> list[tuple[str, str, dict]]:
    encounter = 'ENC-' + patient[4:]
    coverage = 'COV-' + patient[4:]
    return [('CORE.ENCOUNTER', 'encounter_id', {
        'encounter_id': encounter, 'patient_id': patient, 'facility_id': 'FAC-02',
        'encounter_type': 'daycare', 'scheduled_time': '2026-10-05T09:30:00',
        'event_time': '2026-10-05T09:30:00', 'cycle_number': 1, 'status': 'scheduled'}),
        ('CORE.COVERAGE', 'coverage_id', {
            'coverage_id': coverage, 'patient_id': patient, 'payer_type': 'scheme',
            'payer_name': 'PM-JAY', 'effective_from': '2026-01-01', 'effective_to': '2027-01-01',
            'annual_limit': 500000, 'used_amount': 120000}),
        ('CORE.AUTHORIZATION', 'auth_id', {
            'auth_id': 'AUTH-' + patient[4:], 'coverage_id': coverage, 'patient_id': patient,
            'encounter_id': encounter, 'scheme': 'PM-JAY', 'status': 'pending',
            'letter_status': 'approved', 'requested_at': '2026-10-04T08:00:00',
            'expires_at': '2027-01-01T00:00:00'})]
