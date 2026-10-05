"""Offline SQL trust-boundary checks; not live Snowflake compilation."""
from pathlib import Path
import unittest

SQL = (Path(__file__).resolve().parents[1] / "sql/procedures/validate_answer.sql").read_text()


class AnswerValidatorBoundaryTests(unittest.TestCase):
    def test_claim_when_validated_does_not_preserve_model_metadata(self) -> None:
        self.assertNotIn("OBJECT_INSERT(v_claim", SQL)

    def test_limitation_when_stripped_does_not_repeat_rejected_text(self) -> None:
        self.assertNotIn("|| v_text ||", SQL)

    def test_structured_when_rendered_uses_canonical_database_text(self) -> None:
        self.assertIn("v_text := 'Recorded ' || v_ev_concept", SQL)

    def test_structured_when_uncertain_or_derived_is_rejected(self) -> None:
        self.assertIn("v_ev_derived OR v_ev_state!='present'", SQL)

    def test_document_when_returned_includes_contract_verification(self) -> None:
        self.assertIn("'verification_status',v_ev_verif", SQL)

    def test_structured_when_returned_includes_three_clocks(self) -> None:
        self.assertTrue(all(key in SQL for key in (
            "'event_time',", "'source_recorded_at',", "'ingested_at',")))

    def test_class_b_when_all_stripped_is_partial(self) -> None:
        self.assertIn("ARRAY_SIZE(v_validated) = 0 THEN 'partial'", SQL)

    def test_document_when_patient_is_null_fails_scope_check(self) -> None:
        self.assertIn("v_ev_doc_patient IS NULL OR v_ev_doc_patient != v_patient_id", SQL)

    def test_filter_when_error_is_json_null_is_not_treated_as_error(self) -> None:
        self.assertIn("NOT IS_NULL_VALUE(GET_PATH(:v_filter_result, 'error'))", SQL)

    def test_strip_when_logged_uses_private_reason_code_only(self) -> None:
        self.assertIn("SPLIT_PART(COALESCE(v_strip_reason,'invalid_claim'),':',1)", SQL)


def test_document_when_accepted_renders_source_passage_instead_of_generated_prose() -> None:
    assert "v_text := 'Verified source passage: ' || v_passage;" in SQL


def test_document_when_numeric_is_accepted_returns_database_value() -> None:
    assert "v_asserted := TO_VARIANT(TRY_TO_DOUBLE(v_ev_value));" in SQL
