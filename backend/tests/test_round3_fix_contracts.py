"""Offline source regressions for QA round 3 fixes (FIX-ROUND-3). Source reads and local generators
only: NOT Snowflake compilation or execution. Plan: evidence/qa/DEPLOY-ROUND-3.md."""
from pathlib import Path
import json
import re
import tempfile
import unittest

REPO = Path(__file__).resolve().parents[2]
SQL = REPO / "backend/sql"


def read(rel):
    return (REPO / rel).read_text()


class ValueStateRule(unittest.TestCase):
    def rule(self, rel, alias):
        text = read(rel)
        a = text.index("'value_state', CASE")
        b = text.index("ELSE 'unreadable' END", a) + len("ELSE 'unreadable' END")
        body = re.sub(r"--[^\n]*", "", text[a:b])
        body = body.replace(f"{alias}.source_status", "ce.status").replace(f"{alias}.display", "ce.display")
        body = body.replace(f"{alias}.code", "ce.code").replace(f"{alias}.", "h.")
        return re.sub(r"\s+", " ", body)

    def test_timeline_and_labs_use_the_identical_rule(self):
        self.assertEqual(self.rule("backend/sql/procedures/tools/06_get_timeline.sql", "t"),
                         self.rule("backend/sql/procedures/web_reads.sql", "h"))

    def test_recorded_labelled_event_is_present_and_not_received_only_when_cancelled(self):
        text = read("backend/sql/procedures/tools/06_get_timeline.sql")
        self.assertNotIn("ELSE 'not_received'", text)
        self.assertIn("WHEN t.source_status = 'cancelled' THEN 'not_received'", text)
        self.assertIn("NULLIF(TRIM(t.display), '')", text)
        self.assertIn("'ordered' THEN 'pending'", text)

    def test_concept_label_falls_back_to_display_or_code(self):
        text = read("backend/sql/procedures/tools/06_get_timeline.sql")
        self.assertIn("'concept', COALESCE(t.concept_name, NULLIF(TRIM(t.display), ''), NULLIF(TRIM(t.code), ''))",
                      text)


class DeployInputs(unittest.TestCase):
    def test_deploy_round_3_supersedes_and_states_true_counts(self):
        plan = read("evidence/qa/DEPLOY-ROUND-3.md")
        self.assertIn("supersedes", plan.lower())
        self.assertIn("DEPLOY-ROUND-2", plan)
        for needle in ("16 documents", "11 patients", "6 stale", "--manifest", "build_deploy_bundle",
                       "Verification query", "PAT-DEEP-0001"):
            self.assertIn(needle, plan)
        self.assertNotIn("22 rows", plan)
        self.assertNotIn("SNOWFLAKE_PASSWORD", plan)

    def test_manifest_matches_the_documents_the_plan_states(self):
        manifest = json.loads(read("data/generated/cohort_document_manifest.json"))
        self.assertEqual(len(manifest), 16)
        self.assertEqual(len({m["patient_id"] for m in manifest}), 11)

    def test_generator_writes_manifest_and_reports_stale_pdfs(self):
        from data.generator.cohort_documents import EVENTS, main
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "pdf"
            out.mkdir()
            (out / "DOC-PATH-DC-99").write_bytes(b"stale")
            records = main(["--manifest", str(Path(tmp) / "m.json")], EVENTS, out)
            self.assertTrue((out / "DOC-PATH-DC-99").exists(), "stale PDF kept without --prune")
            self.assertEqual(json.loads((Path(tmp) / "m.json").read_text()), records)
            main(["--prune"], EVENTS, out)
            self.assertFalse((out / "DOC-PATH-DC-99").exists())
        self.assertEqual(len(records), 16)

    def test_deep_case_surgical_note_has_a_synthetic_source_page(self):
        text = read("backend/sql/data/load_synthetic.sql")
        self.assertRegex(text, r"INTO SAARTHI\.DOCUMENTS\.DOC_PAGE t USING \(SELECT 'DOC-SURG-NOTE-01' d")
        self.assertIn("SYNTHETIC SURGICAL NOTE", text)
        m = re.search(r"VALUES \('DOC-SURG-NOTE-01', 0,\s*'([^']*)',\s*(\d+)\)", text)
        self.assertEqual(len(m.group(1)), int(m.group(2)))


class RunnerIsSafe(unittest.TestCase):
    src = read("backend/scripts/run-sql-from-env.mjs")

    def test_role_is_required_and_accountadmin_is_not_the_default(self):
        self.assertNotIn("|| 'ACCOUNTADMIN'", self.src)
        self.assertIn("'SNOWFLAKE_ROLE'", self.src)
        self.assertIn("--allow-accountadmin", self.src)

    def test_no_password_path_and_no_inline_secret_in_docs(self):
        self.assertNotIn("SNOWFLAKE_PASSWORD", self.src.replace("a password is not", ""))
        self.assertNotRegex(self.src, r"SNOWFLAKE_PAT=<")
        for doc in ("evidence/qa/DEPLOY-ROUND-3.md", "backend/sql/deploy/README.md"):
            self.assertNotRegex(read(doc), r"SNOWFLAKE_(PASSWORD|PAT)=\S")


class GovernanceAndStatus(unittest.TestCase):
    def test_rap_matches_procedure_predicate_and_keys_on_current_user(self):
        text = read("backend/sql/governance/01_policies.sql")
        rap = text[text.index("CREATE OR REPLACE ROW ACCESS POLICY"):text.index("-- Sensitivity tag")]
        self.assertIn("p.snowflake_user = CURRENT_USER()", rap)
        self.assertIn("ct.role_type IN ('treating', 'coordinator')", rap)
        self.assertIn("p.active = TRUE", rap)
        self.assertNotRegex(re.sub(r"--[^\n]*", "", rap), r"CURRENT_ROLE\(\)")

    def test_unread_discordance_links_are_stated_designed_only(self):
        status = read("IMPLEMENTATION-STATUS.md")
        self.assertIn("discordant_across_specimens", status)
        self.assertIn("designed-only", status)


if __name__ == "__main__":
    unittest.main()
