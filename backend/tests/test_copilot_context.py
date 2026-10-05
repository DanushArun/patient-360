import json
from pathlib import Path
import subprocess


SOURCE = Path('backend/sql/procedures/answer_gateway_context_pack.sql')


def pack(packet: dict) -> dict:
    if not SOURCE.exists():
        raise AssertionError('Bound context packer is not implemented')
    body = SOURCE.read_text().split('$$')[1]
    script = 'const pack=new Function("PACKET","KNOWN_AS_OF",' + json.dumps(body) + ');'
    script += 'process.stdout.write(JSON.stringify(pack(' + json.dumps(packet)
    script += ',"2026-10-05T00:00:00")));'
    return json.loads(subprocess.check_output(['node', '-e', script], text=True))


def test_context_when_corpora_provided_keeps_patient_and_reference_separate() -> None:
    packet = {'patient_documents': {'results': [{'id': 'P1', 'text': 'Patient evidence'}]},
              'reference_documents': {'results': [{'id': 'R1', 'text': 'Guideline evidence'}]}}
    result = pack(packet)
    assert (result['patient_documents']['results'][0]['id'],
            result['reference_documents']['results'][0]['id']) == ('P1', 'R1')


def test_context_when_many_records_provided_bounds_payload_and_marks_truncation() -> None:
    result = pack({'labs': {'facts': [{'event_id': str(i)} for i in range(100)]}})
    assert len(result['record_facts']['labs']['facts']) == 20 and result['limitations']


def test_context_when_dependency_failed_does_not_expose_raw_error_detail() -> None:
    result = pack({'labs': {'error': 'dependency_timeout', 'detail': 'secret-debug-payload'}})
    assert result['record_facts']['labs'] == {'state': 'unavailable'}


def test_context_when_record_values_supplied_does_not_compute_or_rephrase_them() -> None:
    result = pack({'labs': {'facts': [{'event_id': 'E1', 'value': 82000, 'unit': '/cumm'}]}})
    assert result['record_facts']['labs']['facts'] == [
        {'event_id': 'E1', 'value': 82000, 'unit': '/cumm'}]


def test_context_when_long_text_provided_bounds_text_and_marks_truncation() -> None:
    result = pack({'patient_documents': {'results': [{'text': 'x' * 12000}]}})
    assert len(result['patient_documents']['results'][0]['text']) == 2000 and result['limitations']


def test_inference_when_context_collected_supplies_it_before_native_execution() -> None:
    source = Path('backend/sql/procedures/answer_gateway_infer.sql').read_text()
    assert source.index('ANSWER_GATEWAY_CONTEXT(') < source.index('DATA_AGENT_RUN(')


def test_context_when_labs_collected_selects_latest_per_concept_in_sql() -> None:
    source = Path('backend/sql/procedures/answer_gateway_context.sql').read_text()
    assert 'PARTITION BY value:concept::VARCHAR' in source and 'WHERE record_rank=1' in source


def test_context_when_reference_dependency_fails_preserves_record_facts() -> None:
    result = pack({'labs': {'facts': [{'value': 82000}]},
                   'reference_documents': {'error': 'timeout', 'detail': 'private debug'}})
    assert (result['record_facts']['labs']['facts'], result['reference_documents']) == (
        [{'value': 82000}], {'state': 'unavailable'})


def test_context_when_section_dependency_fails_isolates_failure_before_packaging() -> None:
    path = Path('backend/sql/procedures/answer_gateway_context_section.sql')
    assert path.exists() and 'EXCEPTION WHEN STATEMENT_ERROR' in path.read_text()


def test_inference_when_scope_changes_after_context_collection_does_not_send_to_model() -> None:
    source = Path('backend/sql/procedures/answer_gateway_infer.sql').read_text()
    assert source.index('v_context:access_scope') < source.index('DATA_AGENT_RUN(')


def test_context_when_cutoff_omitted_freezes_validated_clock_for_all_sections() -> None:
    source = Path('backend/sql/procedures/answer_gateway_context.sql').read_text()
    assert ('v_clock := v_access:known_as_of::VARCHAR;' in source
            and ':v_name,:QUESTION,:v_clock' in source
            and 'CONTEXT_PACK(:v_packet,:v_clock)' in source)


def test_context_when_bounded_sections_still_exceed_limit_withholds_entire_packet() -> None:
    packet = {name: {'facts': [{'text': 'x' * 2000} for _ in range(20)]}
              for name in ('labs', 'coverage', 'patient_documents')}
    assert pack(packet) == {'error': 'context_size_limit',
                            'known_as_of': '2026-10-05T00:00:00'}


def test_context_when_patient_search_called_uses_existing_two_argument_contract() -> None:
    source = Path('backend/sql/procedures/answer_gateway_context_section.sql').read_text()
    assert ('SEARCH_PATIENT_DOCUMENTS(LEFT(:QUESTION,1000),:KNOWN_AS_OF)'
            in ''.join(source.split()))
