from pathlib import Path


def test_rule_when_canonical_adapter_exists_recomputes_bound_sql_outcome() -> None:
    source = Path('backend/sql/procedures/answer_gateway_rule.sql').read_text()
    assert all(value in source for value in (
        'GET_READINESS', 'RULE_CATALOG', "v_gate:outcome", 'financial', 'clinical', 'identity',
        "'not_received'", 'provenance_note', 'rule_version', 'rule_not_available'))


def test_rule_when_readiness_tool_returns_gates_supplies_exact_citation_pointer() -> None:
    source = Path('backend/sql/procedures/tools/02_get_readiness.sql').read_text()
    assert "'citation_id','RULE--'" in source


def test_rule_when_gateway_installed_helper_precedes_canonical_record_adapter() -> None:
    source = Path('backend/sql/setup.sql').read_text()
    assert source.index("'./procedures/answer_gateway_rule.sql'") < source.index(
        "'./procedures/answer_gateway_record.sql'")
