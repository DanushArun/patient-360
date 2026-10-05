import re
import sqlite3
from pathlib import Path

import pytest


def selected_value(rows: list[tuple], unit: str | None = '/cumm') -> float | None:
    source = Path('backend/sql/procedures/evaluate_gates.sql').read_text()
    loop = source.split('WHILE (v_rule_id IS NOT NULL) DO', 1)[1]
    sql = loop[loop.index('SELECT '):].split('LIMIT 1;', 1)[0] + 'LIMIT 1'
    sql = re.sub(r"DATEDIFF\('day', he.event_time, :v_scheduled\)", '0', sql)
    sql = re.sub(r'\s+INTO .*?\s+FROM', ' FROM', sql, flags=re.S)
    sql = sql.replace('SAARTHI.CORE.DT_HARMONIZED_EVENTS', 'events')
    with sqlite3.connect(':memory:') as db:
        db.execute('CREATE TABLE events(patient_id,concept_name,value_num,event_id,'
                   'derivation,event_time,ingested_at,plausibility_state,unit)')
        db.executemany('INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?)',
                       [row + (unit,) for row in rows])
        result = db.execute(sql, {'p_patient_id': 'P1', 'v_concept': 'PLT',
                                 'v_known_as_of': '2026-10-05', 'v_expected_unit': '/uL'}).fetchone()
    return result[0] if result else None


@pytest.mark.parametrize('state', ['unreadable', 'conflicting', None])
def test_gate_when_latest_value_not_present_does_not_compare_threshold(state: str | None) -> None:
    assert selected_value([('P1', 'PLT', 82000, 'A', None,
                            '2026-10-03', '2026-10-04', state)]) is None


def test_gate_when_later_value_unreadable_does_not_resurrect_older_valid_value() -> None:
    assert selected_value([
        ('P1', 'PLT', 120000, 'A', None, '2026-10-02', '2026-10-03', 'present'),
        ('P1', 'PLT', 82000, 'B', None, '2026-10-03', '2026-10-04', 'unreadable')]) is None


def test_gate_when_latest_value_present_returns_record_number() -> None:
    assert selected_value([('P1', 'PLT', 82000, 'A', None,
                            '2026-10-03', '2026-10-04', 'present')]) == 82000


@pytest.mark.parametrize('unit', ['lakhs/cumm', None])
def test_gate_when_value_unit_does_not_match_rule_withholds_number(unit: str | None) -> None:
    assert selected_value([('P1', 'PLT', 82000, 'A', None,
                            '2026-10-03', '2026-10-04', 'present')], unit) is None
