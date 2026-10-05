from pathlib import Path
import re
import sqlite3

import pytest


def selected(variable: str, unit: str | None) -> float | None:
    source = Path('backend/sql/procedures/evaluate_gates.sql').read_text()
    match = re.search(r'LET ' + variable + r'\s+FLOAT := \((SELECT.*?)\);', source, re.S)
    if match is None:
        raise AssertionError('Numeric gate input query missing')
    query = re.sub(r' AT\(TIMESTAMP => :v_snapshot\)', '', match[1])
    query = query.replace('SAARTHI.CORE.CLINICAL_EVENT', 'events')
    query = query.replace('SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY', 'ontology')
    with sqlite3.connect(':memory:') as db:
        db.execute('CREATE TABLE ontology(concept_id,canonical_name)')
        db.execute('CREATE TABLE events(patient_id,concept_id,status,event_time,value_num,unit)')
        concepts = ['CREATININE', 'WEIGHT', 'BILIRUBIN', 'AST', 'ALT']
        db.executemany('INSERT INTO ontology VALUES (?,?)', [(name, name) for name in concepts])
        db.executemany('INSERT INTO events VALUES (?,?,?,?,?,?)',
                       [('P1', name, 'final', '2026-10-03', 1, unit) for name in concepts])
        result = db.execute(query, {'p_patient_id': 'P1'}).fetchone()
    return result[0] if result else None


@pytest.mark.parametrize('variable', ['v_creat', 'v_weight', 'v_bili', 'v_ast'])
def test_multivalue_rule_when_unit_unknown_withholds_numeric_input(variable: str) -> None:
    assert selected(variable, 'unknown') is None


@pytest.mark.parametrize(('variable', 'unit'), [
    ('v_creat', 'mg/dL'), ('v_weight', 'kg'), ('v_bili', 'mg/dL'),
    ('v_ast', 'U/L'),
])
def test_multivalue_rule_when_unit_valid_keeps_numeric_input(variable: str, unit: str) -> None:
    assert selected(variable, unit) == 1


@pytest.mark.parametrize('gender', ['unknown', None])
def test_crcl_when_recorded_sex_missing_does_not_assume_male(gender: str | None) -> None:
    source = Path('backend/sql/procedures/evaluate_gates.sql').read_text()
    match = re.search(r'LET v_female BOOLEAN := \((SELECT.*?)\);', source, re.S)
    if match is None:
        raise AssertionError('CrCl recorded sex input missing')
    sql = re.sub(r' AT\(TIMESTAMP => :v_snapshot\)', '', match[1])
    sql = sql.replace('SAARTHI.CORE.PATIENT', 'patient')
    with sqlite3.connect(':memory:') as db:
        db.execute('CREATE TABLE patient(patient_id,gender)')
        db.execute('INSERT INTO patient VALUES (?,?)', ('P1', gender))
        result = db.execute(sql, {'p_patient_id': 'P1'}).fetchone()
    assert result == (None,)


@pytest.mark.parametrize(('age', 'sex'), [(-1, 0), (45, None)])
def test_crcl_when_age_or_sex_invalid_does_not_calculate(age: int, sex: int | None) -> None:
    source = Path('backend/sql/procedures/evaluate_gates.sql').read_text()
    predicate = re.search(r'IF \((v_creat IS NULL.*?)\) THEN', source, re.S)
    if predicate is None:
        raise AssertionError('CrCl validity guard missing')
    expression = re.sub(r'\bv_\w+', lambda match: ':' + match[0], predicate[1])
    with sqlite3.connect(':memory:') as db:
        result = db.execute('SELECT ' + expression, {'v_creat': 1, 'v_weight': 60,
                                                    'v_age': age, 'v_female': sex}).fetchone()
    assert result == (1,)
