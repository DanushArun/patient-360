from pathlib import Path
import re
import sqlite3

import pytest


def recorded_age(dob: str, cutoff: str) -> int:
    source = Path('backend/sql/procedures/evaluate_gates.sql').read_text()
    query = re.search(r'LET v_age\s+FLOAT := \((SELECT.*?)\);', source, re.S)
    if query is None:
        raise AssertionError('CrCl age query missing')
    sql = re.sub(r' AT\(TIMESTAMP => :v_snapshot\)|::DATE', '', query[1])
    sql = sql.replace('SAARTHI.CORE.PATIENT', 'patient')
    with sqlite3.connect(':memory:') as db:
        db.create_function('DATEDIFF', 3, year_difference)
        db.create_function('TO_CHAR', 2, month_day)
        db.create_function('IFF', 3, choose)
        db.execute('CREATE TABLE patient(patient_id,dob)')
        db.execute('INSERT INTO patient VALUES (?,?)', ('P1', dob))
        return db.execute(sql, {'p_patient_id': 'P1', 'v_known_as_of': cutoff}).fetchone()[0]


def year_difference(unit: str, start: str, end: str) -> int:
    if unit != 'year':
        raise ValueError('Only year differences are used by this age query')
    return int(end[:4]) - int(start[:4])


def month_day(value: str, format_name: str) -> str:
    if format_name != 'MMDD':
        raise ValueError('Only birthday month/day comparisons are supported')
    return value[5:7] + value[8:10]


def choose(condition: bool, yes: int, no: int) -> int:
    return yes if condition else no


@pytest.mark.parametrize(('cutoff', 'age'), [
    ('2026-10-04', 45), ('2026-10-05', 46), ('2026-10-06', 46),
])
def test_crcl_age_when_snapshot_near_birthday_uses_completed_years(cutoff: str, age: int) -> None:
    assert recorded_age('1980-10-05', cutoff) == age
