from pathlib import Path

import pytest
import yaml

ROOT = Path('backend/sql')
SPEC = yaml.safe_load((ROOT / 'agent/saarthi_agent.sql').read_text().split('$$')[1])
TOOLS = {entry['tool_spec']['name']: entry['tool_spec'] for entry in SPEC['tools']}


@pytest.mark.parametrize('name', sorted(TOOLS))
def test_agent_tool_when_configured_rejects_extra_arguments(name: str) -> None:
    assert TOOLS[name]['input_schema'].get('additionalProperties') is False


def test_agent_domain_when_configured_uses_closed_allowlist() -> None:
    assert TOOLS['GetPatientFacts']['input_schema']['properties']['domain'].get('enum') == [
        'demographics', 'labs', 'coverage', 'treatment_plan', 'encounters', 'identity']


def test_agent_action_when_configured_uses_closed_allowlist() -> None:
    assert TOOLS['CreateReviewTask']['input_schema']['properties']['action'].get('enum') == [
        'escalate', 'close', 'reassign', 'request_document']


def test_changes_when_end_time_omitted_database_uses_default() -> None:
    sql = (ROOT / 'procedures/tools/07_get_changes.sql').read_text()
    assert 'TO_TS VARCHAR DEFAULT NULL' in sql


def test_configuration_when_all_resources_match_returns_eight_bounded_tools() -> None:
    from backend.verification import copilot

    assert len(copilot.verify_configuration(ROOT)['tools']) == 8


def test_signature_when_schema_omits_required_argument_rejects() -> None:
    from backend.verification import copilot

    with pytest.raises(ValueError, match='required SQL'):
        copilot.verify_arguments({'properties': {}, 'required': []},
                                 'CREATE PROCEDURE P(QUESTION VARCHAR) RETURNS VARIANT')
