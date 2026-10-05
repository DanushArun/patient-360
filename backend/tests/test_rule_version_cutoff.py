import re
import sqlite3
from pathlib import Path

import pytest


@pytest.mark.parametrize('cursor', ['c_rules', 'c_special'])
def test_rule_when_version_outside_snapshot_excludes_it(cursor: str) -> None:
    source = Path('backend/sql/procedures/evaluate_gates.sql').read_text()
    query = source.split(f'{cursor} CURSOR FOR', 1)[1].split('ORDER BY specificity DESC;', 1)[0]
    predicate = re.search(r'effective_from <= \?\s+AND \(effective_to IS NULL OR '
                          r'effective_to > \?\)', query)
    if predicate is None:
        raise AssertionError('Rule catalogue has no snapshot validity filter')
    with sqlite3.connect(':memory:') as db:
        db.execute('CREATE TABLE rules(version,effective_from,effective_to)')
        db.executemany('INSERT INTO rules VALUES (?,?,?)', [
            (1, '2026-10-01', '2026-10-03'), (2, '2026-10-03', None),
            (3, '2026-10-06', None)])
        result = db.execute('SELECT version FROM rules WHERE ' + predicate[0],
                            ('2026-10-02', '2026-10-02')).fetchall()
    assert result == [(1,)]
