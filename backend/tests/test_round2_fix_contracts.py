"""Offline source regressions for QA round 2 fixes (FIX-ROUND-2). Source reads only: NOT Snowflake
compilation or execution. Deploy order and verification: evidence/qa/DEPLOY-ROUND-2.md."""
from pathlib import Path
import re
import unittest

REPO = Path(__file__).resolve().parents[2]
SQL = REPO / "backend/sql"
WEB = REPO / "web"


def read(path):
    return path.read_text()


class DeployPlanIsExecutableInSnowsight(unittest.TestCase):
    plan = read(REPO / "evidence/qa/DEPLOY-ROUND-2.md")

    def test_supersedes_round_1_and_has_no_put_step(self):
        self.assertIn("supersedes", self.plan.lower())
        self.assertIn("DEPLOY-ROUND-1", self.plan)
        # PUT may be mentioned only to say it cannot run, never as an instruction line.
        for line in self.plan.splitlines():
            self.assertFalse(line.lstrip().startswith("PUT "), line)

    def test_plan_covers_seed_whole_file_tasks_and_verification(self):
        for needle in ("load_synthetic.sql", "tasks/reconcile_evidence.sql", "tasks/orchestrator.sql",
                       "SNOWFLAKE_SSE", "Pre-deploy checklist", "Post-deploy verification",
                       "verification_status", "evidence_ids", "web_reads.sql"):
            self.assertIn(needle, self.plan)
        self.assertNotIn("run ONLY the", self.plan)

    def test_web_reads_is_deployed_before_the_web_restart(self):
        self.assertLess(self.plan.index("procedures/web_reads.sql"),
                        self.plan.index("Restart the web"))

    def test_env_runner_never_embeds_credentials(self):
        src = read(REPO / "backend/scripts/run-sql-from-env.mjs")
        self.assertIn("process.env", src)
        self.assertRegex(src, r"env\.SNOWFLAKE_ACCOUNT")
        self.assertNotRegex(src, r"\.snowflake|\.p8|snowflake\.log|OHCXVXM|JR18576")
        self.assertIn("--apply", src)  # dry run by default


class SqlUsesUnambiguousConstructs(unittest.TestCase):
    def test_gate_spans_flatten_is_isolated_in_its_own_cte(self):
        reads = read(SQL / "procedures/web_reads.sql")
        self.assertIn("gate_cites AS (", reads)
        self.assertEqual(reads.count("LATERAL FLATTEN(input => rs.evidence_ids)"), 1)
        cites = reads[reads.index("gate_cites AS ("):reads.index("gate_spans AS (")]
        self.assertNotIn(" JOIN ", cites)  # comma-LATERAL only, no JOIN mixing in that FROM
        spans = reads[reads.index("gate_spans AS ("):]
        self.assertNotRegex(spans.split("GROUP BY gc.rule_id")[0], r",\s*LATERAL")

    def test_lvef_evidence_has_no_or_between_window_functions(self):
        gates = read(SQL / "procedures/evaluate_gates.sql")
        self.assertNotRegex(gates, r"QUALIFY[^;]*\bOR\b")
        self.assertIn("rn_first = 1 OR rn_last = 1", gates)

    def test_schemes_branch_declares_instead_of_let(self):
        reads = read(SQL / "procedures/web_reads.sql")
        self.assertNotIn("LET v_scheme_fin", reads)
        self.assertIn("v_scheme_fin BOOLEAN DEFAULT FALSE", reads)
        self.assertIn("v_scheme_fin := COALESCE(ARRAY_CONTAINS('financial'::VARIANT", reads)

    def test_scheme_eligibility_is_full_refresh_without_correlated_subquery(self):
        dt = read(SQL / "dynamic_tables/04_scheme_eligibility.sql")
        self.assertIn("REFRESH_MODE = FULL", dt)
        self.assertNotIn("EXISTS", dt.split("AS\nSELECT")[1])
        self.assertIn("has_current_scheme_coverage", dt)

    def test_packets_view_is_ordered_and_readable_by_id(self):
        reads = read(SQL / "procedures/web_reads.sql")
        block = reads[reads.index("VIEW_NAME = 'packets'"):reads.index("VIEW_NAME = 'document'")]
        self.assertIn("ORDER BY ep.delivered_at DESC, ep.packet_id", block)
        self.assertIn("ep.packet_id=:ARGUMENT", block)
        ts = read(WEB / "lib/patient.ts")
        self.assertIn("GET_WEB_PATIENT_DATA('packets',?)", ts)


class WebFixes(unittest.TestCase):
    def test_timeline_never_defaults_value_state_to_not_received(self):
        ts = read(WEB / "lib/patient.ts")
        self.assertNotIn('"not_received"', ts)
        self.assertIn("deriveValueState(", ts)
        view = read(WEB / "app/patient/[id]/patient-timeline.tsx")
        self.assertIn("factStateDisplay(event)", view)  # N4-04: label + "no value recorded"

    def test_census_label_distinguishes_absent_clock_from_nothing_computed(self):
        census = read(WEB / "lib/census.ts")
        self.assertIn("Readiness clock not reported by the server", census)
        self.assertIn("No readiness computed yet", census)
        self.assertIn("censusClockLabel(data.error, asOf, loadedAt, data.rows.length)",
                      read(WEB / "app/page.tsx"))

    def test_document_page_rejects_malformed_patient_ids(self):
        page = read(WEB / "app/patient/[id]/documents/[doc]/page.tsx")
        self.assertIn("if (!isValidPatientId(id)) notFound();", page)

    def test_unconfirmed_write_has_a_specific_message(self):
        self.assertIn("could not be read back", read(WEB / "components/task-actions.tsx"))
        self.assertIn("write_readback_unconfirmed", read(WEB / "components/use-patient-review-task.ts"))

    def test_ask_route_refuses_reference_scope_instead_of_dropping_it(self):
        route = read(WEB / "app/api/ask/route.ts")
        self.assertIn('body.sourceScope === "reference"', route)
        self.assertLess(route.index("reference_scope_unavailable"), route.index("askPatient(body"))


if __name__ == "__main__":
    unittest.main()
