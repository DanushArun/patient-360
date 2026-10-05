import re
import sqlite3
from pathlib import Path

import pytest


def required_category(path: str, subject: str) -> str:
    source = Path(path).read_text()
    match = re.search(r'v_required_category VARCHAR := (CASE.*?END);', source, re.S)
    if match is None:
        raise AssertionError('Missing SQL consent category routing')
    expression = re.sub(r'\bv_domain\b|:DOMAIN', '?', match.group(1))
    with sqlite3.connect(':memory:') as connection:
        row = connection.execute(f'SELECT {expression}', (subject,)).fetchone()
    if row is None:
        raise AssertionError('SQL category routing returned no row')
    return str(row[0])


@pytest.mark.parametrize(('domain', 'category'), [
    ('demographics', 'identity'), ('identity', 'identity'), ('coverage', 'financial'),
    ('labs', 'clinical'), ('treatment_plan', 'clinical'), ('encounters', 'clinical'),
])
def test_fact_domain_when_consent_partitioned_requires_matching_category(
    domain: str, category: str,
) -> None:
    assert required_category(
        'backend/sql/procedures/tools/01_get_patient_facts.sql', domain) == category


@pytest.mark.parametrize(('pointer', 'category'), [
    ('ROW-PATIENT', 'identity'), ('ROW-IDENTITY', 'identity'),
    ('ROW-COVERAGE', 'financial'), ('ROW-PLAN', 'clinical'), ('ROW-ENCOUNTER', 'clinical'),
])
def test_row_pointer_when_consent_partitioned_requires_matching_category(
    pointer: str, category: str,
) -> None:
    assert required_category('backend/sql/procedures/answer_gateway_record.sql', pointer) == category


def test_category_check_when_consent_array_absent_denies_instead_of_passing() -> None:
    sources = [Path(path).read_text() for path in (
        'backend/sql/procedures/answer_gateway_record.sql',
        'backend/sql/procedures/tools/01_get_patient_facts.sql')]
    assert all('NOT COALESCE(ARRAY_CONTAINS' in source for source in sources)


def test_lab_claim_when_clinical_consent_missing_strips_before_source_read() -> None:
    source = Path('backend/sql/procedures/validate_answer.sql').read_text()
    assert source.index("'clinical_consent_required'") < source.index(
        'FROM SAARTHI.CORE.DT_HARMONIZED_EVENTS h')


def test_document_claim_when_consent_partitioned_filters_before_source_read() -> None:
    source = Path('backend/sql/procedures/validate_answer.sql').read_text()
    assert "CASE d.doc_type WHEN 'authorization_letter' THEN 'financial'" in source


def test_patient_search_when_consent_partitioned_filters_before_page_return() -> None:
    source = Path('backend/sql/procedures/tools/03_search_patient_documents.sql').read_text()
    assert source.index("CASE d.doc_type WHEN 'authorization_letter' THEN 'financial'") < (
        source.index('IF (v_text IS NOT NULL) THEN'))


@pytest.mark.parametrize('tool', ['06_get_timeline.sql', '07_get_changes.sql'])
def test_clinical_tool_when_consent_partitioned_denies_before_reading_events(tool: str) -> None:
    source = Path('backend/sql/procedures/tools', tool).read_text()
    assert source.index("'clinical_consent_required'") < source.index(
        'FROM SAARTHI.CORE.DT_HARMONIZED_EVENTS')


def test_change_tool_when_dates_invalid_returns_sql_clock_before_access_checks() -> None:
    source = Path('backend/sql/procedures/tools/07_get_changes.sql').read_text()
    assert source.index('v_known_as_of_s :=') < source.index("'invalid_argument'")


def test_change_tool_when_range_reversed_or_future_rejects_before_reading_events() -> None:
    source = Path('backend/sql/procedures/tools/07_get_changes.sql').read_text()
    assert all(condition in source for condition in (
        'v_from>v_to', 'v_to>CURRENT_TIMESTAMP()::TIMESTAMP_NTZ',
        'TO_TS IS NOT NULL AND TRY_TO_TIMESTAMP_NTZ(:TO_TS) IS NULL'))


@pytest.mark.parametrize('path', [
    'backend/sql/procedures/validate_answer.sql',
    'backend/sql/procedures/tools/03_search_patient_documents.sql',
])
@pytest.mark.parametrize('doc_type', ['unknown', 'mixed', None])
def test_document_when_category_unclassified_does_not_assume_clinical(
    path: str, doc_type: str | None,
) -> None:
    source = Path(path).read_text()
    expression = re.search(r'CASE d.doc_type.*?END', source, re.S)
    if expression is None:
        raise AssertionError('Document category mapping missing')
    sql = expression.group(0).replace('d.doc_type', '?')
    with sqlite3.connect(':memory:') as db:
        category = db.execute(f'SELECT {sql}', (doc_type,)).fetchone()[0]
    assert category is None


def test_validator_when_access_checked_fingerprints_binding_consent_and_categories() -> None:
    source = Path('backend/sql/procedures/validate_answer.sql').read_text()
    assert "'access_scope',SHA2(v_binding_id || '|' || v_consent_id" in source
