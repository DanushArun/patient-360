"""Tests for data/generator/corruptions.py — corruption scenario 13.

SPEC.md 9, corruption scenario 13: "Rotated/low-quality photo with a
misread value" — tests R7, correct behaviour is "two-pass disagrees ->
refuses to assert." WORK-PLAN.md names this explicitly as a Day 1-2 deep-
case deliverable: "One deliberately ambiguous CBC page where the platelet
count is genuinely hard to read. This is the R7 demo asset."

Scope here is the corrupted source document and a typed statement of both
plausible readings — not the R7 two-pass extraction logic itself, which is
a later Stream 1 task that consumes this fixture.
"""

from __future__ import annotations

import io

import pytest
from pypdf import PdfReader

from data.generator.corruptions import AmbiguousReading, render_ambiguous_cbc_report, resolve_platelet_ambiguity
from data.generator.documents import indian_digit_grouping
from data.generator.ledger import generate_deep_case

_LEDGER = generate_deep_case(seed=20260918)


def _text(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    return "\n".join(page.extract_text() for page in reader.pages)


def test_rotation_confusion_is_preferred_when_a_6_or_9_is_present():
    # 160000 has a single '6' - the classic 180-degree rotation confusion
    # (6 <-> 9) is the most realistic mechanism for a *rotated* photo, so it
    # must win over every other pair when one is available.
    reading = resolve_platelet_ambiguity(160000)
    assert reading == AmbiguousReading(
        true_value=160000, misread_value=190000,
        digit_position=1, true_digit="6", misread_digit="9",
        mechanism="rotation",
    )


def test_falls_back_to_the_next_available_pair_when_no_6_or_9_present():
    # 178721 has no 6 or 9. The next pair in priority order is 1 <-> 7.
    reading = resolve_platelet_ambiguity(178721)
    assert reading.true_digit == "1"
    assert reading.misread_digit == "7"
    assert reading.mechanism == "low-quality capture"


def test_corrupts_the_rightmost_occurrence_to_keep_magnitude_close():
    # 178721 has '1' at positions 0 and 5. Corrupting the rightmost keeps
    # the misread numerically close to the truth (off by 6, not by 600000) -
    # a single-glyph misread should not change the number's whole magnitude,
    # or a human reviewer would catch it on sight and the ambiguity would
    # not be "genuine".
    reading = resolve_platelet_ambiguity(178721)
    assert reading.digit_position == 5
    assert reading.misread_value == 178727


def test_misread_value_uses_only_the_corrupted_digit():
    reading = resolve_platelet_ambiguity(178721)
    true_digits = list(str(reading.true_value))
    misread_digits = list(str(reading.misread_value))
    diff_positions = [i for i in range(len(true_digits)) if true_digits[i] != misread_digits[i]]
    assert diff_positions == [reading.digit_position]


def test_no_mappable_digit_raises_rather_than_silently_passing_through():
    # 234555 uses only digits 2/3/4/5, none of which has a defined
    # confusion pair - this must fail loudly, not silently return the
    # unmodified value pretending it found an ambiguity.
    with pytest.raises(ValueError):
        resolve_platelet_ambiguity(234555)


def test_ambiguous_report_prints_the_misread_value_not_the_truth():
    cbc_event = next(e for e in _LEDGER.events if e.kind == "cbc_lab")
    reading = resolve_platelet_ambiguity(cbc_event.platelet_count)

    text = _text(render_ambiguous_cbc_report(cbc_event, _LEDGER))
    assert indian_digit_grouping(reading.misread_value) in text
    assert indian_digit_grouping(reading.true_value) not in text


def test_ambiguous_report_is_labelled_as_low_quality():
    cbc_event = next(e for e in _LEDGER.events if e.kind == "cbc_lab")
    text = _text(render_ambiguous_cbc_report(cbc_event, _LEDGER))
    assert "LOW" in text.upper() and (
        "QUALITY" in text.upper() or "ROTATED" in text.upper()
    )


def test_ambiguous_report_still_prints_the_unaffected_fields_unchanged():
    # Only the platelet reading is corrupted - WBC and neutrophil % are the
    # same source facts as the clean report, corruption is scoped to the
    # one deliberately ambiguous glyph, not the whole document.
    cbc_event = next(e for e in _LEDGER.events if e.kind == "cbc_lab")
    text = _text(render_ambiguous_cbc_report(cbc_event, _LEDGER))
    assert "/CUMM" in text
    assert "35.0" in text


def test_ambiguous_report_is_byte_deterministic():
    cbc_event = next(e for e in _LEDGER.events if e.kind == "cbc_lab")
    a = render_ambiguous_cbc_report(cbc_event, _LEDGER)
    b = render_ambiguous_cbc_report(cbc_event, _LEDGER)
    assert a == b


def test_ambiguous_report_is_a_valid_pdf():
    cbc_event = next(e for e in _LEDGER.events if e.kind == "cbc_lab")
    pdf_bytes = render_ambiguous_cbc_report(cbc_event, _LEDGER)
    assert pdf_bytes[:4] == b"%PDF"
