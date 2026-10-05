"""Offline deployment contract checks; these do not prove native invocation or accuracy."""
from __future__ import annotations

import hashlib
from pathlib import Path
import re

from jsonschema import Draft202012Validator
import yaml


def procedure_sources(root: Path) -> dict[str, str]:
    procedures = {}
    for path in sorted((root / 'procedures/tools').glob('*.sql')):
        source = path.read_text()
        match = re.search(r'CREATE OR REPLACE PROCEDURE\s+([\w.]+)', source, re.I)
        if match:
            procedures[match[1].upper()] = source
    return procedures


def verify_arguments(schema: dict, source: str) -> None:
    Draft202012Validator.check_schema(schema)
    signature = re.search(r'CREATE(?: OR REPLACE)? PROCEDURE\s+[\w.]+\((.*?)\)',
                          source, re.I | re.S)
    if not signature:
        raise ValueError('SQL procedure signature missing')
    arguments = [argument.strip().split() for argument in signature[1].split(',')]
    names = {argument[0].lower() for argument in arguments if argument}
    required = {argument[0].lower() for argument in arguments
                if argument and 'DEFAULT' not in [word.upper() for word in argument]}
    properties = set(schema.get('properties', {}))
    if properties - names:
        raise ValueError('tool argument does not exist in SQL signature')
    if not required <= set(schema.get('required', [])):
        raise ValueError('tool omits required SQL arguments')
    if properties & {'patient_id', 'encounter_id', 'encounter_ref', 'facility_id'}:
        raise ValueError('agent tool exposes a scope selector')


def verify_configuration(root: Path) -> dict:
    source = (root / 'agent/saarthi_agent.sql').read_text()
    specification = yaml.safe_load(source.split('$$')[1])
    model = specification['models']['orchestration']
    if not isinstance(model, str) or model.lower().startswith('auto'):
        raise ValueError('orchestration model must be pinned')
    tools = specification['tools']
    resources = specification['tool_resources']
    names = [tool['tool_spec']['name'] for tool in tools]
    if len(names) != 8 or len(set(names)) != 8 or set(names) != set(resources):
        raise ValueError('agent tool/resource inventory differs from the eight-tool contract')
    procedures = procedure_sources(root)
    for entry in tools:
        tool = entry['tool_spec']
        resource = resources[tool['name']]
        schema = tool['input_schema']
        if (tool['type'] != 'generic' or resource['type'] != 'procedure'
                or schema.get('additionalProperties') is not False):
            raise ValueError('tools must be bounded generic procedures')
        verify_arguments(schema, procedures[resource['identifier'].upper()])
    skills = specification['skills']
    if len(skills) != 4 or any(skill['source']['type'] != 'STAGE' for skill in skills):
        raise ValueError('four stage-mounted skills required')
    return {'scope': 'offline source configuration only', 'tools': names,
            'model': model, 'skills': [skill['name'] for skill in skills],
            'agent_sql_sha256': hashlib.sha256(source.encode()).hexdigest(),
            'native_execution': 'requires funded-account verification',
            'mcp_sql_binding_continuity': 'requires live proof; unbound calls must deny'}
