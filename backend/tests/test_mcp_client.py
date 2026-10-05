import json

import pytest

from backend.scripts import mcp_client


def test_tool_call_when_question_supplied_targets_guarded_gateway() -> None:
    request = mcp_client.tool_call('What platelet value is recorded?')
    assert request['params'] == {'name': 'ask_saarthi',
                                 'arguments': {'QUESTION': 'What platelet value is recorded?'}}


def test_discovery_when_raw_agent_exposed_rejects() -> None:
    with pytest.raises(ValueError, match='guarded'):
        mcp_client.require_guarded_tools([{'name': 'saarthi_agent'}])


def test_discovery_when_patient_selector_exposed_rejects() -> None:
    tool = {'name': 'ask_saarthi', 'inputSchema': {'type': 'object',
            'properties': {'QUESTION': {'type': 'string'}, 'patient_id': {'type': 'string'}},
            'required': ['QUESTION']}}
    with pytest.raises(ValueError, match='schema'):
        mcp_client.require_guarded_tools([tool])


def test_discovery_when_exact_gateway_exposed_accepts() -> None:
    tool = {'name': 'ask_saarthi', 'inputSchema': {'type': 'object',
            'properties': {'QUESTION': {'type': 'string'}}, 'required': ['QUESTION'],
            'additionalProperties': False}}
    assert mcp_client.require_guarded_tools([tool]) is None


def test_stream_when_progress_precedes_result_selects_matching_response() -> None:
    body = 'data: ' + json.dumps({'method': 'notifications/progress'}) + '\n\n'
    response = {'jsonrpc': '2.0', 'id': 'R1', 'result': {'content': []}}
    body += 'data: ' + json.dumps(response) + '\n\n'
    assert mcp_client.decode_response(body, 'text/event-stream', 'R1') == response


def test_stream_when_json_malformed_rejects() -> None:
    with pytest.raises(ValueError, match='malformed'):
        mcp_client.decode_response('data: {broken}\n\n', 'text/event-stream', 'R1')


def test_response_when_rpc_error_rejects_without_disclosing_body() -> None:
    body = json.dumps({'jsonrpc': '2.0', 'id': 'R1',
                       'error': {'code': -32603, 'message': 'private body'}})
    with pytest.raises(ValueError, match='RPC error -32603'):
        mcp_client.decode_response(body, 'application/json', 'R1')


def test_discovery_when_question_schema_is_null_rejects_cleanly() -> None:
    tool = {'name': 'ask_saarthi', 'inputSchema': {'type': 'object',
            'properties': {'QUESTION': None}, 'required': ['QUESTION'],
            'additionalProperties': False}}
    with pytest.raises(ValueError, match='schema'):
        mcp_client.require_guarded_tools([tool])


def test_discovery_when_tools_is_not_array_rejects_cleanly() -> None:
    with pytest.raises(ValueError, match='guarded'):
        mcp_client.require_guarded_tools(None)


def test_response_when_rpc_error_is_not_object_rejects_cleanly() -> None:
    body = json.dumps({'jsonrpc': '2.0', 'id': 'R1', 'error': 'malformed'})
    with pytest.raises(ValueError, match='RPC error'):
        mcp_client.decode_response(body, 'application/json', 'R1')
