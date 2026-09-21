"""Shared PDF rendering primitives for the synthetic document generators.

Not itself one of Contract 5's named files (ledger / projections /
fhir_bundles / documents / corruptions / eval_questions) — a small internal
helper that `documents.py` and `corruptions.py` both depend on, so the fixed
creation date, font, and line-drawing primitive are guaranteed identical
rather than duplicated across two files and left free to drift apart.
"""

from __future__ import annotations

from datetime import datetime

from fpdf import FPDF

FIXED_CREATION_DATE = datetime(2025, 1, 1)


def new_pdf() -> FPDF:
    pdf = FPDF()
    pdf.set_creation_date(FIXED_CREATION_DATE)
    pdf.add_page()
    pdf.set_font("Helvetica", size=11)
    return pdf


def render_line(pdf: FPDF, text: str, *, bold: bool = False) -> None:
    pdf.set_font("Helvetica", style="B" if bold else "", size=pdf.font_size_pt)
    pdf.cell(0, 8, text, new_x="LMARGIN", new_y="NEXT")
