"""Full-denominator synthetic answer metrics and strict patient/layout split checks."""
from __future__ import annotations

from math import ceil, isfinite
from decimal import Decimal
from typing import Any
import hashlib
import json
import re


def unique_ids(rows: list[dict]) -> dict[str, dict]:
    result = {row["qid"]: row for row in rows}
    if len(result) != len(rows):
        raise ValueError("duplicate question IDs")
    return result


def verify_split(dev: list[dict], heldout: list[dict]) -> None:
    if not dev or not heldout:
        raise ValueError("empty split")
    unique_ids(dev + heldout)
    for key in ("patient_id", "layout_ids", "document_hashes"):
        left = {v for row in dev for v in ([row[key]] if key == "patient_id" else row[key])}
        right = {v for row in heldout for v in ([row[key]] if key == "patient_id" else row[key])}
        if not left or not right or left & right:
            raise ValueError(f"non-independent {key} split")


def verify_gold(gold: list[dict]) -> None:
    unique_ids(gold)
    if not gold:
        raise ValueError('empty gold benchmark')
    factual_fields = {'text', 'asserted_value', 'outcome', 'recorded_date', 'status'}
    for case in gold:
        claims = case.get('expected_claims')
        if not isinstance(claims, list):
            raise ValueError('gold requires explicit expected_claims, including empty lists')
        if case.get('supported') is True and case.get('expected_class') == 'CLASS_B' and not claims:
            raise ValueError('supported factual answer requires expected_claims')
        for claim in claims:
            if (not isinstance(claim, dict) or not factual_fields.intersection(claim)
                    or claim.get('evidence_id') not in case['required_ids']):
                raise ValueError('expected claim requires factual content and required evidence')


def percentile95(values: list[float]) -> float:
    if not values or any(not isfinite(v) or v < 0 for v in values):
        raise ValueError("empty or invalid latency samples")
    return sorted(values)[ceil(len(values) * 0.95) - 1]


def rate(correct: int, total: int) -> dict:
    return {"correct": correct, "total": total, "rate": correct / total if total else None}


def evidence_ids(artifact: dict) -> list[str]:
    return [e["id"] for claim in artifact.get("claims", []) for e in claim.get("evidence", [])]


def equivalent_record_text(expected: str, observed: Any) -> bool:
    if expected == observed:
        return True
    if not isinstance(observed, str):
        return False
    numeric = r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?'
    pattern = (r'Recorded ([A-Z0-9_]+): (' + numeric + r') (\S+) '
               r'\(event time (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\)\.')
    left, right = re.fullmatch(pattern, expected), re.fullmatch(pattern, observed)
    if left is None or right is None:
        return False
    return (all(left[index] == right[index] for index in [1, 3, 4])
            and Decimal(left[2]) == Decimal(right[2]))


def matches_expected_claim(expected: dict, claim: dict) -> bool:
    if isinstance(claim.get('asserted_value'), bool):
        return False
    if any(claim.get(field) != value for field, value in expected.items()
           if field not in {'evidence_id', 'text'}):
        return False
    if 'text' in expected and not equivalent_record_text(expected['text'], claim.get('text')):
        return False
    return expected['evidence_id'] in {item['id'] for item in claim.get('evidence', [])}


def correct_answer(gold: dict, artifact: dict) -> bool:
    if artifact.get("classification") != gold["expected_class"]:
        return False
    if gold["expected_class"] == "CLASS_A":
        return artifact.get("overall_status") == "refused" and not artifact.get("claims")
    claims = artifact.get("claims", [])
    if any(not claim.get("evidence") for claim in claims):
        return False
    if not all(any(matches_expected_claim(expected, claim) for claim in claims)
               for expected in gold.get('expected_claims', [])):
        return False
    expected_claims = gold.get('expected_claims', [])
    if not all(any(matches_expected_claim(expected, claim)
                   for expected in expected_claims) for claim in claims):
        return False
    text = " ".join(claim["text"] for claim in claims) + " " + " ".join(
        artifact.get("limitations", []))
    return (set(gold["required_ids"]) <= set(evidence_ids(artifact))
            and all(re.search(r'(?<![\w.])' + re.escape(part.casefold()) + r'(?![\w.])',
                              text.casefold()) is not None for part in gold["expected_fragments"]))


def fingerprint(value: dict) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    return hashlib.sha256(encoded.encode()).hexdigest()


def document_checks(artifact: dict, judgments: list[dict]) -> list[bool]:
    claims = artifact.get('claims', [])
    artifact_hash = fingerprint(artifact)
    checked = {}
    for judgment in judgments:
        index = judgment.get('claim_index')
        reviewer = judgment.get('reviewer')
        if (type(index) is not int or not 0 <= index < len(claims)
                or judgment.get('artifact_sha256') != artifact_hash
                or judgment.get('claim_sha256') != fingerprint(claims[index])
                or not isinstance(reviewer, str) or not reviewer.strip()):
            continue
        key = (index, judgment['id'])
        if key in checked:
            raise ValueError('duplicate claim/evidence adjudication')
        checked[key] = judgment.get('entailed') is True
    return [checked.get((index, evidence['id']), False)
            for index, claim in enumerate(claims) for evidence in claim.get('evidence', [])
            if evidence['kind'] == 'document_span']


def observations(gold: list[dict], results: dict[str, dict]) -> list[dict]:
    output = []
    for case in gold:
        run = results.get(case["qid"], {})
        artifact = run.get("artifact", {})
        cited = evidence_ids(artifact)
        allowed = set(case.get("allowed_ids", case["required_ids"]))
        foreign = set(case.get('foreign_ids', []))
        entailed = document_checks(artifact, run.get('document_adjudication', []))
        output.append({"correct": correct_answer(case, artifact), "supported": case["supported"],
                       "cited": len(cited), "precise": sum(i in allowed for i in cited),
                       "covered": len(set(cited) & set(case["required_ids"])),
                       "required": len(set(case["required_ids"])),
                       "leaks": len(set(cited) & foreign),
                       "unknown": len(set(cited) - allowed - foreign),
                       "entail_correct": sum(item is True for item in entailed),
                       "entail_total": len(entailed),
                       "edge": case.get("missing_conflict", False)})
    return output


def score(gold: list[dict], runs: list[dict]) -> dict[str, Any]:
    keys = unique_ids(gold)
    results = unique_ids(runs)
    if set(results) - set(keys):
        raise ValueError("unknown result question IDs")
    rows = observations(gold, results)
    summed = lambda key: sum(row[key] for row in rows)
    warm = [run["elapsed_s"] for run in runs if run['cold'] is False]
    cold = [run["elapsed_s"] for run in runs if run['cold'] is True]
    return {"correctness": rate(summed("correct"), len(gold)),
            "supported_answer_recall": rate(sum(r["correct"] for r in rows if r["supported"]),
                                           summed("supported")),
            "citation_precision": rate(summed("precise"), summed("cited")),
            "evidence_coverage": rate(summed("covered"), summed("required")),
            "document_entailment": rate(summed("entail_correct"), summed("entail_total")),
            "missing_conflict": rate(sum(r["correct"] for r in rows if r["edge"]), summed("edge")),
            "scope_leaks": summed("leaks"), "unknown_citations": summed('unknown'),
            "missing_answers": sum(not results.get(qid, {}).get("artifact") for qid in keys),
            "warm": {"samples": len(warm), "p95_s": percentile95(warm) if warm else None},
            "cold": {"samples": len(cold), "latencies_s": cold},
            'unclassified_latency_samples': sum(run['cold'] is None for run in runs)}


def gates(metrics: dict) -> dict[str, bool]:
    thresholds = {"correctness": 0.9, "supported_answer_recall": 0.9,
                  "citation_precision": 0.95, "evidence_coverage": 1.0,
                  "document_entailment": 0.95, "missing_conflict": 1.0}
    result = {key: metrics[key]["rate"] is not None and metrics[key]["rate"] >= minimum
              for key, minimum in thresholds.items()}
    result["scope"] = metrics["scope_leaks"] == 0 and metrics['unknown_citations'] == 0
    result["latency"] = metrics["warm"]["p95_s"] is not None and metrics["warm"]["p95_s"] <= 15
    result["complete"] = metrics["missing_answers"] == 0
    return result
