"""Evidence-kind dispatch — SPEC.md 10, answer_schema.json.

The one place that decides how a claim's evidence gets described to a
reader, for all three kinds: `structured` (a row, with a mandatory-when-
computed derivation note — R1, a computed value must never look printed),
`document_span` (a page with an R7 verification badge), `reference_clause`
(R6: "rendered visually distinct from patient evidence, because a guideline
clause in the same panel style as a pathology page invites reading it as a
finding about the patient" — the `is_patient_evidence` flag this module
returns is what the page uses to enforce that).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class EvidenceDescription:
    kind: str
    headline: str
    detail: str
    is_patient_evidence: bool
    is_derived: bool


def _describe_structured(evidence: dict[str, Any]) -> EvidenceDescription:
    headline = f"{evidence['table']} · {evidence['id']}"
    detail = f"Event time {evidence['event_time']} · recorded {evidence['source_recorded_at']}"
    derived = evidence.get("derived")
    if derived:
        detail += f"\n\nDerived: {derived}"
    return EvidenceDescription(
        kind="structured", headline=headline, detail=detail,
        is_patient_evidence=True, is_derived=bool(derived),
    )


def _describe_document_span(evidence: dict[str, Any]) -> EvidenceDescription:
    # page_index is DOC_PAGE's 0-based array index; readers see the
    # conventional 1-based document-viewer page number.
    page_number = evidence["page_index"] + 1
    headline = f"{evidence['doc_id']}, page {page_number}"
    detail = f"Verification: {evidence['verification_status']}"
    return EvidenceDescription(
        kind="document_span", headline=headline, detail=detail,
        is_patient_evidence=True, is_derived=False,
    )


def _describe_reference_clause(evidence: dict[str, Any]) -> EvidenceDescription:
    headline = evidence.get("document_title") or evidence["doc_id"]
    detail = f"{evidence['publisher']} · effective {evidence['effective_date']}"
    return EvidenceDescription(
        kind="reference_clause", headline=headline, detail=detail,
        is_patient_evidence=False, is_derived=False,
    )


_DESCRIBERS = {
    "structured": _describe_structured,
    "document_span": _describe_document_span,
    "reference_clause": _describe_reference_clause,
}


def describe_evidence(evidence: dict[str, Any]) -> EvidenceDescription:
    describer = _DESCRIBERS.get(evidence.get("kind"))
    if describer is None:
        raise ValueError(f"unknown evidence kind {evidence.get('kind')!r}")
    return describer(evidence)
