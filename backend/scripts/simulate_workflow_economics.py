"""Seeded sensitivity simulation or observed paired reviews; never relabel simulation as impact."""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from backend.verification.economics import economics, simulate, summarize
from backend.verification.report import write_report


def observations(path: Path) -> list[dict]:
    with path.open(newline="") as stream:
        rows = list(csv.DictReader(stream))
    for row in rows:
        row["seconds"] = float(row["seconds"])
        for key in ("correct", "contradiction", "caught"):
            if row[key] not in {"true", "false"}:
                raise ValueError(f"{key} must be true or false")
            row[key] = row[key] == "true"
        if not row.get("operator") or row.get("order") not in {"0", "1"}:
            raise ValueError("observed reviews require operator and counterbalanced order")
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--simulation-config", type=Path)
    source.add_argument("--observed-csv", type=Path)
    parser.add_argument("--usage-json", type=Path)
    parser.add_argument("--credit-price", type=float)
    parser.add_argument("--hourly-wage", type=float)
    parser.add_argument("--currency")
    parser.add_argument("--output", type=Path, default=Path("evidence/qa/workflow-economics.json"))
    args = parser.parse_args()
    rows = (simulate(json.loads(args.simulation_config.read_text())) if args.simulation_config
            else observations(args.observed_csv))
    metrics = summarize(rows)
    usage = json.loads(args.usage_json.read_text()) if args.usage_json else None
    if usage and any(v is None for v in (args.credit_price, args.hourly_wage, args.currency)):
        raise ValueError("usage pricing requires credit-price, hourly-wage and currency")
    costs = economics(usage, {"reviews": metrics["assisted"]["reviews"],
                             "credit_price": args.credit_price,
                             "hourly_wage": args.hourly_wage or 0,
                             "currency": args.currency,
                             "seconds_saved": metrics["paired_median_seconds_saved"]})
    mode = "SIMULATED" if args.simulation_config else "OBSERVED"
    write_report(args.output, {"status": "PASS", "evidence_type": mode,
                               "metrics": metrics, "economics": costs, "observations": rows})
    print(f"{mode}: {json.dumps(metrics, indent=2)}")
    print(f"Economics: {json.dumps(costs, indent=2)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
