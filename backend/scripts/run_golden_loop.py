"""Trace real synthetic ingestion, verified assertions, answer and saved follow-up IDs."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError
from snowflake.connector.errors import Error as SnowflakeError

from backend.verification.golden import (
    require_rule_causality, require_uploaded, save_action, save_answer,
)
from backend.verification.report import write_report
from backend.verification.history import verify_history
from backend.verification.session import ROOT, Session, connect, require_success


def ingest(session: Session, config: dict) -> list[dict]:
    path = (ROOT / config['document_path']).resolve()
    if not path.is_relative_to(ROOT / 'data/generated') or path.suffix != '.pdf':
        raise ValueError('only generated synthetic PDF files may be ingested')
    if hashlib.sha256(path.read_bytes()).hexdigest() != config['document_sha256']:
        raise ValueError('synthetic document hash mismatch')
    patient = config['patient_id']
    if not re.fullmatch(r'PAT-[A-Z0-9-]+', patient):
        raise ValueError('invalid synthetic patient identifier')
    existing = session.query('SELECT doc_id FROM SAARTHI.DOCUMENTS.DOCUMENT '
                             'WHERE patient_id=%s AND source_path=%s',
                             (patient, patient + '/' + path.name), 'new_document_control')
    if existing:
        raise AssertionError('golden loop requires a newly ingested document')
    safe_path = str(path).replace("'", "''")
    uploaded = session.query(f"PUT 'file://{safe_path}' @SAARTHI.STAGES.PATIENT_DOCS/{patient}/ "
                             'AUTO_COMPRESS=FALSE OVERWRITE=FALSE',
                             label='synthetic_document_ingest')
    require_uploaded(uploaded, path.name)
    require_success(session.call('ORCHESTRATOR_PROC', []))
    documents = session.query('SELECT doc_id FROM SAARTHI.DOCUMENTS.DOCUMENT '
                              'WHERE patient_id=%s AND source_path=%s',
                              (patient, patient + '/' + path.name), 'ingested_document')
    if len(documents) != 1:
        raise AssertionError('expected one uniquely ingested document')
    return documents


def pipeline_receipt(session: Session, config: dict, doc_id: str) -> dict:
    assertions = session.query('SELECT assertion_id FROM SAARTHI.EVIDENCE.ASSERTION '
                               "WHERE doc_id=%s AND verification_status='verified'",
                               (doc_id,), 'verified_assertions')
    links = session.query('SELECT relation FROM SAARTHI.EVIDENCE.EVIDENCE_LINK '
                          'WHERE assertion_id IN (SELECT assertion_id FROM '
                          'SAARTHI.EVIDENCE.ASSERTION WHERE doc_id=%s)',
                          (doc_id,), 'reconciliation')
    rules = session.query('SELECT rule_id,rule_version,outcome,evidence_ids FROM '
                          'SAARTHI.OPERATIONAL.READINESS_STATE WHERE patient_id=%s '
                          'AND rule_id=%s AND encounter_id=%s AND rule_version=%s',
                          (config['patient_id'], config['rule_id'], config['encounter_id'],
                           config['expected_rule_version']), 'SQL_rule')
    if not assertions or not links or not rules or any(r['RULE_VERSION'] is None for r in rules):
        raise AssertionError('verified extraction, reconciliation or versioned SQL rule absent')
    require_rule_causality([row['ASSERTION_ID'] for row in assertions], rules, config)
    return {'document_id': doc_id, 'assertion_ids': [a['ASSERTION_ID'] for a in assertions],
            'rules': rules, 'reconciliation': links}


def execute(session: Session, config: dict, report: dict) -> None:
    document = ingest(session, config)[0]['DOC_ID']
    receipt = pipeline_receipt(session, config, document)
    session.query('USE ROLE SAARTHI_APP', label='bounded_operator_role')
    require_success(session.call('BIND_PATIENT', [config['patient_id']]))
    answer = require_success(session.call('ASK_SAARTHI', [config['question']]))
    schema = json.loads((ROOT / 'frontend/contracts/answer_schema.json').read_text())
    Draft202012Validator(schema).validate(answer)
    cited = {e['id'] for c in answer['claims'] for e in c['evidence']}
    if not cited.intersection(receipt['assertion_ids']):
        raise AssertionError('answer did not cite the newly verified ingested document')
    receipt['answer_id'] = save_answer(session, config['question'], answer)
    receipt.update(save_action(session, config))
    with connect('ACCOUNTADMIN') as admin:
        try:
            receipt['history'] = verify_history(
                admin, session, receipt['saved_action_id'], config['rule_id'])
        finally:
            report['events'].extend(admin.events)
    session.query('USE ROLE ACCOUNTADMIN', label='receipt_readback_role')
    rows = session.query('SELECT task_id FROM SAARTHI.OPERATIONAL.REVIEW_TASK '
                         'WHERE idempotency_key=%s',
                         (receipt['request_key'],), 'retry_receipt_count')
    if len(rows) != 1 or rows[0]['TASK_ID'] != receipt['saved_action_id']:
        raise AssertionError('duplicate or missing persisted action receipt')
    report.update(status='PARTIAL', receipt=receipt, answer=answer,
                  immutable_history=receipt['history'],
                  UI_network_recovery='requires browser chaos verification')


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('evidence/qa/golden-loop-live.json'))
    args = parser.parse_args()
    report = {'status': 'FAIL', 'events': []}
    try:
        config = json.loads(args.config.read_text())
        with connect('ACCOUNTADMIN') as session:
            try:
                execute(session, config, report)
            finally:
                report['events'].extend(session.events)
    except (AssertionError, KeyError, ValueError, OSError,
            ValidationError, SnowflakeError) as error:
        report['error'] = str(error)
    write_report(args.output, report)
    return 0 if report['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
