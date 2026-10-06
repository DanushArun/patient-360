"""READINESS_STATE is a snapshot: after a recompute it holds exactly the rules the evaluator
returned, never a row from a rule that no longer applies.

Found live on 6 Oct 2026: ENDO-DEXA-001 v2 was rescoped to breast cancer, and the v1 rows of 10
day-care patients outside that scope survived every recompute (both MERGEs only touch rules the
evaluator returns). The census then showed a 4 Oct DEXA reason for Mohan Lal and an "as of 4 Oct"
header after a full recompute. Both recompute paths must drop rows the evaluator did not return,
and must never do so when the evaluation failed (an empty or errored response would otherwise
erase the patient's readiness instead of failing closed).
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def body(path, name):
    text = (ROOT / "backend/sql" / path).read_text()
    start = text.upper().index(f"PROCEDURE SAARTHI.OPERATIONAL.{name.upper()}")
    return text[start:text.index("$$;", start)]


PATHS = [("tasks/refresh_readiness.sql", "refresh_readiness_proc"),
         ("procedures/web_workflows.sql", "REFRESH_BOUND_READINESS")]


def test_each_recompute_deletes_rules_the_evaluator_did_not_return():
    for path, name in PATHS:
        proc = body(path, name)
        delete = re.search(r"DELETE FROM SAARTHI\.OPERATIONAL\.READINESS_STATE(.*?);", proc, re.S)
        assert delete, f"{name}: no stale-rule DELETE"
        clause = delete.group(1)
        assert "encounter_id = :v_encounter_id" in clause, name
        assert "patient_id = :v_patient_id" in clause, name
        assert "NOT IN" in clause and "FLATTEN(input => :v_gates_response:gates)" in clause, name
        assert "rule_id" in clause and "rule_version" in clause, name
        # Replace, then prune: the MERGE runs first so a crash between them leaves extra rows,
        # never missing ones.
        assert proc.index("MERGE INTO SAARTHI.OPERATIONAL.READINESS_STATE") < delete.start(), name


def test_a_failed_evaluation_never_erases_readiness():
    for path, name in PATHS:
        proc = body(path, name)
        delete_at = proc.index("DELETE FROM SAARTHI.OPERATIONAL.READINESS_STATE")
        guard = proc[:delete_at][-400:]
        assert "ARRAY_SIZE(v_gates_response:gates) > 0" in guard, name
        assert "v_gates_response:error IS NULL" in guard, name
