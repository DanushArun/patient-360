"""Generate transactional SQL for the bounded independent synthetic evaluation cohort."""
from __future__ import annotations

from pathlib import Path
import re

from pypdf import PdfReader

from backend.scripts.prepare_synthetic_documents import literal
from backend.verification.evaluation_inputs import verify_inputs
from backend.verification.evaluation_workflow import workflow_rows


def merge(table: str, key: str, row: dict) -> str:
    columns = ','.join(row)
    values = ','.join(f's.{column}' for column in row)
    projections = ','.join(f'{literal(str(value))} AS {column}' for column, value in row.items())
    return (f'MERGE INTO SAARTHI.{table} t USING (SELECT {projections}) s '
            f'ON t.{key}=s.{key} WHEN NOT MATCHED THEN INSERT({columns}) VALUES({values});\n'
            + require_row(table, row))


def require_row(table: str, row: dict) -> str:
    predicate = ' AND '.join(f'{key}={literal(str(value))}' for key, value in row.items())
    return ('EXECUTE IMMEDIATE $$ DECLARE n INT; '
            "changed_fixture EXCEPTION(-20002,'fixture missing, duplicated or changed'); BEGIN "
            f'SELECT COUNT(*) INTO :n FROM SAARTHI.{table} WHERE {predicate}; '
            'IF(n<>1) THEN RAISE changed_fixture; END IF; END; $$;')


def patient_sql(patient: str) -> list[str]:
    return [merge('CORE.PATIENT', 'patient_id', {
        'patient_id': patient, 'abha_ref': 'SYNTHETIC-ABHA-' + patient,
        'name': 'SYNTHETIC EVALUATION ' + patient, 'gender': 'female'}),
        merge('CORE.ID_MAP', 'map_id', {
            'map_id': 'MAP-' + patient, 'patient_id': patient, 'source_system': 'synthetic_eval',
            'source_patient_id': patient, 'link_status': 'abha_linked',
            'link_evidence': 'Synthetic ABHA anchor; not an actual ABDM identifier'}),
        f"MERGE INTO SAARTHI.GOVERNANCE.CARE_TEAM t USING (SELECT {literal('TEAM-' + patient)} "
        f"care_team_id,{literal(patient)} patient_id,practitioner_id FROM "
        "SAARTHI.GOVERNANCE.PRACTITIONER WHERE snowflake_user=CURRENT_USER() AND active "
        "AND facility_id='FAC-02') s ON t.care_team_id=s.care_team_id WHEN NOT MATCHED THEN "
        "INSERT(care_team_id,practitioner_id,patient_id,facility_id,role_type,granted_by) "
        "VALUES(s.care_team_id,s.practitioner_id,s.patient_id,"
        "'FAC-02','coordinator',CURRENT_USER());",
        f"MERGE INTO SAARTHI.GOVERNANCE.CONSENT t USING (SELECT {literal('CONSENT-' + patient)} "
        f"consent_id,{literal(patient)} patient_id) s ON t.consent_id=s.consent_id "
        "WHEN NOT MATCHED THEN INSERT(consent_id,patient_id,granted_to_facility_id,granted_by,"
        "purpose_code,data_categories,valid_from,valid_until,status,artifact_hash) VALUES("
        "s.consent_id,s.patient_id,'FAC-02','patient','coordination',"
        "ARRAY_CONSTRUCT('clinical','identity','financial'),'2026-10-04T00:00:00',"
        "'2027-01-01T00:00:00','active','synthetic-consent-fixture');"]


def event_sql(event: dict) -> str:
    fields = ['event_id', 'patient_id', 'value_num', 'unit', 'event_time', 'source_recorded_at']
    source = ','.join(f"{literal(str(event[key]))} AS {key}" for key in fields)
    source += f",concept_id FROM SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY WHERE canonical_name="
    source += literal(event['concept'])
    return (f'MERGE INTO SAARTHI.CORE.CLINICAL_EVENT t USING (SELECT {source}) s '
        'ON t.event_id=s.event_id WHEN NOT MATCHED THEN INSERT('
        'event_id,patient_id,event_type,concept_id,value_num,unit,status,event_time,'
        'source_recorded_at,original_value,original_unit) VALUES('
        "s.event_id,s.patient_id,'lab',s.concept_id,s.value_num,s.unit,'final',"
        's.event_time,s.source_recorded_at,s.value_num::VARCHAR,s.unit);\n'
        + require_row('CORE.CLINICAL_EVENT', {key: event[key] for key in fields}))


def document_sql(document: dict, directory: Path) -> list[str]:
    doc = document['doc_id']
    row = {'doc_id': doc, 'patient_id': document['patient_id'], 'scope': 'patient',
           'doc_type': 'lab_report', 'file_hash': document['sha256'], 'source_quality': 'clean_pdf',
           'signed_at': document['signed_at'], 'effective_at': document['event_time'],
           'source_facility_id': 'FAC-02', 'ingestion_method': 'digital_emr', 'status': 'active',
           'source_path': document['patient_id'] + '/' + doc + '.pdf'}
    statements = [merge('DOCUMENTS.DOCUMENT', 'doc_id', row)]
    for index, page in enumerate(PdfReader(directory / document['path']).pages):
        text = page.extract_text()
        if not text or 'SYNTHETIC' not in text or document['patient_id'] not in text:
            raise ValueError('evaluation PDF missing synthetic identity')
        statements.append('MERGE INTO SAARTHI.DOCUMENTS.DOC_PAGE t USING (SELECT '
            f'{literal(doc)} doc_id,{index} page_index,{literal(text)} text) s '
            'ON t.doc_id=s.doc_id AND t.page_index=s.page_index WHEN NOT MATCHED THEN '
            'INSERT(doc_id,page_index,text,char_count) VALUES('
            's.doc_id,s.page_index,s.text,LENGTH(s.text));\n'
            + require_row('DOCUMENTS.DOC_PAGE', {'doc_id': doc, 'page_index': index, 'text': text}))
    return statements


def prepare_sql(directory: Path) -> str:
    _, manifest = verify_inputs(directory)
    patients = {doc['patient_id'] for doc in manifest['documents']}
    if len(patients) != 8 or any(not re.fullmatch(
            r'PAT-EVAL-(DEV|HELDOUT)-0[1-4]', patient) for patient in patients):
        raise ValueError('evaluation patients outside bounded cohort')
    expected = [list(row) for patient in sorted(patients) for row in workflow_rows(patient)]
    if manifest.get('workflow_rows') != expected:
        raise ValueError('frozen workflow fixture rows changed')
    statements = ["USE ROLE ACCOUNTADMIN;", 'USE SECONDARY ROLES NONE;',
                  "ALTER SESSION SET TIMEZONE='UTC';", "EXECUTE IMMEDIATE $$ DECLARE n INT; "
                  "invalid_practitioner EXCEPTION(-20001,'unique FAC-02 practitioner required'); "
                  "BEGIN SELECT COUNT(*) INTO :n FROM SAARTHI.GOVERNANCE.PRACTITIONER "
                  "WHERE snowflake_user=CURRENT_USER() AND active AND facility_id='FAC-02'; "
                  "IF(n<>1) THEN RAISE invalid_practitioner; END IF; END; $$;", 'BEGIN;']
    for patient in sorted(patients):
        statements.extend(patient_sql(patient))
    statements.extend(merge(table, key, row) for table, key, row in manifest['workflow_rows'])
    statements.extend(event_sql(event) for event in manifest['events'])
    for document in manifest['documents']:
        statements.extend(document_sql(document, directory))
    statements.append('COMMIT;')
    return '\n'.join(statements) + '\n'
