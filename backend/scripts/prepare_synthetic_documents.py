"""Prepare bounded, idempotent SQL for explicitly labelled synthetic PDFs.

This digital-text ingestion helper does not extract clinical assertions or
establish R7 verification. It never reads the real reports used for research.
Run: python -m backend.scripts.prepare_synthetic_documents [--with-put] MANIFEST PDF_DIR SQL_OUT

Default output is pure SQL (MERGE of DOCUMENT and DOC_PAGE text rows) that runs unchanged in a
Snowsight worksheet: no PUT, no local file paths, so it is machine-independent. DOCUMENT.source_path
records the stage-relative path "<patient>/<doc>"; the parse task therefore treats the document as
already ingested whether or not the PDF itself is uploaded. Upload the PDFs through the Snowsight
stage UI only if you want the original files on the stage (stage must be ENCRYPTION =
(TYPE = 'SNOWFLAKE_SSE'), AGENTS.md section 3.7). `--with-put` additionally emits SnowSQL PUT lines
with absolute local paths; those cannot run in Snowsight.
The manifest is a JSON array emitted by the synthetic generators.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

PATIENTS = {"PAT-DEEP-0001", *(f"PAT-DC-{i:02d}" for i in range(1, 12))}
TYPES = {"lab_report", "pathology_report", "pathology", "authorization_letter",
         "clinical_note", "surgical_note", "imaging_report"}


def literal(value: str) -> str:
    # Snowflake single-quoted strings treat backslash as an escape character.
    return "'" + value.replace("\\", "\\\\").replace("'", "''") + "'"


def prepare(records: list[dict], pdf_dir: Path, with_put: bool = False) -> str:
    root = pdf_dir.resolve()
    seen = set()
    statements = [
        "-- Synthetic cohort documents (no file upload). Run as ACCOUNTADMIN; every statement is re-runnable.",
        "USE ROLE ACCOUNTADMIN;",
        "USE SECONDARY ROLES NONE;",
        "ALTER TABLE SAARTHI.DOCUMENTS.DOCUMENT ADD COLUMN IF NOT EXISTS source_path VARCHAR;",
        "ALTER TABLE SAARTHI.DOCUMENTS.DOC_PAGE ADD COLUMN IF NOT EXISTS extraction_attempted_at TIMESTAMP_NTZ;",
    ]
    for record in records:
        doc = record["doc_id"]
        patient = record["patient_id"]
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,160}", doc):
            raise ValueError("invalid document identifier")
        if patient not in PATIENTS:
            raise ValueError("patient outside synthetic submission cohort")
        if doc in seen:
            raise ValueError("duplicate document identifier")
        seen.add(doc)
        if record["doc_type"] not in TYPES:
            raise ValueError("unsupported synthetic document type")
        path = (root / doc).resolve()
        if not path.is_relative_to(root):
            raise ValueError("document path outside synthetic PDF directory")
        content = path.read_bytes()
        if len(content) > 5_000_000:
            raise ValueError("synthetic PDF exceeds size limit")
        pages = PdfReader(path).pages
        if not 1 <= len(pages) <= 40:
            raise ValueError("synthetic PDF exceeds page limit")
        texts = [page.extract_text() or "" for page in pages]
        body = "\n".join(texts)
        if f"Patient: {patient}" not in body or "SYNTHETIC" not in body:
            raise ValueError("PDF lacks matching synthetic patient label")
        if any(not text.strip() for text in texts):
            raise ValueError("synthetic PDF has an unreadable page")
        stage_path = f"{patient}/{doc}"
        if with_put:
            statements.append(f"PUT {literal('file://' + str(path))} "
                f"@SAARTHI.STAGES.PATIENT_DOCS/{patient}/ AUTO_COMPRESS=FALSE OVERWRITE=FALSE;")
        values = [literal(doc), literal(patient), "'patient'", literal(record["doc_type"]),
            "1", literal(hashlib.sha256(content).hexdigest()), literal(stage_path), "'clean_pdf'",
            literal(record["signed_at"]) + "::TIMESTAMP_NTZ",
            literal(record["event_time"]) + "::TIMESTAMP_NTZ", "CURRENT_TIMESTAMP()",
            literal(record["facility_id"]), "'digital_emr'", "'active'"]
        statements.append("MERGE INTO SAARTHI.DOCUMENTS.DOCUMENT t USING "
            f"(SELECT {literal(doc)} doc_id) s ON t.doc_id=s.doc_id "
            "WHEN NOT MATCHED THEN INSERT (doc_id,patient_id,scope,doc_type,version,file_hash,"
            "source_path,source_quality,signed_at,effective_at,ingested_at,source_facility_id,"
            f"ingestion_method,status) VALUES ({','.join(values)});")
        for index, text in enumerate(texts):
            statements.append("MERGE INTO SAARTHI.DOCUMENTS.DOC_PAGE t USING "
                f"(SELECT {literal(doc)} doc_id,{index} page_index) s "
                "ON t.doc_id=s.doc_id AND t.page_index=s.page_index "
                "WHEN NOT MATCHED THEN INSERT (doc_id,page_index,text,char_count) "
                f"VALUES ({literal(doc)},{index},{literal(text)},{len(text)});")
    if with_put:
        statements.append("ALTER STAGE SAARTHI.STAGES.PATIENT_DOCS REFRESH;")
    return "\n".join(statements) + "\n"


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--with-put"]
    manifest, directory, output = args
    Path(output).write_text(prepare(json.loads(Path(manifest).read_text()), Path(directory),
                                    with_put="--with-put" in sys.argv[1:]))
