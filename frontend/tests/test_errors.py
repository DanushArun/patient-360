"""Tests for frontend/core/errors.py — the uniform-error / fallback UI map.

Contract 2, error half (frontend/contracts/error_shape.json x-disclosure and
x-fallback-behaviours), COPILOT-SPEC.md 4. The contract's own comment says
"Listed here so app/core/errors.py covers all eleven" — but counting the
actual keys in error_shape.json gives 5 tool-error codes + 7 fallback
situations = 12, not 11. This module is built data-driven off the contract
file, not a hardcoded count, specifically so it stays correct regardless of
which number is right — and test_total_situation_count_matches_the_contract
below pins down what the contract actually contains today, so a future edit
to error_shape.json shows up as an intentional test change, not silent drift.
"""

from __future__ import annotations

import pytest

from frontend.core.errors import FailureBehaviour, describe, known_situations


def test_all_five_tool_error_codes_are_known():
    for code in (
        "no_patient_bound", "no_patient_access", "access_withdrawn",
        "binding_mismatch", "consent_not_valid",
    ):
        assert code in known_situations()


def test_all_seven_fallback_situations_are_known():
    for situation in (
        "cortex_search_down", "agent_unreachable", "malformed_agent_json",
        "extraction_conflict_r7", "claim_stripped_by_validator",
        "injected_instruction_in_document", "nothing_found",
    ):
        assert situation in known_situations()


def test_total_situation_count_matches_the_contract():
    # 5 + 7 = 12, not the "eleven" the contract's own comment claims.
    assert len(known_situations()) == 12


def test_the_json_metadata_key_is_never_mistaken_for_a_situation():
    assert "description" not in known_situations()


def test_no_patient_access_reveals_nothing():
    behaviour = describe("no_patient_access")
    assert isinstance(behaviour, FailureBehaviour)
    assert "NOTHING" in behaviour.reveals
    assert behaviour.never is not None


def test_no_patient_access_and_access_withdrawn_are_not_collapsed():
    # x-disclosure's own point: access_withdrawn reveals strictly more than
    # no_patient_access, on purpose. A UI that renders them the same string
    # defeats the asymmetry the contract exists to guarantee.
    no_access = describe("no_patient_access")
    withdrawn = describe("access_withdrawn")
    assert no_access.ui != withdrawn.ui
    assert no_access.reveals != withdrawn.reveals


def test_consent_not_valid_explicitly_matches_access_withdrawn_treatment():
    # The contract states this equivalence explicitly (not an omission) —
    # check it stays that way rather than silently drifting apart.
    assert describe("consent_not_valid").ui == "Same treatment as access_withdrawn."


def test_fallback_situations_have_ui_but_no_disclosure_fields():
    behaviour = describe("nothing_found")
    assert behaviour.ui
    assert behaviour.reveals is None
    assert behaviour.never is None


def test_unknown_situation_raises_rather_than_returning_a_default():
    # Fail closed: an un-mapped situation must be loud, never silently
    # rendered as some generic fallback message.
    with pytest.raises(KeyError):
        describe("not_a_real_situation")


def test_binding_mismatch_names_the_reason_it_exists():
    behaviour = describe("binding_mismatch")
    assert "encounter_ref" in behaviour.reveals
    assert behaviour.why is not None
