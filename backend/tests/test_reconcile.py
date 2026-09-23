"""Parsing inside backend/sql/tasks/reconcile_evidence.sql, run locally.

Inputs are the exact strings the live pipeline produced on 24 Sept from the
synthetic deep-case PDFs (AI_PARSE_DOCUMENT text, two-pass extraction values).
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
R: dict = {}
exec(compile((ROOT / "backend/sql/tasks/reconcile_evidence.sql").read_text().split("$$")[1], "reconcile.py", "exec"), R)

CBC_PAGE = """Tata Memorial Hospital
COMPLETE BLOOD COUNT
Patient: PAT-DEEP-0001
Report date: 2025-03-27

WBC: 6,000 /CUMM
Neutrophils (differential): 35.0%
Platelet count: 2,60,604 /CUMM"""

HER2_PAGE = """Tata Memorial Hospital
HISTOPATHOLOGY / HER2 REPORT
Patient: PAT-DEEP-0001
Specimen: SPEC-SURGICAL-001 (surgical_specimen)
Report date: 2025-02-05
Grade: III
HER2 IHC: 2+"""


def test_report_date_is_read_from_the_page():
    assert R["parse_date"](CBC_PAGE) == datetime(2025, 3, 27)


def test_indian_day_first_and_month_name_dates():
    assert R["parse_date"]("Collected on: 05/02/2025") == datetime(2025, 2, 5)
    assert R["parse_date"]("Reported: 27-Mar-2025") == datetime(2025, 3, 27)
    assert R["parse_date"]("no date printed here") is None


def test_specimen_is_read_from_the_page():
    assert R["parse_specimen"](HER2_PAGE) == "SPEC-SURGICAL-001"


def test_indian_digit_grouping():
    assert R["parse_number"]("2,60,604") == 260604.0
    assert R["parse_number"]("2,60,904 /CUMM") == 260904.0
    assert R["parse_number"]("35.0%") == 35.0


def test_passes_that_differ_only_in_unit_agree():
    # Live: pass 1 "2,60,904", pass 2 "2,60,904 /CUMM" - the same reading.
    assert R["passes_agree"]("2,60,904", "2,60,904 /CUMM", "analyte")


def test_a_misread_digit_is_a_difference():
    # The rotated photo: both passes read 2,60,904; the report says 2,60,604.
    assert not R["same_value"](260904.0, 260604.0)
    assert R["same_value"](35.0, 35.1) is True       # decimals: within 0.5%


def test_her2_scores():
    assert R["parse_ihc"]("2+") == "2+"
    assert R["parse_ihc"]("grade=III ihc=2+".replace("ihc=", "")) == "2+"
    assert R["passes_agree"]("1+", "1 +", "biomarker")
    assert not R["passes_agree"]("1+", "2+", "biomarker")


def test_reading_normalises_by_concept():
    assert R["reading"]({"CONCEPT_NAME": "PLT", "VALUE": "2,60,604"}) == ("num", 260604.0)
    assert R["reading"]({"CONCEPT_NAME": "HER2_IHC", "VALUE": "2+"}) == ("ihc", "2+")
