from pathlib import Path
import sqlite3

import pytest


def normalize(value: float, unit: str) -> tuple:
    source = Path('backend/sql/dynamic_tables/01_harmonized_events.sql').read_text()
    prefix = source.split('WITH ', 1)[1].split(',\nanc_derived AS', 1)[0]
    sql = 'WITH ' + prefix + ' SELECT value_num,unit,plausibility_state FROM normalized'
    for qualified, local in (
        ('SAARTHI.CORE.CLINICAL_EVENT', 'events'),
        ('SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY', 'ontology'),
        ('SAARTHI.OPERATIONAL.UNIT_REGISTRY', 'registry'),
    ):
        sql = sql.replace(qualified, local)
    with sqlite3.connect(':memory:') as db:
        db.execute('CREATE TABLE events(event_id,patient_id,encounter_id,event_type,concept_id,'
                   'value_num,value_text,abnormal_flag,event_time,source_recorded_at,'
                   'ingested_at,valid_until,specimen_id,unit,original_unit)')
        db.execute('CREATE TABLE ontology(concept_id,canonical_name)')
        db.execute('CREATE TABLE registry(concept_id,source_unit_pattern,canonical_unit,'
                   'conversion_factor,plausible_min,plausible_max)')
        db.execute("INSERT INTO ontology VALUES ('ANC','ANC')")
        db.execute("INSERT INTO registry VALUES ('ANC','lakhs/cumm','/uL',100000,10000,1000000)")
        db.execute('INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                   ('A','P','E','lab','ANC',value,None,None,'T','T','T',None,'S',unit,'lakhs/cumm'))
        return db.execute(sql).fetchone()


@pytest.mark.parametrize(('value', 'unit', 'expected'), [
    (0.2, 'lakhs/cumm', (20000, '/uL', 'present')),
    (20000, '/uL', (20000, '/uL', 'present')),
    (20, 'lakhs/cumm', (2000000, '/uL', 'unreadable')),
])
def test_unit_when_registered_normalizes_once_before_range_check(
    value: float, unit: str, expected: tuple,
) -> None:
    assert normalize(value, unit) == expected
