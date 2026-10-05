"""The generated Snowsight bundle must match the repo SQL it is built from (no drift)."""
import re
import subprocess
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "backend/sql/deploy"


class DeployBundle(unittest.TestCase):
    def test_bundle_is_not_stale(self):
        done = subprocess.run([sys.executable, "-m", "backend.scripts.build_deploy_bundle", "--check"],
                              cwd=REPO, capture_output=True, text=True)
        self.assertEqual(done.returncode, 0, done.stderr + "\nrebuild: python -m backend.scripts.build_deploy_bundle")

    def test_files_are_ordered_small_and_never_drop_core_tables_or_hold_secrets(self):
        names = sorted(p.name for p in OUT.glob("*.sql"))
        self.assertEqual(names[0], "00_preflight.sql")
        self.assertEqual(names[-1], "09_verify.sql")
        self.assertEqual(names, [f"{i:02d}_" + n.split("_", 1)[1] for i, n in enumerate(names)])
        for name in names:
            text = (OUT / name).read_text()
            self.assertLess(len(text.encode()), 150_000, name)
            self.assertIn("USE SECONDARY ROLES NONE;", text)
            self.assertNotRegex(text, r"(?i)DROP\s+TABLE")
            self.assertNotIn("setup.sql", re.sub(r"--[^\n]*", "", text))
            self.assertNotRegex(text, r"(?i)(password|private_key|bearer)\s*[:=]\s*['\"]?\w{8,}")
            self.assertNotRegex(text, r"(?m)^PUT ")

    def test_readme_lists_every_step_and_the_12_patient_criteria(self):
        readme = (OUT / "README.md").read_text()
        for n in ("00", "01", "02", "03", "04", "05", "06", "07", "08", "09"):
            self.assertRegex(readme, rf"\| {n} \|")
        for needle in ("16 documents over 11 patients", "all 12 patients", "with_evidence >= 1",
                       "verification_status"):
            self.assertIn(needle, readme)

    def test_documents_step_has_every_manifest_document(self):
        import json
        manifest = json.loads((REPO / "data/generated/cohort_document_manifest.json").read_text())
        text = (OUT / "06_cohort_and_documents.sql").read_text()
        for record in manifest:
            self.assertIn(f"'{record['doc_id']}'", text)


    def _sql(self, name):
        return re.sub(r"(?m)^\s*--[^\n]*$", "", (OUT / name).read_text())

    def test_n4_01_grants_precede_tasks_and_suspend_is_executed_and_guarded(self):
        text = self._sql("04_tasks_and_grants.sql")
        self.assertLess(text.index("GRANT USAGE ON PROCEDURE SAARTHI.OPERATIONAL.ASK_SAARTHI"), text.index("CREATE OR REPLACE TASK"))
        self.assertLess(text.index("ALTER TASK IF EXISTS SAARTHI.OPERATIONAL.TASK_PARSE_DOCUMENTS SUSPEND"),
                        text.index("CREATE OR REPLACE TASK"))
        self.assertIn("ALTER TASK IF EXISTS SAARTHI.OPERATIONAL.TASK_PARSE_DOCUMENTS SUSPEND",
                      self._sql("00_preflight.sql"))
        for obj in ("ON AGENT SAARTHI.OPERATIONAL.SAARTHI_AGENT", "ON MCP SERVER SAARTHI.OPERATIONAL.SAARTHI_MCP"):
            i = text.index(obj)
            self.assertIn("EXCEPTION", text[i:i + 400], obj)
            self.assertIn("EXECUTE IMMEDIATE $$", text[max(0, i - 120):i])

    def test_n4_02_page_merges_run_detached_and_the_policy_is_attached_after_them(self):
        for name in ("05_seed_data.sql", "06_cohort_and_documents.sql"):
            text = self._sql(name)
            self.assertIn("DROP ROW ACCESS POLICY", text)
            self.assertLess(text.index("DROP ROW ACCESS POLICY"), text.index("MERGE INTO SAARTHI.DOCUMENTS.DOC_PAGE"))
            self.assertNotIn("ADD ROW ACCESS POLICY", text)
        self.assertIn("ADD ROW ACCESS POLICY", self._sql("07_governance_row_access.sql"))
        pipeline = self._sql("08_pipeline_kickoff.sql")
        for needle in ("RAISE no_pages", "RAISE not_prac01", "RAISE procs_missing", "RAISE rap_missing"):
            self.assertIn(needle, pipeline)
        self.assertLess(pipeline.index("RAISE no_pages"), pipeline.index("CALL SAARTHI"))

    def test_n4_03_policy_argument_is_unambiguous_and_negative_test_fails_closed(self):
        policy = (REPO / "backend/sql/governance/01_policies.sql").read_text()
        body = re.sub(r"(?m)^\s*--[^\n]*$", "", policy)
        self.assertIn("AS (p_doc_id VARCHAR)", body)
        self.assertNotRegex(body, r"=\s*doc_id\b(?!\s*\w)")  # no unqualified column-vs-argument compare
        self.assertEqual(len(re.findall(r"d\.doc_id = p_doc_id", body)), 2)
        gov = self._sql("07_governance_row_access.sql")
        self.assertLess(gov.index("ADD ROW ACCESS POLICY"), gov.index("RAISE rap_leak"))
        self.assertIn("doc_id = 'DOC-RAP-CANARY-01'", gov)
        self.assertIn("DOC-RAP-CANARY-01", self._sql("09_verify.sql"))
        self.assertIn("RAISE rap_missing", self._sql("09_verify.sql"))

    def test_n4_06_preflight_lists_missing_pipeline_procedures(self):
        text = self._sql("00_preflight.sql")
        for name in ("RELEASE_PATIENT_BINDING", "ASK_SAARTHI", "PARSE_DOCUMENTS_PROC", "CHUNK_DOCUMENTS_PROC",
                     "EXTRACT_ASSERTIONS_PROC", "REFRESH_READINESS_PROC"):
            self.assertIn(f"'{name}'", text)


if __name__ == "__main__":
    unittest.main()
