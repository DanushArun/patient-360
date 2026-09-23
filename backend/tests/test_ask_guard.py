"""The answer guard inside backend/sql/agent/ask_saarthi.sql, run locally.

Fixture: a real SAARTHI_AGENT response for synthetic patient PAT-DC-04,
captured from the live account on 24 Sept (thinking blocks dropped). The
guard must leave that genuine answer intact, and remove any sentence whose
number, date or evidence id did not come from the record.
"""
from __future__ import annotations

import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GUARD: dict = {}
exec(compile((ROOT / "backend/sql/agent/ask_saarthi.sql").read_text().split("$$")[1], "ask_saarthi.py", "exec"), GUARD)
LIVE = json.loads((ROOT / "backend/tests/fixtures/ask_dc04_live.json").read_text())


def answer(resp):
    return next(b["text"] for b in resp["content"] if b["type"] == "text")


def guard(text, id_status=None, resp=LIVE):
    pool = GUARD["fact_pool"](GUARD["tool_texts"](resp))
    return GUARD["guard_text"](text, pool, id_status or {})


def test_the_genuine_answer_passes_intact():
    kept, removed, claims = guard(answer(LIVE))
    assert removed == [] and kept == answer(LIVE).strip() and len(claims) == 4


def test_a_number_the_tools_never_returned_is_removed():
    tampered = answer(LIVE).replace("PLT 82,000", "PLT 92,000")
    kept, removed, _ = guard(tampered)
    assert "92,000" not in kept and removed == ["stated a number that is not in any tool result"]


def test_other_sentences_survive_when_one_is_removed():
    tampered = answer(LIVE).replace("PLT 82,000", "PLT 92,000")
    kept, _, _ = guard(tampered)
    assert "ANC 2208" in kept and "DOC-DC-04-CONSENT" in kept


def test_an_uncited_number_is_removed():
    kept, removed, _ = guard("Her platelets are 82,000.")
    assert kept == "" and removed == ["stated a number or date without citing evidence"]


def test_a_made_up_evidence_id_is_removed():
    kept, removed, _ = guard("Platelets are 82,000 (EVT-DC-04-PLT-FAKE).", {"EVT-DC-04-PLT-FAKE": "missing"})
    assert kept == "" and removed == ["cited an evidence id that does not exist in the record"]


def test_another_patients_evidence_is_removed():
    kept, removed, _ = guard("Platelets are 82,000 (EVT-DC-05-PLT).", {"EVT-DC-05-PLT": "other_patient"})
    assert kept == "" and removed == ["cited evidence belonging to a different patient"]


def test_a_date_the_tools_never_returned_is_removed():
    kept, removed, _ = guard("Consent was signed on 2026-01-01 (DOC-DC-04-CONSENT).")
    assert removed == ["stated a date that is not in any tool result"]


def test_prose_without_numbers_or_ids_is_kept():
    kept, removed, _ = guard("The dose decision itself requires the treating practitioner's judgment.")
    assert removed == [] and kept.startswith("The dose decision")


def test_protocol_scale_numbers_match_either_unit():
    # Protocols write 1.5 x10^9/L; the record says 1500 /uL.
    resp = copy.deepcopy(LIVE)
    resp["content"].append({"type": "tool_result", "tool_result": {"content": [{"json": {"result": "ANC 1.5"}}]}})
    kept, removed, _ = guard("Full dose needs ANC 1500 (EVT-DC-04-PLT).", resp=resp)
    assert removed == []


def test_everything_removed_means_withheld():
    assert GUARD["answer_status"]([{"text": ""}], ["x"]) == "withheld"
    assert GUARD["answer_status"]([{"text": "kept"}], ["x"]) == "partial"
    assert GUARD["answer_status"]([{"text": "kept"}], []) == "supported"


def test_ids_inside_numbers_are_not_read_as_numbers():
    dates, nums = GUARD["facts_in"]("see EVT-DC-04-PLT and CLIN-PLT-001 v2")
    assert nums == {2.0} and dates == set()


def test_class_a_refusal_names_the_practitioner_and_offers_a_packet():
    text = GUARD["refusal_text"]("Dr A. Rao")
    assert "Dr A. Rao" in text and "evidence packet" in text and "Class A" in text
