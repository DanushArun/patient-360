"""Pure-Python ground-truth oracle for the flagship gate, CLIN-ANC-001.

SPEC.md 9's eval_questions.py needs "ground-truth answers" that are known
independently of the deployed SQL — an eval harness that checks
evaluate_gates.sql against an oracle computed BY evaluate_gates.sql cannot
catch a bug both share. This module is that independent oracle for the one
rule WORK-PLAN.md protects on the cut list ("never cut: R7 two-pass ...").
It is deliberately not SQL, and it must stay logically equivalent to
evaluate_gates.sql without ever importing or calling it.

Threshold: ANC >=1500 is `pass` (SPEC.md 511, 652).

evaluate_gates.sql's own algorithm (WORK-PLAN.md, Day 5) is followed exactly:
  1. keep evidence with ingested_at <= known_as_of AND valid_until >=
     encounter.scheduled_time (R2 time-travel cutoff + validity window)
  2. drop any assertion whose R7 verification_status is 'conflicting' or
     'unverified' - never asserted, per R7's one-way state machine
  3. if nothing survives step 2 -> not_evaluated
  4. if what survives disagrees on value -> gate-level 'conflicting'
     (cross-source discordance - distinct from R7's per-assertion
     'conflicting' status handled in step 2)
  5. otherwise -> pass/fail by threshold
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

ANC_THRESHOLD = 1500

_RULE_ID = "CLIN-ANC-001"
_RULE_VERSION = 1

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
class GateResult:
    gate: str
    rule_id: str
    rule_version: int
    outcome: str
    reason: str
    evidence_ids: tuple[str, ...]


def _visible(evidence: AncEvidence, known_as_of: datetime, scheduled_time: datetime) -> bool:
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
            gate="clinical", rule_id=_RULE_ID, rule_version=_RULE_VERSION,
            outcome="not_evaluated", reason="no ANC evidence known as of this timestamp",
            evidence_ids=(),
        )

    usable = [e for e in visible if e.verification_status not in _UNUSABLE_STATUSES]

    if not usable:
        statuses = sorted({e.verification_status for e in visible})
        return GateResult(
            gate="clinical", rule_id=_RULE_ID, rule_version=_RULE_VERSION,
            outcome="not_evaluated",
            reason=f"the only ANC evidence available has R7 status {statuses} — never asserted",
            evidence_ids=tuple(e.evidence_id for e in visible),
        )

    distinct_values = {e.value for e in usable}
    if len(distinct_values) > 1:
        return GateResult(
            gate="clinical", rule_id=_RULE_ID, rule_version=_RULE_VERSION,
            outcome="conflicting",
            reason=f"independently verified sources disagree: {sorted(distinct_values)}",
            evidence_ids=tuple(e.evidence_id for e in usable),
        )

    value = usable[0].value
    outcome = "pass" if value >= ANC_THRESHOLD else "fail"
    return GateResult(
        gate="clinical", rule_id=_RULE_ID, rule_version=_RULE_VERSION,
        outcome=outcome, reason=f"ANC {value} {'>=' if outcome == 'pass' else '<'} {ANC_THRESHOLD}",
        evidence_ids=tuple(e.evidence_id for e in usable),
    )
