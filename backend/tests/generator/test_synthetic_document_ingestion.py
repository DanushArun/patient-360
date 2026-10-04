"""The submission helper must never ingest real reports or seed verification."""
import io
from pathlib import Path

import pytest
from pypdf import PdfReader

from backend.scripts.prepare_synthetic_documents import prepare
from data.generator.documents import render_cohort_lab_report


def fixture(tmp_path, patient="PAT-DC-04"):
    doc = "DOC-LAB-DC-04"
    content = render_cohort_lab_report(patient_id=patient, facility="Test's facility",
        report_date="2026-10-03", results=[("Platelet count", "82,000", "/cumm")])
    (tmp_path / doc).write_bytes(content)
    return {"doc_id": doc, "patient_id": "PAT-DC-04", "doc_type": "lab_report",
            "facility_id": "FAC-02", "event_time": "2026-10-03T10:00:00",
            "signed_at": "2026-10-03T13:00:00"}, content


def test_pdf_page_is_retained_verbatim_without_claims(tmp_path):
    record, content = fixture(tmp_path)
    sql = prepare([record], tmp_path, with_put=True)
    text = PdfReader(io.BytesIO(content)).pages[0].extract_text()
    assert text.replace("'", "''") in sql
    assert "82,000 /cumm" in sql
    assert "Test''s facility" in sql
    assert "AUTO_COMPRESS=FALSE OVERWRITE=FALSE" in sql
    assert "WHEN NOT MATCHED THEN INSERT" in sql
    assert "SAARTHI.EVIDENCE" not in sql
    assert "verified" not in sql


@pytest.mark.parametrize("field,value", [("doc_id", "../report"),
    ("patient_id", "REAL-PATIENT-1"), ("doc_id", "x'; DROP TABLE x;--")])
def test_unsafe_or_non_synthetic_identifiers_are_rejected(tmp_path, field, value):
    record, _ = fixture(tmp_path)
    record[field] = value
    with pytest.raises(ValueError):
        prepare([record], tmp_path)


def test_cross_patient_pdf_and_duplicate_manifest_are_rejected(tmp_path):
    record, _ = fixture(tmp_path, patient="PAT-DC-01")
    with pytest.raises(ValueError, match="patient"):
        prepare([record], tmp_path)
    record, _ = fixture(tmp_path)
    with pytest.raises(ValueError, match="duplicate"):
        prepare([record, record], tmp_path)


def test_default_output_is_pure_sql_without_put_or_local_paths(tmp_path):
    record, _ = fixture(tmp_path)
    sql = prepare([record], tmp_path)
    assert "PUT " not in sql and "file://" not in sql and str(tmp_path) not in sql
    assert "REFRESH" not in sql
    assert "MERGE INTO SAARTHI.DOCUMENTS.DOCUMENT" in sql
    assert "MERGE INTO SAARTHI.DOCUMENTS.DOC_PAGE" in sql
    assert "'PAT-DC-04/DOC-LAB-DC-04'" in sql  # source_path = parse-task dedup key


def test_literal_escapes_backslash_and_quote():
    from backend.scripts.prepare_synthetic_documents import literal
    assert literal("a\\b'c") == "'a\\\\b''c'"
