#!/usr/bin/env python3
"""Renders one lab report and one histopathology report per day-care cohort patient
from an exported CLINICAL_EVENT snapshot (data/generated/cohort_events.json), so each
document carries exactly the values the rules already evaluate. Writes
data/generated/pdf/cohort/<DOC_ID> and prints a manifest line per document.

Run from the repo root: venv/bin/python -m data.generator.cohort_documents
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

from data.generator.documents import (indian_digit_grouping, render_cohort_lab_report,
                                      render_cohort_pathology_report)

ROOT = Path(__file__).resolve().parents[2]
EVENTS = ROOT / "data/generated/cohort_events.json"
OUT = ROOT / "data/generated/pdf/cohort"
FACILITIES = {"FAC-01": "Apollo Cancer Centre", "FAC-02": "Tata Memorial Hospital",
              "FAC-03": "AIIMS", "FAC-04": "HCG Cancer Centre"}
# Report order and printed labels; counts are grouped, everything else printed as stored.
PANEL = [("WBC", "WBC", True), ("NEUTROPHIL_PCT", "Neutrophils (differential)", False),
         ("PLT", "Platelet count", True), ("CREATININE", "Serum creatinine", False),
         ("BILIRUBIN", "Total bilirubin", False), ("AST", "AST", False)]


def number(value: float, grouped: bool) -> str:
    if grouped:
        return indian_digit_grouping(int(value))
    return f"{value:g}"


def main(argv: list[str] | None = None, events_path: Path = EVENTS, out: Path = OUT) -> list[dict]:
    """Render the cohort documents. `--manifest PATH` writes the JSON array that
    backend/scripts/prepare_synthetic_documents.py consumes (this is the step that creates
    data/generated/cohort_document_manifest.json). Stale `DOC-*` PDFs in the output directory
    that this run did not regenerate are reported, and removed only with `--prune`."""
    argv = list(argv if argv is not None else [])
    manifest_path = Path(argv[argv.index("--manifest") + 1]) if "--manifest" in argv else None
    events = json.loads(events_path.read_text())
    records: list[dict] = []
    out.mkdir(parents=True, exist_ok=True)
    by_patient = defaultdict(list)
    for event in events:
        by_patient[event["patient_id"]].append(event)
    for patient_id in sorted(by_patient):
        rows = by_patient[patient_id]
        labs = [r for r in rows if r["event_type"] == "lab" and r["concept"] in dict(
            (c, 1) for c, _, _ in PANEL)]
        if labs:
            # The latest panel date only: one report = one collection.
            panel_time = max(r["event_time"] for r in labs)
            on_panel = {r["concept"]: r for r in labs if r["event_time"] == panel_time}
            results = [(label, number(on_panel[c]["value_num"], grouped), on_panel[c]["unit"] or "")
                       for c, label, grouped in PANEL if c in on_panel]
            first = next(iter(on_panel.values()))
            doc = f"DOC-LAB-{patient_id[4:]}"
            (out / doc).write_bytes(render_cohort_lab_report(
                patient_id=patient_id, facility=FACILITIES[first["facility_id"]],
                report_date=panel_time[:10], results=results))
            record = {"doc_id": doc, "patient_id": patient_id, "doc_type": "lab_report",
                      "facility_id": first["facility_id"], "event_time": panel_time,
                      "signed_at": first["source_recorded_at"],
                      "must_contain": "|".join(label for label, _, _ in results[:2])}
            records.append(record)
            print(json.dumps(record))
        for path in (r for r in rows if r["event_type"] == "pathology"):
            text = path["value_text"] or ""
            lines = ([f"Grade: {text.split('grade=')[1].split()[0]}",
                      f"HER2 IHC: {text.split('ihc=')[1]}"] if "ihc=" in text
                     else [f"Diagnosis: {text}"])
            doc = f"DOC-PATH-{patient_id[4:]}"
            (out / doc).write_bytes(render_cohort_pathology_report(
                patient_id=patient_id, facility=FACILITIES[path["facility_id"]],
                specimen_id=path["specimen_id"], report_date=path["event_time"][:10],
                lines=lines))
            record = {"doc_id": doc, "patient_id": patient_id, "doc_type": "pathology",
                      "facility_id": path["facility_id"], "event_time": path["event_time"],
                      "signed_at": path["source_recorded_at"],
                      "must_contain": path["specimen_id"]}
            records.append(record)
            print(json.dumps(record))
    if manifest_path:
        manifest_path.write_text(json.dumps(records, indent=1) + "\n")
    current = {r["doc_id"] for r in records}
    stale = sorted(p.name for p in out.glob("DOC-*") if p.name not in current)
    for name in stale:
        if "--prune" in argv:
            (out / name).unlink()
    if stale:
        print(f"{'removed' if '--prune' in argv else 'STALE (not in manifest; use --prune)'}: "
              + ", ".join(stale))
    return records


if __name__ == "__main__":
    import sys
    main(sys.argv[1:])
