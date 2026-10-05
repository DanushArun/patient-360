"""Freeze document gold from unique, verified SQL assertions, never generated identifiers."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
from contextlib import contextmanager
import hashlib
import json
from pathlib import Path
from typing import Any, Iterator

from backend.verification.metrics import unique_ids, verify_gold, verify_split
from backend.verification.session import Session


def number(value: Any) -> Decimal:
    if isinstance(value, bool):
        raise ValueError('boolean is not a measured value')
    try:
        parsed = Decimal(str(value))
    except InvalidOperation as error:
        raise ValueError('invalid measured value') from error
    if not parsed.is_finite():
        raise ValueError('nonfinite measured value')
    return parsed


def document_gold(selector: dict, rows: list[dict]) -> dict:
    if len(rows) != 1 or not rows[0].get('ASSERTION_ID'):
        raise ValueError('document gold requires a unique verified assertion')
    row = rows[0]
    expected = number(selector['asserted_value'])
    if any(number(row[key]) != expected for key in ['VALUE', 'PASS1_VALUE', 'PASS2_VALUE']):
        raise ValueError('two_pass readings must equal the independent synthetic gold')
    identifier = row['ASSERTION_ID']
    return {'qid': selector['qid'], 'expected_class': 'CLASS_B', 'supported': True,
            'required_ids': [identifier], 'allowed_ids': [identifier], 'expected_fragments': [],
            'expected_claims': [{'evidence_id': identifier, 'claim_type': 'numeric',
                                 'asserted_value': selector['asserted_value']}]}


def load_rows(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_inputs(directory: Path) -> tuple[dict, dict]:
    freeze = json.loads((directory / 'freeze.json').read_text())
    if freeze.get('manifest') != digest(directory / 'manifest.json'):
        raise ValueError('frozen manifest changed before extraction')
    manifest = json.loads((directory / 'manifest.json').read_text())
    for name in ['dev', 'heldout', 'structured_gold', 'document_selectors']:
        if freeze[name] != digest(directory / f'{name}.jsonl'):
            raise ValueError(f'frozen {name} changed before extraction')
    verify_split(load_rows(directory / 'dev.jsonl'), load_rows(directory / 'heldout.jsonl'))
    for doc in manifest['documents']:
        path = (directory / doc['path']).resolve()
        if not path.is_relative_to(directory.resolve()) or digest(path) != doc['sha256']:
            raise ValueError('frozen PDF path or bytes changed')
    return freeze, manifest


def assertion_rows(session: Session, selector: dict, document: dict) -> list[dict]:
    return session.query("""
        SELECT a.assertion_id,a.value,a.pass1_value,a.pass2_value,a.extractor_version,
               a.page_index,a.char_start,a.char_end,d.file_hash,
               SUBSTR(p.text,a.char_start+1,a.char_end-a.char_start) AS source_span
          FROM SAARTHI.EVIDENCE.ASSERTION a
          JOIN SAARTHI.DOCUMENTS.DOCUMENT d ON d.doc_id=a.doc_id
          JOIN SAARTHI.DOCUMENTS.DOC_PAGE p
            ON p.doc_id=a.doc_id AND p.page_index=a.page_index
          JOIN SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY co ON co.concept_id=a.concept_id
         WHERE d.doc_id=%s AND d.patient_id=%s AND co.canonical_name=%s
           AND d.file_hash=%s AND d.scope='patient' AND d.status='active'
           AND a.verification_status='verified' AND a.missingness_state='present'
           AND a.extractor_version='independent-two-family@0.2'
           AND a.char_start>=0 AND a.char_end>a.char_start AND a.char_end<=LENGTH(p.text)
        """, (selector['doc_id'], selector['patient_id'], selector['concept'],
              document['sha256']), label='freeze_verified_document_gold')


@contextmanager
def exclusive_freeze(directory: Path) -> Iterator[None]:
    marker = directory / '.freeze.lock'
    try:
        stream = marker.open('x')
    except FileExistsError as error:
        raise ValueError('benchmark freeze already in progress') from error
    try:
        with stream:
            stream.write('Final gold writer owns this benchmark directory.\n')
            stream.flush()
            yield
    finally:
        marker.unlink()


def freeze_gold(session: Session, directory: Path) -> dict:
    with exclusive_freeze(directory):
        return write_gold(session, directory)


def write_gold(session: Session, directory: Path) -> dict:
    freeze, manifest = verify_inputs(directory)
    if freeze.get('status') != 'PRE_AI' or (directory / 'gold.jsonl').exists():
        raise ValueError('final gold is immutable; create a separately versioned benchmark')
    documents = {doc['doc_id']: doc for doc in manifest['documents']}
    gold = load_rows(directory / 'structured_gold.jsonl')
    proofs = []
    for selector in load_rows(directory / 'document_selectors.jsonl'):
        rows = assertion_rows(session, selector, documents[selector['doc_id']])
        gold.append(document_gold(selector, rows))
        proofs.append({'qid': selector['qid'], 'assertion': rows[0]})
    verify_gold(gold)
    if set(unique_ids(gold)) != set(unique_ids(load_rows(directory / 'heldout.jsonl'))):
        raise ValueError('complete heldout gold required before any answer run')
    body = ''.join(json.dumps(row, sort_keys=True) + '\n' for row in gold)
    (directory / 'gold.jsonl').write_text(body)
    freeze.update(status='FROZEN', gold=digest(directory / 'gold.jsonl'),
                  manifest=digest(directory / 'manifest.json'), document_proofs=proofs,
                  query_events=session.events.copy())
    (directory / 'freeze.json').write_text(json.dumps(freeze, indent=2, default=str) + '\n')
    return freeze
