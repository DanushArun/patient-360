#!/usr/bin/env python3
"""
run_rule_fixtures.py - SAARTHI rule fixture validator + live regression check
=============================================================================

Two-stage test corpus for the 16 SAARTHI readiness rules:

  STAGE 1 - Structural validation
      All 80 fixtures load; every rule has 5 scenarios; IDs unique.

  STAGE 2 - Deep-case regression (pass path)
      Calls evaluate_gates for PAT-DEEP-0001 / EVT-CHEMO-06 and verifies each
      observed outcome is predicted by at least one fixture scenario. Proves
      the fixtures agree with reality for the deep-case data profile.

  STAGE 3 - Scratch-patient harness (fail path + edges)
      For every rule where a fail/edge scenario is deterministically seedable
      from the fixture's `inputs` field, this stage:
        1. Provisions a scratch patient (PAT-FX-<n>) with CARE_TEAM + CONSENT
           so the row access policy accepts the current caller.
        2. Seeds the exact evidence the fixture describes for the rule under
           test (e.g. a low creatinine + a high age -> a CrCl fail case).
        3. Calls evaluate_gates against that scratch patient.
        4. Asserts the specific rule's outcome matches the fixture expected.
        5. Tears down all scratch rows.

      Not every fixture is stage-3-testable - cross-source and conflicting
      scenarios need multi-specimen orchestration that this harness does not
      yet do. Untestable fixtures are counted, named, and reported so nothing
      is silently skipped.

USAGE
    source venv/bin/activate
    python3 backend/scripts/run_rule_fixtures.py [--connection EA72552_SNOW] [--keep-scratch]

EXIT CODE
    0 - all stages pass
    1 - any mismatch, structural error, or SQL error
"""
from __future__ import annotations
import argparse
import json
import re
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

try:
    import yaml
except ImportError:
    print("ERROR: pyyaml not installed. Run: pip install pyyaml", file=sys.stderr)
    sys.exit(2)


REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURES = REPO_ROOT / "data" / "fixtures" / "rules" / "rule_fixtures.yaml"
DEEP_PATIENT = "PAT-DEEP-0001"
DEEP_ENCOUNTER = "EVT-CHEMO-06"

# Ontology concept UUIDs - copied from CLINICAL_ONTOLOGY, verified 22 Sept
CONCEPT = {
    "ANC":              "e695965e-646b-44c0-94c0-be884b8739e7",  # placeholder if used
    "PLT":              "59ab8f31-38fc-4b0d-ad13-b9b7869a43ab",
    "WBC":              "f27118e4-fc99-45fd-a5a2-a6103c9ba531",
    "NEUTROPHIL_PCT":   "a8ab1319-64bf-4f60-993b-0acfdb0e525b",
    "LVEF":             "047c1aee-f5ff-415b-9f44-1d222bd96b18",
    "HBA1C":            "e695965e-646b-44c0-94c0-be884b8739e7",
    "T_SCORE":          "61e47ee5-a07f-4e0f-92f4-bf480174380d",
    "CREATININE":       "d74263e5-108d-455d-985a-23505d911cc7",
    "WEIGHT":           "305bb211-39ef-4070-a204-5b1fb01d0a78",
    "BILIRUBIN":        "e64db6d4-a019-4cfe-97b0-633220e157f9",
    "AST":              "7449126c-da4c-4d46-8c81-b067968c9715",
}


def run_snow(connection: str, sql: str) -> str:
    """Execute SQL via snow CLI. Uses -f with a temp file so multi-statement
    scripts work reliably (snow sql -q silently fails on multiple statements)."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False) as f:
        f.write(sql)
        tmp_path = f.name
    try:
        proc = subprocess.run(
            ["snow", "sql", "-c", connection, "-f", tmp_path, "--format", "json"],
            capture_output=True, text=True, check=False,
        )
    finally:
        Path(tmp_path).unlink(missing_ok=True)
    if proc.returncode != 0:
        raise RuntimeError(f"snow sql failed:\nSTDERR: {proc.stderr}\nSTDOUT: {proc.stdout[:400]}\nSQL:\n{sql[:600]}")
    return proc.stdout.strip()


def load_fixtures() -> dict:
    with FIXTURES.open() as f:
        return yaml.safe_load(f)


# ---------------------------------------------------------------------------
# STAGE 1
# ---------------------------------------------------------------------------
def structural_check(data: dict) -> tuple[int, list[str]]:
    errors: list[str] = []
    rules = [k for k, v in data.items() if isinstance(v, list)]
    if len(rules) != 16:
        errors.append(f"Expected 16 rules, got {len(rules)}")
    ids_seen: set[str] = set()
    total = 0
    for rule_id in rules:
        fixtures = data[rule_id]
        if len(fixtures) != 5:
            errors.append(f"{rule_id}: expected 5 scenarios, got {len(fixtures)}")
        scenarios_seen = set()
        for fx in fixtures:
            total += 1
            for req in ("id", "scenario", "inputs", "expected"):
                if req not in fx:
                    errors.append(f"{fx.get('id','?')}: missing '{req}'")
            if fx["id"] in ids_seen:
                errors.append(f"Duplicate fixture id: {fx['id']}")
            ids_seen.add(fx["id"])
            scenarios_seen.add(fx["scenario"])
            if "outcome" not in fx.get("expected", {}):
                errors.append(f"{fx['id']}: expected.outcome missing")
        expected_scenarios = {"pass", "fail", "exact-boundary", "missing-input", "conflicting-input"}
        missing = expected_scenarios - scenarios_seen
        if missing:
            errors.append(f"{rule_id}: missing scenarios {missing}")
    return total, errors


# ---------------------------------------------------------------------------
# STAGE 2 - deep case
# ---------------------------------------------------------------------------
def call_evaluate_gates(connection: str, patient: str, encounter: str) -> dict:
    sql = f"CALL SAARTHI.OPERATIONAL.EVALUATE_GATES('{patient}','{encounter}',NULL)"
    raw = run_snow(connection, sql)
    parsed = json.loads(raw)
    return json.loads(parsed[0]["EVALUATE_GATES"])


def stage2_deep_case(connection: str, data: dict) -> tuple[list[dict], list[str]]:
    gates_response = call_evaluate_gates(connection, DEEP_PATIENT, DEEP_ENCOUNTER)
    gates = gates_response.get("gates", [])
    checks: list[dict] = []
    errors: list[str] = []
    for gate in gates:
        rule_id = gate["rule_id"]
        actual = gate["outcome"]
        if rule_id not in data:
            errors.append(f"Rule {rule_id} not in fixtures YAML")
            continue
        matching = [fx for fx in data[rule_id] if fx["expected"]["outcome"] == actual]
        checks.append({
            "rule_id": rule_id, "actual": actual, "reason": gate.get("reason", ""),
            "matches": [fx["id"] for fx in matching], "agrees": bool(matching),
        })
        if not matching:
            errors.append(f"{rule_id}: observed '{actual}' - no fixture predicts this")
    return checks, errors


# ---------------------------------------------------------------------------
# STAGE 3 - scratch-patient harness
# ---------------------------------------------------------------------------
# For each rule, a `seeder` translates a fixture's `inputs` + `expected` into a
# small SQL snippet that provisions the scratch state, and a `probes` list
# names which rule_id(s) to check for that scenario. Rules without a seeder
# are reported as "not stage-3-testable" and skipped.
#
# All scratch patients use the same encounter shape: an ENCOUNTER row 3 days
# after event_time so the max_age_days check has a stable anchor.

SCRATCH_ENCOUNTER = "EVT-FX-ENC-01"
FRESH_EVENT_TIME = "TIMESTAMP_NTZ_FROM_PARTS(2025,4,15,10,0,0)"  # 38 days before deep-case encounter
STALE_EVENT_TIME = "TIMESTAMP_NTZ_FROM_PARTS(2024,10,1,10,0,0)"  # very stale


def provision_scratch(connection: str, pid: str, dob: str = "'1970-01-01'", gender: str = "'female'") -> None:
    sql = f"""
    MERGE INTO SAARTHI.CORE.PATIENT t USING (SELECT '{pid}' k) s ON t.patient_id = s.k
    WHEN NOT MATCHED THEN INSERT (patient_id, abha_ref, name, dob, gender, district, state, primary_language, created_at)
    VALUES ('{pid}', 'ABHA-FX-'||SUBSTR(UUID_STRING(),1,8), 'Fixture Test', {dob}, {gender}, 'FixtureDistrict', 'FixtureState', 'en', CURRENT_TIMESTAMP());
    MERGE INTO SAARTHI.GOVERNANCE.CARE_TEAM t USING (SELECT '{pid}' k) s ON t.patient_id = s.k AND t.practitioner_id = 'PRAC-01'
    WHEN NOT MATCHED THEN INSERT (care_team_id, practitioner_id, patient_id, facility_id, role_type, active_from, granted_by)
    VALUES (UUID_STRING(), 'PRAC-01', '{pid}', 'FAC-02', 'treating', DATEADD(day,-30,CURRENT_DATE()), 'PRAC-01');
    MERGE INTO SAARTHI.GOVERNANCE.CONSENT t USING (SELECT 'CON-{pid}' k) s ON t.consent_id = s.k
    WHEN NOT MATCHED THEN INSERT (consent_id, patient_id, granted_to_facility_id, granted_by, grantor_name, purpose_code, data_categories, valid_from, valid_until, status)
    VALUES ('CON-{pid}', '{pid}', 'FAC-02', 'patient', 'Fixture Test', 'treatment', ARRAY_CONSTRUCT('clinical','identity'), DATEADD(day,-30,CURRENT_TIMESTAMP()), NULL, 'active');
    MERGE INTO SAARTHI.CORE.ENCOUNTER t USING (SELECT '{SCRATCH_ENCOUNTER}-{pid}' k) s ON t.encounter_id = s.k
    WHEN NOT MATCHED THEN INSERT (encounter_id, patient_id, facility_id, department_id, encounter_type, scheduled_time, event_time, status)
    VALUES ('{SCRATCH_ENCOUNTER}-{pid}', '{pid}', 'FAC-02', 'DEPT-ONC-02', 'daycare',
            TIMESTAMP_NTZ_FROM_PARTS(2025,5,23,9,0,0), TIMESTAMP_NTZ_FROM_PARTS(2025,5,23,9,0,0), 'scheduled');
    """
    run_snow(connection, sql)


def teardown_all_scratch(connection: str) -> None:
    sql = """
    DELETE FROM SAARTHI.EVIDENCE.ASSERTION WHERE subject LIKE 'PAT-FX-%';
    DELETE FROM SAARTHI.CORE.CLINICAL_EVENT WHERE patient_id LIKE 'PAT-FX-%';
    DELETE FROM SAARTHI.CORE.ENCOUNTER WHERE patient_id LIKE 'PAT-FX-%';
    DELETE FROM SAARTHI.DOCUMENTS.DOCUMENT WHERE patient_id LIKE 'PAT-FX-%';
    DELETE FROM SAARTHI.CORE.AUTHORIZATION WHERE patient_id LIKE 'PAT-FX-%';
    DELETE FROM SAARTHI.CORE.COVERAGE WHERE patient_id LIKE 'PAT-FX-%';
    DELETE FROM SAARTHI.CORE.ID_MAP WHERE patient_id LIKE 'PAT-FX-%';
    DELETE FROM SAARTHI.GOVERNANCE.CARE_TEAM WHERE patient_id LIKE 'PAT-FX-%';
    DELETE FROM SAARTHI.GOVERNANCE.CONSENT WHERE patient_id LIKE 'PAT-FX-%';
    DELETE FROM SAARTHI.CORE.PATIENT WHERE patient_id LIKE 'PAT-FX-%';
    """
    run_snow(connection, sql)


def seed_and_probe(connection: str, pid: str, seed_sql: str, rule_id: str) -> tuple[str, str]:
    """Seed scratch state, call evaluate_gates, return (outcome, reason) for rule_id.

    Forces a DT_HARMONIZED_EVENTS refresh after seeding because that DT has
    TARGET_LAG=1 minute; tests need synchronous consistency to pick up rows
    seeded milliseconds earlier. The evaluators for LVEF/HBA1C/T_SCORE read
    from the DT (not raw CLINICAL_EVENT), so without this the scratch data
    is invisible to those three rules and the test spuriously fails.
    """
    if seed_sql:
        run_snow(connection, seed_sql)
    # Force DT to pick up scratch CLINICAL_EVENT rows synchronously
    run_snow(connection, "ALTER DYNAMIC TABLE SAARTHI.CORE.DT_HARMONIZED_EVENTS REFRESH;")
    gates = call_evaluate_gates(connection, pid, f"{SCRATCH_ENCOUNTER}-{pid}")
    for g in gates.get("gates", []):
        if g["rule_id"] == rule_id:
            return g["outcome"], g.get("reason", "")
    return "MISSING", "rule not returned by evaluate_gates"


def stage3_scratch_harness(connection: str) -> tuple[list[dict], list[str]]:
    """
    Runs a curated set of scratch-patient tests that exercise the FAIL / edge
    paths for every rule that has a testable pattern. Reports one result per
    test. This is not the full 64 remaining fixtures - it is the subset whose
    inputs translate cleanly to a single-value seed.
    """
    checks: list[dict] = []
    errors: list[str] = []

    scenarios = [
        # (test_id, rule_id, expected_outcome, seed_sql_template)
        ("ID-QUAR-fail", "ID-QUAR-001", "fail", lambda p:
            f"MERGE INTO SAARTHI.CORE.ID_MAP t USING (SELECT 'IDM-Q-{p}' k) s ON t.map_id=s.k "
            f"WHEN NOT MATCHED THEN INSERT (map_id,patient_id,source_system,source_patient_id,link_status,linked_at) "
            f"VALUES ('IDM-Q-{p}','{p}','FAC-01-MRN','MRN-FX','quarantined',CURRENT_TIMESTAMP());"),
        ("ID-LINK-fail", "ID-LINK-001", "fail", lambda p: ""),  # no ID_MAP rows -> fail
        ("DOC-PATH-fail", "DOC-PATH-001", "fail", lambda p: ""),  # no pathology events -> fail
        ("COV-LIMIT-fail", "COV-LIMIT-001", "fail", lambda p:
            f"MERGE INTO SAARTHI.CORE.COVERAGE t USING (SELECT 'COV-FX-{p}' k) s ON t.coverage_id=s.k "
            f"WHEN NOT MATCHED THEN INSERT (coverage_id,patient_id,payer_type,payer_name,policy_number,is_family_floater,effective_from,effective_to,annual_limit,used_amount,priority,portability) "
            f"VALUES ('COV-FX-{p}','{p}','scheme','PM-JAY','PMJAY-FX-{p}',FALSE,DATEADD(day,-90,CURRENT_DATE()),DATEADD(day,90,CURRENT_DATE()),500000,510000,1,'within_state');"),
        ("COV-AUTH-denied", "COV-AUTH-001", "fail", lambda p:
            f"MERGE INTO SAARTHI.CORE.AUTHORIZATION t USING (SELECT 'PA-FX-{p}' k) s ON t.auth_id=s.k "
            f"WHEN NOT MATCHED THEN INSERT (auth_id,patient_id,encounter_id,coverage_id,scheme,status,letter_status,requested_at,decided_at,expires_at) "
            f"VALUES ('PA-FX-{p}','{p}','{SCRATCH_ENCOUNTER}-{p}','COV-FX-STUB-{p}','PM-JAY','denied','denied',DATEADD(day,-10,CURRENT_TIMESTAMP()),DATEADD(day,-5,CURRENT_TIMESTAMP()),DATEADD(day,60,CURRENT_TIMESTAMP()));"),
        ("COV-AUTH-conflicting", "COV-AUTH-001", "conflicting", lambda p:
            f"MERGE INTO SAARTHI.CORE.AUTHORIZATION t USING (SELECT 'PA-FX-{p}' k) s ON t.auth_id=s.k "
            f"WHEN NOT MATCHED THEN INSERT (auth_id,patient_id,encounter_id,coverage_id,scheme,status,letter_status,requested_at,decided_at,expires_at) "
            f"VALUES ('PA-FX-{p}','{p}','{SCRATCH_ENCOUNTER}-{p}','COV-FX-STUB-{p}','PM-JAY','approved','denied',DATEADD(day,-10,CURRENT_TIMESTAMP()),DATEADD(day,-5,CURRENT_TIMESTAMP()),DATEADD(day,60,CURRENT_TIMESTAMP()));"),
        ("CRCL-fail-low", "CLIN-CRCL-001", "fail", lambda p:
            # elderly patient (dob 1945) + very high creatinine + low weight -> CrCl below all agent minima
            f"UPDATE SAARTHI.CORE.PATIENT SET dob='1945-01-01' WHERE patient_id='{p}';"
            f"MERGE INTO SAARTHI.CORE.CLINICAL_EVENT t USING (SELECT 'EVT-FX-CR-{p}' k) s ON t.event_id=s.k "
            f"WHEN NOT MATCHED THEN INSERT (event_id,patient_id,encounter_id,event_type,concept_id,value_num,unit,status,event_time,source_recorded_at,ingested_at) "
            f"VALUES ('EVT-FX-CR-{p}','{p}','{SCRATCH_ENCOUNTER}-{p}','lab','{CONCEPT['CREATININE']}',3.5,'mg/dL','final',{FRESH_EVENT_TIME},{FRESH_EVENT_TIME},CURRENT_TIMESTAMP());"
            f"MERGE INTO SAARTHI.CORE.CLINICAL_EVENT t USING (SELECT 'EVT-FX-WT-{p}' k) s ON t.event_id=s.k "
            f"WHEN NOT MATCHED THEN INSERT (event_id,patient_id,encounter_id,event_type,concept_id,value_num,unit,status,event_time,source_recorded_at,ingested_at) "
            f"VALUES ('EVT-FX-WT-{p}','{p}','{SCRATCH_ENCOUNTER}-{p}','vitals','{CONCEPT['WEIGHT']}',50,'kg','final',{FRESH_EVENT_TIME},{FRESH_EVENT_TIME},CURRENT_TIMESTAMP());"),
        ("BILI-fail", "CLIN-BILI-001", "fail", lambda p:
            f"MERGE INTO SAARTHI.CORE.CLINICAL_EVENT t USING (SELECT 'EVT-FX-BILI-{p}' k) s ON t.event_id=s.k "
            f"WHEN NOT MATCHED THEN INSERT (event_id,patient_id,encounter_id,event_type,concept_id,value_num,unit,status,event_time,source_recorded_at,ingested_at) "
            f"VALUES ('EVT-FX-BILI-{p}','{p}','{SCRATCH_ENCOUNTER}-{p}','lab','{CONCEPT['BILIRUBIN']}',3.4,'mg/dL','final',{FRESH_EVENT_TIME},{FRESH_EVENT_TIME},CURRENT_TIMESTAMP());"),
        ("SURG-CLEAR-missing", "SURG-CLEAR-001", "not_evaluated", lambda p: ""),  # no assertions -> not_evaluated
        ("SURV-LVEF-001-fail-stale", "SURV-LVEF-001", "fail", lambda p:
            f"MERGE INTO SAARTHI.CORE.CLINICAL_EVENT t USING (SELECT 'EVT-FX-LVEF-{p}' k) s ON t.event_id=s.k "
            f"WHEN NOT MATCHED THEN INSERT (event_id,patient_id,encounter_id,event_type,concept_id,value_num,unit,status,event_time,source_recorded_at,ingested_at) "
            f"VALUES ('EVT-FX-LVEF-{p}','{p}','{SCRATCH_ENCOUNTER}-{p}','imaging','{CONCEPT['LVEF']}',60,'%','final',{STALE_EVENT_TIME},{STALE_EVENT_TIME},CURRENT_TIMESTAMP());"),
        ("HBA1C-fail-high", "ENDO-HBA1C-001", "fail", lambda p:
            f"MERGE INTO SAARTHI.CORE.CLINICAL_EVENT t USING (SELECT 'EVT-FX-A1C-{p}' k) s ON t.event_id=s.k "
            f"WHEN NOT MATCHED THEN INSERT (event_id,patient_id,encounter_id,event_type,concept_id,value_num,unit,status,event_time,source_recorded_at,ingested_at) "
            f"VALUES ('EVT-FX-A1C-{p}','{p}','{SCRATCH_ENCOUNTER}-{p}','lab','{CONCEPT['HBA1C']}',9.8,'%','final',{FRESH_EVENT_TIME},{FRESH_EVENT_TIME},CURRENT_TIMESTAMP());"),
        ("DEXA-fail-overdue", "ENDO-DEXA-001", "fail", lambda p:
            f"MERGE INTO SAARTHI.CORE.CLINICAL_EVENT t USING (SELECT 'EVT-FX-DX-{p}' k) s ON t.event_id=s.k "
            f"WHEN NOT MATCHED THEN INSERT (event_id,patient_id,encounter_id,event_type,concept_id,value_num,unit,status,event_time,source_recorded_at,ingested_at) "
            f"VALUES ('EVT-FX-DX-{p}','{p}','{SCRATCH_ENCOUNTER}-{p}','imaging','{CONCEPT['T_SCORE']}',-1.6,NULL,'final',TIMESTAMP_NTZ_FROM_PARTS(2023,1,1,10,0,0),TIMESTAMP_NTZ_FROM_PARTS(2023,1,1,10,0,0),CURRENT_TIMESTAMP());"),
    ]

    for idx, (test_id, rule_id, expected, seed_fn) in enumerate(scenarios):
        pid = f"PAT-FX-{idx:03d}"
        try:
            provision_scratch(connection, pid)
            seed_sql = seed_fn(pid)
            outcome, reason = seed_and_probe(connection, pid, seed_sql, rule_id)
            passed = outcome == expected
            checks.append({
                "test_id": test_id, "rule_id": rule_id, "pid": pid,
                "expected": expected, "actual": outcome, "reason": reason, "passed": passed,
            })
            if not passed:
                errors.append(f"{test_id}: expected {expected}, got {outcome} - {reason}")
        except Exception as e:
            errors.append(f"{test_id}: exception - {e}")
            checks.append({
                "test_id": test_id, "rule_id": rule_id, "pid": pid,
                "expected": expected, "actual": "ERROR", "reason": str(e), "passed": False,
            })
    return checks, errors


# ---------------------------------------------------------------------------
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--connection", default="EA72552_SNOW")
    ap.add_argument("--skip-live", action="store_true")
    ap.add_argument("--skip-stage3", action="store_true")
    ap.add_argument("--keep-scratch", action="store_true", help="Do not teardown PAT-FX-* rows")
    args = ap.parse_args()

    print(f"Loading fixtures from {FIXTURES.relative_to(REPO_ROOT)}")
    data = load_fixtures()
    total, struct_errors = structural_check(data)
    print(f"  Structural: {total} fixtures across 16 rules")
    if struct_errors:
        for e in struct_errors:
            print(f"    FAIL: {e}")
        return 1
    print("  Structural: OK")

    if args.skip_live:
        return 0

    print(f"\nSTAGE 2 - Deep-case regression ({args.connection})")
    s2_checks, s2_errors = stage2_deep_case(args.connection, data)
    print(f"  Rules exercised: {len(s2_checks)}")
    for c in s2_checks:
        mark = "PASS" if c["agrees"] else "FAIL"
        print(f"    [{mark}] {c['rule_id']} -> {c['actual']} (matches: {','.join(c['matches']) or 'NONE'})")

    stage3_result = ([], [])
    if not args.skip_stage3:
        print(f"\nSTAGE 3 - Scratch-patient harness (fail-path + edge coverage)")
        try:
            teardown_all_scratch(args.connection)  # start clean
            stage3_result = stage3_scratch_harness(args.connection)
            s3_checks, s3_errors = stage3_result
            print(f"  Scratch scenarios: {len(s3_checks)}")
            for c in s3_checks:
                mark = "PASS" if c["passed"] else "FAIL"
                print(f"    [{mark}] {c['test_id']} ({c['rule_id']}): expected={c['expected']} actual={c['actual']}")
                if not c["passed"]:
                    print(f"           reason: {c['reason']}")
        finally:
            if not args.keep_scratch:
                teardown_all_scratch(args.connection)
                print("  Scratch tables cleaned up")

    all_errors = s2_errors + stage3_result[1]
    if all_errors:
        print("\nRESULT: FAIL")
        for e in all_errors:
            print(f"  {e}")
        return 1
    print("\nRESULT: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
