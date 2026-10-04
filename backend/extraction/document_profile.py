"""Conservative, offline document routing and observable parse-quality checks.

Explicit headings only, never filenames, guessed medical facts or image scores.
SQL ingestion uses the same small heading map; a source test checks parity.
"""
from .contract import InvalidExtraction, text_observations

HEADINGS = {
    "COMPLETE BLOOD COUNT": "lab_report",
    "LABORATORY REPORT": "lab_report",
    "HISTOPATHOLOGY / HER2 REPORT": "pathology_report",
    "HISTOPATHOLOGY REPORT": "pathology_report",
    "RADIOLOGY REPORT": "imaging_report",
    "DISCHARGE SUMMARY": "discharge_summary",
    "AUTHORIZATION LETTER": "authorization_letter",
    "AUTHORISATION LETTER": "authorization_letter",
    "PRESCRIPTION": "prescription",
    "CONSENT FORM": "consent_form",
    "REFERRAL LETTER": "referral_letter",
}

HINTS = {
    "lab_report": "Keep printed units and result flags separate. Do not derive ANC.",
    "pathology_report": "Keep each finding with its explicit specimen. Do not merge specimen results or turn pending FISH into negative.",
    "imaging_report": "Keep measurement, modality and date together. Do not infer an absent measurement.",
    "discharge_summary": "Extract only documented findings; do not infer clearance from elapsed time.",
    "authorization_letter": "Retain the printed decision. Do not infer coverage approval or calculate a balance.",
    "prescription": "Transcribe only; never recommend or calculate a dose.",
    "consent_form": "Document wording does not establish active application consent; authorisation remains server-side.",
    "referral_letter": "Do not claim a referral was delivered or accepted from a draft letter.",
}


def profile(text):
    observed = text_observations(text)
    headings = text.replace("\r", "").split("\n")[:8]
    matched = sorted({HEADINGS[line.strip().upper()] for line in headings
                      if line.strip().upper() in HEADINGS})
    return {"doc_type": matched[0] if len(matched) == 1 else "unknown",
            "routing_state": "explicit_heading" if len(matched) == 1 else
                "ambiguous" if matched else "unrecognised",
            "text_observations": observed}


def parsed_pages(payload):
    """Validate a supplied AI_PARSE_DOCUMENT page-split result, no service call."""
    if not isinstance(payload, dict) or payload.get("error"):
        raise InvalidExtraction("invalid_parse_output")
    meta = payload.get("metadata")
    count = meta.get("pageCount") if isinstance(meta, dict) else None
    pages = payload.get("pages")
    if type(count) is not int or not 1 <= count <= 100 or not isinstance(pages, list) or len(pages) != count:
        raise InvalidExtraction("invalid_parse_page_count")
    by_index = {}
    for page in pages:
        if (not isinstance(page, dict) or type(page.get("index")) is not int
                or page["index"] in by_index or not 0 <= page["index"] < count
                or not isinstance(page.get("content"), str)):
            raise InvalidExtraction("invalid_parse_page")
        by_index[page["index"]] = page["content"]
    return tuple(by_index[i] for i in range(count))


def evaluate_text(text, expected_quotes):
    """Exact fixture checks, not a general OCR/table association accuracy score."""
    positions = [text.find(quote) for quote in expected_quotes]
    found = sum(text.count(quote) == 1 for quote in expected_quotes)
    return {"expected_field_count": len(expected_quotes), "exact_field_lines_found": found,
            "expected_reading_order_matches": found == len(expected_quotes)
                and positions == sorted(positions),
            "table_association": "not_measured", "image_quality": "not_assessed"}
