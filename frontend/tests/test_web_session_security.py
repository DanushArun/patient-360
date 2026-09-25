"""Regression checks for the Next.js Snowflake session security contract.

These are source-level checks because Snowflake is deliberately not contacted in
CI; live role/session evidence must come from an authorized account query.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WEB_SESSION = ROOT / "web/lib/snowflake.ts"
BIND_PROC = ROOT / "backend/sql/procedures/bind_patient.sql"
AGENT_SPEC = ROOT / "backend/sql/agent/saarthi_agent.sql"


def test_web_connections_use_app_role_and_disable_secondary_roles():
    source = WEB_SESSION.read_text()
    assert 'role: "SAARTHI_APP"' in source
    assert 'role: "ACCOUNTADMIN"' not in source
    assert 'await execOn(conn, "USE SECONDARY ROLES NONE")' in source
    assert 'await run("USE SECONDARY ROLES NONE")' in source


def test_patient_binding_is_server_authorized_and_released_only_if_created():
    source = WEB_SESSION.read_text()
    procedure = BIND_PROC.read_text()
    assert 'CALL SAARTHI.OPERATIONAL.BIND_PATIENT(?)' in source
    assert "let bindingCreated = false" in source
    assert "bindingCreated = true" in source
    assert "if (bindingCreated)" in source
    assert "destroyConnection(conn)" in source
    assert "active_from   <= CURRENT_DATE()" in procedure
    assert "c.status     = 'active'" in procedure
    assert "c.valid_until >= CURRENT_TIMESTAMP()" in procedure
    assert "consent_not_valid" in procedure


def test_agent_tool_contract_does_not_accept_patient_selector():
    source = AGENT_SPEC.read_text()
    # The patient is derived from the server-side session binding, not model input.
    import re

    schemas = re.findall(r"input_schema:\s*(.*?)(?=\n    - tool_spec:|\n  tool_resources:)", source, re.S)
    assert schemas
    for schema in schemas:
        assert not re.search(r"^\s{6}(?:patient_id|patientId):", schema, re.M)
