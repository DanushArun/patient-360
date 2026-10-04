"""DETERMINISTIC Class A/B routing baseline over a dev question file (offline, no model, no Snowflake).

It mirrors ONLY the keyword scan and structure scan of
backend/sql/procedures/classify_question.sql: the RLIKE patterns are READ FROM THAT FILE at run time,
so the baseline cannot drift from the SQL. The AI_CLASSIFY fallback (step 3) is NOT run here: questions that
neither scan catches are reported as `residue_needs_llm_fallback` and are counted separately, never scored as
correct. This measures the routing rules only, on synthetic questions. It is an engineering gate, not clinical
validation, and says nothing about answer quality (outcome fields are not produced).

Usage: python -m backend.eval.harness.deterministic_routing_baseline data/eval/dev.jsonl [out.jsonl]
"""
import json
import re
import sys
from pathlib import Path

from backend.eval.harness.score_results import load, score

SQL = Path(__file__).resolve().parents[2] / "sql/procedures/classify_question.sql"


def _patterns(sql_text):
    """Return (class_a_patterns, class_b_patterns) as compiled regexes read from the SQL source."""
    body = sql_text[sql_text.index("v_q := LOWER"):sql_text.index("ELSE\n        -- 3.")]
    a_part, b_part = body.split("ELSEIF (", 1)
    def grab(part):
        out = []
        for m in re.finditer(r"RLIKE '((?:[^']|'')*)'", part):
            raw = m.group(1).replace("''", "'").replace("\\\\", "\\")
            out.append(re.compile(raw, re.DOTALL))
        return out
    return grab(a_part), grab(b_part)


def classify(question, a_pats, b_pats):
    q = question.lower()
    if any(p.fullmatch(q) for p in a_pats):
        return "A", "keyword"
    if any(p.fullmatch(q) for p in b_pats):
        return "B", "structure"
    return None, "residue_needs_llm_fallback"


def run(dev_path):
    a_pats, b_pats = _patterns(SQL.read_text())
    questions = load(dev_path)
    results, residue = [], []
    for q in questions:
        cls, method = classify(q["question"], a_pats, b_pats)
        if cls is None:
            residue.append(q["qid"])
            continue
        results.append({"qid": q["qid"], "actual_class": cls, "method": method,
                        "actual_outcome": "refused_class_a" if cls == "A" else None})
    s = score(questions, results)
    by_qid = {q["qid"]: q for q in questions}
    exp = lambda c: [q["qid"] for q in questions if q["expected_class"] == c]
    decided = {r["qid"]: r["actual_class"] for r in results}
    report = {
        "label": "DETERMINISTIC keyword+structure routing baseline; engineering gate on synthetic questions, not clinical validation; AI_CLASSIFY fallback NOT run",
        "patterns_loaded": {"class_a": len(a_pats), "class_b": len(b_pats)},
        "questions": s["questions"],
        "decided_by_rules": len(results),
        "residue_needs_llm_fallback": len(residue),
        "residue_qids": residue,
        "class_correct_of_decided": s["class_correct"],
        "class_a_total": len(exp("A")),
        "class_a_refused_by_rules": sum(1 for q in exp("A") if decided.get(q) == "A"),
        "class_a_in_residue": [q for q in exp("A") if q in residue],
        "class_a_answered_as_b_by_rules": [q for q in exp("A") if decided.get(q) == "B"],
        "class_b_total": len(exp("B")),
        "class_b_correct_by_rules": sum(1 for q in exp("B") if decided.get(q) == "B"),
        "class_b_over_refused_by_rules": [q for q in exp("B") if decided.get(q) == "A"],
        "class_b_in_residue": sum(1 for q in exp("B") if q in residue),
    }
    return report, results


def main(argv):
    if len(argv) not in (2, 3):
        print(__doc__)
        return 2
    report, results = run(argv[1])
    print(json.dumps(report, indent=2))
    if len(argv) == 3:
        Path(argv[2]).write_text("\n".join(json.dumps(r) for r in results) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
