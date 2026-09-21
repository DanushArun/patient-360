"""Per-source-system CSV projection — WORK-PLAN.md Day 1-2, Contract 5.

Derives one CSV per facility from a `Ledger`, each carrying only that
facility's own local identifier. This is the structured half of the three
ingestion paths (SPEC.md 9, 444: "CSV per source system" -> `COPY INTO` ->
staging -> `DT_HARMONIZED_EVENTS`), and it is deliberately siloed: real
hospital EHRs do not share a patient key, so a projection that leaked the
ledger's internal `patient_id` into a facility export would model an
identity system that doesn't exist outside this generator. Cross-facility
identity resolution is ID_MAP's job downstream, not this file's.
"""

from __future__ import annotations

import csv
from pathlib import Path

from data.generator.ledger import ClinicalEvent, Ledger

ROW_FIELDS = [
    "local_patient_id",
    "event_id",
    "kind",
    "event_time",
    "source_recorded_at",
    "specimen_id",
    "specimen_source",
    "grade",
    "ihc_score",
    "t_score",
    "wbc_per_uL",
    "neutrophil_pct",
    "platelet_count",
]


def _blank(value: object) -> str:
    return "" if value is None else str(value)


def _row(event: ClinicalEvent, local_patient_id: str) -> dict[str, str]:
    return {
        "local_patient_id": local_patient_id,
        "event_id": event.event_id,
        "kind": event.kind,
        "event_time": event.event_time.isoformat(),
        "source_recorded_at": event.source_recorded_at.isoformat(),
        "specimen_id": _blank(event.specimen_id),
        "specimen_source": _blank(event.specimen_source),
        "grade": _blank(event.grade),
        "ihc_score": _blank(event.ihc_score),
        "t_score": _blank(event.t_score),
        "wbc_per_uL": _blank(event.wbc_per_uL),
        "neutrophil_pct": _blank(event.neutrophil_pct),
        "platelet_count": _blank(event.platelet_count),
    }


def project_to_source_rows(ledger: Ledger) -> dict[str, list[dict[str, str]]]:
    """One row group per facility, each row using that facility's own MRN.

    A facility with events but no MRN identifier in the ledger is a data
    bug, not a case to paper over silently, so it raises rather than
    emitting a row with an empty local ID.
    """
    mrn_by_facility = {
        ident.facility_id: ident.value
        for ident in ledger.identifiers
        if ident.system == "MRN"
    }

    groups: dict[str, list[dict[str, str]]] = {}
    for event in sorted(ledger.events, key=lambda e: e.event_time):
        if event.facility_id not in mrn_by_facility:
            raise ValueError(
                f"facility {event.facility_id} has clinical events but no MRN "
                "identifier in the ledger — every source system needs its own "
                "local patient key to export a CSV"
            )
        row = _row(event, mrn_by_facility[event.facility_id])
        groups.setdefault(event.facility_id, []).append(row)
    return groups


def write_csvs(ledger: Ledger, output_dir: Path) -> dict[str, Path]:
    """Writes one CSV per facility under `output_dir`, returns the paths written."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    written: dict[str, Path] = {}
    for facility_id, rows in project_to_source_rows(ledger).items():
        path = output_dir / f"{facility_id}.csv"
        with path.open("w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=ROW_FIELDS)
            writer.writeheader()
            writer.writerows(rows)
        written[facility_id] = path
    return written
