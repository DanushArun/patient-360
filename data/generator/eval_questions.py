"""Ground-truth Q&A pairs — WORK-PLAN.md Day 9-10 eval harness, Contract 5
(SPEC.md 9): "eval_questions.py -> 80 questions + ground-truth answers,"
"Per question: expected tool invocations + expected answer shape."

Scope here is the first question against the deep case, not the full
80-question dev/held-out sets (that is explicitly Day 9-10, later). What
this builds is the pattern the full set reuses: a question's expected
answer is assembled from the ledger (the only source of truth) and
reference_rules.py (the independent oracle that must never share code with
the SQL it will eventually check), then validated against the real frozen
Contract 3 schema (frontend/core/contracts.py) — not hand-typed and hoped
correct.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from data.generator.ledger import ClinicalEvent, Ledger
from data.generator.reference_rules import AncEvidence, evaluate_clin_anc_001

_ANC_VALIDITY_WINDOW = timedelta(days=90)


@dataclass(frozen=True)
class EvalQuestion:
    question_id: str
    patient_id: str
    question_text: str
    expected_tool_invocations: tuple[str, ...]
    expected_answer: dict


def _anc_evidence_from_ledger(cbc_event: ClinicalEvent) -> AncEvidence:
    """Ground truth assumes correct extraction — this question tests
    whether the deployed rule computes the right outcome from a known-good
    value, not whether R7 extracted it correctly. `verification_status`
    "verified" is the assumption that makes; a question meant to exercise
    extraction failure (e.g. against corruptions.py's ambiguous page) needs
    its own oracle call with a different status, not this one."""
    anc = round(cbc_event.wbc_per_uL * cbc_event.neutrophil_pct / 100)
    return AncEvidence(
        evidence_id=cbc_event.event_id,
        value=anc,
        verification_status="verified",
        ingested_at=cbc_event.source_recorded_at,
        valid_until=cbc_event.event_time + _ANC_VALIDITY_WINDOW,
    )


def build_anc_readiness_question(ledger: Ledger) -> EvalQuestion:
    """The flagship Class B gate-outcome question (ARCHITECTURE-DIAGRAMS.md
    1309's own category: "Gate outcomes ... SQL results from versioned
    rules, not judgments") against the deep case's CBC event."""
    cbc_event = next(e for e in ledger.events if e.kind == "cbc_lab")
    evidence = _anc_evidence_from_ledger(cbc_event)
    known_as_of = cbc_event.source_recorded_at

    result = evaluate_clin_anc_001(
        evidence=[evidence], known_as_of=known_as_of, encounter_scheduled_time=cbc_event.event_time,
    )

    expected_answer = {
        "classification": "CLASS_B",
        "claims": [{
            "text": f"ANC is {evidence.value} cells/uL, {result.reason}",
            "claim_type": "numeric",
            "asserted_value": evidence.value,
            "asserted_unit": "cells/uL",
            "gate": result.gate,
            "outcome": result.outcome,
            "rule_id": result.rule_id,
            "rule_version": result.rule_version,
            "evidence": [{
                "kind": "structured",
                "id": cbc_event.event_id,
                "table": "CLINICAL_EVENT",
                "event_time": cbc_event.event_time.isoformat(),
                "source_recorded_at": cbc_event.source_recorded_at.isoformat(),
                "derived": (
                    f"computed from WBC {cbc_event.wbc_per_uL} x "
                    f"{cbc_event.neutrophil_pct}% neutrophils"
                ),
            }],
        }],
        "limitations": [],
        "overall_status": "supported",
        "known_as_of": known_as_of.isoformat(),
        "binding_id": None,
        "consent_id": None,
        "rule_versions": {result.rule_id: result.rule_version},
    }

    return EvalQuestion(
        question_id="EVAL-DEEP-ANC-001",
        patient_id=ledger.patient_id,
        question_text="What does the ANC readiness gate show for the next cycle?",
        expected_tool_invocations=("get_readiness",),
        expected_answer=expected_answer,
    )
