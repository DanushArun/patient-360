"""Evaluate a frozen disjoint synthetic split through the actual SQL answer gateway."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from time import perf_counter

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError
from snowflake.connector.errors import Error as SnowflakeError

from backend.verification.metrics import gates, score, unique_ids, verify_gold, verify_split
from backend.verification.report import write_report
from backend.verification.session import ROOT, connect, require_success


def load(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def run_cases(cases: list[dict]) -> tuple[list[dict], list[dict]]:
    schema = json.loads((ROOT / "frontend/contracts/answer_schema.json").read_text())
    validator = Draft202012Validator(schema)
    runs, events = [], []
    for case in cases:
        started = perf_counter()
        run = {"qid": case["qid"], "cold": None,
               'latency_basis': 'fresh connection; warehouse state before patient binding'}
        try:
            with connect() as session:
                try:
                    warehouses = session.query('SHOW WAREHOUSES', label='latency_warehouse_state')
                    current = [row for row in warehouses if row.get('is_current') == 'Y']
                    if len(current) != 1:
                        raise AssertionError('current warehouse metadata unavailable')
                    state = current[0]['state']
                    run['warehouse_state_before_binding'] = state
                    run['cold'] = {'SUSPENDED': True, 'STARTED': False}.get(state)
                    require_success(session.call("BIND_PATIENT", [case["patient_id"]]))
                    answer = require_success(session.call("ASK_SAARTHI", [case["question"]]))
                    validator.validate(answer)
                    run["artifact"] = answer
                finally:
                    events.extend(session.events)
        except (AssertionError, ValueError, OSError, ValidationError, SnowflakeError) as error:
            run["error"] = type(error).__name__
        run["elapsed_s"] = perf_counter() - started
        runs.append(run)
    return runs, events


def markdown(metrics: dict) -> str:
    lines = ["| Metric | Correct / total | Rate |", "|---|---:|---:|"]
    for key, value in metrics.items():
        if not isinstance(value, dict) or "rate" not in value:
            continue
        fraction = f"{value['correct']}/{value['total']}"
        percent = f"{value['rate']:.1%}" if value["rate"] is not None else "unmeasured"
        lines.append(f"| {key} | {fraction} | {percent} |")
    lines.append(f"\nWarm p95: {metrics['warm']['p95_s']} s; "
                 f"n={metrics['warm']['samples']}. Cold: {metrics['cold']['latencies_s']}.")
    return "\n".join(lines) + "\n"


def captured_runs(path: Path, expected: dict) -> tuple[list[dict], list[dict]]:
    captured = json.loads(path.read_text())
    if captured.get('freeze') != expected:
        raise ValueError('captured result freeze differs from current benchmark')
    runs, events = captured['runs'], captured['events']
    if not isinstance(runs, list) or not isinstance(events, list):
        raise ValueError('captured results must contain run and query-event arrays')
    return runs, events


def attach_adjudication(runs: list[dict], path: Path) -> None:
    judgments = unique_ids(load(path))
    if set(judgments) - set(unique_ids(runs)):
        raise ValueError('adjudication references an unknown captured question')
    for run in runs:
        run['document_adjudication'] = judgments.get(run['qid'], {}).get('citations', [])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("dev", "heldout", "gold", "freeze"):
        parser.add_argument(f"--{name}", type=Path, required=True)
    parser.add_argument("--adjudication", type=Path)
    parser.add_argument('--results', type=Path,
                        help='Rescore exact captured results; no new queries')
    parser.add_argument("--output", type=Path, default=Path("evidence/qa/evaluation-live.json"))
    args = parser.parse_args()
    expected = json.loads(args.freeze.read_text())
    for name in ("dev", "heldout", "gold"):
        digest = hashlib.sha256(getattr(args, name).read_bytes()).hexdigest()
        if expected[name] != digest:
            raise ValueError(f"frozen {name} hash mismatch")
    dev, heldout, gold = load(args.dev), load(args.heldout), load(args.gold)
    verify_split(dev, heldout)
    verify_gold(gold)
    if set(unique_ids(heldout)) != set(unique_ids(gold)):
        raise ValueError("heldout/gold question IDs differ")
    runs, events = (captured_runs(args.results, expected) if args.results
                    else run_cases(heldout))
    if args.adjudication:
        attach_adjudication(runs, args.adjudication)
    metrics = score(gold, runs)
    checks = gates(metrics)
    status = "PASS" if all(checks.values()) else "FAIL"
    write_report(args.output, {"status": status, "freeze": expected, "metrics": metrics,
                               "gates": checks, "runs": runs, "events": events,
                               'execution_mode': 'captured_rescore' if args.results else 'live'})
    args.output.with_suffix(".md").write_text(markdown(metrics))
    print(markdown(metrics))
    return 0 if status == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
