"""Dropped-response injection: retry the same request and verify persisted identity."""
from __future__ import annotations

from collections.abc import Callable
import json
from uuid import uuid4

from backend.verification.session import Session, require_success


def require_uploaded(rows: list[dict], filename: str) -> None:
    if len(rows) != 1:
        raise AssertionError('expected one new upload receipt')
    row = {key.lower(): value for key, value in rows[0].items()}
    if row.get('status') != 'UPLOADED' or row.get('target') != filename:
        raise AssertionError('a new upload is required; staged old bytes are not proof')


def require_rule_causality(assertion_ids: list[str], rules: list[dict], expected: dict) -> None:
    if len(rules) != 1:
        raise AssertionError('expected exactly one current rule result')
    rule = rules[0]
    if (rule['RULE_VERSION'] != expected['expected_rule_version']
            or rule['OUTCOME'] != expected['expected_outcome']):
        raise AssertionError('rule version or outcome differs from expected fixture')
    evidence = rule['EVIDENCE_IDS']
    evidence = json.loads(evidence) if isinstance(evidence, str) else evidence
    if not isinstance(evidence, list) or not set(assertion_ids).intersection(evidence):
        raise AssertionError('rule does not cite an assertion from the new document')


def retry_dropped_response(write: Callable[[str], dict], key: str) -> dict:
    committed = require_success(write(key))
    recovered = require_success(write(key))
    if not committed.get('task_id') or recovered.get('task_id') != committed['task_id']:
        raise AssertionError('write retry was not idempotent')
    return recovered


def save_answer(session: Session, question: str, answer: dict) -> str:
    identifier = str(uuid4())
    ids = list({e['id'] for c in answer['claims'] for e in c['evidence']})
    result = session.query('CALL SAARTHI.OPERATIONAL.RECORD_WEB_ANSWER('
                           '%s,%s,PARSE_JSON(%s)::ARRAY,%s,%s)',
                           (question, answer['known_as_of'], json.dumps(ids), identifier,
                            answer['overall_status']), label='save_validated_answer')
    from backend.verification.session import variant
    if require_success(variant(result)).get('run_id') != identifier:
        raise AssertionError('answer receipt identity mismatch')
    return identifier


def save_action(session: Session, config: dict) -> dict:
    key = str(uuid4())
    write = lambda request: session.call('CREATE_REVIEW_TASK', [config['issue_id'],
        'request_document', 'Synthetic golden-loop evidence follow-up', request])
    recovered = retry_dropped_response(write, key)
    return {'saved_action_id': recovered['task_id'], 'request_key': key,
            'response_drop_injection': 'client deliberately discards first committed response'}
