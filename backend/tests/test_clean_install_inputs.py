from pathlib import Path

import pytest

from backend.scripts import install_clean_account as installer


def test_task_sql_when_new_account_operator_supplied_replaces_legacy_user() -> None:
    sql = 'CREATE TASK T EXECUTE AS USER SITAR AS CALL P();'
    assert installer.task_sql(sql, 'TEAMMATE') == (
        'CREATE TASK T EXECUTE AS USER "TEAMMATE" AS CALL P();')


def test_task_sql_when_operator_contains_identifier_injection_rejects() -> None:
    with pytest.raises(ValueError, match='task user'):
        installer.task_sql('EXECUTE AS USER SITAR', 'NAME";DROP DATABASE SAARTHI;')


def test_structured_inputs_when_all_four_sources_exist_preserves_facility_paths() -> None:
    inputs = installer.structured_inputs(Path('data/generated/csv'))
    assert [entry['stage'] for entry in inputs] == [
        f'@SAARTHI.CORE.%STG_SOURCE_EVENTS/FAC-0{index}/' for index in range(1, 5)]


def test_structured_inputs_when_source_missing_rejects(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match='source CSV'):
        installer.structured_inputs(tmp_path)


def test_install_when_pre_ai_requested_defers_only_native_endpoint_files() -> None:
    from backend.scripts.install_clean_account import native_endpoint

    assert {path.name for path in installer.targets() if native_endpoint(path)} == {
        'saarthi_agent.sql', 'saarthi_mcp.sql'}


def test_install_when_generated_documents_prepared_includes_actual_patient_pages() -> None:
    from backend.scripts.install_clean_account import patient_document_sql

    sql = patient_document_sql()
    assert all(part in sql for part in ['DOC-LAB-DC-04', 'DOC-PATH-DC-04',
                                       'SAARTHI.DOCUMENTS.DOC_PAGE', 'MERGE INTO'])
