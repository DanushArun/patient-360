"""Synthetic PDF reports — WORK-PLAN.md Day 1-2, Contract 5.

Renders the ledger's own CBC and HER2 facts as PDFs using the Indian lab
report conventions AI_PARSE_DOCUMENT and the R7 prompts have to survive
(SPEC.md 9): comma-grouped digits in the lakh/crore system rather than
thousands, and "/CUMM" rather than SI "/uL" for cell counts. The report
prints exactly what the source ledger event carries and nothing else — in
particular, never a computed ANC, matching the same invariant `ledger.py`
and `fhir_bundles.py` already enforce.

PDF bytes are made deterministic on purpose (fixed creation date) so the
generator can be re-run without producing a spurious diff every time.
"""

from __future__ import annotations

from datetime import datetime

from fpdf import FPDF

from data.generator.ledger import ClinicalEvent, Ledger

_FIXED_CREATION_DATE = datetime(2025, 1, 1)


def indian_digit_grouping(n: int) -> str:
    """Formats `n` in the Indian numbering system: thousands, then lakhs,
    then crores — groups of 2 digits after the first group of 3.
    178721 -> "1,78,721", not the SI "178,721"."""
    s = str(n)
    if len(s) <= 3:
        return s
    last_three, rest = s[-3:], s[:-3]
    groups: list[str] = []
    while len(rest) > 2:
        groups.insert(0, rest[-2:])
        rest = rest[:-2]
    if rest:
        groups.insert(0, rest)
    return ",".join(groups) + "," + last_three


def _new_pdf() -> FPDF:
    pdf = FPDF()
    pdf.set_creation_date(_FIXED_CREATION_DATE)
    pdf.add_page()
    pdf.set_font("Helvetica", size=11)
    return pdf


def _line(pdf: FPDF, text: str, *, bold: bool = False) -> None:
    pdf.set_font("Helvetica", style="B" if bold else "", size=pdf.font_size_pt)
    pdf.cell(0, 8, text, new_x="LMARGIN", new_y="NEXT")


def render_cbc_report(event: ClinicalEvent, ledger: Ledger) -> bytes:
    facility = next(f for f in ledger.facilities if f.facility_id == event.facility_id)
    pdf = _new_pdf()
    _line(pdf, facility.name, bold=True)
    _line(pdf, "COMPLETE BLOOD COUNT")
    _line(pdf, f"Patient: {ledger.patient_id}")
    _line(pdf, f"Report date: {event.event_time.date().isoformat()}")
    _line(pdf, "")
    _line(pdf, f"WBC: {indian_digit_grouping(event.wbc_per_uL)} /CUMM")
    _line(pdf, f"Neutrophils (differential): {event.neutrophil_pct}%")
    _line(pdf, f"Platelet count: {indian_digit_grouping(event.platelet_count)} /CUMM")
    return bytes(pdf.output())


def render_her2_report(event: ClinicalEvent, ledger: Ledger) -> bytes:
    facility = next(f for f in ledger.facilities if f.facility_id == event.facility_id)
    pdf = _new_pdf()
    _line(pdf, facility.name, bold=True)
    _line(pdf, "HISTOPATHOLOGY / HER2 REPORT")
    _line(pdf, f"Patient: {ledger.patient_id}")
    _line(pdf, f"Specimen: {event.specimen_id} ({event.specimen_source})")
    _line(pdf, f"Report date: {event.event_time.date().isoformat()}")
    _line(pdf, "")
    _line(pdf, f"Grade: {event.grade}")
    _line(pdf, f"HER2 IHC: {event.ihc_score}")
    return bytes(pdf.output())


_RENDERERS = {
    "cbc_lab": render_cbc_report,
    "her2_result": render_her2_report,
}


def build_documents(ledger: Ledger) -> dict[str, bytes]:
    """Returns `{event_id: pdf_bytes}` for every ledger event with a PDF
    rendering. Current scope is cbc_lab and her2_result only — the two
    events WORK-PLAN.md Day 1-2 actually needs a document for (the R7
    ambiguous-CBC asset and the HER2 discordance claim). chemo/appendectomy/
    DEXA/infusion events are skipped, not because they could never be a
    document in reality, but because nothing downstream needs one yet."""
    return {
        event.event_id: _RENDERERS[event.kind](event, ledger)
        for event in sorted(ledger.events, key=lambda e: e.event_time)
        if event.kind in _RENDERERS
    }
