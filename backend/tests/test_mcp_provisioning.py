from pathlib import Path


SOURCE = Path('backend/sql/governance/04_pat_provisioning.sql')


def test_mcp_role_when_provisioned_grants_only_guarded_procedure() -> None:
    source = SOURCE.read_text()
    grants = [line for line in source.splitlines() if line.startswith('GRANT USAGE ON PROCEDURE')]
    assert grants == [
        'GRANT USAGE ON PROCEDURE SAARTHI.OPERATIONAL.ASK_SAARTHI(VARCHAR) '
        'TO ROLE SAARTHI_MCP_CLIENT;']


def test_mcp_role_when_provisioned_does_not_allow_every_network() -> None:
    assert '0.0.0.0/0' not in SOURCE.read_text()


def test_mcp_role_when_provisioned_does_not_grant_raw_agent() -> None:
    assert 'GRANT USAGE ON AGENT' not in SOURCE.read_text()
