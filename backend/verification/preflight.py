"""Readiness checks and a clean-account guard for the canonical install manifest."""
from __future__ import annotations

from urllib.request import urlopen
from urllib.parse import urlparse
import re
import json

from backend.verification.session import ROOT, Session


def require_empty_database(rows: list[dict]) -> None:
    if rows:
        raise AssertionError('clean installation requires a disposable account without SAARTHI')


def normalize_search_query(query: str) -> str:
    pattern = r"'(?:''|[^'])*'|\"(?:\"\"|[^\"])*\"|[A-Za-z_][A-Za-z0-9_]*|\S"
    tokens = re.findall(pattern, query)
    return ''.join(token.upper() if token[0].isalpha() else token
                   for token in tokens).strip('();')


def require_search_ready(row: dict, corpus: str) -> None:
    if row.get('serving_state') != 'RUNNING' or row.get('indexing_state') != 'RUNNING':
        raise AssertionError('search serving and indexing must both be RUNNING')
    if row.get('indexing_error') or int(row.get('source_data_num_rows', 0)) < 1:
        raise AssertionError('search must have indexed content without indexing errors')
    files = {'patient': '01_patient_doc_search.sql', 'reference': '02_reference_doc_search.sql'}
    source = (ROOT / 'backend/sql/search' / files[corpus]).read_text()
    expected = re.search(r'\bAS\s*\((SELECT.*?)\);', source, re.DOTALL | re.IGNORECASE)
    if expected is None:
        raise AssertionError('canonical search corpus definition missing')
    actual = normalize_search_query(str(row.get('definition', '')))
    if actual != normalize_search_query(expected[1]):
        raise AssertionError('search corpus differs from canonical scoped source query')


def check_platform(session: Session) -> dict:
    warehouse = session.query("SHOW WAREHOUSES LIKE 'SAARTHI_AI_WH'", label='warehouse')
    schemas = session.query('SHOW SCHEMAS IN DATABASE SAARTHI', label='schemas')
    services = session.query('SHOW CORTEX SEARCH SERVICES IN DATABASE SAARTHI', label='search')
    names = {row['name'].upper() for row in schemas}
    required = {'CORE', 'DOCUMENTS', 'EVIDENCE', 'GOVERNANCE', 'OPERATIONAL', 'STAGES'}
    found = {(row['schema_name'].upper(), row['name'].upper()) for row in services}
    searches = {'PATIENT_DOC_SEARCH': 'patient', 'REFERENCE_DOC_SEARCH': 'reference'}
    if not warehouse or not required <= names:
        raise AssertionError('warehouse, required schemas, or separate search services absent')
    status = []
    for service, corpus in searches.items():
        if ('DOCUMENTS', service) not in found:
            raise AssertionError(f'required search service missing: {service}')
        rows = session.query('DESCRIBE CORTEX SEARCH SERVICE SAARTHI.DOCUMENTS.' + service,
                             label='search_status')
        if len(rows) != 1:
            raise AssertionError('search description must return one service')
        require_search_ready(rows[0], corpus)
        status.extend(rows)
    return {'warehouse': warehouse, 'schemas': sorted(names), 'search': status}


def require_backend_health(payload: bytes, revision: str) -> dict:
    try:
        value = json.loads(payload)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise AssertionError('backend health JSON required') from error
    if not isinstance(value, dict) or value.get('status') != 'ready':
        raise AssertionError('backend health is not ready')
    if value.get('service') != 'saarthi-web-backend':
        raise AssertionError('backend health service mismatch')
    if (not re.fullmatch(r'(?:[a-f0-9]{40}|[a-f0-9]{64})', revision)
            or value.get('release_revision') != revision):
        raise AssertionError('backend release revision mismatch')
    database = value.get('database')
    if (not isinstance(database, dict) or database.get('status') != 'ready'
            or not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',
                                str(database.get('query_id', '')))):
        raise AssertionError('backend query receipt missing')
    return value


def health(url: str, expected_revision: str | None = None) -> dict:
    parsed = urlparse(url)
    if parsed.scheme not in ('https', 'http') or not parsed.hostname:
        raise ValueError('invalid health URL')
    if parsed.scheme == 'http' and parsed.hostname not in ('localhost', '127.0.0.1'):
        raise ValueError('remote health checks require HTTPS')
    with urlopen(url, timeout=20) as response:
        body = response.read(65537)
        if response.status != 200 or len(body) > 65536:
            raise AssertionError('health response failed or exceeds bounded body size')
        result = {'url': url, 'status': response.status, 'body_bytes': len(body)}
        if expected_revision is not None:
            result['backend'] = require_backend_health(body, expected_revision)
        return result
