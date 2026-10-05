"""Gateway behavior and offline SQL contracts; live compilation remains a separate gate."""
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1] / "sql"


def candidates(payload: dict) -> dict:
    sql = (ROOT / "procedures/answer_gateway_candidates.sql").read_text()
    body = sql.split("$$")[1]
    script = "const f=new Function('PAYLOAD'," + json.dumps(body) + ");"
    script += "process.stdout.write(JSON.stringify(f(" + json.dumps(payload) + ")));"
    return json.loads(subprocess.check_output(["node", "-e", script], text=True))


class GatewayTests(unittest.TestCase):
    def test_candidate_when_free_prose_contains_only_explicit_ids(self) -> None:
        result = candidates({"content": [{"type": "text", "text": "Safe! [CE-LAB-1]"}]})
        self.assertEqual(result, {"mode": "legacy", "ids": ["CE-LAB-1"]})

    def test_candidate_when_thinking_contains_id_does_not_use_it(self) -> None:
        result = candidates({"content": [{"type": "thinking", "text": "CE-SECRET-1"}]})
        self.assertEqual(result, {"mode": "legacy", "ids": []})

    def test_candidate_when_legacy_cites_sql_row_preserves_bounded_pointer(self) -> None:
        text = 'Recorded coverage [ROW-COVERAGE--COV-DC-04]; ROW-UNKNOWN--PRIVATE'
        result = candidates({'content': [{'type': 'text', 'text': text}]})
        self.assertEqual(result, {'mode': 'legacy', 'ids': ['ROW-COVERAGE--COV-DC-04']})

    def test_candidate_when_legacy_cites_rule_preserves_exact_version_pointer(self) -> None:
        text = 'Safe to treat RULE--ENC-DC-04--CLIN-PLT-001--1 RULE--X--Y--0'
        result = candidates({'content': [{'type': 'text', 'text': text}]})
        self.assertEqual(result, {'mode': 'legacy',
                                 'ids': ['RULE--ENC-DC-04--CLIN-PLT-001--1']})

    def test_candidate_when_typed_has_extra_fields_rejects(self) -> None:
        claim = {"text": "Hemoglobin recorded", "claim_type": "textual", "action": "Give drug",
                 "evidence": [{"kind": "structured", "id": "CE-1", "table": "evil"}]}
        payload = {"content": [{"type": "text", "text": json.dumps({"claims": [claim]})}]}
        result = candidates(payload)
        self.assertEqual(result, {"error": "invalid_candidate"})

    def test_candidate_when_numeric_missing_value_rejects(self) -> None:
        claim = {"text": "10", "claim_type": "numeric",
                 "evidence": [{"kind": "structured", "id": "CE-1"}]}
        payload = {"content": [{"type": "text", "text": json.dumps({"claims": [claim]})}]}
        result = candidates(payload)
        self.assertEqual(result, {"error": "invalid_candidate"})

    def test_candidate_when_malformed_json_never_uses_legacy_fallback(self) -> None:
        result = candidates({"content": [{"type": "text", "text": '{"claims": [CE-LAB-1'}]})
        self.assertEqual(result, {"error": "invalid_candidate"})

    def test_gateway_when_called_classifies_before_inference(self) -> None:
        sql = (ROOT / "agent/ask_saarthi.sql").read_text()
        self.assertLess(sql.index("CLASSIFY_QUESTION"), sql.index("ANSWER_GATEWAY_INFER"))

    def test_gateway_when_legacy_resolves_only_scoped_identifiers(self) -> None:
        sql = (ROOT / "procedures/answer_gateway_resolve.sql").read_text()
        self.assertTrue(all(item in sql for item in (
            "VALIDATE_ANSWER", "h.patient_id=:v_patient", "d.patient_id=:v_patient",
            "h.event_id=i.value::VARCHAR", "a.assertion_id=i.value::VARCHAR")))

    def test_gateway_when_refusing_requires_real_named_recipient(self) -> None:
        sql = (ROOT / "procedures/answer_gateway_refusal.sql").read_text()
        self.assertTrue(all(item in sql for item in (
            "nmc_registration_no", "treating_practitioner_unavailable", "'refusal'",
            "'evidence_packet_offered',TRUE", "'known_as_of',KNOWN_AS_OF")))

    def test_mcp_when_exposed_calls_gateway_without_patient_selector(self) -> None:
        sql = (ROOT / "agent/saarthi_mcp.sql").read_text()
        spec = sql.split("FROM SPECIFICATION")[1]
        self.assertTrue('type: "GENERIC"' in spec
                        and 'SAARTHI.OPERATIONAL.ASK_SAARTHI' in spec
                        and 'patient_id' not in spec and 'CORTEX_AGENT_RUN' not in spec)

    def test_candidate_when_date_invalid_rejects(self) -> None:
        claim = {"text": "Recorded date", "claim_type": "date", "asserted_value": "banana",
                 "evidence": [{"kind": "structured", "id": "CE-1"}]}
        payload = {"content": [{"type": "text", "text": json.dumps({"claims": [claim]})}]}
        self.assertEqual(candidates(payload), {"error": "invalid_candidate"})

    def test_candidate_when_json_array_rejects_instead_of_fallback(self) -> None:
        self.assertEqual(candidates({"content": [{"type": "text", "text": '["CE-LAB-1"]'}]}),
                         {"error": "invalid_candidate"})

    def test_candidate_when_legacy_has_hyphenated_prose_ignores_it(self) -> None:
        payload = {"content": [{"type": "text", "text": "high-risk PAT-1 EVT-DC-1-HB"}]}
        self.assertEqual(candidates(payload), {"mode": "legacy", "ids": ["EVT-DC-1-HB"]})

    def test_gateway_when_classifier_missing_reports_unavailable(self) -> None:
        sql = (ROOT / "agent/ask_saarthi.sql").read_text()
        self.assertIn("'classification_unavailable'", sql)

    def test_packet_when_replayed_returns_saved_evidence_snapshot(self) -> None:
        sql = (ROOT / "procedures/web_evidence.sql").read_text()
        self.assertIn("'gate_snapshot',ep.gate_snapshot", sql)

    def test_candidate_when_valid_typed_preserves_minimal_claim(self) -> None:
        claim = {"text": "Recorded Hb 10", "claim_type": "numeric", "asserted_value": 10,
                 "evidence": [{"kind": "structured", "id": "EVT-DC-1-HB"}]}
        payload = {"content": [{"type": "text", "text": json.dumps({"claims": [claim]})}]}
        self.assertEqual(candidates(payload), {"mode": "typed", "claims": [claim]})

    def test_candidate_when_textual_value_is_object_rejects(self) -> None:
        claim = {"text": "Recorded", "claim_type": "textual", "asserted_value": {"evil": 1},
                 "evidence": [{"kind": "structured", "id": "EVT-DC-1-HB"}]}
        payload = {"content": [{"type": "text", "text": json.dumps({"claims": [claim]})}]}
        self.assertEqual(candidates(payload), {"error": "invalid_candidate"})


def test_gateway_when_trial_agent_denied_uses_only_bounded_sql_facts() -> None:
    from pathlib import Path

    fallback = Path('backend/sql/procedures/answer_gateway_record_fallback.sql').read_text()
    required = ('VALIDATE_ANSWER', 'CURRENT_SESSION()', 'ingested_at<=',
                'ANSWER_GATEWAY_FINALIZE', "'PLT'", "'ANC'", "'WBC'")
    assert all(token in fallback for token in required)


def test_classifier_when_AI_dependency_errors_defaults_to_clinical_refusal() -> None:
    from pathlib import Path

    source = Path('backend/sql/procedures/classify_question.sql').read_text()
    assert "v_method := 'dependency_unavailable'" in source and 'EXCEPTION' in source


def test_candidate_when_one_claim_combines_two_records_rejects_ambiguous_provenance() -> None:
    claim = {'text': 'Recorded Hb 10', 'claim_type': 'numeric', 'asserted_value': 10,
             'evidence': [{'kind': 'structured', 'id': 'EVT-DC-1-HB'},
                          {'kind': 'structured', 'id': 'EVT-DC-2-HB'}]}
    payload = {'content': [{'type': 'text', 'text': json.dumps({'claims': [claim]})}]}
    assert candidates(payload) == {'error': 'invalid_candidate'}


def test_gateway_when_consent_scope_changes_rechecks_before_any_answer_returns() -> None:
    source = (ROOT / 'agent/ask_saarthi.sql').read_text()
    assert source.count('VALIDATE_ANSWER') >= 2 and "'access_scope_changed'" in source
