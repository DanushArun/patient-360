#!/usr/bin/env python3
"""Score CLASSIFY_QUESTION against the labelled eval sets, on a live account.

    python3 backend/eval/harness/run_classifier_eval.py <connection> dev
    python3 backend/eval/harness/run_classifier_eval.py <connection> held_out --write

The classifier routes every question before the agent: Class A (clinical
judgement) is refused, Class B (record state) is answered. Both error
directions matter and are reported separately:
  A->B  a clinical-judgement question answered  (safety failure)
  B->A  a record question refused               (usefulness failure)

Tune on dev only. held_out is scored once, after tuning, and --write records
the result in backend/eval/results/ with the date and every misroute.
"""
from __future__ import annotations

import json
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def classify_all(connection: str, questions: list[str]) -> list[dict]:
    calls = "; ".join("CALL SAARTHI.OPERATIONAL.CLASSIFY_QUESTION('" + q.replace("'", "''") + "')" for q in questions)
    out = subprocess.run(["snow", "sql", "-c", connection, "--format", "json", "-q", calls],
                         capture_output=True, text=True, check=True).stdout
    blocks = json.loads(out)
    return [json.loads(list(b[0].values())[0]) for b in blocks]


def main() -> int:
    connection, split = sys.argv[1], sys.argv[2]
    rows = [json.loads(line) for line in (ROOT / f"data/eval/{split}.jsonl").open()]
    got = classify_all(connection, [r["question"] for r in rows])
    results, a_to_b, b_to_a = [], [], []
    for r, g in zip(rows, got):
        pred = "A" if g["classification"] == "CLASS_A" else "B"
        results.append({"qid": r["qid"], "question": r["question"], "expected": r["expected_class"],
                        "predicted": pred, "method": g["method"]})
        if r["expected_class"] == "A" and pred == "B":
            a_to_b.append(results[-1])
        if r["expected_class"] == "B" and pred == "A":
            b_to_a.append(results[-1])
    n = len(rows)
    correct = n - len(a_to_b) - len(b_to_a)
    summary = {"split": split, "date": date.today().isoformat(), "questions": n, "correct": correct,
               "accuracy": round(correct / n, 3),
               "class_a_answered (A->B, safety)": len(a_to_b), "record_refused (B->A, usefulness)": len(b_to_a),
               "by_method": {m: sum(1 for x in results if x["method"] == m) for m in {x["method"] for x in results}}}
    print(json.dumps(summary, indent=1))
    for x in a_to_b + b_to_a:
        print(f"  MISROUTE {x['qid']} expected {x['expected']} got {x['predicted']} ({x['method']}): {x['question']}")
    if "--write" in sys.argv:
        path = ROOT / f"backend/eval/results/classifier_{split}_{summary['date']}.json"
        path.write_text(json.dumps({"summary": summary, "results": results}, indent=1))
        print("wrote", path.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
