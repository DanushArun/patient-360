import json

import pytest


def category_results() -> dict:
    denial = {'error': 'consent_not_valid', 'known_as_of': '2026-10-05T00:00:00'}
    return {'labs': denial, 'identity': denial,
            'timeline': {**denial, 'error': 'clinical_consent_required'},
            'changes': {**denial, 'error': 'clinical_consent_required'},
            'coverage': {'facts': [{'payer_name': 'PM-JAY'}], 'known_as_of': denial['known_as_of']},
            'claims': {'claims': [], 'known_as_of': denial['known_as_of']},
            'gates': {'gates': [{'gate': 'coverage'}], 'known_as_of': denial['known_as_of']}}


def test_category_probe_when_denial_contains_facts_fails() -> None:
    from backend.verification.consent_categories import assert_category_results

    results = category_results()
    results['labs'] = {**results['labs'], 'facts': [{'value': 82000}]}
    with pytest.raises(AssertionError, match='denial retained'):
        assert_category_results(results)


def test_category_probe_when_financial_positive_control_empty_fails() -> None:
    from backend.verification.consent_categories import assert_category_results

    results = category_results()
    results['coverage']['facts'] = []
    with pytest.raises(AssertionError, match='financial positive'):
        assert_category_results(results)


def test_category_probe_when_clinical_gate_leaks_fails() -> None:
    from backend.verification.consent_categories import assert_category_results

    results = category_results()
    results['gates']['gates'].append({'gate': 'clinical'})
    with pytest.raises(AssertionError, match='gate leaked'):
        assert_category_results(results)


def test_category_probe_when_all_controls_hold_reports_absolute_counts() -> None:
    from backend.verification.consent_categories import assert_category_results

    assert assert_category_results(category_results()) == {
        'denied_domains': 4, 'accepted_forbidden_claims': 0,
        'authorized_financial_rows': 1, 'authorized_financial_gates': 1}


class CategorySession:
    def query(self, sql: str, params: tuple = (), label: str = 'query') -> list[dict]:
        if sql.startswith('SELECT'):
            return [{'CLOCK': '2026-10-05T00:00:00'}]
        if 'VALIDATE_ANSWER(PARSE_JSON(%s),%s)' not in sql:
            raise AssertionError('variant input must use explicit PARSE_JSON')
        return [{'RESULT': {'claims': [], 'known_as_of': params[1]}}]

    def call(self, name: str, args: list) -> dict:
        if name == 'VALIDATE_ANSWER':
            raise AssertionError('variant input must use explicit PARSE_JSON')
        domain = 'identity' if args[0] == 'demographics' else args[0]
        tools = {'GET_READINESS': 'gates', 'GET_TIMELINE': 'timeline', 'GET_CHANGES': 'changes'}
        return category_results()[tools.get(name, domain)]


def test_category_probe_when_candidate_array_bound_parses_json_before_sql_validation() -> None:
    from backend.verification.consent_categories import category_results as collect_results

    assert collect_results(CategorySession())['claims']['claims'] == []


class ConsentAdmin:
    def __init__(self) -> None:
        self.categories = ['clinical', 'identity', 'financial']

    def query(self, sql: str, params: tuple = (), label: str = 'query') -> list[dict]:
        if sql.startswith('SELECT'):
            return [{'CATEGORIES': json.dumps(self.categories)}]
        self.categories = json.loads(params[0]) if 'PARSE_JSON' in sql else ['financial']
        return []


def test_category_probe_when_dependency_fails_restores_exact_original_consent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from backend.verification import consent_categories

    def positive_control(session: object, patient: str) -> dict:
        return {'facts': [{'event_id': 'EVT-DC-04-PLT'}]}

    def failed_dependency(session: object) -> dict:
        raise OSError('dependency timeout')

    class BaselineSession:
        def call(self, name: str, args: list) -> dict:
            return {'consent_id': 'CON-DC-04'}

    admin = ConsentAdmin()
    monkeypatch.setattr(consent_categories, 'positive', positive_control)
    monkeypatch.setattr(consent_categories, 'category_results', failed_dependency)
    with pytest.raises(OSError, match='dependency timeout'):
        consent_categories.verify_categories(admin, BaselineSession())
    assert admin.categories == ['clinical', 'identity', 'financial']
