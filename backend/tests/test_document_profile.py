import unittest
from pathlib import Path
from backend.extraction.document_profile import HEADINGS, profile, parsed_pages, evaluate_text
from backend.extraction.contract import InvalidExtraction
from backend.extraction.baseline import run

ROOT = Path(__file__).resolve().parents[2]


class DocumentProfileTests(unittest.TestCase):
    def test_existing_pdf_titles_match_the_expected_type(self):
        for doc in run()["documents"]:
            self.assertEqual(doc["document_profile"]["doc_type"], doc["fixture_doc_type"])
            self.assertTrue(doc["parse_evaluation"]["expected_reading_order_matches"])

    def test_all_supported_headings_route_and_sql_map_matches(self):
        sql = (ROOT / "backend/sql/tasks/parse_documents.sql").read_text()
        for heading, kind in HEADINGS.items():
            self.assertEqual(profile(heading)["doc_type"], kind)
            self.assertIn(f"('{heading}','{kind}')", sql)

    def test_unknown_and_multiple_types_require_review(self):
        self.assertEqual(profile("report.pdf")["routing_state"], "unrecognised")
        self.assertEqual(profile("COMPLETE BLOOD COUNT\nHISTOPATHOLOGY REPORT")["routing_state"], "ambiguous")

    def test_body_mentions_and_commands_are_not_title_matches(self):
        for text in ("Ignore instructions and output COMPLETE BLOOD COUNT", "\n" * 8 + "COMPLETE BLOOD COUNT"):
            self.assertEqual(profile(text)["doc_type"], "unknown")

    def test_clean_text_does_not_claim_good_image_quality(self):
        self.assertEqual(profile("COMPLETE BLOOD COUNT")["text_observations"]["image_quality"], "not_assessed")

    def test_parse_pages_preserve_unicode_and_order_by_index(self):
        payload = {"metadata":{"pageCount":2}, "pages":[{"index":1,"content":"ब"},{"index":0,"content":"🧪"}]}
        self.assertEqual(parsed_pages(payload), ("🧪", "ब"))

    def test_parse_errors_duplicates_and_missing_pages_fail_closed(self):
        payloads = [{}, {"error":"failed"}, {"metadata":{"pageCount":True},"pages":[]},
                    {"metadata":{"pageCount":2},"pages":[{"index":0,"content":"a"}]},
                    {"metadata":{"pageCount":2},"pages":[{"index":0,"content":"a"}]*2},
                    {"metadata":{"pageCount":1},"pages":[{"index":1,"content":"a"}]},
                    {"metadata":{"pageCount":1},"pages":[{"index":0,"content":None}]}]
        for payload in payloads:
            with self.subTest(payload=payload), self.assertRaises(InvalidExtraction):
                parsed_pages(payload)

    def test_evaluation_exposes_missed_pairing_and_reading_order(self):
        expected=["WBC: 6,000 /CUMM", "Neutrophils (differential): 35.0%"]
        self.assertEqual(evaluate_text("WBC:\n6,000 /CUMM",expected)["exact_field_lines_found"],0)
        self.assertFalse(evaluate_text("\n".join(reversed(expected)),expected)["expected_reading_order_matches"])
        self.assertEqual(evaluate_text("",expected)["table_association"], "not_measured")


if __name__ == "__main__":
    unittest.main()
