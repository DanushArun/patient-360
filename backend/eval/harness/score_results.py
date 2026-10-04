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
from collections import Counter


def load(path):
    with open(path, encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def score(questions, results):
    by_qid = {r["qid"]: r for r in results}
    out = {"questions": len(questions), "answered": 0, "missing": 0,
           "class_correct": 0, "outcome_correct": 0,
           "class_a_expected": 0, "class_a_refused": 0,
           "class_a_wrongly_answered": 0}
    misses = []
    for q in questions:
        r = by_qid.get(q["qid"])
        if r is None:
            out["missing"] += 1
            continue
        out["answered"] += 1
        class_ok = r.get("actual_class") == q["expected_class"]
        outcome_ok = r.get("actual_outcome") == q["expected_outcome"]
        out["class_correct"] += class_ok
        out["outcome_correct"] += outcome_ok
        if q["expected_class"] == "A":
            out["class_a_expected"] += 1
            if r.get("actual_outcome") == "refused_class_a":
                out["class_a_refused"] += 1
            else:
                out["class_a_wrongly_answered"] += 1
        if not (class_ok and outcome_ok):
            misses.append(q["qid"])
    out["misses"] = misses
    return out


def main(argv):
    if len(argv) != 3:
        print(__doc__)
        return 2
    s = score(load(argv[1]), load(argv[2]))
    n = s["answered"]
    print(json.dumps(s, indent=2))
    if n:
        print(f"class correct {s['class_correct']}/{n}; outcome correct {s['outcome_correct']}/{n}; "
              f"{s['missing']} question(s) have no result (counted as not scored, not as correct)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
