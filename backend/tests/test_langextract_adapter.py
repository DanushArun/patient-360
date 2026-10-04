"""Actual LangExtract library with fake completions and sockets blocked."""
import importlib.util
import json
import socket
import unittest
from unittest.mock import patch

from backend.extraction.contract import SourcePage, InvalidExtraction, reconcile

HAS_LANGEXTRACT = importlib.util.find_spec("langextract") is not None


@unittest.skipUnless(HAS_LANGEXTRACT, "optional isolated LangExtract trial environment required")
class LangExtractAdapterTests(unittest.TestCase):
    def setUp(self):
        for target in ("socket.socket.connect", "socket.socket.connect_ex", "socket.getaddrinfo"):
            guard = patch(target, side_effect=AssertionError("network_forbidden"))
            guard.start()
            self.addCleanup(guard.stop)
        from langextract.core import data
        from backend.extraction.langextract_adapter import CortexContractModel, extract_page
        self.Model = CortexContractModel
        self.extract = extract_page
        self.page = SourcePage("PAT-DEEP-0001", "EVT-CBC-01", 0, "WBC: 6,000 /CUMM")
        self.attrs = {"concept": "WBC", "value": "6,000", "unit": "/CUMM",
                      "negation": False, "missingness_state": "present", "specimen_id": None}
        self.examples = [data.ExampleData(text=self.page.text, extractions=[
            data.Extraction(extraction_class="finding", extraction_text=self.page.text,
                            attributes=self.attrs)])]
        self.requests = []

    def response(self, **overrides):
        envelope = {"extractions": [{"finding": self.page.text, "finding_attributes": self.attrs}]}
        return {"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(envelope)}}], **overrides}

    def model(self, name="llama3.3-70b", response=None):
        def fake(request):
            self.requests.append(request)
            return self.response() if response is None else response
        return self.Model(name, completion=fake)

    def read(self, model):
        return self.extract(self.page, model, examples=self.examples, concepts={"WBC"})

    def test_actual_library_aligns_and_normalizes_the_mocked_finding(self):
        model = self.model()
        read = self.read(model)
        self.assertEqual(len(read.findings), 1)
        self.assertEqual(read.findings[0].value, "6,000")
        self.assertEqual(read.findings[0].char_end, len(self.page.text))
        request, = self.requests
        self.assertEqual(request["max_completion_tokens"], 1800)
        self.assertNotIn("max_tokens", request)
        self.assertNotIn("response_format", request)
        self.assertEqual(request["temperature"], 0)
        self.assertEqual(model.attempts, 1)

    def test_independent_reads_receive_same_source_not_first_answer(self):
        a, b = self.model(), self.model("claude-haiku-4-5")
        result = reconcile(self.read(a), self.read(b))
        self.assertEqual(result[0]["verification_status"], "verified")
        self.assertEqual(self.requests[0]["messages"], self.requests[1]["messages"])
        self.assertNotEqual(self.requests[0]["model"], self.requests[1]["model"])

    def test_no_default_transport_or_model_fallback(self):
        with self.assertRaisesRegex(InvalidExtraction, "live_access_disabled"):
            self.Model("llama3.3-70b")
        with self.assertRaisesRegex(InvalidExtraction, "unapproved_model"):
            self.Model("auto", completion=lambda request: self.response())

    def test_no_second_call_or_batch_after_budget_consumed(self):
        model = self.model()
        list(model.infer(["source"]))
        with self.assertRaisesRegex(InvalidExtraction, "one_completion_limit"):
            list(model.infer(["source"]))
        with self.assertRaisesRegex(InvalidExtraction, "one_completion_limit"):
            list(self.model().infer(["one", "two"]))
        self.assertEqual(len(self.requests), 1)

    def test_completion_failure_is_sanitized_and_not_retried(self):
        def failure(request):
            raise TimeoutError("secret-token and source text must not escape")
        model = self.Model("llama3.3-70b", completion=failure)
        with self.assertRaisesRegex(InvalidExtraction, "^completion_failed_no_retry$"):
            list(model.infer(["source"]))
        self.assertEqual(model.attempts, 1)

    def test_malformed_truncated_and_refused_responses_fail_closed(self):
        for response in [{}, {"choices": []}, {"choices": [None]}, {"choices": {"0": {}}},
                         {"choices": [{"finish_reason": "stop", "message": None}]},
                         {"choices": [{"finish_reason": "length", "message": {"content": "{}"}}]},
                         {"choices": [{"finish_reason": "stop", "message": {"content": "{bad"}}]},
                         {"choices": [{"finish_reason": "stop", "message": {"content": '{"extractions": []}', "refusal": "no"}}]}]:
            with self.subTest(response=response), self.assertRaises(InvalidExtraction):
                list(self.model(response=response).infer(["source"]))

    def test_claude_missing_finish_reason_requires_valid_json(self):
        response = self.response()
        del response["choices"][0]["finish_reason"]
        self.assertEqual(len(self.read(self.model("claude-haiku-4-5", response)).findings), 1)

    def test_mismatched_or_unlocated_quote_is_not_an_accepted_finding(self):
        from langextract.core import data
        for quote, alignment in [("WBC: 6000 /CUMM", None), (self.page.text, data.AlignmentStatus.MATCH_FUZZY)]:
            ext = data.Extraction(extraction_class="finding", extraction_text=quote,
                                 attributes=self.attrs, alignment_status=alignment)
            model = self.model()
            list(model.infer(["mock source"]))
            with patch("backend.extraction.langextract_adapter.lx.extract", return_value=data.AnnotatedDocument(extractions=[ext])):
                with self.assertRaisesRegex(InvalidExtraction, "source_alignment_not_exact"):
                    self.read(model)

    def test_alignment_must_not_silently_drop_a_returned_finding(self):
        from langextract.core import data
        model = self.model()
        list(model.infer(["mock source"]))
        with patch("backend.extraction.langextract_adapter.lx.extract",
                   return_value=data.AnnotatedDocument(extractions=[])):
            with self.assertRaisesRegex(InvalidExtraction, "extraction_count_changed"):
                self.read(model)

    def test_actual_library_can_return_no_findings_without_inventing_a_value(self):
        response = self.response()
        response["choices"][0]["message"]["content"] = '{"extractions": []}'
        self.assertEqual(self.read(self.model(response=response)).findings, ())

    def test_usage_is_not_fabricated_when_absent(self):
        model = self.model()
        self.read(model)
        self.assertNotIn("tokens", model.observations[0])
        self.assertNotIn("content", model.observations[0])


if __name__ == "__main__":
    unittest.main()
