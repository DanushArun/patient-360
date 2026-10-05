"""Bounded generated input loading for the clean installer; no AI extraction calls."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re

from backend.scripts.prepare_synthetic_documents import prepare
from backend.scripts.load_reference_documents import checked_records, load
from backend.verification.session import ROOT, Session, require_success


def patient_document_sql() -> str:
    manifest = ROOT / 'data/generated/cohort_document_manifest.json'
    return prepare(json.loads(manifest.read_text()), ROOT / 'data/generated/pdf/cohort')


def fhir_inputs() -> list[dict]:
    result = []
    for path in sorted((ROOT / 'data/generated/fhir').glob('*.json')):
        payload = json.loads(path.read_text())
        if payload.get('resourceType') != 'Bundle' or path.stat().st_size > 10_000_000:
            raise ValueError('invalid generated FHIR bundle')
        patient = path.stem
        if not re.fullmatch(r'PAT-(?:DC-\d{2}|DEEP-0001)', patient):
            raise ValueError('FHIR patient outside synthetic cohort')
        identities = [entry.get('resource', {}).get('id') for entry in payload.get('entry', [])
                      if entry.get('resource', {}).get('resourceType') == 'Patient']
        if identities != [patient]:
            raise ValueError('FHIR patient identity mismatch')
        result.append({'source_id': 'SAARTHI-FHIR-FIXTURE/' + patient,
                       'payload': payload, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    if not result:
        raise ValueError('generated FHIR bundles missing')
    return result


def load_fhir(session: Session, inputs: list[dict]) -> None:
    for item in inputs:
        session.query('MERGE INTO SAARTHI.DOCUMENTS.RAW_FHIR_BUNDLE t '
            'USING (SELECT %s source_id,PARSE_JSON(%s) payload) s ON t.source_id=s.source_id '
            'WHEN NOT MATCHED THEN INSERT(source_id,payload,bundle_type) '
            "VALUES(s.source_id,s.payload,'collection')",
            (item['source_id'], json.dumps(item['payload'])), 'load_fhir_fixture')
    first = require_success(session.call('FLATTEN_FHIR_PROC', []))
    replay = require_success(session.call('FLATTEN_FHIR_PROC', []))
    if replay.get('events_written') != 0:
        raise AssertionError('FHIR replay generated duplicate events')
    session.events.append({'label': 'FHIR_replay_summary', 'first': first,
                           'replay': replay, 'status': 'PASS'})


def load_references(session: Session) -> dict:
    records = checked_records(ROOT / 'data/reference/catalog.json')
    load(session, records)
    return {'documents': len(records),
            'quarantined_pages': sum(len(row['parser_warnings']) for row in records),
            'origin_verified': False}


def align_generated_event_clocks(session: Session) -> None:
    records = json.loads((ROOT / 'data/generated/cohort_events.json').read_text())
    for record in records:
        if not re.fullmatch(r'PAT-DC-\d{2}', record['patient_id']):
            raise ValueError('snapshot patient outside synthetic cohort')
        rows = session.query('SELECT value_num,value_text FROM SAARTHI.CORE.CLINICAL_EVENT '
            'WHERE event_id=%s AND patient_id=%s',
            (record['event_id'], record['patient_id']), 'frozen_cohort_event_control')
        if len(rows) != 1 or rows[0] != {'VALUE_NUM': record['value_num'],
                                       'VALUE_TEXT': record['value_text']}:
            raise ValueError('generated PDF and installed event values differ')
        session.query('UPDATE SAARTHI.CORE.CLINICAL_EVENT SET event_time=%s,'
            'source_recorded_at=%s WHERE event_id=%s AND patient_id=%s',
            (record['event_time'], record['source_recorded_at'], record['event_id'],
             record['patient_id']), 'align_frozen_synthetic_clocks')
