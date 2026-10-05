#!/usr/bin/env python3
"""Verify and call only the guarded Snowflake MCP procedure.

Set SAARTHI_MCP_HOST to the target account's hyphenated Snowflake hostname and
MCP_PAT to a role-restricted token. Commands: health, list-tools, call QUESTION.
An MCP transport session does not prove SQL patient-binding continuity. A call
without an authorized human-selected SQL binding must return no_patient_bound.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass, field
import json
import os
import re
import uuid
from typing import Any

import requests

PROTOCOL = '2025-11-25'


def rpc(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    return {'jsonrpc': '2.0', 'id': str(uuid.uuid4()),
            'method': method, 'params': params or {}}


def tool_call(question: str) -> dict[str, Any]:
    if not question.strip() or len(question) > 4000:
        raise ValueError('question must contain 1 to 4000 characters')
    return rpc('tools/call', {'name': 'ask_saarthi', 'arguments': {'QUESTION': question}})


def require_guarded_tools(tools: list[dict]) -> None:
    if (not isinstance(tools, list) or len(tools) != 1 or not isinstance(tools[0], dict)
            or tools[0].get('name') != 'ask_saarthi'):
        raise ValueError('expected exactly one guarded ask_saarthi tool')
    schema = tools[0].get('inputSchema', {})
    if not isinstance(schema, dict) or not isinstance(schema.get('properties'), dict):
        raise ValueError('guarded tool schema must contain an object properties map')
    properties = schema['properties']
    question = properties.get('QUESTION')
    if (schema.get('type') != 'object' or schema.get('required') != ['QUESTION']
            or set(properties) != {'QUESTION'} or not isinstance(question, dict)
            or question.get('type') != 'string'
            or schema.get('additionalProperties') is not False):
        raise ValueError('guarded tool schema differs from the approved question-only contract')


def stream_messages(body: str) -> list[dict]:
    messages = []
    for event in body.replace('\r\n', '\n').split('\n\n'):
        data = '\n'.join(line[5:].lstrip() for line in event.splitlines()
                         if line.startswith('data:'))
        if not data:
            continue
        try:
            messages.append(json.loads(data))
        except json.JSONDecodeError as error:
            raise ValueError('malformed MCP event data') from error
    return messages


def decode_response(body: str, content_type: str, request_id: str) -> dict:
    try:
        messages = (stream_messages(body) if 'text/event-stream' in content_type
                    else [json.loads(body)])
    except json.JSONDecodeError as error:
        raise ValueError('malformed MCP JSON response') from error
    matches = [item for item in messages if isinstance(item, dict)
               and item.get('id') == request_id]
    if len(matches) != 1 or matches[0].get('jsonrpc') != '2.0':
        raise ValueError('missing or duplicate matching MCP response')
    result = matches[0]
    if 'error' in result:
        error = result['error']
        code = error.get('code', 'unknown') if isinstance(error, dict) else 'malformed'
        raise ValueError(f'MCP RPC error {code}')
    if not isinstance(result.get('result'), dict):
        raise ValueError('MCP response result must be an object')
    if result['result'].get('isError') is True:
        raise ValueError('MCP guarded tool execution failed')
    return result


@dataclass
class Client:
    host: str
    token: str = field(repr=False)
    session: requests.Session = field(default_factory=requests.Session, repr=False)
    session_id: str | None = None

    def __post_init__(self) -> None:
        if not re.fullmatch(r'[A-Za-z0-9-]+\.snowflakecomputing\.com', self.host):
            raise ValueError('explicit hyphenated Snowflake account hostname required')
        if not self.token:
            raise ValueError('MCP_PAT is required')

    def post(self, payload: dict) -> dict:
        headers = {'Authorization': f'Bearer {self.token}',
                   'X-Snowflake-Authorization-Token-Type': 'PROGRAMMATIC_ACCESS_TOKEN',
                   'Content-Type': 'application/json',
                   'Accept': 'application/json, text/event-stream'}
        if self.session_id:
            headers.update({'Mcp-Session-Id': self.session_id, 'MCP-Protocol-Version': PROTOCOL})
        url = (f'https://{self.host}/api/v2/databases/SAARTHI/schemas/OPERATIONAL/'
               'mcp-servers/SAARTHI_MCP')
        response = self.session.post(url, headers=headers, json=payload,
                                     timeout=(20, 120), allow_redirects=False)
        try:
            if response.status_code not in (200, 202, 204):
                raise ValueError(f'MCP HTTP {response.status_code}; response body withheld')
            if response.headers.get('Mcp-Session-Id'):
                self.session_id = response.headers['Mcp-Session-Id']
            if 'id' not in payload:
                return {}
            return decode_response(response.text, response.headers.get('content-type', ''),
                                   payload['id'])
        finally:
            response.close()

    def initialize(self) -> dict:
        result = self.post(rpc('initialize', {'protocolVersion': PROTOCOL, 'capabilities': {},
                           'clientInfo': {'name': 'saarthi-guarded-client', 'version': '1.0.0'}}))
        if result['result'].get('protocolVersion') != PROTOCOL:
            raise ValueError('unsupported negotiated MCP protocol')
        self.post({'jsonrpc': '2.0', 'method': 'notifications/initialized'})
        return result

    def discover(self) -> dict:
        result = self.post(rpc('tools/list'))
        require_guarded_tools(result['result'].get('tools', []))
        return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['health', 'list-tools', 'call'])
    parser.add_argument('question', nargs='*')
    args = parser.parse_args()
    try:
        client = Client(os.environ.get('SAARTHI_MCP_HOST', ''), os.environ.get('MCP_PAT', ''))
        try:
            result = client.initialize()
            if args.command != 'health':
                result = client.discover()
            if args.command == 'call':
                result = client.post(tool_call(' '.join(args.question)))
            print(json.dumps({'status': 'PASS', 'response': result}, indent=2))
        finally:
            client.session.close()
    except (ValueError, requests.RequestException) as error:
        print(json.dumps({'status': 'FAIL', 'error_type': type(error).__name__}))
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
