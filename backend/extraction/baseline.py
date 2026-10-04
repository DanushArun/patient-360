"""Read-only offline baseline. python -m backend.extraction.baseline

Optional --predictions FILE scores externally produced candidate findings.
Without that file, extraction scores stay null, not fabricated perfect results.
No model calls, credentials, DB connection or document generation occurs here.
"""
from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import asdict
import hashlib
import json
from pathlib import Path
from time import perf_counter

from .contract import SourcePage, decode_findings, InvalidExtraction, text_observations
from .document_profile import profile, parsed_pages, evaluate_text

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = Path(__file__).with_name("fixtures.json")


def score_predictions(page, expected, prediction):
    if not isinstance(prediction, dict) or set(prediction) != {"text_sha256", "findings"}:
        raise InvalidExtraction("invalid_prediction_envelope")
    if prediction["text_sha256"] != page.text_sha256:
        raise InvalidExtraction("source_version_mismatch")
    concepts = {r["concept"] for r in expected}
    candidates = decode_findings(json.dumps(prediction["findings"]), page, concepts)
    def signature(r):
        return tuple(r[k] for k in ("concept", "value", "unit", "specimen_id", "quote",
                                   "char_start", "char_end", "negation", "missingness_state"))
    want = Counter(signature(r) for r in expected)
    got = Counter(signature(asdict(f)) for f in candidates)
    return {"expected_fields": sum(want.values()), "candidate_fields": sum(got.values()),
            "correct_with_exact_evidence": sum((got & want).values()),
            "missed_fields": sum((want - got).values()),
            "unsupported_or_wrong_fields": sum((got - want).values())}


def run(predictions=None, parsed_documents=None):
    # Existing project dependency, loaded only for the PDF command.
    from pypdf import PdfReader
    cases = json.loads(FIXTURES.read_text())["cases"]
    if parsed_documents is not None and (not isinstance(parsed_documents, dict) or
            set(parsed_documents) != {c["doc_id"] for c in cases}):
        raise InvalidExtraction("parse_case_set_mismatch")
    if predictions is not None and (not isinstance(predictions, dict) or
                                   set(predictions) != {c["doc_id"] for c in cases}):
        raise InvalidExtraction("prediction_case_set_mismatch")
    reports = []
    for case in cases:
        path = ROOT / "data/generated/pdf" / case["file"]
        started = perf_counter()
        pages = parsed_pages(parsed_documents[case["doc_id"]]) if parsed_documents is not None else tuple(
            p.extract_text() for p in PdfReader(path).pages)
        if len(pages) != 1:
            raise InvalidExtraction("fixture_page_count_changed")
        text = pages[0]
        elapsed = round((perf_counter() - started) * 1000, 3)
        page = SourcePage(case["patient_id"], case["doc_id"], 0, text, case["specimen_id"])
        anchors = ["Patient: " + case["patient_id"], "Report date: " + case["report_date"]]
        if case["specimen_id"]:
            anchors.append("Specimen: " + case["specimen_id"])
        expected = []
        for row in case["fields"]:
            start = text.find(row["quote"])
            expected.append({**row, "specimen_id": case["specimen_id"], "negation": False,
                             "missingness_state": "present", "char_start": start,
                             "char_end": start + len(row["quote"]) if start >= 0 else -1})
        present = sum(text.count(r["quote"]) == 1 for r in expected)
        report = {"doc_id": case["doc_id"], "fixture_doc_type": case["doc_type"],
                  "file_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                  "text_sha256": page.text_sha256, "local_input_read_ms": elapsed,
                  "expected_field_count": len(expected), "exact_field_lines_found": present,
                  "context_anchors_match": all(a in text for a in anchors),
                  "text_observations": text_observations(text), "extraction_score": None,
                  "document_profile": profile(text),
                  "parse_evaluation": evaluate_text(text,[r["quote"] for r in expected])}
        if predictions is not None:
            try:
                if present != len(expected) or not report["context_anchors_match"]:
                    raise InvalidExtraction("fixture_text_changed")
                report["extraction_score"] = score_predictions(page, expected, predictions[case["doc_id"]])
            except InvalidExtraction as exc:
                report["extraction_error"] = str(exc)
        reports.append(report)
    return {"mode": "offline_supplied_parse_output" if parsed_documents is not None else
            "offline_existing_synthetic_pdf_text_baseline", "documents": reports,
            "document_count": len(reports),
            "expected_field_count": sum(r["expected_field_count"] for r in reports),
            "exact_field_lines_found": sum(r["exact_field_lines_found"] for r in reports),
            "model_calls": 0, "snowflake_queries": 0,
            "cloud_cost": "No cloud operations performed; account balance not queried",
            "limits": ["pypdf text extraction is not Snowflake AI_PARSE_DOCUMENT or image OCR",
                       "Exact text matches do not measure table association or original-image readability",
                       "Fixture document types are expected labels, not an implemented classifier",
                       "No extraction accuracy result without candidate predictions",
                       "Synthetic engineering checks are not clinical validation"]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--predictions", type=Path)
    parser.add_argument("--parsed-documents", type=Path,
                        help="Existing exported parse results keyed by fixture doc_id; no cloud call")
    args = parser.parse_args()
    try:
        report = run(json.loads(args.predictions.read_text()) if args.predictions else None,
                     json.loads(args.parsed_documents.read_text()) if args.parsed_documents else None)
        print(json.dumps(report, indent=2))
        if any(r.get("extraction_error") or not r["context_anchors_match"] or
               r["exact_field_lines_found"] != r["expected_field_count"] for r in report["documents"]):
            raise SystemExit(1)
    except (InvalidExtraction, json.JSONDecodeError) as exc:
        parser.exit(1, f"baseline_failed: {exc}\n")
