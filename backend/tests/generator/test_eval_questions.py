"""Tests for data/generator/eval_questions.py — ground-truth Q&A pairs.

SPEC.md 9 (Contract 5): "eval_questions.py -> 80 questions + ground-truth
answers." WORK-PLAN.md's eval harness section: "Per question: expected tool
invocations + expected answer shape."

Scope here is the first question against the deep case (the full 80-question
dev/held-out sets are Day 9-10, WORK-PLAN.md) — but it deliberately exercises
the full chain this session already built: the ledger is the only source of
truth, reference_rules.py is the independent oracle, and the expected answer
must validate against the real frozen Contract 3 schema, not a hand-typed
dict that merely looks right. If any of those three pieces drifts, this test
is the one that notices.
"""

from __future__ import annotations

from data.generator.eval_questions import _anc_evidence_from_ledger, build_anc_readiness_question
from data.generator.ledger import generate_deep_case
from data.generator.reference_rules import evaluate_clin_anc_001
from frontend.core.contracts import validate_answer

_LEDGER = generate_deep_case(seed=20260918)


def test_expected_answer_validates_against_the_real_contract():
    question = build_anc_readiness_question(_LEDGER)
    result = validate_answer(question.expected_answer)
    assert result.valid is True, result.errors


def test_question_is_class_b_not_class_a():
    # The boundary test (ARCHITECTURE-DIAGRAMS.md 1311): this asks what the
    # gate returns, never "should she proceed" - answerable as "the rule
    # returns", not requiring the word "should".
    question = build_anc_readiness_question(_LEDGER)
    assert question.expected_answer["classification"] == "CLASS_B"
    assert "should" not in question.question_text.lower()


def test_expected_outcome_matches_the_independent_oracle_exactly():
    cbc_event = next(e for e in _LEDGER.events if e.kind == "cbc_lab")
    oracle_result = evaluate_clin_anc_001(
        evidence=[_anc_evidence_from_ledger(cbc_event)],
        known_as_of=cbc_event.source_recorded_at,
        encounter_scheduled_time=cbc_event.event_time,
    )
    question = build_anc_readiness_question(_LEDGER)
    claim = question.expected_answer["claims"][0]
    assert claim["outcome"] == oracle_result.outcome
    assert claim["rule_id"] == oracle_result.rule_id
    assert claim["rule_version"] == oracle_result.rule_version


def test_evidence_traces_back_to_a_real_ledger_event():
    question = build_anc_readiness_question(_LEDGER)
    cbc_event = next(e for e in _LEDGER.events if e.kind == "cbc_lab")
    evidence = question.expected_answer["claims"][0]["evidence"]
    assert len(evidence) == 1
    assert evidence[0]["id"] == cbc_event.event_id
    assert evidence[0]["event_time"] == cbc_event.event_time.isoformat()
    assert evidence[0]["source_recorded_at"] == cbc_event.source_recorded_at.isoformat()


def test_expected_tool_invocation_is_get_readiness():
    # get_readiness (tool 2, WORK-PLAN.md Days 3-4) is the procedure that
    # returns "5 gates, outcome + rule id + version + evidence ids" - the
    # exact shape this question's expected answer carries.
    question = build_anc_readiness_question(_LEDGER)
    assert question.expected_tool_invocations == ("get_readiness",)


def test_known_as_of_is_stated_and_matches_the_evidence_it_saw():
    question = build_anc_readiness_question(_LEDGER)
    cbc_event = next(e for e in _LEDGER.events if e.kind == "cbc_lab")
    assert question.expected_answer["known_as_of"] == cbc_event.source_recorded_at.isoformat()


def test_deterministic_same_ledger_same_question():
    a = build_anc_readiness_question(_LEDGER)
    b = build_anc_readiness_question(_LEDGER)
    assert a == b
