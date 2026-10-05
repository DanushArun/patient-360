from pathlib import Path


def test_record_resolver_when_domains_resolved_requires_historical_scoped_rows() -> None:
    path = Path('backend/sql/procedures/answer_gateway_record.sql')
    assert path.is_file()
    sql = path.read_text()
    assert all(item in sql for item in ['AT(TIMESTAMP => :v_clock)',
        'patient_id=:v_patient', "'not_received'", "'financial_consent_required'",
        "link_status IN ('abha_linked','manually_verified')", "'record_snapshot_unavailable'"])


def test_fact_tool_when_nonlab_rows_returned_supplies_bounded_citation_ids() -> None:
    sql = Path('backend/sql/procedures/tools/01_get_patient_facts.sql').read_text()
    assert all(item in sql for item in ['ROW-COVERAGE--', 'ROW-PLAN--', 'ROW-ENCOUNTER--',
                                       'ROW-IDENTITY--', 'ROW-PATIENT--'])


def test_answer_receipt_when_record_or_reference_cited_revalidates_pointer() -> None:
    sql = Path('backend/sql/procedures/web_evidence.sql').read_text()
    assert all(item in sql for item in ['VALIDATE_ANSWER(:v_pointer_claims',
        "'reference_clause'", "STARTSWITH(i.value::VARCHAR,'ROW-')", 'v_checked_pointers:claims'])


def test_fact_tool_when_historical_nonlab_request_uses_database_snapshot() -> None:
    sql = Path('backend/sql/procedures/tools/01_get_patient_facts.sql').read_text()
    assert sql.count('AT(TIMESTAMP => :v_snapshot)') == 5
