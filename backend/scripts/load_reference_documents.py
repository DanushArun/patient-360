"""Load byte-checked public reference PDFs without creating clinical assertions."""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from pypdf import PdfReader

from backend.verification.session import Session, connect

ROOT = Path(__file__).resolve().parents[2]


def checked_file(root: Path, record: dict[str, Any]) -> Path:
    path = (root / record['filename']).resolve()
    if not path.is_relative_to(root) or path.suffix.lower() != '.pdf':
        raise ValueError('reference_path_outside_catalog')
    content = path.read_bytes()
    if hashlib.sha256(content).hexdigest() != record['sha256']:
        raise ValueError('reference_hash_mismatch')
    if not content.startswith(b'%PDF-') or len(content) > 25_000_000:
        raise ValueError('reference_not_pdf')
    return path



class WarningReceipt(logging.Handler):
    def __init__(self) -> None:
        super().__init__()
        self.messages: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.messages.append(record.getMessage())


@contextmanager
def capture_pdf_warnings() -> Iterator[WarningReceipt]:
    logger = logging.getLogger('pypdf')
    handlers, propagate = logger.handlers, logger.propagate
    receipt = WarningReceipt()
    logger.handlers, logger.propagate = [receipt], False
    try:
        yield receipt
    finally:
        logger.handlers, logger.propagate = handlers, propagate


def checked_pages(path: Path, count: int) -> dict[str, Any]:
    with capture_pdf_warnings() as receipt:
        pages = PdfReader(path).pages
        if len(pages) != count or not 1 <= len(pages) <= 500:
            raise ValueError('reference_page_count_mismatch')
        structural_warnings = list(receipt.messages)
        texts, warnings = [], []
        for index, page in enumerate(pages):
            receipt.messages.clear()
            text = page.extract_text() or ''
            messages = structural_warnings + receipt.messages
            if messages:
                warnings.append({'page_index': index, 'messages': sorted(set(messages))})
            texts.append('' if messages else text)
    return {'texts': texts, 'parser_warnings': warnings,
            'status': 'active' if any(text.strip() for text in texts) else 'unreadable'}


def checked_records(catalog: Path) -> list[dict[str, Any]]:
    root = catalog.resolve().parent
    records = json.loads(catalog.read_text())['entries']
    if not isinstance(records, list) or not 1 <= len(records) <= 20:
        raise ValueError('invalid_reference_catalog')
    seen: set[str] = set()
    output = []
    for record in records:
        path = checked_file(root, record)
        if path.name in seen:
            raise ValueError('duplicate_reference_catalog_entry')
        seen.add(path.name)
        extracted = checked_pages(path, record['pages'])
        output.append({**record, **extracted, 'doc_id': 'REF-' + record['sha256'][:24]})
    return output


def verify_existing(session: Session, record: dict[str, Any]) -> None:
    rows = session.query(
        'SELECT doc_id,scope,patient_id,file_hash FROM SAARTHI.DOCUMENTS.DOCUMENT '
        'WHERE doc_id=%s OR source_path=%s', (record['doc_id'], record['filename']),
        'reference_existing_documents')
    expected = {'DOC_ID': record['doc_id'], 'SCOPE': 'reference',
                'PATIENT_ID': None, 'FILE_HASH': record['sha256']}
    if any(row != expected for row in rows) or len(rows) > 1:
        raise ValueError('reference_existing_document_conflict')
    pages = session.query('SELECT page_index,text FROM SAARTHI.DOCUMENTS.DOC_PAGE '
                          'WHERE doc_id=%s', (record['doc_id'],), 'reference_existing_pages')
    seen: set[int] = set()
    for page in pages:
        index = page['PAGE_INDEX']
        if index in seen or not isinstance(index, int) or not 0 <= index < len(record['texts']):
            raise ValueError('reference_existing_page_conflict')
        if page['TEXT'] != record['texts'][index]:
            raise ValueError('reference_existing_page_conflict')
        seen.add(index)


def insert_record(session: Session, record: dict[str, Any]) -> None:
    verify_existing(session, record)
    jurisdiction = 'US' if record['publisher'].startswith('U.S.') else 'IN'
    session.query(
        'MERGE INTO SAARTHI.DOCUMENTS.DOCUMENT t USING (SELECT %s doc_id) s '
        'ON t.doc_id=s.doc_id WHEN NOT MATCHED THEN INSERT '
        '(doc_id,scope,doc_type,version,file_hash,source_path,ingestion_method,'
        'jurisdiction,status) VALUES (%s,\'reference\',\'guideline\',1,%s,%s,'
        '\'downloaded_pdf\',%s,%s)',
        (record['doc_id'], record['doc_id'], record['sha256'], record['filename'],
         jurisdiction, record['status']),
        'reference_insert_document')
    for index, text in enumerate(record['texts']):
        session.query(
            'MERGE INTO SAARTHI.DOCUMENTS.DOC_PAGE t '
            'USING (SELECT %s doc_id,%s page_index) s '
            'ON t.doc_id=s.doc_id AND t.page_index=s.page_index '
            'WHEN NOT MATCHED THEN INSERT (doc_id,page_index,text,char_count) '
            'VALUES (%s,%s,%s,%s)',
            (record['doc_id'], index, record['doc_id'], index, text, len(text)),
            'reference_insert_page')


def load(session: Session, records: list[dict[str, Any]]) -> None:
    session.query('BEGIN TRANSACTION', label='reference_transaction_begin')
    try:
        for record in records:
            insert_record(session, record)
        result = session.call('CHUNK_DOCUMENTS_PROC', [])
        if result.get('error'):
            raise ValueError('reference_chunking_failed')
        session.query('COMMIT', label='reference_transaction_commit')
    except Exception:
        session.query('ROLLBACK', label='reference_transaction_rollback')
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', type=Path, default=ROOT / 'data/reference/catalog.json')
    parser.add_argument('--load', action='store_true', help='Write verified pages to Snowflake')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    records = checked_records(args.catalog)
    report: dict[str, Any] = {'status': 'PASS', 'mode': 'byte_check',
        'documents': len(records), 'pages': sum(len(row['texts']) for row in records),
        'origin_verified': False, 'effective_dates_verified': False, 'events': [],
        'quarantined_pages': sum(len(row['parser_warnings']) for row in records),
        'usable_pages': sum(bool(text.strip()) for row in records for text in row['texts']),
        'corpus': [{key: row[key] for key in ['filename', 'sha256', 'status',
                   'parser_warnings']} for row in records]}
    if args.load:
        with connect('ACCOUNTADMIN') as session:
            try:
                load(session, records)
                report['mode'] = 'loaded'
            except Exception as error:
                report.update(status='FAIL', error_type=type(error).__name__)
                raise
            finally:
                report['events'] = session.events
                args.output.write_text(json.dumps(report, indent=2) + '\n')
    else:
        args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: value for key, value in report.items() if key != 'corpus'}))


if __name__ == '__main__':
    main()
