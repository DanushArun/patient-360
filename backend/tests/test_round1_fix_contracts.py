"""Offline source regressions for QA/code-review round 1 fixes (FIX-ROUND-1).

These read the SQL/TypeScript source. They are NOT Snowflake compilation or execution; the
fixed-needs-snowflake-deploy items still require the deploy order in evidence/qa/DEPLOY-ROUND-1.md.
"""
from pathlib import Path
import re
import unittest

REPO = Path(__file__).resolve().parents[2]
SQL = REPO / "backend/sql"
WEB = REPO / "frontend"


def sql(path):
    return (SQL / path).read_text()


def web(path):
    return (WEB / path).read_text()


class SetupDeploysEveryWebProcedure(unittest.TestCase):
    def test_setup_runs_every_wired_web_procedure_file(self):
        setup = sql("setup.sql")
        for name in ("web_reads", "web_workflows", "web_evidence"):
            self.assertIn(f"EXECUTE IMMEDIATE FROM './procedures/{name}.sql'", setup)

    def test_every_call_from_web_resolves_to_a_create_procedure_reachable_from_setup(self):
        setup = sql("setup.sql")
        files = re.findall(r"EXECUTE IMMEDIATE FROM '\./([^']+\.sql)'", setup)
        created = set()
        for rel in files:
            p = SQL / rel
            if p.exists():
                created |= {m.upper() for m in re.findall(
                    r"CREATE OR REPLACE PROCEDURE SAARTHI\.OPERATIONAL\.(\w+)", p.read_text(),
                    re.IGNORECASE)}
        called = set()
        for ts in list((WEB / "lib").glob("*.ts")) + list((WEB / "app").rglob("*.ts*")):
            called |= {m.upper() for m in re.findall(
                r"CALL SAARTHI\.OPERATIONAL\.(\w+)", ts.read_text())}
        self.assertTrue(called, "no CALLs found; the scan is broken")
        self.assertEqual(sorted(called - created), [])

    def test_patch_script_installs_every_changed_procedure_in_dependency_order(self):
        script = (REPO / "backend/scripts/deploy-web-integration.mjs").read_text()
        for name in ("evaluate_gates.sql", "tools/06_get_timeline.sql",
                     "tools/08_create_review_task.sql", "web_reads.sql",
                     "web_workflows.sql", "web_evidence.sql"):
            self.assertIn(f"'{name}'", script)

    def test_legacy_authorization_upgrade_is_not_a_noop_inside_setup(self):
        setup = sql("setup.sql")
        self.assertNotIn("EXECUTE IMMEDIATE FROM './data/upgrade_legacy_authorization.sql'", setup)


class ConsentFailsClosed(unittest.TestCase):
    def test_no_bare_not_array_contains_on_financial_consent(self):
        reads = sql("procedures/web_reads.sql")
        self.assertNotRegex(reads, r"NOT ARRAY_CONTAINS\('financial'")
        self.assertNotRegex(reads, r"(?<!COALESCE\()ARRAY_CONTAINS\('financial'")

    def test_schemes_view_withholds_patient_figures_without_financial_consent(self):
        reads = sql("procedures/web_reads.sql")
        view = reads[reads.index("VIEW_NAME = 'schemes'"):reads.index("VIEW_NAME = 'answers'")]
        self.assertIn("'financial_consent_required'", view)
        self.assertIn("IFF(:v_scheme_fin, annual_limit, NULL)", view)

    def test_scheme_eligibility_is_not_asserted_from_domicile_alone(self):
        dt = sql("dynamic_tables/04_scheme_eligibility.sql")
        self.assertIn("'eligibility_unverified'", dt)
        self.assertNotRegex(dt, r"state_scope = p\.state THEN 'eligible'")
        self.assertRegex(dt, r"c\.effective_to\s+>= CURRENT_DATE\(\)")


class AccessPolicyIsOneThing(unittest.TestCase):
    def test_no_case_folded_user_match_and_every_preamble_restricts_role_type(self):
        for path in (SQL / "procedures").rglob("*.sql"):
            text = path.read_text()
            self.assertNotRegex(text, r"UPPER\([\w.]*snowflake_user\)\s*=\s*UPPER\(CURRENT_USER",
                                msg=str(path))
        for path in (SQL / "procedures/tools").glob("*.sql"):
            text = path.read_text()
            if "SAARTHI PREAMBLE v1 BEGIN" in text:
                block = text[text.index("PREAMBLE v1 BEGIN"):text.index("PREAMBLE v1 END")]
                self.assertIn("role_type IN ('treating', 'coordinator')", block, msg=str(path))
        self.assertIn("role_type IN ('treating', 'coordinator')", sql("procedures/bind_patient.sql"))

    def test_no_current_role_in_executable_sql(self):
        for path in (SQL / "procedures").rglob("web_*.sql"):
            code = "\n".join(line for line in path.read_text().splitlines()
                             if not line.strip().startswith("--"))
            self.assertNotIn("CURRENT_ROLE()", code, msg=str(path))


class GatesCiteEvidence(unittest.TestCase):
    def test_no_rule_dispatch_hardcodes_empty_evidence(self):
        gates = sql("procedures/evaluate_gates.sql")
        special = gates[gates.index("LET c_special CURSOR"):]
        self.assertNotIn("'evidence_ids', ARRAY_CONSTRUCT()", special)
        self.assertIn("'evidence_ids', v_ev", special)
        for rule in ("ID-LINK-001", "ID-QUAR-001", "DOC-PATH-001", "DOC-DISC-001", "DOC-HER2-001",
                     "COV-LIMIT-001", "COV-AUTH-001", "CLIN-CRCL-001", "CLIN-BILI-001",
                     "SURG-CLEAR-001", "SURV-LVEF-002"):
            branch = special[special.index(f"v_rule_id = '{rule}'"):]
            self.assertIn("v_ev := ", branch[:1500], msg=rule)

    def test_threshold_gates_also_cite_supporting_verified_assertions(self):
        gates = sql("procedures/evaluate_gates.sql")
        self.assertIn("el.relation = 'supports'", gates)
        self.assertIn("ARRAY_CAT(ARRAY_CONSTRUCT(v_evt_id)", gates)

    def test_orchestrator_runs_reconcile_before_readiness(self):
        orch = sql("tasks/orchestrator.sql")
        self.assertLess(orch.index("reconcile_evidence_proc()"),
                        orch.index("refresh_readiness_proc()"))
        self.assertLess(orch.index("extract_assertions_proc()"),
                        orch.index("reconcile_evidence_proc()"))

    def test_snapshot_returns_exact_spans_only_for_verified_assertions(self):
        reads = sql("procedures/web_reads.sql")
        snap = reads[reads.index("VIEW_NAME = 'snapshot'"):reads.index("VIEW_NAME = 'tasks'")]
        for clause in ["gate_spans", "a.verification_status = 'verified'",
                       "d.patient_id = :v_patient_id", "a.char_end <= LENGTH(dp.text)",
                       "source_spans"]:
            self.assertIn(clause, snap)

    def test_packets_inherit_citations_from_gate_evidence(self):
        ev = sql("procedures/web_evidence.sql")
        self.assertIn("LATERAL FLATTEN(input=>g.value:evidence_ids)", ev)


class TimelineCarriesEveryRenderedField(unittest.TestCase):
    def test_timeline_emits_values_units_states_and_provenance(self):
        tl = sql("procedures/tools/06_get_timeline.sql")
        for key in ("'value_text'", "'unit'", "'abnormal_flag'", "'value_state'", "'derivation'",
                    "'valid_until'", "'source_event_ids'", "'source_assertion_ids'",
                    "'source_document_ids'", "'total_events'", "'truncated'",
                    "'provenance_observed_at'"):
            self.assertIn(key, tl)
        self.assertIn("IFF(t.plausibility_state = 'present', t.value_num, NULL)", tl)
        self.assertIn("'not_received'", tl)

    def test_timeline_mapper_keeps_those_fields(self):
        ts = web("lib/patient.ts")
        for key in ("value_text", "unit", "value_state", "source_document_ids", "total_events"):
            self.assertIn(key, ts[ts.index("loadPatientTimeline"):ts.index("loadReviewTasks")])


class DocumentStateIsVerified(unittest.TestCase):
    def test_document_is_present_only_through_a_verified_assertion(self):
        reads = sql("procedures/web_reads.sql")
        self.assertIn("WHEN a.verified_present_assertions > 0 THEN 'present'", reads)
        self.assertNotIn("a.present_assertions", reads)
        for state in ("unreadable", "explicitly_negative", "superseded"):
            self.assertIn(f"THEN '{state}'", reads)


class CreateTaskIsAtomicAndNotReplayedForever(unittest.TestCase):
    def test_create_review_task_uses_one_merge_in_a_transaction(self):
        text = sql("procedures/tools/08_create_review_task.sql")
        body = text[text.index("IF (NOT v_issue_in_scope)"):]
        self.assertIn("BEGIN TRANSACTION", body)
        self.assertIn("MERGE INTO SAARTHI.OPERATIONAL.REVIEW_TASK", body)
        self.assertIn("state IN ('open', 'acknowledged')", body)
        self.assertNotIn("INSERT INTO SAARTHI.OPERATIONAL.REVIEW_TASK", body)
        self.assertLess(body.index("v_existing :="), body.index("MERGE INTO"))

    def test_web_key_is_per_attempt_not_constant(self):
        ts = web("lib/patient.ts")
        self.assertIn("`${issueId}:${action}:${requestId ?? randomUUID()}`", ts)
        self.assertNotIn("`${issueId}:${action}`", ts)

    def test_resolving_the_last_open_task_closes_the_issue(self):
        wf = sql("procedures/web_workflows.sql")
        self.assertIn("UPDATE SAARTHI.OPERATIONAL.REVIEW_ISSUE SET state='closed'", wf)

    def test_writes_are_confirmed_by_read_back(self):
        ts = web("lib/patient.ts")
        self.assertEqual(ts.count("confirmWriteReceipt({"), 3)


class RoutesAreHardened(unittest.TestCase):
    def test_every_state_changing_route_checks_origin_and_uses_typed_errors(self):
        for rel in ("app/api/ask/route.ts", "app/api/review-task/route.ts",
                    "app/api/patient/[id]/evidence/route.ts",
                    "app/api/patient/[id]/review-tasks/route.ts",
                    "app/api/patient/[id]/route.ts"):
            text = web(rel)
            self.assertIn("isSameOrigin(request)", text, msg=rel)
        for rel in Path(WEB / "app/api").rglob("route.ts"):
            text = rel.read_text()
            self.assertNotIn("error.message", text, msg=str(rel))
            self.assertNotIn("includes(\"access\")", text, msg=str(rel))

    def test_malformed_json_is_a_client_error(self):
        for rel in ("app/api/ask/route.ts", "app/api/review-task/route.ts"):
            text = web(rel)
            self.assertIn("readJsonBody(request)", text)
            self.assertLess(text.index("readJsonBody"), text.index("agent_unreachable")
                            if "agent_unreachable" in text else text.index("action_unavailable"))


class CensusCarriesItsOwnClock(unittest.TestCase):
    def test_census_selects_known_as_of_and_page_renders_it(self):
        reads = sql("procedures/web_reads.sql")
        census = reads[reads.index("VIEW_NAME = 'census'"):reads.index("VIEW_NAME = 'practitioner'")]
        self.assertIn("AS known_as_of", census)
        page = web("app/page.tsx")
        self.assertIn("oldestKnownAsOf", page)
        self.assertNotIn("'Refreshed'", page)


class LoaderKeepsIngestionClock(unittest.TestCase):
    def test_reload_does_not_restamp_unchanged_events(self):
        load = sql("data/load_daycare_cohort.sql")
        self.assertIn("IFF(t.event_time = s.event_time, t.ingested_at, CURRENT_TIMESTAMP())", load)


if __name__ == "__main__":
    unittest.main()
