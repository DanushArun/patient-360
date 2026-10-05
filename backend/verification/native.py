"""Execute source-defined queries and verify incremental assertion identity stability."""
from __future__ import annotations

import json
import re

from backend.verification.session import Session, require_success


def verified_queries(source: str) -> list[dict]:
    pattern = r"(vq_\w+) AS \(\s*QUESTION '((?:''|[^'])*)'\s*SQL '((?:''|[^'])*)'"
    queries = [{"name": name, "question": question.replace("''", "'"),
                "sql": sql.replace("''", "'")} for name, question, sql in
               re.findall(pattern, source)]
    if len(queries) != 7 or any(not q['sql'].startswith('SELECT ') for q in queries):
        raise ValueError('expected exactly seven read-only verified query definitions')
    return queries


def require_stable(before: list[dict], after: list[dict]) -> None:
    canonical = lambda rows: sorted(json.dumps(row, sort_keys=True, default=str) for row in rows)
    if not before:
        raise AssertionError('empty assertions cannot prove incremental processing')
    if canonical(before) != canonical(after):
        raise AssertionError('assertions changed on duplicate incremental pass')


def assertions(session: Session) -> list[dict]:
    return session.query('SELECT assertion_id, doc_id, page_index, concept_id, value, '
                         'verification_status FROM SAARTHI.EVIDENCE.ASSERTION '
                         'ORDER BY assertion_id', label='assertion_identity_snapshot')


def require_progress(before: list[dict], after: list[dict]) -> list[str]:
    old_ids = {row['ASSERTION_ID'] for row in before}
    new_ids = [row['ASSERTION_ID'] for row in after
               if row['ASSERTION_ID'] not in old_ids
               and row['VERIFICATION_STATUS'] == 'verified']
    if not new_ids or len(new_ids) != len(set(new_ids)):
        raise AssertionError('first pass requires new verified assertions from fresh input')
    return sorted(new_ids)


def incremental(session: Session) -> dict:
    original = assertions(session)
    first = require_success(session.call('ORCHESTRATOR_PROC', []))
    before = assertions(session)
    new_ids = require_progress(original, before)
    second = require_success(session.call('ORCHESTRATOR_PROC', []))
    after = assertions(session)
    require_stable(before, after)
    return {"first": first, "second": second, "assertions": len(after),
            'new_verified_assertion_ids': new_ids,
            "duplicate_assertions": 0}
