"""Tests for app/core/contracts.py — Contract 3 (app/contracts/answer_schema.json).

Schema semantics under test come from COPILOT-SPEC.md 2 / ARCHITECTURE-HANDOFF.md
Contract 3, as encoded in the frozen schema file itself:
  - classification CLASS_A -> claims must be empty, refusal required, overall_status "refused"
  - classification CLASS_B -> overall_status in {supported, partial}, never "refused"
  - every claim needs >=1 evidence entry (an uncited claim must not exist)
  - known_as_of is TIMESTAMP_NTZ shaped: no offset, no "Z"
"""

from __future__ import annotations

import copy

import pytest

from app.core.contracts import validate_answer, _compiled_validator


def _minimal_class_b_answer() -> dict:
    return {
        "classification": "CLASS_B",
        "claims": [
            {
                "text": "ANC is 2100/uL, above the 1500 threshold",
                "claim_type": "numeric",
                "asserted_value": 2100,
                "asserted_unit": "cells/uL",
                "evidence": [
                    {
                        "kind": "structured",
                        "id": "EVT-0001",
                        "table": "CLINICAL_EVENT",
                        "event_time": "2026-09-18T09:00:00",
                        "source_recorded_at": "2026-09-18T09:05:00",
                    }
                ],
            }
        ],
        "limitations": [],
        "overall_status": "supported",
        "known_as_of": "2026-09-18T09:00:00",
    }


def _minimal_class_a_refusal() -> dict:
    return {
        "classification": "CLASS_A",
        "claims": [],
        "limitations": [],
        "overall_status": "refused",
        "known_as_of": "2026-09-18T09:00:00",
        "refusal": {
            "reason_code": "class_a_clinical_judgment",
            "message": "This requires clinical judgment from the treating practitioner.",
            "practitioner": {
                "practitioner_id": "PRC-0001",
                "name": "Dr. Test Practitioner",
                "nmc_registration_no": "NMC-12345",
            },
        },
    }


def test_valid_class_b_answer_passes():
    result = validate_answer(_minimal_class_b_answer())
    assert result.valid is True
    assert result.errors == []


def test_valid_class_a_refusal_passes():
    result = validate_answer(_minimal_class_a_refusal())
    assert result.valid is True
    assert result.errors == []


def test_class_a_with_claims_is_rejected():
    answer = _minimal_class_a_refusal()
    answer["claims"] = [copy.deepcopy(_minimal_class_b_answer()["claims"][0])]
    result = validate_answer(answer)
    assert result.valid is False
    assert any("claims" in e for e in result.errors)


def test_class_a_without_refusal_is_rejected():
    answer = _minimal_class_a_refusal()
    del answer["refusal"]
    result = validate_answer(answer)
    assert result.valid is False


def test_class_b_cannot_be_refused():
    answer = _minimal_class_b_answer()
    answer["overall_status"] = "refused"
    result = validate_answer(answer)
    assert result.valid is False


def test_claim_with_no_evidence_is_rejected():
    answer = _minimal_class_b_answer()
    answer["claims"][0]["evidence"] = []
    result = validate_answer(answer)
    assert result.valid is False
    assert any("evidence" in e for e in result.errors)


def test_missing_required_top_level_field_is_rejected():
    answer = _minimal_class_b_answer()
    del answer["known_as_of"]
    result = validate_answer(answer)
    assert result.valid is False
    assert any("known_as_of" in e for e in result.errors)


def test_known_as_of_rejects_timezone_offset():
    answer = _minimal_class_b_answer()
    answer["known_as_of"] = "2026-09-18T09:00:00Z"
    result = validate_answer(answer)
    assert result.valid is False


def test_unknown_top_level_property_is_rejected():
    answer = _minimal_class_b_answer()
    answer["unexpected_field"] = "not part of the contract"
    result = validate_answer(answer)
    assert result.valid is False


def test_evidence_kind_must_be_a_recognised_variant():
    answer = _minimal_class_b_answer()
    answer["claims"][0]["evidence"] = [{"kind": "not_a_real_kind"}]
    result = validate_answer(answer)
    assert result.valid is False


def test_schema_validator_is_compiled_once_and_cached():
    # Compiling the schema (JSON parse + schema validation) is paid once;
    # every subsequent validate_answer call reuses the same validator object
    # instead of re-parsing app/contracts/answer_schema.json from disk.
    first = _compiled_validator()
    second = _compiled_validator()
    assert first is second
