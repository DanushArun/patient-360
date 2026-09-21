"""Tests for data/generator/documents.py — synthetic PDF reports.

WORK-PLAN.md Day 1-2, Contract 5: "Synthetic PDF reports -> PUT to
PATIENT_DOCS stage." Real-world Indian lab reports use conventions
AI_PARSE_DOCUMENT and the R7 extraction prompts have to survive:
comma-grouped digits in the Indian numbering system (lakhs, not thousands),
and "/CUMM" for cell counts rather than SI "/uL" (SPEC.md 9 / the
Dipali-derived trap list). This generator renders the ledger's own CBC and
HER2 facts using those conventions rather than SI-clean ones, so later
pipeline work has authentic documents to parse, not idealised ones.

Determinism (byte-identical PDFs from the same ledger) is required so the
generator can be re-run without producing spurious diffs.
"""

from __future__ import annotations

from pypdf import PdfReader
import io

from data.generator.documents import (
    indian_digit_grouping,
    render_cbc_report,
    render_her2_report,
    build_documents,
)
from data.generator.ledger import generate_deep_case

_LEDGER = generate_deep_case(seed=20260918)


def _text(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    return "\n".join(page.extract_text() for page in reader.pages)


def test_indian_digit_grouping_matches_the_lakh_crore_convention():
    assert indian_digit_grouping(0) == "0"
    assert indian_digit_grouping(7) == "7"
    assert indian_digit_grouping(999) == "999"
    assert indian_digit_grouping(1000) == "1,000"
    assert indian_digit_grouping(178721) == "1,78,721"
    assert indian_digit_grouping(4500000) == "45,00,000"
    assert indian_digit_grouping(100000) == "1,00,000"


def test_cbc_report_renders_indian_lab_conventions():
    cbc_event = next(e for e in _LEDGER.events if e.kind == "cbc_lab")
    pdf_bytes = render_cbc_report(cbc_event, _LEDGER)
    text = _text(pdf_bytes)

    assert "/CUMM" in text
    assert indian_digit_grouping(cbc_event.platelet_count) in text
    assert "35.0" in text  # neutrophil differential, as printed, not derived
    assert "ANC" not in text, "the source report must never print a computed ANC"


def test_her2_report_renders_grade_and_ihc_per_specimen():
    her2_events = [e for e in _LEDGER.events if e.kind == "her2_result"]
    assert len(her2_events) == 2

    for event in her2_events:
        text = _text(render_her2_report(event, _LEDGER))
        assert event.grade in text
        assert event.ihc_score in text
        assert event.specimen_id in text


def test_build_documents_produces_one_pdf_per_cbc_and_her2_event():
    docs = build_documents(_LEDGER)
    cbc_and_her2 = [e for e in _LEDGER.events if e.kind in ("cbc_lab", "her2_result")]
    assert len(docs) == len(cbc_and_her2)
    for doc_id, pdf_bytes in docs.items():
        assert pdf_bytes[:4] == b"%PDF"


def test_documents_are_byte_deterministic():
    a = build_documents(_LEDGER)
    b = build_documents(_LEDGER)
    assert a.keys() == b.keys()
    for doc_id in a:
        assert a[doc_id] == b[doc_id]
