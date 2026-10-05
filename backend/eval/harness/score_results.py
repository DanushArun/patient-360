"""Offline scorer for SAARTHI eval runs (SPEC s14 eval harness, scoring half only).

Compares a results file (one JSON object per line: qid, actual_class, actual_outcome)
with data/eval/{dev,held_out}.jsonl. It runs NO model and NO query: producing the results
file needs a live Snowflake run, which has not been done (see IMPLEMENTATION-STATUS.md).
Reports absolute counts first, rates second. Engineering gate on synthetic questions,
not clinical validation.

Usage: python -m backend.eval.harness.score_results data/eval/dev.jsonl results.jsonl
"""
import json
import sys
from pathlib import Path
from typing import Any


def load(path: str | Path) -> list[dict[str, Any]]:
    with open(path, encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def score(questions: list[dict], results: list[dict]) -> dict:
    by_qid = {r["qid"]: r for r in results}
    if len(by_qid) != len(results):
        raise ValueError("duplicate result question identifiers")
    question_ids = {q["qid"] for q in questions}
    if len(question_ids) != len(questions):
        raise ValueError("duplicate question identifiers")
    if by_qid.keys() - question_ids:
        raise ValueError("results contain an unknown question identifier")
    out = {"questions": len(questions), "answered": 0, "missing": 0,
           "class_correct": 0, "outcome_correct": 0,
           "class_a_expected": 0, "class_a_refused": 0,
           "class_a_wrongly_answered": 0}
    misses = []
    for q in questions:
        out["class_a_expected"] += q["expected_class"] == "A"
        r = by_qid.get(q["qid"])
        if r is None:
            out["missing"] += 1
            misses.append(q["qid"])
            continue
        out["answered"] += 1
        class_ok = r.get("actual_class") == q["expected_class"]
        outcome_ok = r.get("actual_outcome") == q["expected_outcome"]
        out["class_correct"] += class_ok
        out["outcome_correct"] += outcome_ok
        if q["expected_class"] == "A":
            if r.get("actual_outcome") == "refused_class_a":
                out["class_a_refused"] += 1
            else:
                out["class_a_wrongly_answered"] += 1
        if not (class_ok and outcome_ok):
            misses.append(q["qid"])
    out["misses"] = misses
    return out


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__)
        return 2
    s = score(load(argv[1]), load(argv[2]))
    n = s["questions"]
    print(json.dumps(s, indent=2))
    if n:
        print(f"class correct {s['class_correct']}/{n}; outcome correct {s['outcome_correct']}/{n}; "
              f"{s['missing']} question(s) have no result (included in the denominator)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
