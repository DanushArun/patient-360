"""Strict, dependency-free candidate contract for the extraction comparison.

This is an offline validation boundary, NOT an authorization mechanism or a
clinical rule engine. There are no transports, SQL writes or numerical clinical
calculations here. A future runtime adapter must obtain scoped content through
the existing binding/consent procedures before calling any model.

Offsets are zero-based Unicode code points, end-exclusive (not UTF-16 bytes).
Never normalize source text before resolving a span against its text hash.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json


class InvalidExtraction(ValueError):
    """Stable reason code only: do not leak source text in error messages."""


@dataclass(frozen=True)
class SourcePage:
    patient_id: str
    doc_id: str
    page_index: int
    text: str
    specimen_id: str | None = None

    def __post_init__(self):
        if not self.patient_id or not self.doc_id:
            raise InvalidExtraction("source_identity_missing")
        if type(self.page_index) is not int or self.page_index < 0:
            raise InvalidExtraction("invalid_page_index")
        if not isinstance(self.text, str) or not self.text.strip() or len(self.text) > 12000:
            raise InvalidExtraction("page_size_limit")

    @property
    def text_sha256(self):
        return hashlib.sha256(self.text.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class Finding:
    concept: str
    value: str | None
    unit: str | None
    negation: bool
    missingness_state: str
    specimen_id: str | None
    quote: str
    char_start: int
    char_end: int

    @property
    def context_key(self):
        # Repeated results and separate specimens must never collapse by concept.
        return (self.concept, self.specimen_id, self.char_start, self.char_end)


FIELDS = frozenset(Finding.__dataclass_fields__)
STATES = frozenset({"present", "explicitly_negative", "pending", "unreadable"})


def decode_findings(raw: str, page: SourcePage, concepts: set[str]) -> tuple[Finding, ...]:
    """Reject the whole pass on malformed output. No fuzzy quote matching.

    Accept only an optional *outer* JSON fence; embedded backticks are source
    content. Missing offsets are resolved only for a single exact occurrence.
    Quote presence proves location, not medical meaning or label/value entailment.
    """
    if not isinstance(raw, str) or len(raw) > 64000:
        raise InvalidExtraction("response_size_limit")
    raw = raw.strip()
    if raw.startswith("```json\n") and raw.endswith("\n```"):
        raw = raw[8:-4]
    try:
        rows = json.loads(raw)
    except (ValueError, TypeError):
        raise InvalidExtraction("invalid_json") from None
    if not isinstance(rows, list) or len(rows) > 16:
        raise InvalidExtraction("invalid_findings_array")
    out = []
    seen = set()
    for row in rows:
        if not isinstance(row, dict) or set(row) != FIELDS:
            raise InvalidExtraction("invalid_fields")
        if not isinstance(row["concept"], str) or row["concept"] not in concepts:
            raise InvalidExtraction("unsupported_concept")
        if type(row["negation"]) is not bool:
            raise InvalidExtraction("invalid_negation")
        if not isinstance(row["missingness_state"], str) or row["missingness_state"] not in STATES:
            raise InvalidExtraction("invalid_missingness")
        for key in ("value", "unit", "specimen_id"):
            if row[key] is not None and (not isinstance(row[key], str) or not row[key].strip()):
                raise InvalidExtraction("invalid_" + key)
        state = row["missingness_state"]
        if state in {"pending", "unreadable"} and row["value"] is not None:
            raise InvalidExtraction("missing_result_has_value")
        if state == "present" and (row["value"] is None or row["negation"]):
            raise InvalidExtraction("invalid_present_result")
        if row["negation"] != (state == "explicitly_negative"):
            raise InvalidExtraction("negation_state_mismatch")
        if page.specimen_id is not None and row["specimen_id"] != page.specimen_id:
            raise InvalidExtraction("specimen_mismatch")
        if row["specimen_id"] is not None and row["specimen_id"] not in page.text:
            raise InvalidExtraction("specimen_not_on_page")
        quote = row["quote"]
        if not isinstance(quote, str) or not quote.strip():
            raise InvalidExtraction("quote_missing")
        start, end = row["char_start"], row["char_end"]
        if start is None and end is None:
            start = page.text.find(quote)
            if start < 0:
                raise InvalidExtraction("quote_not_on_page")
            if page.text.find(quote, start + 1) != -1:
                raise InvalidExtraction("ambiguous_quote")
            end = start + len(quote)
        if type(start) is not int or type(end) is not int or not 0 <= start < end <= len(page.text):
            raise InvalidExtraction("invalid_span")
        if page.text[start:end] != quote:
            raise InvalidExtraction("span_quote_mismatch")
        if any(row[k] is not None and row[k] not in quote for k in ("value", "unit")):
            raise InvalidExtraction("value_or_unit_not_in_quote")
        finding = Finding(**{**row, "char_start": start, "char_end": end})
        if finding.context_key in seen:
            raise InvalidExtraction("duplicate_finding_context")
        seen.add(finding.context_key)
        out.append(finding)
    return tuple(out)


@dataclass(frozen=True)
class ReadPass:
    # Set by the runner, never accepted from a model-generated JSON object.
    model: str
    page: SourcePage
    findings: tuple[Finding, ...]


MODEL_FAMILIES = {"llama3.3-70b": "llama", "claude-haiku-4-5": "claude"}


def reconcile(a: ReadPass, b: ReadPass) -> list[dict]:
    """Conservative independent-reader comparison; does not persist assertions.

    Caller must perform genuinely independent model calls. This function cannot
    prove prompt independence or correctness of the shared OCR text.
    """
    if a.page != b.page:
        raise InvalidExtraction("source_context_mismatch")
    if a.model not in MODEL_FAMILIES or b.model not in MODEL_FAMILIES:
        raise InvalidExtraction("unapproved_model")
    if MODEL_FAMILIES[a.model] == MODEL_FAMILIES[b.model]:
        raise InvalidExtraction("independent_families_required")
    # Revalidate even dataclass inputs so direct construction is not a bypass.
    from dataclasses import asdict
    concepts = {f.concept for read in (a, b) for f in read.findings}
    for read in (a, b):
        decode_findings(json.dumps([asdict(f) for f in read.findings]), read.page, concepts)
    left = {f.context_key: f for f in a.findings}
    right = {f.context_key: f for f in b.findings}
    results = []
    for key in sorted(left.keys() | right.keys(), key=repr):
        fa, fb = left.get(key), right.get(key)
        verified = fa is not None and fa == fb
        status = "verified" if verified else "conflicting" if fa and fb else "unverified"
        f = fa or fb
        results.append({
            "patient_id": a.page.patient_id, "doc_id": a.page.doc_id,
            "page_index": a.page.page_index, "text_sha256": a.page.text_sha256,
            "concept": f.concept, "specimen_id": f.specimen_id,
            "char_start": f.char_start, "char_end": f.char_end,
            "value": f.value if verified else None,
            "unit": f.unit if verified else None,
            "missingness_state": f.missingness_state if verified else "conflicting",
            "verification_status": status,
            "pass1_value": fa.value if fa else None, "pass2_value": fb.value if fb else None,
        })
    return results


def text_observations(text: str) -> dict:
    """Observable defects only; clean text does NOT imply a readable source image."""
    if not isinstance(text, str):
        raise InvalidExtraction("invalid_page_text")
    controls = sum(ord(c) < 32 and c not in "\n\r\t" for c in text)
    return {"characters": len(text), "nonempty_lines": sum(bool(s.strip()) for s in text.splitlines()),
            "replacement_characters": text.count("\ufffd"), "unexpected_controls": controls,
            "empty": not bool(text.strip()), "image_quality": "not_assessed"}
