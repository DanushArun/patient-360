"""Reversible category isolation probe on the fixed synthetic PAT-DC-04 fixture."""
import json

from backend.verification.security import positive
from backend.verification.session import Session, require_success, variant


def assert_category_results(results: dict) -> dict[str, int]:
    for domain in ('labs', 'identity', 'timeline', 'changes'):
        denial = results[domain]
        expected = 'consent_not_valid' if domain in ('labs', 'identity') else (
            'clinical_consent_required')
        if denial.get('error') != expected:
            raise AssertionError('category denial absent')
        if any(denial.get(key) for key in ('facts', 'rows', 'claims', 'results',
                                          'timeline', 'changes')):
            raise AssertionError('category denial retained data')
    if not results['coverage'].get('facts'):
        raise AssertionError('financial positive control empty')
    if results['claims'].get('claims') != []:
        raise AssertionError('forbidden candidate claim leaked')
    gates = results['gates'].get('gates')
    if not gates or any(gate.get('gate') != 'coverage' for gate in gates):
        raise AssertionError('nonfinancial gate leaked or positive control absent')
    if any(not payload.get('known_as_of') for payload in results.values()):
        raise AssertionError('category response clock absent')
    return {'denied_domains': 4, 'accepted_forbidden_claims': 0,
            'authorized_financial_rows': len(results['coverage']['facts']),
            'authorized_financial_gates': len(gates)}


def category_results(session: Session) -> dict:
    clock = session.query("SELECT TO_VARCHAR(CURRENT_TIMESTAMP()::TIMESTAMP_NTZ, "
                          "'YYYY-MM-DD\"T\"HH24:MI:SS') AS CLOCK")[0]['CLOCK']
    claims = [{'claim_type': 'textual', 'text': 'Recorded source',
               'evidence': [{'kind': 'structured', 'id': pointer}]} for pointer in (
                   'EVT-DC-04-PLT', 'ROW-PATIENT--PAT-DC-04')]
    return {'labs': session.call('GET_PATIENT_FACTS', ['labs', clock]),
            'identity': session.call('GET_PATIENT_FACTS', ['demographics', clock]),
            'timeline': session.call('GET_TIMELINE', [clock]),
            'changes': session.call('GET_CHANGES', ['2026-10-01T00:00:00', clock]),
            'coverage': require_success(session.call('GET_PATIENT_FACTS', ['coverage', clock])),
            'claims': require_success(variant(session.query(
                'CALL SAARTHI.OPERATIONAL.VALIDATE_ANSWER(PARSE_JSON(%s),%s)',
                (json.dumps(claims), clock), 'VALIDATE_ANSWER'))),
            'gates': require_success(session.call('GET_READINESS', ['ENC-DC-04', clock]))}


def consent_snapshot(admin: Session, consent: str) -> str:
    rows = admin.query('SELECT TO_JSON(DATA_CATEGORIES) AS CATEGORIES '
                       'FROM SAARTHI.GOVERNANCE.CONSENT WHERE CONSENT_ID=%s', (consent,))
    if len(rows) != 1 or not isinstance(json.loads(rows[0]['CATEGORIES']), list):
        raise AssertionError('synthetic consent snapshot unavailable')
    return rows[0]['CATEGORIES']


def restore_categories(admin: Session, consent: str, original: str) -> None:
    admin.query('UPDATE SAARTHI.GOVERNANCE.CONSENT '
                'SET DATA_CATEGORIES=PARSE_JSON(%s)::ARRAY WHERE CONSENT_ID=%s '
                "AND ARRAY_SIZE(DATA_CATEGORIES)=1 "
                "AND ARRAY_CONTAINS('financial'::VARIANT,DATA_CATEGORIES)",
                (original, consent), 'restore_synthetic_categories')
    if json.loads(consent_snapshot(admin, consent)) != json.loads(original):
        raise AssertionError('original synthetic consent categories not restored')


def verify_categories(admin: Session, session: Session) -> dict:
    positive(session, 'PAT-DC-04')
    baseline = require_success(session.call('GET_READINESS', ['ENC-DC-04', None]))
    consent = baseline['consent_id']
    original = consent_snapshot(admin, consent)
    try:
        admin.query('UPDATE SAARTHI.GOVERNANCE.CONSENT '
                    "SET DATA_CATEGORIES=ARRAY_CONSTRUCT('financial') WHERE CONSENT_ID=%s",
                    (consent,), 'narrow_synthetic_categories')
        results = category_results(session)
        summary = assert_category_results(results)
    finally:
        restore_categories(admin, consent, original)
    positive(session, 'PAT-DC-04')
    return {'status': 'PASS', 'counts': summary, 'responses': results,
            'original_categories_restored': True, 'consent_id': consent}
