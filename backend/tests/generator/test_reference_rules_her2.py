"""Tests for evaluate_doc_her2_001 in data/generator/reference_rules.py.

WORK-PLAN.md 470/511: "HER2 FISH if IHC 2+" — ASCO-CAP 2018's reflex-testing
rule, closed via the ontology's `reflexes_to` (IHC 2+ -> FISH, SPEC.md 334).
This is a documentation-completeness gate (DOC- prefix), not a clinical
threshold: it reports whether the required follow-up test exists, never
whether the disease is HER2-positive.

Deliberately does NOT test a `conflicting` outcome for this rule.
CLIN-ANC-001's `conflicting` semantics are explicit in WORK-PLAN.md
("Two sources report different ANC values"); no equivalent statement exists
for DOC-HER2-001, and SPEC.md 301's `discordant_across_specimens` is
described as a presentation concern ("both shown ... not auto-resolved"),
not stated as this gate's `conflicting` outcome. Inventing that mapping
without a source would be a guess dressed up as a rule, so this test suite
covers the three outcomes WORK-PLAN.md actually specifies (pass/fail/
not_evaluated) and leaves `conflicting` unimplemented rather than wrong.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from data.generator.reference_rules import Her2Result, evaluate_doc_her2_001

_KNOWN_AS_OF = datetime(2026, 9, 18, 9, 0, 0)
_SCHEDULED_TIME = datetime(2026, 9, 20, 9, 0, 0)


def _result(
    ihc_score: str,
    *,
    fish_result: str | None = None,
    verification_status: str = "verified",
    ingested_at: datetime = datetime(2026, 9, 17, 9, 0, 0),
    valid_until: datetime = datetime(2026, 9, 25, 9, 0, 0),
    evidence_id: str = "EVT-HER2-01",
) -> Her2Result:
    return Her2Result(
        evidence_id=evidence_id, ihc_score=ihc_score, fish_result=fish_result,
        verification_status=verification_status, ingested_at=ingested_at, valid_until=valid_until,
    )


def test_pass_when_ihc_2plus_has_a_fish_follow_up():
    result = evaluate_doc_her2_001(
        [_result("2+", fish_result="positive")], _KNOWN_AS_OF, _SCHEDULED_TIME,
    )
    assert result.outcome == "pass"
    assert result.rule_id == "DOC-HER2-001"


def test_pass_when_ihc_is_not_equivocal_and_no_fish_exists():
    # IHC 1+ (or 0, or 3+) does not reflex to FISH under ASCO-CAP - no
    # follow-up required, so documentation is complete without one.
    result = evaluate_doc_her2_001([_result("1+")], _KNOWN_AS_OF, _SCHEDULED_TIME)
    assert result.outcome == "pass"


def test_fail_when_ihc_2plus_has_no_fish_follow_up():
    # WORK-PLAN.md's own corruption scenario 5: "Missing FISH after IHC 2+
    # | documentation gate | fails; bring-list says 'bring FISH report'."
    result = evaluate_doc_her2_001([_result("2+")], _KNOWN_AS_OF, _SCHEDULED_TIME)
    assert result.outcome == "fail"
    assert "FISH" in result.reason


def test_not_evaluated_when_there_is_no_her2_result_at_all():
    result = evaluate_doc_her2_001([], _KNOWN_AS_OF, _SCHEDULED_TIME)
    assert result.outcome == "not_evaluated"
    assert result.evidence_ids == ()


def test_not_evaluated_when_the_only_result_is_r7_conflicting():
    result = evaluate_doc_her2_001(
        [_result("2+", verification_status="conflicting")], _KNOWN_AS_OF, _SCHEDULED_TIME,
    )
    assert result.outcome == "not_evaluated"


def test_the_deep_case_surgical_specimen_actually_fails_this_gate():
    # The deep case (ledger.py) has outside-biopsy IHC 1+ and a surgical
    # specimen IHC 2+ with no FISH event anywhere in the ledger - this rule,
    # run against that specimen alone, must fail. Not a synthetic fixture:
    # the actual generated deep case.
    from data.generator.ledger import generate_deep_case

    ledger = generate_deep_case(seed=20260918)
    surgical = next(
        e for e in ledger.events if e.kind == "her2_result" and e.specimen_source == "surgical_specimen"
    )
    assert surgical.ihc_score == "2+"

    evidence = Her2Result(
        evidence_id=surgical.event_id, ihc_score=surgical.ihc_score, fish_result=None,
        verification_status="verified", ingested_at=surgical.source_recorded_at,
        valid_until=surgical.event_time + timedelta(days=365),
    )
    result = evaluate_doc_her2_001(
        [evidence], known_as_of=surgical.source_recorded_at, encounter_scheduled_time=surgical.event_time,
    )
    assert result.outcome == "fail"
