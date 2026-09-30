#!/usr/bin/env python3
"""Generate FHIR R4 bundles for every patient in SAARTHI.CORE.PATIENT and
load them into SAARTHI.DOCUMENTS.RAW_FHIR_BUNDLE for the flatten_fhir task
to consume.

WHY this exists
    Until 23 Sept, RAW_FHIR_BUNDLE was empty because per-patient bundle
    generation had never been run. flatten_fhir_proc was verified to idle
    cleanly on empty input, but the full RAW_FHIR_BUNDLE -> LATERAL FLATTEN
    -> CLINICAL_EVENT pipeline (SPEC.md §14 diagram) had no live evidence.
    This script closes that gap.

WHAT it does (per patient)
    1. Query PATIENT (base row), ID_MAP (identifiers), CLINICAL_EVENT (events).
    2. Build a FHIR R4 Bundle dict via data.generator.fhir_from_db.
    3. Write the bundle JSON to data/generated/fhir/<patient_id>.json for
       inspection.
    4. Upsert the bundle into RAW_FHIR_BUNDLE keyed on source_id, so a
       re-run replaces the payload and clears downstream processing markers
       so flatten_fhir processes the refreshed bundle again.

WHY idempotent via source_id (not bundle_id)
    bundle_id is UUID-generated per row. Using MERGE on it would insert a
    new row every run and RAW_FHIR_BUNDLE would grow linearly with
    invocations. source_id ('SAARTHI-FHIR-EXPORT/<patient_id>') is stable
    per patient so re-running the script leaves exactly one bundle row per
    patient. This matches the R2 discipline: source_recorded_at is a
    real-world timestamp; ingested_at moves.

USAGE
    source venv/bin/activate
    python backend/scripts/generate_fhir_bundles.py --connection EA72552_SNOW

    Options:
      --patient <id>         Restrict to a single patient (useful for spot-check)
      --dry-run              Emit bundles to disk only, do NOT load into DB
      --skip-flatten         Do not CALL flatten_fhir_proc after loading
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from data.generator.fhir_from_db import build_fhir_bundle_from_db  # noqa: E402

OUTPUT_DIR = REPO_ROOT / "data" / "generated" / "fhir"


def run_snow(connection: str, sql: str) -> str:
    """Run SQL via `snow sql -f tempfile --format json`. Same pattern as
    run_rule_fixtures.py; -q -f is used because -q silently fails on
    multi-statement scripts and JSON output needs cleanup for parsing."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False) as f:
        f.write(sql)
        tmp_path = f.name
    try:
        proc = subprocess.run(
            ["snow", "sql", "-c", connection, "-f", tmp_path, "--format", "json"],
            capture_output=True, text=True, check=False,
        )
    finally:
        Path(tmp_path).unlink(missing_ok=True)
    if proc.returncode != 0:
        raise RuntimeError(
            f"snow sql failed:\nSTDERR: {proc.stderr}\n"
            f"STDOUT: {proc.stdout[:400]}\nSQL:\n{sql[:600]}"
        )
    return proc.stdout.strip()


def query_rows(connection: str, sql: str) -> list[dict]:
    """Run a SELECT and return the row list, tolerating snow CLI's various
    JSON output shapes (dict with 'result' key, bare list, or multi-statement
    concatenation)."""
    out = run_snow(connection, sql)
    if not out:
        return []
    # `snow sql --format json` returns a JSON array for single-statement
    # queries. Multi-statement scripts return a concatenation which we don't
    # use in this file.
    data = json.loads(out)
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get("result") or []
    return []


def sql_literal(value: str) -> str:
    """Escape a string for Snowflake SQL files, including backslash escapes."""
    return "'" + value.replace("\\", "\\\\").replace("'", "''") + "'"


def fetch_patients(connection: str, restrict: str | None) -> list[str]:
    filter_clause = f"WHERE patient_id = {sql_literal(restrict)}" if restrict else ""
    rows = query_rows(connection, f"SELECT patient_id FROM SAARTHI.CORE.PATIENT {filter_clause} ORDER BY patient_id")
    return [r["PATIENT_ID"] for r in rows]


def fetch_identifiers(connection: str, patient_id: str) -> list[dict]:
    return query_rows(
        connection,
        f"SELECT source_system AS SYSTEM, source_patient_id AS VALUE "
        f"FROM SAARTHI.CORE.ID_MAP "
        f"WHERE patient_id = {sql_literal(patient_id)} ORDER BY source_system, source_patient_id",
    )


def fetch_events(connection: str, patient_id: str) -> list[dict]:
    # Selecting explicit columns (not *) so the FHIR builder sees stable
    # keys regardless of table evolution.
    return query_rows(
        connection,
        f"""
        SELECT event_id AS EVENT_ID,
               event_type AS EVENT_TYPE,
               code_system AS CODE_SYSTEM,
               code AS CODE,
               display AS DISPLAY,
               value_num AS VALUE_NUM,
               unit AS UNIT,
               event_time AS EVENT_TIME,
               source_recorded_at AS SOURCE_RECORDED_AT,
               status AS STATUS
          FROM SAARTHI.CORE.CLINICAL_EVENT
         WHERE patient_id = {sql_literal(patient_id)}
         ORDER BY event_time
        """,
    )


def load_bundle_into_db(connection: str, patient_id: str, bundle: dict) -> None:
    """Upsert one bundle into RAW_FHIR_BUNDLE, keyed on source_id.

    Uses PARSE_JSON on an escaped VARCHAR because Snowflake's VARIANT
    literal syntax does not accept a raw JSON string in an INSERT VALUES.
    Both the JSON and source identifier are escaped as SQL string literals;
    JSON serialization alone is not SQL escaping.
    """
    payload_json = json.dumps(bundle, separators=(",", ":"))
    source_id = f"SAARTHI-FHIR-EXPORT/{patient_id}"
    run_snow(connection, f"""
        MERGE INTO SAARTHI.DOCUMENTS.RAW_FHIR_BUNDLE t
        USING (SELECT
                 {sql_literal(source_id)}          AS source_id,
                 PARSE_JSON({sql_literal(payload_json)}) AS payload,
                 'collection'                      AS bundle_type
              ) s
           ON t.source_id = s.source_id
        WHEN MATCHED THEN UPDATE SET
             t.payload      = s.payload,
             t.bundle_type  = s.bundle_type,
             t.received_at  = CURRENT_TIMESTAMP(),
             t.processed_at = NULL,
             t.process_status = NULL,
             t.error_detail = NULL
        WHEN NOT MATCHED THEN INSERT (source_id, payload, bundle_type)
        VALUES (s.source_id, s.payload, s.bundle_type);
    """)


def call_flatten(connection: str) -> dict:
    out = run_snow(connection, "CALL SAARTHI.OPERATIONAL.flatten_fhir_proc();")
    rows = json.loads(out) if out else []
    if not rows:
        return {}
    # snow CLI returns proc VARIANT result as a JSON string inside a single-row/col result
    raw = rows[0].get("FLATTEN_FHIR_PROC") or ""
    try:
        return json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        return {"raw": raw}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--connection", default="EA72552_SNOW")
    parser.add_argument("--patient", help="Restrict to a single patient_id")
    parser.add_argument("--dry-run", action="store_true", help="Do not load into DB")
    parser.add_argument("--skip-flatten", action="store_true", help="Do not CALL flatten_fhir_proc after loading")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    patients = fetch_patients(args.connection, args.patient)
    if not patients:
        print("No patients found.", file=sys.stderr)
        return 1

    total_entries = 0
    print(f"Building FHIR bundles for {len(patients)} patient(s) via {args.connection}...")
    for pid in patients:
        id_map_rows = fetch_identifiers(args.connection, pid)
        events = fetch_events(args.connection, pid)
        bundle = build_fhir_bundle_from_db(pid, id_map_rows, events)
        entry_count = len(bundle["entry"])
        total_entries += entry_count

        # Always write to disk for inspection
        out_path = OUTPUT_DIR / f"{pid}.json"
        out_path.write_text(json.dumps(bundle, indent=2))
        print(f"  {pid:16s} identifiers={len(id_map_rows):>2d} events={len(events):>3d} bundle_entries={entry_count:>3d} -> {out_path.relative_to(REPO_ROOT)}")

        if not args.dry_run:
            load_bundle_into_db(args.connection, pid, bundle)

    print(f"\nEmitted {len(patients)} bundles, {total_entries} total resources.")

    if args.dry_run:
        print("--dry-run: skipped RAW_FHIR_BUNDLE load and flatten_fhir_proc.")
        return 0

    # Verify count in RAW_FHIR_BUNDLE
    check = query_rows(
        args.connection,
        "SELECT COUNT(*) AS N FROM SAARTHI.DOCUMENTS.RAW_FHIR_BUNDLE "
        "WHERE source_id LIKE 'SAARTHI-FHIR-EXPORT/%'",
    )
    print(f"RAW_FHIR_BUNDLE rows with source_id LIKE 'SAARTHI-FHIR-EXPORT/%': {check[0]['N']}")

    if args.skip_flatten:
        print("--skip-flatten: not calling flatten_fhir_proc.")
        return 0

    print("\nCalling flatten_fhir_proc...")
    result = call_flatten(args.connection)
    print(f"  result: {json.dumps(result)}")

    # Verify no unprocessed bundles remain
    pending = query_rows(
        args.connection,
        "SELECT COUNT(*) AS N FROM SAARTHI.DOCUMENTS.RAW_FHIR_BUNDLE "
        "WHERE source_id LIKE 'SAARTHI-FHIR-EXPORT/%' AND processed_at IS NULL",
    )
    print(f"  unprocessed bundles remaining: {pending[0]['N']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
