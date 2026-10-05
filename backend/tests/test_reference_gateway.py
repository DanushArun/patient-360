import json
from pathlib import Path

from backend.tests.test_answer_gateway import candidates


def test_reference_candidate_when_textual_accepts_separate_corpus_pointer() -> None:
    claim = {'text': 'Source quote', 'claim_type': 'textual',
             'evidence': [{'kind': 'reference_clause', 'id': 'REF-CHUNK-1'}]}
    payload = {'content': [{'type': 'text', 'text': json.dumps({'claims': [claim]})}]}
    assert candidates(payload) == {'mode': 'typed', 'claims': [claim]}


def test_reference_candidate_when_numeric_refuses_clinical_inference() -> None:
    claim = {'text': 'Use 6 mg', 'claim_type': 'numeric', 'asserted_value': 6,
             'evidence': [{'kind': 'reference_clause', 'id': 'REF-CHUNK-1'}]}
    payload = {'content': [{'type': 'text', 'text': json.dumps({'claims': [claim]})}]}
    assert candidates(payload) == {'error': 'invalid_candidate'}


def test_catalog_when_misleading_filename_used_preserves_actual_publisher() -> None:
    catalog = json.loads(Path('data/reference/catalog.json').read_text())
    record = next(row for row in catalog['entries'] if row['filename'].startswith('aiims_'))
    assert record['publisher'] == 'Government of Gujarat'


def test_reference_sql_when_pointer_resolved_requires_hash_and_corpus_boundary() -> None:
    sql = Path('backend/sql/procedures/answer_gateway_reference.sql').read_text()
    assert all(part in sql for part in ["c.doc_scope='reference'", "d.scope='reference'",
        'd.file_hash=r.file_hash', 'd.patient_id IS NULL', 'CONTAINS(dp.text,c.text)',
        'd.ingested_at<=', "'not_received'"])
