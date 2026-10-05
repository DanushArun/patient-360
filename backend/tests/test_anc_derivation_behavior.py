import re
import sqlite3
from pathlib import Path

import pytest


def derive(rows: list[tuple]) -> list[tuple]:
    source = Path('backend/sql/dynamic_tables/01_harmonized_events.sql').read_text()
    sql = source.split('anc_derived AS (', 1)[1].split('\n)\nSELECT', 1)[0]
    sql = re.sub(r'\(SELECT concept_id FROM .*?\)', "'ANC'", sql)
    with sqlite3.connect(':memory:') as db:
        db.execute('CREATE TABLE normalized(event_id,patient_id,encounter_id,event_type,'
                   'concept_id,concept_name,value_num,value_text,abnormal_flag,'
                   'plausibility_state,event_time,source_recorded_at,ingested_at,'
                   'valid_until,specimen_id,unit)')
        db.executemany('INSERT INTO normalized VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', rows)
        return db.execute(sql).fetchall()


def lab(event: str, patient: str, concept: str, value: float) -> tuple:
    return (event, patient, 'E1', 'lab', concept, concept, value, None, None, 'present',
            '2026-10-01', '2026-10-02', '2026-10-03', None, 'S1', '%' if concept == 'NEUTROPHIL_PCT' else '/cumm')


def test_anc_when_inputs_match_derives_record_value() -> None:
    result = derive([lab('W1', 'P1', 'WBC', 6000),
                     lab('N1', 'P1', 'NEUTROPHIL_PCT', 35)])
    assert [row[6] for row in result] == [2100]


def test_anc_when_specimen_unrecorded_on_both_inputs_derives_record_value() -> None:
    # Live day-care CBC rows carry no specimen_id; NULL = NULL must not drop the pair.
    wbc, neut = list(lab('W1', 'P1', 'WBC', 4600)), list(lab('N1', 'P1', 'NEUTROPHIL_PCT', 48))
    wbc[14] = neut[14] = None
    assert [row[6] for row in derive([tuple(wbc), tuple(neut)])] == [2208]


def test_anc_when_only_one_input_has_specimen_does_not_join() -> None:
    neut = list(lab('N1', 'P1', 'NEUTROPHIL_PCT', 48))
    neut[14] = None
    assert derive([lab('W1', 'P1', 'WBC', 4600), tuple(neut)]) == []


def test_anc_when_unrecorded_specimen_has_two_differentials_does_not_choose_one() -> None:
    rows = [list(lab('W1', 'P1', 'WBC', 6000)), list(lab('N1', 'P1', 'NEUTROPHIL_PCT', 35)),
            list(lab('N2', 'P1', 'NEUTROPHIL_PCT', 45))]
    for row in rows:
        row[14] = None
    assert derive([tuple(row) for row in rows]) == []


def test_anc_when_patients_differ_does_not_join() -> None:
    assert derive([lab('W1', 'P1', 'WBC', 6000),
                   lab('N1', 'P2', 'NEUTROPHIL_PCT', 35)]) == []


@pytest.mark.parametrize('field,value', [(9, 'unreadable'), (14, 'S2'), (6, 150)])
def test_anc_when_differential_invalid_does_not_derive(field: int, value: object) -> None:
    differential = list(lab('N1', 'P1', 'NEUTROPHIL_PCT', 35))
    differential[field] = value
    assert derive([lab('W1', 'P1', 'WBC', 6000), tuple(differential)]) == []


def test_anc_when_foreign_direct_anc_exists_does_not_suppress_patient_derivation() -> None:
    result = derive([lab('W1', 'P1', 'WBC', 6000),
                     lab('N1', 'P1', 'NEUTROPHIL_PCT', 35), lab('A2', 'P2', 'ANC', 200)])
    assert [row[6] for row in result] == [2100]


def test_anc_when_differential_arrives_later_waits_for_both_source_clocks() -> None:
    differential = list(lab('N1', 'P1', 'NEUTROPHIL_PCT', 35))
    differential[11:13] = ['2026-10-04', '2026-10-05']
    assert derive([lab('W1', 'P1', 'WBC', 6000), tuple(differential)])[0][11:13] == (
        '2026-10-04', '2026-10-05')


def test_anc_when_differentials_disagree_does_not_choose_one() -> None:
    assert derive([lab('W1', 'P1', 'WBC', 6000),
                   lab('N1', 'P1', 'NEUTROPHIL_PCT', 35),
                   lab('N2', 'P1', 'NEUTROPHIL_PCT', 45)]) == []


@pytest.mark.parametrize('concept,unit', [('WBC', 'lakhs/cumm'), ('NEUTROPHIL_PCT', 'fraction')])
def test_anc_when_input_unit_not_canonical_does_not_guess_conversion(
    concept: str, unit: str,
) -> None:
    rows = [list(lab('W1', 'P1', 'WBC', 6000)),
            list(lab('N1', 'P1', 'NEUTROPHIL_PCT', 35))]
    rows[0 if concept == 'WBC' else 1][15] = unit
    assert derive([tuple(row) for row in rows]) == []
