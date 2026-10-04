"""Compare saved A/B/C predictions offline; never runs a model or query.

A=current pipeline, B=corrected Cortex pipeline, C=corrected pipeline + LangExtract.
Input files use baseline.py's predictions contract. Compare only identical text
hashes, record prompt/model differences separately, and do not call fixture-filled
outputs model accuracy. Missing/invalid runs cannot win a comparison.
"""
import argparse
import json
from pathlib import Path
from .baseline import run
from .contract import InvalidExtraction


def compare(predictions_by_arm):
    if set(predictions_by_arm) != {"A", "B", "C"}:
        raise InvalidExtraction("three_comparison_arms_required")
    results = {}
    for arm, predictions in predictions_by_arm.items():
        report = run(predictions)
        errors = [d["doc_id"] for d in report["documents"] if d.get("extraction_error")]
        if errors:
            results[arm] = {"status": "invalid_predictions", "invalid_documents": errors,
                            "counts": None}
        else:
            results[arm] = {"status": "scored", "counts": {
                key: sum(d["extraction_score"][key] for d in report["documents"])
                for key in ("expected_fields", "candidate_fields", "correct_with_exact_evidence",
                            "missed_fields", "unsupported_or_wrong_fields")}}
    return {"mode": "offline_saved_predictions", "arms": results,
            "model_calls": 0, "snowflake_queries": 0,
            "cost_comparison": "not_measured", "model_latency_comparison": "not_measured",
            "adoption_decision": "requires_accuracy_safety_latency_and_cost_review"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for arm in ("A", "B", "C"):
        parser.add_argument("--" + arm.lower(), type=Path, required=True)
    args = parser.parse_args()
    try:
        result = compare({arm: json.loads(getattr(args, arm.lower()).read_text()) for arm in ("A","B","C")})
        print(json.dumps(result,indent=2))
        if any(r["status"] != "scored" for r in result["arms"].values()):
            raise SystemExit(1)
    except (InvalidExtraction,json.JSONDecodeError) as exc:
        parser.exit(1,f"comparison_failed: {exc}\n")
