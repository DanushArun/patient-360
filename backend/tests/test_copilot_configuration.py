from pathlib import Path

import pytest
import yaml

ROOT = Path('backend/sql')
SPEC = yaml.safe_load((ROOT / 'agent/saarthi_agent.sql').read_text().split('$$')[1])
TOOLS = {entry['tool_spec']['name']: entry['tool_spec'] for entry in SPEC['tools']}


@pytest.mark.parametrize('name', sorted(TOOLS))
def test_agent_tool_when_configured_uses_supported_schema_and_no_scope_selector(name: str) -> None:
    schema = TOOLS[name]['input_schema']
    assert not set(schema) - {'type', 'properties', 'required'}
    assert not set(schema.get('properties', {})) & {'patient_id', 'encounter_id', 'facility_id'}


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
    assert copilot.verify_configuration(ROOT)['prompt_store']['model'] == 'claude-opus-5-5'


def test_prompt_store_when_deployment_prompt_drifts_fails_closed(tmp_path: Path) -> None:
    from backend.verification.copilot import verify_prompt_store

    prompt_dir = tmp_path / 'prompts'
    prompt_dir.mkdir()
    response = 'Return the verified claim.'
    orchestration = 'Use only bounded tools.'
    (prompt_dir / 'response.md').write_text(response + '\n')
    (prompt_dir / 'orchestration.md').write_text(orchestration + '\n')
    import hashlib
    import json
    manifest = {'version': 'test@1', 'model': 'claude-opus-5-5', 'prompts': {
        'response': {'file': 'response.md', 'sha256': hashlib.sha256(
            (response + '\n').encode()).hexdigest()},
        'orchestration': {'file': 'orchestration.md', 'sha256': hashlib.sha256(
            (orchestration + '\n').encode()).hexdigest()},
    }}
    (prompt_dir / 'copilot_manifest.json').write_text(json.dumps(manifest))
    specification = {'instructions': {'response': response, 'orchestration': orchestration}}

    with pytest.raises(ValueError, match='response prompt differs'):
        verify_prompt_store(tmp_path, {**specification, 'instructions': {
            **specification['instructions'], 'response': 'Return changed content.'}},
            'claude-opus-5-5')


def test_signature_when_schema_omits_required_argument_rejects() -> None:
    from backend.verification import copilot

    with pytest.raises(ValueError, match='required SQL'):
        copilot.verify_arguments({'properties': {}, 'required': []},
                                 'CREATE PROCEDURE P(QUESTION VARCHAR) RETURNS VARIANT')
