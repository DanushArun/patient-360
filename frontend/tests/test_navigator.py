"""Tests for frontend/core/navigator.py - the family's pre-visit checklist.

Every item must trace to a gate outcome (R1), a stale test and a low value must
read differently to the family, and nothing may tell a family what treatment
to have (Class A).
"""

from __future__ import annotations

from datetime import date

import pytest

from frontend.core.navigator import LANGUAGES, TEXT, checklist, language_code, message

VISIT = date(2026, 9, 24)


def _g(rule, outcome, reason="", severity="blocker"):
    return {"rule_id": rule, "outcome": outcome, "reason": reason, "severity": severity}


def test_stale_cbc_asks_for_a_fresh_test():
    items = dict(checklist([_g("CLIN-ANC-001", "fail", "ANC assessment is 11 days old, exceeds 7-day limit")]))
    assert "cbc_fresh" in items


def test_missing_cbc_asks_for_a_test_too():
    assert "cbc_fresh" in dict(checklist([_g("CLIN-PLT-001", "not_evaluated", "no PLT evidence found")]))


def test_low_count_tells_family_to_wait_for_a_call_not_to_retest():
    # A fresh but low platelet count is a clinical review, not an errand -
    # and the family should not travel until the coordinator calls.
    items = dict(checklist([_g("CLIN-PLT-001", "fail", "PLT is 82000, below threshold 100000")]))
    assert "wait_for_call" in items and "cbc_fresh" not in items


def test_anc_and_plt_on_the_same_stale_cbc_collapse_to_one_item():
    items = checklist([
        _g("CLIN-ANC-001", "fail", "ANC assessment is 11 days old"),
        _g("CLIN-PLT-001", "fail", "PLT assessment is 11 days old"),
    ])
    assert [k for k, _ in items] == ["cbc_fresh"]
    assert items[0][1] == ["CLIN-ANC-001", "CLIN-PLT-001"]


def test_hospital_side_items_reassure_rather_than_assign_work():
    items = dict(checklist([_g("COV-AUTH-001", "not_evaluated"), _g("DOC-HER2-001", "not_evaluated")]))
    assert "preauth_pending" in items and "hospital_result_pending" in items
    assert "do not need to do anything" in TEXT["preauth_pending"]["en"]


def test_conflicting_preauth_asks_for_the_original_letter():
    assert "preauth_letter" in dict(checklist([_g("COV-AUTH-001", "conflicting")]))


def test_passing_and_unactionable_gates_produce_nothing():
    assert checklist([_g("CLIN-ANC-001", "pass"), _g("ENDO-DEXA-001", "not_evaluated", severity="advisory")]) == []


def test_things_to_do_come_before_things_the_hospital_is_handling():
    keys = [k for k, _ in checklist([_g("COV-AUTH-001", "not_evaluated"),
                                     _g("SURV-LVEF-001", "fail")])]
    assert keys.index("echo") < keys.index("preauth_pending")


def test_all_clear_message_when_nothing_is_needed():
    text = message(name="Sunita Devi", visit=VISIT, gates=[_g("CLIN-ANC-001", "pass")], lang="en")
    assert TEXT["all_clear"]["en"] in text and "Sunita Devi" in text


def test_cbc_window_is_seven_days_before_the_visit():
    text = message(name="X", visit=VISIT, gates=[_g("CLIN-ANC-001", "not_evaluated")], lang="en")
    assert "17 Sep" in text


@pytest.mark.parametrize("lang", list(LANGUAGES))
def test_every_item_exists_in_every_language(lang):
    for key, by_lang in TEXT.items():
        assert by_lang.get(lang), f"{key} missing {lang}"


def test_unknown_language_falls_back_to_english():
    assert message(name="X", visit=VISIT, gates=[], lang="xx").startswith("Before your visit")


def test_language_code_maps_patient_record_values():
    assert language_code("Marathi") == "mr" and language_code("Tamil") == "ta"
    assert language_code(None) == "en" and language_code("Kannada") == "en"


def test_no_item_ever_prescribes_or_withholds_treatment():
    # Class A: the checklist tells a family what to bring or wait for, never
    # whether to have chemotherapy.
    forbidden = ("stop treatment", "skip", "cancel your", "do not take", "start treatment")
    for by_lang in TEXT.values():
        assert not any(f in by_lang["en"].lower() for f in forbidden)
