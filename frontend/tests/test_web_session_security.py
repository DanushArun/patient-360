"""Regression checks for the Next.js Snowflake session security contract.

These are source-level checks because Snowflake is deliberately not contacted in
CI; live role/session evidence must come from an authorized account query.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WEB_SESSION = ROOT / "web/lib/snowflake.ts"
SESSION_SECURITY = ROOT / "web/lib/session-security.ts"
BIND_PROC = ROOT / "backend/sql/procedures/bind_patient.sql"
AGENT_SPEC = ROOT / "backend/sql/agent/saarthi_agent.sql"


def test_web_connections_use_app_role_and_disable_secondary_roles():
    source = WEB_SESSION.read_text()
    assert 'role: "SAARTHI_APP"' in source
    assert 'role: "ACCOUNTADMIN"' not in source
    assert 'username: login.username' in source
    assert 'password: login.password' in source
    assert 'authenticator: "SNOWFLAKE"' in source
    assert "const USER = \"DANUSH\"" not in source
    assert 'await execOn(conn, "USE SECONDARY ROLES NONE")' in source
    assert 'await run("USE SECONDARY ROLES NONE")' not in source


def test_patient_binding_attempt_always_calls_scoped_release_procedure():
    source = WEB_SESSION.read_text()
    security = SESSION_SECURITY.read_text()
    procedure = BIND_PROC.read_text()
    assert 'CALL SAARTHI.OPERATIONAL.BIND_PATIENT(?)' in security
    assert "let bindAttempted = false" in security
    assert "bindAttempted = true" in security
    assert 'CALL SAARTHI.OPERATIONAL.RELEASE_PATIENT_BINDING()' in security
    assert "await destroyConnection(conn)" in source
    release = (ROOT / "backend/sql/procedures/release_patient_binding.sql").read_text()
    assert "EXECUTE AS OWNER" in release
    assert "session_id = CURRENT_SESSION()" in release
    assert "snowflake_user = CURRENT_USER()" in release
    assert "active_from   <= CURRENT_DATE()" in procedure
    assert "c.status     = 'active'" in procedure
    assert "c.valid_until >= CURRENT_TIMESTAMP()" in procedure
    assert "consent_not_valid" in procedure


def test_web_reads_use_owner_rights_procedures_not_direct_table_grants():
    source = WEB_SESSION.read_text()
    patient = (ROOT / "web/lib/patient.ts").read_text()
    census = (ROOT / "web/lib/census.ts").read_text()
    assert "GET_WEB_PATIENT_CONTEXT()" in source
    assert "GET_WEB_REVIEW_TASKS(?)" in patient
    assert "GET_WEB_CENSUS(?)" in census
    assert "CENSUS_SQL" not in census
    assert "SELECT rt.task_id" not in patient
    for procedure in ("web_patient_context.sql", "web_review_tasks.sql", "web_census.sql"):
        sql = (ROOT / "backend/sql/procedures" / procedure).read_text()
        assert "EXECUTE AS OWNER" in sql
        assert "CURRENT_USER()" in sql
    setup = (ROOT / "backend/sql/setup.sql").read_text()
    for procedure in ("web_patient_context.sql", "web_review_tasks.sql", "web_census.sql"):
        assert f"./procedures/{procedure}" in setup


def test_agent_tool_contract_does_not_accept_patient_selector():
    source = AGENT_SPEC.read_text()
    # The patient is derived from the server-side session binding, not model input.
    import re

    schemas = re.findall(r"input_schema:\s*(.*?)(?=\n    - tool_spec:|\n  tool_resources:)", source, re.S)
    assert schemas
    for schema in schemas:
        assert not re.search(r"^\s{6}(?:patient_id|patientId):", schema, re.M)
