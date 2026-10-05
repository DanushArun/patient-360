"""Run the canonical manifest only on a verified empty SAARTHI database account."""
from __future__ import annotations

from io import StringIO
from pathlib import Path
import argparse
import csv
import hashlib
import re

from snowflake.connector.errors import Error as SnowflakeError

from backend.verification.install_inputs import (
    align_generated_event_clocks, fhir_inputs, load_fhir, load_references, patient_document_sql,
)
from backend.verification.preflight import require_empty_database
from backend.verification.golden import require_uploaded
from backend.verification.report import write_report
from backend.verification.session import ROOT, Session, connect


def targets() -> list[Path]:
    root = ROOT / 'backend/sql'
    source = (root / 'setup.sql').read_text()
    relative = re.findall(r"^EXECUTE IMMEDIATE FROM '([^']+)'", source, re.MULTILINE)
    paths = [(root / name).resolve() for name in relative]
    if not paths or any(not path.is_file() for path in paths):
        raise ValueError('canonical installation manifest has missing files')
    return paths


def task_sql(source: str, user: str) -> str:
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,254}', user):
        raise ValueError('invalid task user identifier')
    return source.replace('EXECUTE AS USER SITAR', f'EXECUTE AS USER "{user}"')


def structured_inputs(root: Path) -> list[dict]:
    result = []
    for index in range(1, 5):
        facility = f'FAC-0{index}'
        path = root / f'{facility}.csv'
        if not path.is_file():
            raise ValueError(f'missing source CSV: {facility}')
        with path.open(newline='') as stream:
            rows = list(csv.reader(stream))
        if len(rows) < 2 or any(len(row) != 13 for row in rows):
            raise ValueError(f'invalid source CSV shape: {facility}')
        result.append({'path': path.resolve(), 'rows': len(rows) - 1,
                       'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                       'stage': f'@SAARTHI.CORE.%STG_SOURCE_EVENTS/{facility}/'})
    return result


def stage_inputs(session: Session, inputs: list[dict]) -> None:
    for entry in inputs:
        uri = ('file://' + entry['path'].as_posix()).replace("'", "''")
        rows = session.query(f"PUT '{uri}' {entry['stage']} AUTO_COMPRESS=FALSE OVERWRITE=FALSE",
                             label='stage_structured_source')
        require_uploaded(rows, entry['path'].name)


def native_endpoint(path: Path) -> bool:
    return path.name in {'saarthi_agent.sql', 'saarthi_mcp.sql'}


def execute_sql(session: Session, source: str, label: str) -> None:
    for cursor in session.connection.execute_stream(StringIO(source), remove_comments=True):
        try:
            cursor.fetchall()
            session.events.append({'label': label, 'query_id': cursor.sfqid, 'status': 'PASS'})
        finally:
            cursor.close()


def execute_file(session: Session, path: Path, user: str) -> None:
    execute_sql(session, task_sql(path.read_text(), user), str(path.relative_to(ROOT)))


def install(session: Session, pre_ai: bool, report: dict) -> None:
    from backend.scripts.build_deploy_bundle import _grants

    require_empty_database(session.query("SHOW DATABASES LIKE 'SAARTHI'"))
    user = session.query('SELECT CURRENT_USER() AS USER')[0]['USER']
    task_sql('', user)
    inputs = structured_inputs(ROOT / 'data/generated/csv')
    bundles = fhir_inputs()
    documents = patient_document_sql()
    report.update(task_user=user, structured_inputs=inputs, deferred_files=[])
    for path in targets():
        report['active_file'] = str(path.relative_to(ROOT))
        if pre_ai and native_endpoint(path):
            report['deferred_files'].append(report['active_file'])
            continue
        if path.name == 'load_structured_events_copy.sql':
            stage_inputs(session, inputs)
        if pre_ai and path.name == '03_grants.sql':
            execute_sql(session, _grants()[0], report['active_file'])
        else:
            execute_file(session, path, user)
        if path.name == '02_warehouse.sql':
            session.query('USE WAREHOUSE SAARTHI_AI_WH')
        if path.name == 'load_daycare_cohort.sql':
            align_generated_event_clocks(session)
        if path.name == 'chunk_documents.sql':
            execute_sql(session, documents, 'generated_patient_document_pages')
            report['reference_inputs'] = load_references(session)
        if path.name == 'flatten_fhir.sql':
            load_fhir(session, bundles)
        report['files'].append(report['active_file'])
    report['status'] = 'PASS_PRE_AI' if pre_ai else 'PASS'


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pre-ai', action='store_true',
                        help='Defer native agent/MCP creation; install all other components')
    args = parser.parse_args()
    report = {'status': 'FAIL', 'events': [], 'files': []}
    try:
        with connect('ACCOUNTADMIN', use_warehouse=False) as session:
            try:
                install(session, args.pre_ai, report)
            finally:
                report['events'] = session.events
    except (AssertionError, ValueError, OSError, SnowflakeError) as error:
        report['error'] = str(error)
    write_report(Path('evidence/qa/clean-install-live.json'), report)
    return 0 if report['status'] in {'PASS', 'PASS_PRE_AI'} else 1


if __name__ == '__main__':
    raise SystemExit(main())
