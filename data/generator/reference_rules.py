"""Pure-Python ground-truth oracle for the readiness gates.

SPEC.md 9's eval_questions.py needs "ground-truth answers" that are known
independently of the deployed SQL — an eval harness that checks
evaluate_gates.sql against an oracle computed BY evaluate_gates.sql cannot
catch a bug both share. This module is that independent oracle. It is
deliberately not SQL, and it must stay logically equivalent to
evaluate_gates.sql by hand, without ever importing or calling it.

CLIN-ANC-001 (WORK-PLAN.md's cut-list-protected flagship, "never cut: R7
two-pass..."): ANC >=1500 is `pass` (SPEC.md 511, 652). Follows
evaluate_gates.sql's own algorithm (WORK-PLAN.md Day 5) exactly:
  1. keep evidence with ingested_at <= known_as_of AND valid_until >=
     encounter.scheduled_time (R2 time-travel cutoff + validity window)
  2. drop any assertion whose R7 verification_status is 'conflicting' or
     'unverified' - never asserted, per R7's one-way state machine
  3. if nothing survives step 2 -> not_evaluated
  4. if what survives disagrees on value -> gate-level 'conflicting'
     (cross-source discordance - distinct from R7's per-assertion
     'conflicting' status handled in step 2)
  5. otherwise -> pass/fail by threshold

DOC-HER2-001 (WORK-PLAN.md 470/511, ASCO-CAP 2018's reflex-testing rule,
closed via the ontology's `reflexes_to`, SPEC.md 334): IHC 2+ requires a
FISH follow-up; any other IHC score does not. A documentation-completeness
gate, not a clinical threshold — it reports whether the required follow-up
exists, never whether the disease is HER2-positive. Only three outcomes are
implemented (pass/fail/not_evaluated); see test_reference_rules_her2.py for
why `conflicting` is deliberately left unimplemented for this rule rather
than guessed.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

ANC_THRESHOLD = 1500

_ANC_RULE_ID = "CLIN-ANC-001"
_ANC_RULE_VERSION = 1

# R7 verification_status values that make an assertion unusable as evidence.
# 'verified' (two-pass agreement) and 'single_pass' (non-safety-critical,
# one pass required) are the only usable statuses.
_UNUSABLE_STATUSES = frozenset({"conflicting", "unverified"})


@dataclass(frozen=True)
class AncEvidence:
    evidence_id: str
    value: int
    verification_status: str
    ingested_at: datetime
    valid_until: datetime


@dataclass(frozen=True)
class Her2Result:
    evidence_id: str
    ihc_score: str
    fish_result: str | None
    verification_status: str
    ingested_at: datetime
    valid_until: datetime


@dataclass(frozen=True)
class GateResult:
    gate: str
    rule_id: str
    rule_version: int
    outcome: str
    reason: str
    evidence_ids: tuple[str, ...]


def _visible(evidence: AncEvidence | Her2Result, known_as_of: datetime, scheduled_time: datetime) -> bool:
    return evidence.ingested_at <= known_as_of and evidence.valid_until >= scheduled_time


def evaluate_clin_anc_001(
    evidence: list[AncEvidence], known_as_of: datetime, encounter_scheduled_time: datetime,
) -> GateResult:
    """Four-valued outcome for CLIN-ANC-001, computed independently of any
    SQL implementation. `evidence` is every ANC-relevant assertion the
    caller has, regardless of visibility or verification — this function
    applies the R2 cutoff and the R7 usability filter itself, exactly as
    evaluate_gates.sql is specified to."""
    visible = [e for e in evidence if _visible(e, known_as_of, encounter_scheduled_time)]

    if not visible:
        return GateResult(
            gate="clinical", rule_id=_ANC_RULE_ID, rule_version=_ANC_RULE_VERSION,
            outcome="not_evaluated", reason="no ANC evidence known as of this timestamp",
            evidence_ids=(),
        )

    usable = [e for e in visible if e.verification_status not in _UNUSABLE_STATUSES]

    if not usable:
        statuses = sorted({e.verification_status for e in visible})
        return GateResult(
            gate="clinical", rule_id=_ANC_RULE_ID, rule_version=_ANC_RULE_VERSION,
            outcome="not_evaluated",
            reason=f"the only ANC evidence available has R7 status {statuses} — never asserted",
            evidence_ids=tuple(e.evidence_id for e in visible),
        )

    distinct_values = {e.value for e in usable}
    if len(distinct_values) > 1:
        return GateResult(
            gate="clinical", rule_id=_ANC_RULE_ID, rule_version=_ANC_RULE_VERSION,
            outcome="conflicting",
            reason=f"independently verified sources disagree: {sorted(distinct_values)}",
            evidence_ids=tuple(e.evidence_id for e in usable),
        )

    value = usable[0].value
    outcome = "pass" if value >= ANC_THRESHOLD else "fail"
    return GateResult(
        gate="clinical", rule_id=_ANC_RULE_ID, rule_version=_ANC_RULE_VERSION,
        outcome=outcome, reason=f"ANC {value} {'>=' if outcome == 'pass' else '<'} {ANC_THRESHOLD}",
        evidence_ids=tuple(e.evidence_id for e in usable),
    )


_HER2_RULE_ID = "DOC-HER2-001"
_HER2_RULE_VERSION = 1
_EQUIVOCAL_IHC = "2+"


def evaluate_doc_her2_001(
    results: list[Her2Result], known_as_of: datetime, encounter_scheduled_time: datetime,
) -> GateResult:
    """Documentation-completeness outcome for DOC-HER2-001: every usable
    IHC 2+ result must have a FISH follow-up. Reports on record
    completeness, not on HER2 status itself — R1, gates never phrase a
    clinical judgment."""
    visible = [r for r in results if _visible(r, known_as_of, encounter_scheduled_time)]

    if not visible:
        return GateResult(
            gate="documentation", rule_id=_HER2_RULE_ID, rule_version=_HER2_RULE_VERSION,
            outcome="not_evaluated", reason="no HER2 result known as of this timestamp",
            evidence_ids=(),
        )

    usable = [r for r in visible if r.verification_status not in _UNUSABLE_STATUSES]

    if not usable:
        statuses = sorted({r.verification_status for r in visible})
        return GateResult(
            gate="documentation", rule_id=_HER2_RULE_ID, rule_version=_HER2_RULE_VERSION,
            outcome="not_evaluated",
            reason=f"the only HER2 result available has R7 status {statuses} — never asserted",
            evidence_ids=tuple(r.evidence_id for r in visible),
        )

    missing_fish = [
        r for r in usable if r.ihc_score == _EQUIVOCAL_IHC and r.fish_result is None
    ]
    if missing_fish:
        return GateResult(
            gate="documentation", rule_id=_HER2_RULE_ID, rule_version=_HER2_RULE_VERSION,
            outcome="fail",
            reason=(
                f"IHC {_EQUIVOCAL_IHC} on {tuple(r.evidence_id for r in missing_fish)} "
                "has no FISH follow-up on record"
            ),
            evidence_ids=tuple(r.evidence_id for r in usable),
        )

    return GateResult(
        gate="documentation", rule_id=_HER2_RULE_ID, rule_version=_HER2_RULE_VERSION,
        outcome="pass", reason="every equivocal (IHC 2+) result has a FISH follow-up on record",
        evidence_ids=tuple(r.evidence_id for r in usable),
    )
