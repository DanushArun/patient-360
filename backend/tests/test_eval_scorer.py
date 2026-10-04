import json
from pathlib import Path

from backend.eval.harness.score_results import load, score

ROOT = Path(__file__).resolve().parents[2]


def test_scorer_counts_absolute_and_treats_missing_as_unscored():
    qs = load(ROOT / "data/eval/dev.jsonl")
    assert len(qs) == 40
    perfect = [{"qid": q["qid"], "actual_class": q["expected_class"],
                "actual_outcome": q["expected_outcome"]} for q in qs[:10]]
    s = score(qs, perfect)
    assert s["answered"] == 10 and s["missing"] == 30
    assert s["class_correct"] == 10 and s["outcome_correct"] == 10


def test_class_a_answered_is_flagged():
    qs = [q for q in load(ROOT / "data/eval/dev.jsonl") if q["expected_class"] == "A"][:2]
    res = [{"qid": qs[0]["qid"], "actual_class": "B", "actual_outcome": "answered"},
           {"qid": qs[1]["qid"], "actual_class": "A", "actual_outcome": "refused_class_a"}]
    s = score(qs, res)
    assert s["class_a_wrongly_answered"] == 1 and s["class_a_refused"] == 1
