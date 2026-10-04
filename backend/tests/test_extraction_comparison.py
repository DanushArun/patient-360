"""Scoring tests use deliberately empty predictions, not purported model results."""
from copy import deepcopy
import unittest
from backend.extraction.baseline import run
from backend.extraction.compare import compare
from backend.extraction.contract import InvalidExtraction


class ExtractionComparisonTests(unittest.TestCase):
    def predictions(self):
        return {d["doc_id"]:{"text_sha256":d["text_sha256"],"findings":[]}
                for d in run()["documents"]}

    def test_empty_predictions_are_ten_misses_not_perfect_accuracy(self):
        result=compare({arm:self.predictions() for arm in ("A","B","C")})
        for arm in result["arms"].values():
            self.assertEqual(arm["counts"]["missed_fields"],10)
            self.assertEqual(arm["counts"]["correct_with_exact_evidence"],0)
        self.assertEqual(result["cost_comparison"],"not_measured")

    def test_changed_source_hash_does_not_produce_a_comparison_score(self):
        inputs={arm:self.predictions() for arm in ("A","B","C")}
        inputs["C"]["EVT-CBC-01"]["text_sha256"]="wrong"
        result=compare(inputs)
        self.assertEqual(result["arms"]["C"]["status"],"invalid_predictions")
        self.assertIsNone(result["arms"]["C"]["counts"])

    def test_missing_comparison_arm_is_rejected(self):
        with self.assertRaisesRegex(InvalidExtraction,"three_comparison_arms_required"):
            compare({"C":self.predictions()})


if __name__ == "__main__":
    unittest.main()
