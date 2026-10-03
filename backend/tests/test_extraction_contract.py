"""Offline tests; unittest works without installing the project's pytest stack."""
from dataclasses import asdict, replace
import json
from pathlib import Path
import socket
import unittest
from unittest.mock import patch

from backend.extraction.contract import (
    SourcePage, ReadPass, decode_findings, reconcile, InvalidExtraction, text_observations,
)
from backend.extraction.baseline import run, score_predictions


class ExtractionContractTests(unittest.TestCase):
    def setUp(self):
        self.network = patch.object(socket.socket, "connect", side_effect=AssertionError("network_forbidden"))
        self.network.start()
        self.addCleanup(self.network.stop)
        self.page = SourcePage("PAT-DEEP-0001", "EVT-CBC-01", 0,
                               "WBC: 6,000 /CUMM\nNeutrophils (differential): 35.0%")
        self.row = dict(concept="WBC", value="6,000", unit="/CUMM", negation=False,
                        missingness_state="present", specimen_id=None, quote="WBC: 6,000 /CUMM",
                        char_start=None, char_end=None)

    def decode(self, rows=None, page=None):
        return decode_findings(json.dumps(rows if rows is not None else [self.row]),
                               page or self.page, {"WBC", "NEUTROPHIL_PCT", "HER2_IHC"})

    def test_exact_quotes_resolve_to_end_exclusive_offsets(self):
        f, = self.decode()
        self.assertEqual(self.page.text[f.char_start:f.char_end], self.row["quote"])

    def test_malformed_and_unexpected_fields_fail_closed(self):
        cases = ["null", "{}", "[", '[{"value":"6,000"}]', json.dumps([self.row] * 17)]
        for raw in cases:
            with self.subTest(raw=raw), self.assertRaises(InvalidExtraction):
                decode_findings(raw, self.page, {"WBC"})

    def test_no_silent_numeric_conversion_missingness_or_extra_fields(self):
        for changes in [{"value": 6000}, {"unit": 1}, {"negation": "false"},
                        {"value": "6000"}, {"missingness_state": "pending"},
                        {"missingness_state": "unreadable"}, {"missingness_state": "unknown"},
                        {"missingness_state": None}, {"negation": True},
                        {"value": None}, {"confidence": 99}, {"patient_id": "PAT-DC-07"}]:
            with self.subTest(changes=changes), self.assertRaises(InvalidExtraction):
                self.decode([{**self.row, **changes}])

    def test_repeated_quote_requires_explicit_position(self):
        page = replace(self.page, text=self.row["quote"] + "\n" + self.row["quote"])
        with self.assertRaisesRegex(InvalidExtraction, "ambiguous_quote"):
            self.decode(page=page)
        first = {**self.row, "char_start": 0, "char_end": len(self.row["quote"])}
        second = {**first, "char_start": len(self.row["quote"]) + 1, "char_end": len(page.text)}
        self.assertEqual(len(self.decode([first, second], page)), 2)

    def test_bad_offsets_not_coerced(self):
        for start, end in [(True, 2), (0, False), (-1, 3), (0, 9999), ("0", 3), (0.0, 3), (0, None)]:
            with self.subTest(start=start,end=end), self.assertRaises(InvalidExtraction):
                self.decode([{**self.row, "char_start": start, "char_end": end}])

    def test_specimen_must_match_the_supplied_document_context(self):
        page = replace(self.page, specimen_id="SPEC-SURGICAL-001", text="SPEC-SURGICAL-001\n" + self.page.text)
        with self.assertRaisesRegex(InvalidExtraction, "specimen_mismatch"):
            self.decode(page=page)
        with self.assertRaisesRegex(InvalidExtraction, "specimen_mismatch"):
            self.decode([{**self.row, "specimen_id": "SPEC-OUTSIDE-001"}], page)

    def test_unicode_offsets_do_not_count_utf16_surrogates(self):
        page = replace(self.page, text="📄 रिपोर्ट\n" + self.page.text)
        f, = self.decode(page=page)
        self.assertEqual(f.char_start, len("📄 रिपोर्ट\n"))
        self.assertEqual(page.text[f.char_start:f.char_end], f.quote)

    def test_two_family_agreement_and_unverified_absence(self):
        findings = self.decode()
        a = ReadPass("llama3.3-70b", self.page, findings)
        b = ReadPass("claude-haiku-4-5", self.page, findings)
        self.assertEqual(reconcile(a,b)[0]["verification_status"], "verified")
        result = reconcile(a, replace(b, findings=()))[0]
        self.assertEqual(result["verification_status"], "unverified")
        self.assertIsNone(result["value"])
        self.assertEqual(result["pass1_value"], "6,000")

    def test_agreement_cannot_cross_patients_pages_or_versions(self):
        a = ReadPass("llama3.3-70b", self.page, self.decode())
        for page in [replace(self.page, patient_id="PAT-DC-07"), replace(self.page, page_index=1),
                     replace(self.page,text=self.page.text+"\n")]:
            with self.subTest(page=page), self.assertRaisesRegex(InvalidExtraction,"source_context_mismatch"):
                reconcile(a, ReadPass("claude-haiku-4-5",page,a.findings))

    def test_same_family_or_unapproved_model_is_rejected(self):
        a = ReadPass("llama3.3-70b",self.page,self.decode())
        for model in ("llama3.3-70b", "auto"):
            with self.subTest(model=model), self.assertRaises(InvalidExtraction):
                reconcile(a, replace(a, model=model))

    def test_different_source_supported_values_are_not_asserted(self):
        page=replace(self.page,text="HER2 IHC: 1+ / 2+")
        row={**self.row,"concept":"HER2_IHC","value":"1+","unit":None,"quote":page.text}
        a=ReadPass("llama3.3-70b",page,self.decode([row],page))
        b=ReadPass("claude-haiku-4-5",page,self.decode([{**row,"value":"2+"}],page))
        result=reconcile(a,b)[0]
        self.assertEqual(result["verification_status"],"conflicting")
        self.assertIsNone(result["value"])
        self.assertEqual((result["pass1_value"],result["pass2_value"]),("1+","2+"))

    def test_filename_is_not_a_quality_signal(self):
        observations=text_observations("\ufffd\x00")
        self.assertEqual(observations["replacement_characters"],1)
        self.assertEqual(observations["unexpected_controls"],1)
        self.assertEqual(text_observations(self.page.text)["image_quality"],"not_assessed")

    def test_baseline_preserves_unknown_model_accuracy(self):
        result=run()
        self.assertEqual(result["document_count"],4)
        self.assertEqual(result["expected_field_count"],10)
        self.assertEqual(result["exact_field_lines_found"],10)
        self.assertTrue(all(r["extraction_score"] is None for r in result["documents"]))
        self.assertEqual(result["model_calls"],0)

    def test_benchmark_counts_misses_and_requires_source_hash(self):
        expected=[asdict(f) for f in self.decode()]
        pred={"text_sha256":self.page.text_sha256,"findings":[]}
        self.assertEqual(score_predictions(self.page,expected,pred)["missed_fields"],1)
        pred["findings"]=expected
        self.assertEqual(score_predictions(self.page,expected,pred)["correct_with_exact_evidence"],1)
        pred["text_sha256"]="old_text"
        with self.assertRaisesRegex(InvalidExtraction,"source_version_mismatch"):
            score_predictions(self.page,expected,pred)

    def test_altered_cbc_expected_value_is_printed_value_not_ledger(self):
        from backend.extraction.baseline import FIXTURES
        cases=json.loads(FIXTURES.read_text())["cases"]
        altered=next(c for c in cases if c["file"]=="ambiguous_cbc.pdf")
        self.assertEqual(next(f["value"] for f in altered["fields"] if f["concept"]=="PLT"),"2,60,904")


if __name__ == "__main__":
    unittest.main()
