"""Tests for data/generator/reference_rules.py — the pure-Python ground-truth
oracle for CLIN-ANC-001.

WORK-PLAN.md Day 5: "CLIN-ANC-001 must produce all four outcomes on test
data" with the threshold from SPEC.md 511 ("ANC >=1500") and the worked
example at SPEC.md 652 ("ANC is 2100/uL, above the 1500 threshold").

This module exists because an eval harness that checks the deployed
evaluate_gates.sql against ground truth computed BY evaluate_gates.sql
proves nothing — SPEC.md 9's eval_questions.py needs an independent oracle,
and this is it. It is deliberately not SQL and never will be: the whole
point is that it must not share a bug with the thing it is meant to catch.

Two distinct meanings of "conflicting" that this test suite is careful to
keep apart, both real per WORK-PLAN.md's own evaluate_gates description:
  - R7 VERIFICATION status "conflicting" on a single assertion (pass A and
    pass B disagreed reading the same source) -> that assertion is unusable,
    never contributes evidence, per R7's one-way state machine.
  - Gate-level "conflicting" OUTCOME: two or more independently VERIFIED
    assertions (each internally consistent) report different ANC values -
    a cross-source discordance a human must reconcile (R3/D3).
A single mislabelled test here would be worse than not testing at all.
"""

from __future__ import annotations

from datetime import datetime

from data.generator.reference_rules import (
    ANC_THRESHOLD,
    AncEvidence,
    evaluate_clin_anc_001,
)

_KNOWN_AS_OF = datetime(2026, 9, 18, 9, 0, 0)
_SCHEDULED_TIME = datetime(2026, 9, 20, 9, 0, 0)


def _evidence(
    value: int,
    *,
    verification_status: str = "verified",
    ingested_at: datetime = datetime(2026, 9, 17, 9, 0, 0),
    valid_until: datetime = datetime(2026, 9, 25, 9, 0, 0),
    evidence_id: str = "EVT-CBC-01",
) -> AncEvidence:
    return AncEvidence(
        evidence_id=evidence_id, value=value, verification_status=verification_status,
        ingested_at=ingested_at, valid_until=valid_until,
    )


def test_pass_when_a_single_verified_value_meets_the_threshold():
    result = evaluate_clin_anc_001([_evidence(2100)], _KNOWN_AS_OF, _SCHEDULED_TIME)
    assert result.outcome == "pass"
    assert result.rule_id == "CLIN-ANC-001"
    assert result.rule_version == 1
    assert result.evidence_ids == ("EVT-CBC-01",)


def test_exactly_at_threshold_is_a_pass_not_a_fail():
    result = evaluate_clin_anc_001([_evidence(ANC_THRESHOLD)], _KNOWN_AS_OF, _SCHEDULED_TIME)
    assert result.outcome == "pass"


def test_fail_when_a_single_verified_value_is_below_threshold():
    result = evaluate_clin_anc_001([_evidence(900)], _KNOWN_AS_OF, _SCHEDULED_TIME)
    assert result.outcome == "fail"
    assert result.evidence_ids == ("EVT-CBC-01",)


def test_not_evaluated_when_there_is_no_anc_evidence_at_all():
    result = evaluate_clin_anc_001([], _KNOWN_AS_OF, _SCHEDULED_TIME)
    assert result.outcome == "not_evaluated"
    assert result.evidence_ids == ()


def test_not_evaluated_when_the_only_assertion_has_r7_conflicting_status():
    # R7 verification_status "conflicting" on the one available assertion -
    # never asserted, never usable as evidence for a threshold comparison.
    result = evaluate_clin_anc_001(
        [_evidence(1900, verification_status="conflicting")], _KNOWN_AS_OF, _SCHEDULED_TIME,
    )
    assert result.outcome == "not_evaluated"
    # Still names what was rejected and why, even though it contributes no
    # evidence toward the threshold comparison itself.
    assert result.evidence_ids == ("EVT-CBC-01",)
    assert "conflicting" in result.reason.lower()


def test_not_evaluated_when_the_only_assertion_is_unverified():
    result = evaluate_clin_anc_001(
        [_evidence(1900, verification_status="unverified")], _KNOWN_AS_OF, _SCHEDULED_TIME,
    )
    assert result.outcome == "not_evaluated"


def test_gate_conflicting_when_two_independently_verified_sources_disagree():
    # Both individually verified (R7 passed on each) but they disagree with
    # each other - cross-source discordance, not an R7 failure.
    evidence = [
        _evidence(1200, evidence_id="EVT-CBC-01"),
        _evidence(1800, evidence_id="EVT-CBC-02"),
    ]
    result = evaluate_clin_anc_001(evidence, _KNOWN_AS_OF, _SCHEDULED_TIME)
    assert result.outcome == "conflicting"
    assert set(result.evidence_ids) == {"EVT-CBC-01", "EVT-CBC-02"}


def test_agreeing_verified_sources_are_not_conflicting():
    evidence = [
        _evidence(2100, evidence_id="EVT-CBC-01"),
        _evidence(2100, evidence_id="EVT-CBC-02"),
    ]
    result = evaluate_clin_anc_001(evidence, _KNOWN_AS_OF, _SCHEDULED_TIME)
    assert result.outcome == "pass"


def test_evidence_ingested_after_known_as_of_is_excluded():
    # R2: known_as_of is a time-travel cutoff. Evidence ingested after it
    # must not be visible, exactly as if it did not exist yet.
    future_evidence = _evidence(2100, ingested_at=datetime(2026, 9, 19, 0, 0, 0))
    result = evaluate_clin_anc_001([future_evidence], _KNOWN_AS_OF, _SCHEDULED_TIME)
    assert result.outcome == "not_evaluated"
    assert result.evidence_ids == ()


def test_evidence_expired_before_the_encounter_is_excluded():
    stale_evidence = _evidence(2100, valid_until=datetime(2026, 9, 19, 0, 0, 0))
    result = evaluate_clin_anc_001([stale_evidence], _KNOWN_AS_OF, _SCHEDULED_TIME)
    assert result.outcome == "not_evaluated"


def test_single_pass_verification_status_is_usable_evidence():
    # single_pass (non-safety-critical concept, only one R7 pass required)
    # is a valid, asserted status - distinct from conflicting/unverified.
    result = evaluate_clin_anc_001(
        [_evidence(2100, verification_status="single_pass")], _KNOWN_AS_OF, _SCHEDULED_TIME,
    )
    assert result.outcome == "pass"
