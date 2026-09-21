#!/usr/bin/env python3
"""Run the SQL test suites through the Snowflake CLI.

    tests/run_tests.py <connection>
    tests/run_tests.py <connection> --suite access
    tests/run_tests.py <connection> --dry-run       # list what would run

THE CONVENTION, AND WHY IT MATTERS
----------------------------------
Every test file's LAST statement returns exactly one row with three columns:

    SELECT 't21_conflicting'                                   AS TEST_ID,
           CASE WHEN <the assertion> THEN 'PASS' ELSE 'FAIL' END AS RESULT,
           'pass1=1900 pass2=1200 status=' || v_status          AS DETAIL;

One shape for every test means the runner needs no per-file knowledge and the
results file is machine-readable without post-processing - which the eval and the
CoCo testing-phase evidence both need.

DETAIL is not decoration. A failing test whose detail says only "FAIL" costs the
twenty minutes of re-running it by hand that the detail column would have saved.

A test that returns no row is reported as ERROR, never as PASS. Fail closed applies
to the test harness too: a suite that silently skips a test it could not run is
worse than one that fails, because it reports green.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import shutil
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
SQL_DIR = ROOT / "tests" / "sql"


def discover(suite: str | None) -> list[pathlib.Path]:
    root = SQL_DIR / suite if suite else SQL_DIR
    if not root.exists():
        return []
    return sorted(p for p in root.rglob("*.sql") if not p.name.startswith("_"))


def run_one(conn: str, path: pathlib.Path) -> tuple[str, str, str]:
    """-> (test_id, result, detail). Never raises."""
    proc = subprocess.run(
        ["snow", "sql", "-c", conn, "-f", str(path), "--format", "json"],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        return path.stem, "ERROR", (proc.stderr or proc.stdout).strip().splitlines()[-1][:160]

    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return path.stem, "ERROR", "output was not JSON - check the final SELECT"

    # snow returns a list of result sets, or a single one. The last row wins.
    rows: list = []
    if isinstance(payload, list):
        rows = payload if payload and isinstance(payload[0], dict) else (payload[-1] or [])
    elif isinstance(payload, dict):
        rows = [payload]
    if not rows or not isinstance(rows[-1], dict):
        return path.stem, "ERROR", "no result row - a test must end with the TEST_ID/RESULT/DETAIL select"

    row = {k.upper(): v for k, v in rows[-1].items()}
    return (
        str(row.get("TEST_ID", path.stem)),
        str(row.get("RESULT", "ERROR")).upper(),
        str(row.get("DETAIL", "")),
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="SAARTHI SQL test runner")
    ap.add_argument("connection", nargs="?")
    ap.add_argument("--suite", help="access | extraction | validator | classifier | rules")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--out", default="eval/results/sql_tests.json")
    args = ap.parse_args()

    tests = discover(args.suite)
    if not tests:
        where = f"tests/sql/{args.suite}" if args.suite else "tests/sql"
        print(f"No tests found in {where}.")
        print("tests/TEST-MANIFEST.md lists every test that must exist - 36 and counting.")
        return 0

    if args.dry_run:
        for t in tests:
            print(f"  {t.relative_to(ROOT)}")
        print(f"\n{len(tests)} tests would run")
        return 0

    if not args.connection:
        ap.error("a connection name is required unless --dry-run")
    if not shutil.which("snow"):
        print("the Snowflake CLI ('snow') is not on PATH", file=sys.stderr)
        return 1

    started = time.time()
    results = []
    for t in tests:
        test_id, result, detail = run_one(args.connection, t)
        results.append({"test_id": test_id, "result": result, "detail": detail,
                        "file": str(t.relative_to(ROOT))})
        print(f"{result:5}  {test_id:<44}  {detail[:70]}")

    passed = sum(1 for r in results if r["result"] == "PASS")
    failed = sum(1 for r in results if r["result"] == "FAIL")
    errored = sum(1 for r in results if r["result"] not in ("PASS", "FAIL"))

    out = ROOT / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        "suite": args.suite or "all",
        "ran_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "duration_s": round(time.time() - started, 1),
        "passed": passed, "failed": failed, "errored": errored,
        "total": len(results),
        "results": results,
    }, indent=2) + "\n")

    # Absolute counts alongside rates - AGENTS.md 4. "27 of 36" beats "75%".
    print(f"\n{passed} passed, {failed} failed, {errored} errored, of {len(results)}")
    print(f"written to {args.out}")
    return 1 if (failed or errored) else 0


if __name__ == "__main__":
    sys.exit(main())
