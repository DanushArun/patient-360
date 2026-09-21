"""Tests for frontend/core/evidence_render.py — the evidence-kind dispatch.

SPEC.md 10 / answer_schema.json: three evidence kinds render differently —
`structured` (a row, with a mandatory-when-computed derivation note),
`document_span` (a page with a verification badge), `reference_clause`
(R6: "rendered visually distinct from patient evidence, because a guideline
clause in the same panel style as a pathology page invites reading it as a
finding about the patient"). This module is the one place that distinction
is decided, so a UI bug that renders a guideline clause identically to a
lab result would show up here first.
"""

from __future__ import annotations

import pytest

from frontend.core.evidence_render import describe_evidence


def test_structured_evidence_is_marked_as_patient_evidence():
    evidence = {
        "kind": "structured", "id": "CE-LAB-441", "table": "CLINICAL_EVENT",
        "event_time": "2026-09-16T08:30:00", "source_recorded_at": "2026-09-16T16:45:00",
    }
    result = describe_evidence(evidence)
    assert result.is_patient_evidence is True
    assert "CLINICAL_EVENT" in result.headline
    assert "CE-LAB-441" in result.headline


def test_structured_evidence_surfaces_the_derived_note_when_present():
    # R1/answer_schema.json: a computed value must never look like a
    # printed one. The derivation note is mandatory-when-present in the
    # rendering, not an optional detail a reader could miss.
    evidence = {
        "kind": "structured", "id": "CE-LAB-441", "table": "CLINICAL_EVENT",
        "event_time": "2026-09-16T08:30:00", "source_recorded_at": "2026-09-16T16:45:00",
        "derived": "ANC computed as WBC x (neutrophil% + band%) / 100",
    }
    result = describe_evidence(evidence)
    assert result.is_derived is True
    assert "computed as WBC" in result.detail


def test_structured_evidence_without_derived_field_is_not_flagged_derived():
    evidence = {
        "kind": "structured", "id": "CE-LAB-441", "table": "CLINICAL_EVENT",
        "event_time": "2026-09-16T08:30:00", "source_recorded_at": "2026-09-16T16:45:00",
    }
    result = describe_evidence(evidence)
    assert result.is_derived is False


def test_document_span_is_marked_as_patient_evidence():
    evidence = {
        "kind": "document_span", "id": "AS-7741", "doc_id": "DOC-0052",
        "page_index": 1, "char_start": 393, "char_end": 418, "verification_status": "verified",
    }
    result = describe_evidence(evidence)
    assert result.is_patient_evidence is True
    assert "DOC-0052" in result.headline


def test_document_span_shows_one_indexed_page_number_for_readers():
    evidence = {
        "kind": "document_span", "id": "AS-7741", "doc_id": "DOC-0052",
        "page_index": 1, "char_start": 393, "char_end": 418, "verification_status": "verified",
    }
    result = describe_evidence(evidence)
    # page_index is the 0-based DOC_PAGE array index; a clinician-facing
    # label shows "page 2", the conventional 1-based document viewer number.
    assert "page 2" in result.headline.lower()


def test_document_span_surfaces_r7_verification_status():
    evidence = {
        "kind": "document_span", "id": "AS-7741", "doc_id": "DOC-0052",
        "page_index": 1, "char_start": 393, "char_end": 418, "verification_status": "conflicting",
    }
    result = describe_evidence(evidence)
    assert "conflicting" in result.detail.lower()


def test_reference_clause_is_not_patient_evidence():
    # R6, enforced here: this must render visually distinct from
    # structured/document_span, and the flag this dispatch returns is what
    # the page uses to decide the panel style.
    evidence = {
        "kind": "reference_clause", "id": "RC-01", "doc_id": "PMJAY-2026",
        "page_index": 4, "publisher": "National Health Authority",
        "document_title": "PM-JAY Operational Guidelines", "effective_date": "2026-04-01",
    }
    result = describe_evidence(evidence)
    assert result.is_patient_evidence is False
    assert "PM-JAY Operational Guidelines" in result.headline


def test_reference_clause_falls_back_to_doc_id_with_no_title():
    evidence = {
        "kind": "reference_clause", "id": "RC-01", "doc_id": "PMJAY-2026",
        "page_index": 4, "publisher": "National Health Authority", "effective_date": "2026-04-01",
    }
    result = describe_evidence(evidence)
    assert "PMJAY-2026" in result.headline


def test_unknown_evidence_kind_raises_rather_than_rendering_nothing():
    with pytest.raises(ValueError):
        describe_evidence({"kind": "not_a_real_kind"})
