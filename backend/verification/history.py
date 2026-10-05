"""Verify append-only operator receipts and optimistic locking on synthetic tasks."""
from __future__ import annotations

from typing import Any
from uuid import uuid4

from snowflake.connector.errors import ProgrammingError

from backend.verification.session import Session, require_success


def indexed(rows: list[dict]) -> dict[str, dict]:
    result = {row['TASK_ID']: row for row in rows}
    if len(result) != len(rows):
        raise AssertionError('duplicate receipt identities')
    return result


def require_preserved(before: list[dict], after: list[dict]) -> int:
    original, current = indexed(before), indexed(after)
    for identifier, row in original.items():
        if identifier not in current:
            raise AssertionError('prior history receipt missing')
        if current[identifier] != row:
            raise AssertionError('prior history receipt changed')
    return len(original)


def require_stale_denial(result: dict) -> None:
    if result.get('error') != 'stale_task':
        raise AssertionError('stale task version was not rejected')


def read_history(admin: Session, task: str) -> list[dict]:
    return admin.query('SELECT * FROM SAARTHI.OPERATIONAL.REVIEW_TASK '
                       'WHERE STARTSWITH(idempotency_key,%s) ORDER BY task_id',
                       ('web-event:' + task + ':',), 'history_receipt_readback')


def task_version(session: Session, task: str, rule: str) -> int:
    payload = require_success(session.call('GET_WEB_PATIENT_DATA', ['tasks', rule]))
    rows = [row for row in payload.get('rows', []) if row['TASK_ID'] == task]
    if len(rows) != 1 or rows[0]['STATE'] != 'open' or rows[0]['IS_EVENT']:
        raise AssertionError('history verification requires one fresh open synthetic task')
    return int(rows[0]['ISSUE_VERSION'])


def transition(session: Session, task: str, config: dict) -> dict:
    args = [task, config['action'], None, config['note'], config['version'], config['key']]
    result = require_success(session.call('UPDATE_WEB_REVIEW_TASK', args))
    if result.get('task_id') != task:
        raise AssertionError('transition returned a different task identity')
    return result


def deny_direct_mutation(session: Session, task: str) -> dict[str, Any]:
    try:
        session.query('UPDATE SAARTHI.OPERATIONAL.REVIEW_TASK SET reason=reason '
                      'WHERE task_id=%s', (task,), 'direct_history_mutation_denial')
    except ProgrammingError as error:
        message = str(error).lower()
        if error.errno not in {2003, 3001} or not any(
                text in message for text in ('privilege', 'not authorized')):
            raise
        return {'status': 'PASS', 'error_code': error.errno}
    raise AssertionError('application role can directly mutate history')


def verify_history(admin: Session, session: Session, task: str, rule: str) -> dict:
    version = task_version(session, task, rule)
    initial = read_history(admin, task)
    if initial:
        raise AssertionError('history verification requires a new task without receipts')
    acknowledge = {'action': 'acknowledge', 'note': 'Synthetic receipt verification',
                   'version': version, 'key': str(uuid4())}
    transition(session, task, acknowledge)
    first = read_history(admin, task)
    if len(first) != 1 or first[0]['DECISION'] != 'acknowledge':
        raise AssertionError('acknowledgement receipt missing or duplicated')
    retry = transition(session, task, acknowledge)
    if retry.get('idempotent_replay') is not True:
        raise AssertionError('acknowledgement retry was not idempotent')
    stale = session.call('UPDATE_WEB_REVIEW_TASK', [task, 'resolve', None,
                         'Synthetic stale update', version, str(uuid4())])
    require_stale_denial(stale)
    require_preserved(first, read_history(admin, task))
    resolve = {'action': 'resolve', 'note': 'Synthetic workflow verification complete',
               'version': version + 1, 'key': str(uuid4())}
    transition(session, task, resolve)
    final = read_history(admin, task)
    preserved = require_preserved(first, final)
    if len(final) != 2 or {r['DECISION'] for r in final} != {'acknowledge', 'resolve'}:
        raise AssertionError('expected exactly two append-only transition receipts')
    denial = deny_direct_mutation(session, task)
    return {'status': 'PASS', 'task_id': task, 'receipt_ids': [r['TASK_ID'] for r in final],
            'prior_receipts_preserved': preserved, 'stale_update_denied': True,
            'application_direct_update': denial, 'boundary': 'app role; not admin tamper proof'}
