"""Offline source regressions, NOT Snowflake SQL compilation or live execution."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1] / "sql"


class DocumentSqlContractTests(unittest.TestCase):
    def read(self, path):
        return (ROOT / path).read_text()

    def test_two_readers_use_same_prompt_in_both_paths(self):
        for path, prompt in [("tasks/extract_assertions.sql","v_prompt_a"),
                             ("procedures/extract_one_document.sql","v_prompt")]:
            sql = self.read(path)
            calls = re.findall(r"AI_COMPLETE\('([^']+)',\s*:([a-z_]+)", sql)
            self.assertEqual(calls, [("llama3.3-70b",prompt),("claude-haiku-4-5",prompt)])
            self.assertNotIn("A previous reader extracted",sql)
            self.assertEqual(len(re.findall(r"'max_tokens':\s*1800",sql)),2)

    def test_batch_is_patient_only_bounded_and_unverified_values_are_null(self):
        sql = self.read("tasks/extract_assertions.sql")
        for clause in ["d.scope='patient'", "d.status='active'", "LIMIT 10", "'page_size_limit'",
                       "'pass_a_invalid'", "'pass_b_invalid'", "char_start,char_end",
                       "IFF(:v_verification='verified',NULLIF(:v_value,'null'),NULL)"]:
            self.assertIn(clause,sql)
        self.assertNotIn("'single_pass'",sql)

    def test_merge_preserves_once_only_extraction_before_any_model_call(self):
        sql = self.read("tasks/extract_assertions.sql")
        self.assertIn("AND dp.extraction_attempted_at IS NULL", sql)
        self.assertLess(sql.index("SET extraction_attempted_at = CURRENT_TIMESTAMP()"),
                        sql.index("'page_size_limit'"))
        self.assertLess(sql.index("'page_size_limit'"), sql.index("SELECT AI_COMPLETE("))
        self.assertIn("EXECUTE AS USER SITAR", sql)

    def test_merge_preserves_ingestion_dedupe_stream_and_unreadable_records(self):
        sql = self.read("tasks/parse_documents.sql")
        self.assertEqual(sql.count("doc.source_path = d.relative_path OR doc.file_hash = d.etag"), 2)
        self.assertIn("FROM SAARTHI.DOCUMENTS.DOC_STREAM WHERE METADATA$ACTION = 'INSERT'", sql)
        self.assertIn("ALTER STAGE SAARTHI.STAGES.PATIENT_DOCS REFRESH", sql)
        self.assertIn("ALTER STAGE SAARTHI.STAGES.REFERENCE_DOCS REFRESH", sql)
        self.assertEqual(sql.count("'downloaded_pdf', 'unreadable'"), 2)
        self.assertNotIn("RETURN OBJECT_CONSTRUCT('error','parse_", sql)
        self.assertIn("'patient', :v_doc_type, :v_file_hash, :v_relative_path", sql)
        self.assertIn("CALL SAARTHI.OPERATIONAL.chunk_documents_proc()", sql)
        self.assertIn("EXECUTE AS USER SITAR", sql)

    def test_repeat_findings_do_not_collapse_to_concept_only(self):
        sql = self.read("procedures/extract_one_document.sql")
        self.assertIn("PARTITION BY co.concept_id,a.f:quote::VARCHAR",sql)
        self.assertIn("b.f:quote::VARCHAR=a.f:quote::VARCHAR",sql)
        self.assertIn("POSITION(a.f:quote::VARCHAR,:v_text,POSITION(a.f:quote::VARCHAR,:v_text)+1)=0",sql)
        self.assertIn("IS_NULL_VALUE(a.f:value)",sql)
        self.assertIn("IS_VARCHAR(a.f:value)",sql)

    def test_routing_no_longer_labels_every_patient_file_as_lab_or_quality_by_name(self):
        sql = self.read("tasks/parse_documents.sql")
        self.assertNotIn("ILIKE '%ambiguous%'",sql)
        self.assertNotIn("'clean_pdf'",sql)
        self.assertIn("'patient', :v_doc_type",sql)
        self.assertIn("v_doc_type:='unknown'",sql)

    def test_search_exports_assertion_ids_and_exact_spans_not_claim_eligible_chunks(self):
        sql = self.read("procedures/tools/03_search_patient_documents.sql")
        for clause in ["'id',a.assertion_id", "a.verification_status='verified'",
                       "a.char_end<=LENGTH(:v_text)", "'claim_eligible',FALSE", "'evidence',COALESCE",
                       "d.patient_id=:v_patient_id", "d.ingested_at<=:v_known_as_of"]:
            self.assertIn(clause,sql)

    def test_validator_uses_reference_access_preamble_before_claims(self):
        template = self.read("procedures/tools/_preamble.sql")
        validator = self.read("procedures/validate_answer.sql")
        pattern = r"-- >>> SAARTHI PREAMBLE v1 BEGIN[\s\S]*?-- <<< SAARTHI PREAMBLE v1 END"
        self.assertEqual(re.search(pattern,template)[0],re.search(pattern,validator)[0])
        self.assertLess(validator.index("'access_withdrawn'"),validator.index("v_n_claims :="))

    def test_validator_rejects_unverified_missing_future_and_bad_spans(self):
        sql = self.read("procedures/validate_answer.sql")
        for clause in ["v_ev_verif!='verified'", "v_ev_doc_ingested>v_known_as_of",
                       "v_ev_end>LENGTH(v_ev_source)", "SUBSTR(v_ev_source,v_ev_start+1,v_ev_end-v_ev_start)",
                       "NOT COALESCE(IS_ARRAY(v_evidence),FALSE)",
                       "OBJECT_INSERT(v_claim,'evidence',v_canonical_evidence,TRUE)",
                       "TRY_TO_BOOLEAN(GET_PATH(:v_filter_result, 'value')::VARCHAR),FALSE)"]:
            self.assertIn(clause,sql)


if __name__ == "__main__":
    unittest.main()
