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

from data.generator._pdf_render import new_pdf, render_line
from data.generator.ledger import ClinicalEvent, Ledger


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


def render_cbc_report(event: ClinicalEvent, ledger: Ledger) -> bytes:
    facility = next(f for f in ledger.facilities if f.facility_id == event.facility_id)
    pdf = new_pdf()
    render_line(pdf, facility.name, bold=True)
    render_line(pdf, "COMPLETE BLOOD COUNT")
    render_line(pdf, f"Patient: {ledger.patient_id}")
    render_line(pdf, f"Report date: {event.event_time.date().isoformat()}")
    render_line(pdf, "")
    render_line(pdf, f"WBC: {indian_digit_grouping(event.wbc_per_uL)} /CUMM")
    render_line(pdf, f"Neutrophils (differential): {event.neutrophil_pct}%")
    render_line(pdf, f"Platelet count: {indian_digit_grouping(event.platelet_count)} /CUMM")
    return bytes(pdf.output())


def render_her2_report(event: ClinicalEvent, ledger: Ledger) -> bytes:
    facility = next(f for f in ledger.facilities if f.facility_id == event.facility_id)
    pdf = new_pdf()
    render_line(pdf, facility.name, bold=True)
    render_line(pdf, "HISTOPATHOLOGY / HER2 REPORT")
    render_line(pdf, f"Patient: {ledger.patient_id}")
    render_line(pdf, f"Specimen: {event.specimen_id} ({event.specimen_source})")
    render_line(pdf, f"Report date: {event.event_time.date().isoformat()}")
    render_line(pdf, "")
    render_line(pdf, f"Grade: {event.grade}")
    render_line(pdf, f"HER2 IHC: {event.ihc_score}")
    return bytes(pdf.output())


_RENDERERS = {
    "cbc_lab": render_cbc_report,
    "her2_result": render_her2_report,
}


def render_authorization_letter(*, patient_id: str, auth_id: str, payer: str,
                                package: str, decision: str, decided_on: str,
                                valid_until: str) -> bytes:
    """Synthetic pre-authorisation letter for a day-care cohort patient. The cohort
    is seeded in SQL, not from a ledger, so its fields are passed explicitly. PAT-DC-07
    is the SPEC scenario-6 case: the AUTHORIZATION row says pending while this letter
    says approved, and COV-AUTH-001 must report `conflicting` with both retained."""
    pdf = new_pdf()
    render_line(pdf, f"{payer} - Pre-Authorisation Decision", bold=True)
    render_line(pdf, "SYNTHETIC DOCUMENT - NOT A REAL PAYER LETTER")
    render_line(pdf, f"Patient: {patient_id}")
    render_line(pdf, f"Pre-auth reference: {auth_id}")
    render_line(pdf, f"Package: {package}")
    render_line(pdf, "")
    render_line(pdf, f"Authorisation status: {decision}")
    render_line(pdf, f"Decision date: {decided_on}")
    render_line(pdf, f"Valid until: {valid_until}")
    return bytes(pdf.output())


def render_cohort_lab_report(*, patient_id: str, facility: str, report_date: str,
                             results: list[tuple[str, str, str]]) -> bytes:
    """One dated lab panel for a SQL-seeded cohort patient. `results` are
    (label, value, unit) exactly as stored, so extraction can be checked against
    the structured rows. Counts use Indian digit grouping, as on real Indian reports."""
    pdf = new_pdf()
    render_line(pdf, facility, bold=True)
    render_line(pdf, "LABORATORY REPORT - SYNTHETIC")
    render_line(pdf, f"Patient: {patient_id}")
    render_line(pdf, f"Report date: {report_date}")
    render_line(pdf, "")
    for label, value, unit in results:
        render_line(pdf, f"{label}: {value} {unit}".rstrip())
    return bytes(pdf.output())


def render_cohort_pathology_report(*, patient_id: str, facility: str, specimen_id: str,
                                   report_date: str, lines: list[str]) -> bytes:
    pdf = new_pdf()
    render_line(pdf, facility, bold=True)
    render_line(pdf, "HISTOPATHOLOGY REPORT - SYNTHETIC")
    render_line(pdf, f"Patient: {patient_id}")
    render_line(pdf, f"Specimen: {specimen_id}")
    render_line(pdf, f"Report date: {report_date}")
    render_line(pdf, "")
    for line in lines:
        render_line(pdf, line)
    return bytes(pdf.output())


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
