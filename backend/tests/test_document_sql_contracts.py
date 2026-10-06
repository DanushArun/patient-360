"""Offline source regressions, NOT Snowflake SQL compilation or live execution."""
from pathlib import Path
import re
import sqlite3
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
        self.assertRegex(sql, r"EXECUTE AS USER [A-Z0-9_]+")

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
        self.assertRegex(sql, r"EXECUTE AS USER [A-Z0-9_]+")

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
                       "'evidence',v_canonical_evidence)",
                       "TRY_TO_BOOLEAN(GET_PATH(:v_filter_result, 'value')::VARCHAR),FALSE)"]:
            self.assertIn(clause,sql)

    def test_numeric_support_requires_matching_units_and_current_verified_sources(self):
        sql = self.read("tasks/reconcile_evidence.sql")
        self.assertIn("AND a.unit = ce.unit", sql)
        # A source can become conflicting after a link was created. The read
        # must recheck trust and patient identity rather than trusting the link.
        reads = self.read("procedures/web_reads.sql")
        links = reads[reads.index("LEFT JOIN (SELECT el.target_id"):]
        for clause in ["a.verification_status = 'verified'", "a.missingness_state = 'present'",
                       "d.scope = 'patient'", "d.patient_id = :v_patient_id",
                       "source_event.patient_id = d.patient_id", "source_event.unit = a.unit"]:
            self.assertIn(clause, links[:links.index("GROUP BY el.target_id")])

    def test_cross_specimen_discordance_is_patient_scoped_and_preserves_missingness(self):
        sql = self.read("tasks/reconcile_evidence.sql")
        self.assertNotIn("SET t.missingness_state = 'discordant_across_specimens'", sql)
        for clause in ["d1.patient_id = d2.patient_id", "d1.accession_id <> d2.accession_id",
                       "a1.concept_id = a2.concept_id", "'assertion'", "'discordant_across_specimens'"]:
            self.assertIn(clause, sql)

    def test_cross_specimen_selection_on_synthetic_relational_rows(self):
        # Execute the actual portable SELECT, not a parallel Python rule. This
        # checks relational behavior; it is not Snowflake procedure compilation.
        sql = self.read("tasks/reconcile_evidence.sql")
        query = sql[sql.index("SELECT DISTINCT a1.assertion_id"):]
        query = query[:query.index(") s")]
        query = query.replace("SAARTHI.EVIDENCE.ASSERTION", "assertions")
        query = query.replace("SAARTHI.DOCUMENTS.DOCUMENT", "documents")
        query = query.replace("SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY", "ontology")
        with sqlite3.connect(":memory:") as db:
            db.create_function("EQUAL_NULL", 2, lambda a, b: a == b)
            db.executescript("""
                CREATE TABLE assertions (assertion_id TEXT, doc_id TEXT, concept_id TEXT,
                    value TEXT, unit TEXT, verification_status TEXT, missingness_state TEXT);
                CREATE TABLE documents (doc_id TEXT, patient_id TEXT, scope TEXT,
                    status TEXT, accession_id TEXT);
                CREATE TABLE ontology (concept_id TEXT, concept_type TEXT);
                INSERT INTO ontology VALUES ('HER2', 'biomarker'), ('HB', 'analyte');
            """)
            rows = [
                ("a", "p1", "s1", "1+", None, "verified", "present"),
                ("b", "p1", "s2", "3+", None, "verified", "present"),
                ("foreign", "p2", "s3", "2+", None, "verified", "present"),
                ("same_specimen", "p1", "s1", "2+", None, "verified", "present"),
                ("unknown_specimen", "p1", None, "2+", None, "verified", "present"),
                ("conflict", "p1", "s4", "2+", None, "conflicting", "present"),
                ("pending", "p1", "s5", "2+", None, "verified", "pending"),
                ("different_unit", "p1", "s6", "2+", "%", "verified", "present"),
            ]
            for name, patient, accession, value, unit, verified, state in rows:
                db.execute("INSERT INTO documents VALUES (?, ?, 'patient', 'active', ?)",
                           (name, patient, accession))
                db.execute("INSERT INTO assertions VALUES (?, ?, 'HER2', ?, ?, ?, ?)",
                           (name, name, value, unit, verified, state))
            self.assertEqual(set(db.execute(query)), {
                ("a", "b"), ("b", "a"), ("same_specimen", "b"), ("b", "same_specimen"),
            })
            # CR1-09: serial analytes (Hb 10.1 then 11.2 on different reports) are a trend,
            # not a cross-specimen discordance, even with distinct accession ids.
            for name, accession, value in [("hb1", "h1", "10.1"), ("hb2", "h2", "11.2")]:
                db.execute("INSERT INTO documents VALUES (?, 'p9', 'patient', 'active', ?)",
                           (name, accession))
                db.execute("INSERT INTO assertions VALUES (?, ?, 'HB', ?, 'g/dL', 'verified', 'present')",
                           (name, name, value))
            self.assertFalse({row for row in db.execute(query) if row[0] in ("hb1", "hb2")})


if __name__ == "__main__":
    unittest.main()
