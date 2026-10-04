"""Skill reuse proof (offline): evidence-reconciliation contract applied to a second synthetic schema.

Honest scope: tests a deterministic reference implementation of the SKILL.md contract plus drift checks that SKILL.md
still states the rules the reference implements. Does not execute the skill in the Cortex agent
(unverified-needs-deploy). Synthetic data; engineering gate, not clinical validation.
"""
import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
RT = ROOT / "backend/skills/reuse-tests/evidence_reconciliation"
spec = importlib.util.spec_from_file_location("reconcile_reference", RT / "reconcile_reference.py")
ref = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ref)
FIX = json.loads((RT / "fixture_second_schema.json").read_text())["cases"]


def test_second_schema_uses_column_names_saarthi_does_not():
    saarthi_cols = (ROOT / "backend/sql/tables/40_evidence.sql").read_text() + (ROOT / "backend/sql/tables/30_documents.sql").read_text()
    for col in FIX["clean_supersession_chain"]["columns"]:
        assert col not in saarthi_cols, col


def test_one_successful_mapping_and_supersession_chain():
    case = FIX["clean_supersession_chain"]
    out = ref.reconcile(case["columns"], case["rows"])
    assert out["mapping"]["version"] == "rev_no" and out["mapping"]["value"] == "reading"
    rel = {(r["from"], r["to"]): r["relation"] for r in out["relations"]}
    assert rel[("LD-1", "LD-2")] == "supersedes"
    assert rel[("LD-3", "LD-4")] == "complemented_by"          # append: original stays valid
    assert rel[("LD-5", "LD-6")] == "discordant_across_specimens"
    assert "LD-1" not in out["current_ids"] and "LD-2" in out["current_ids"]
    assert "LD-3" in out["current_ids"]                          # appended original is NOT superseded


def test_ambiguous_version_column_is_refused_not_guessed():
    case = FIX["ambiguous_two_version_columns"]
    with pytest.raises(ref.Refusal) as e:
        ref.reconcile(case["columns"], case["rows"])
    assert e.value.outcome == "not_evaluated"
    assert e.value.reason == "ambiguous_version_column"
    assert sorted(e.value.candidates) == ["rev_no", "version_seq"]


def test_ambiguous_value_column_is_refused_not_guessed():
    case = FIX["ambiguous_two_value_columns"]
    with pytest.raises(ref.Refusal) as e:
        ref.reconcile(case["columns"], case["rows"])
    assert e.value.reason == "ambiguous_value_column"


def test_same_specimen_disagreement_is_conflicting_never_resolved_and_unknown_specimen_refused():
    a = {"id": "1", "patient": "p", "concept": "c", "specimen": "S", "value": "1", "kind": "original", "supersedes": None}
    b = dict(a, id="2", value="2")
    assert ref.classify(a, b) == "conflicting"
    with pytest.raises(ref.Refusal):
        ref.classify(dict(a, specimen=None), b)
    with pytest.raises(ref.Refusal):
        ref._canon({"rpt_id": "x", "pt_ref": "p", "test_code": "c", "reading": "1", "rev_kind": "???"},
                   {"record_id": "rpt_id", "patient": "pt_ref", "concept": "test_code", "value": "reading", "revision_kind": "rev_kind"})


def test_skill_md_still_states_the_rules_the_reference_implements():
    text = (ROOT / "backend/skills/evidence-reconciliation/SKILL.md").read_text()
    for needle in ("supersedes", "complemented_by", "conflicts_with", "discordant_across_specimens",
                   "Never auto-resolve", "An append is not a supersession", "two candidate version"):
        assert needle in text, needle


def test_all_four_skills_have_frontmatter_name_and_no_instructions_key():
    for d in sorted((ROOT / "backend/skills").glob("*/SKILL.md")):
        head = d.read_text().split("---")[1]
        assert f"name: {d.parent.name}" in head
        assert "instructions:" not in head
