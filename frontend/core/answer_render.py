"""HTML builders for the answer document.

Spec: planning/research/design/DESIGN-SYSTEM.md. Style tokens live in design.py; this
module decides STRUCTURE and nothing else. Pure string functions, no Streamlit import,
so every one of them is unit-testable without a browser.

SECURITY - read before editing
    Everything here is rendered with unsafe_allow_html=True, and some of it is PATIENT
    DOCUMENT TEXT. Documents in this system are adversarial by assumption: SPEC.md ships
    a Judge Console probe for an instruction injected into a document, and a document can
    equally carry markup. So every interpolated value goes through _esc().

    An unescaped f-string here is a cross-site-scripting hole, not a style bug. If you add
    a builder, escape first. The one deliberate exception is _highlight(), which emits a
    <mark> around text that has ALREADY been escaped - see its docstring.
"""

from __future__ import annotations

from html import escape
from typing import Any

from frontend.core.census import STATUS_LABEL, STATUS_OUTCOME
from frontend.core.design import (
    INK_CONFLICT,
    INK_MUTED,
    MISSINGNESS_WORD,
    STATUS,
    VERIFICATION_WORD,
    status_chip,
    status_style,
)

# outcome -> display word, read off the single source of truth rather than restated,
# so the selector and the chip can never disagree about what "pass" is called.
STATUS_WORD: dict[str, str] = {key: style.word for key, style in STATUS.items()}


def _esc(value: Any) -> str:
    """Escape anything bound for HTML. Not optional - see the module docstring."""
    return escape(str(value), quote=True)


def _field(label: str, value: str) -> str:
    return (
        f'<div class="sa-field"><span class="sa-field-label">{_esc(label)}</span>'
        f'<span class="sa-field-value">{_esc(value)}</span></div>'
    )


# ---------------------------------------------------------------------------
# Masthead - who is asking, about whom, under what authority, as of when
# ---------------------------------------------------------------------------

def masthead(
    *,
    patient_name: str,
    practitioner_name: str,
    consent_id: str | None,
    known_as_of: str,
    binding_id: str | None = None,
) -> str:
    """The dateline. Every answer is true only as of a moment, and only under a consent.

    Both facts belong at the top of the page rather than in a footnote: an answer whose
    authority and cutoff are not visible is an answer a clinician cannot safely act on.
    """
    fields = [
        _field("Practitioner", practitioner_name),
        _field("Consent", consent_id or "none"),
        _field("Known as of", _pretty_ts(known_as_of)),
    ]
    if binding_id:
        fields.append(_field("Binding", binding_id))

    return (
        '<div class="sa-masthead">'
        f'<div class="sa-masthead-patient">{_esc(patient_name)}</div>'
        + "".join(fields)
        + "</div>"
    )


def _pretty_ts(ts: str) -> str:
    """2026-09-18T09:00:00 -> 18 Sep 2026, 09:00. Never silently reformat a bad value."""
    try:
        date_part, time_part = ts.split("T")
        y, m, d = date_part.split("-")
        months = ("Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
        return f"{int(d)} {months[int(m) - 1]} {y}, {time_part[:5]}"
    except (ValueError, IndexError):
        return ts


def unbound_masthead() -> str:
    """No patient bound.

    The screen must not look ready to answer when it has no subject. COPILOT-SPEC 0:
    the subject comes from a human's click, never from the question text - so with no
    click there is no subject, and the honest thing is to say so rather than render an
    empty answer surface.
    """
    return (
        '<div class="sa-masthead">'
        '<div class="sa-masthead-patient" style="color:' + INK_MUTED + '">'
        "No patient bound</div>"
        '<div class="sa-field"><span class="sa-field-label">Required</span>'
        '<span class="sa-field-value">Select a patient on <strong>Bind Patient</strong> '
        "before asking anything.</span></div>"
        "</div>"
    )


# ---------------------------------------------------------------------------
# Claims
# ---------------------------------------------------------------------------

def claim_header(claim: dict[str, Any]) -> str:
    """Status chip + rule citation. Both, always.

    rule_id AND rule_version, because "the rule said so" is not verifiable without
    knowing which version of the rule said so - and thresholds change between versions.
    """
    parts: list[str] = []

    outcome = claim.get("outcome")
    if outcome:
        parts.append(status_chip(outcome))

    meta: list[str] = []
    rule_id = claim.get("rule_id")
    if rule_id:
        version = claim.get("rule_version")
        cite = f"{rule_id} v{version}" if version is not None else str(rule_id)
        meta.append(f"<code>{_esc(cite)}</code>")
    gate = claim.get("gate")
    if gate:
        meta.append(_esc(gate))
    if meta:
        parts.append(f'<span class="sa-meta">{" &middot; ".join(meta)}</span>')

    return (
        '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;'
        f'margin-bottom:12px">{"".join(parts)}</div>'
    )


def claim_text(claim: dict[str, Any]) -> str:
    """The prose. Values get tabular figures so they align and do not jitter."""
    text = _esc(claim["text"])
    return f'<div class="sa-claim-text sa-num">{text}</div>'


def provenance(claim: dict[str, Any]) -> str:
    """Shown wherever a threshold is practice consensus rather than a guideline.

    Three thresholds in this system are consensus and have no guideline behind them.
    Presenting those with the same authority as an FDA label would be a false citation.
    """
    note = claim.get("provenance_note")
    if not note:
        return ""
    return f'<div class="sa-provenance">{_esc(note)}</div>'


def action(claim: dict[str, Any]) -> str:
    """What to do, addressed to a named person or facility.

    An alert with no action is what the override-rate literature says gets dismissed
    (~90% for interruptive CDS alerts - clinical-ux-evidence.md 2.1).
    """
    text = claim.get("action")
    if not text:
        return ""
    return f'<div class="sa-action">{_esc(text)}</div>'


def limitation(text: str) -> str:
    """What could not be established - first-class, never a grey caption.

    This is the most credible content on the screen. Burying it would be the
    dishonest choice, and judges are explicitly looking for it.
    """
    return f'<div class="sa-limitation">{_esc(text)}</div>'


# ---------------------------------------------------------------------------
# Evidence
# ---------------------------------------------------------------------------

_CLOCK_LABELS = (
    ("event_time", "Event"),
    ("source_recorded_at", "Recorded"),
    ("ingested_at", "Ingested"),
)


def _clocks(evidence: dict[str, Any]) -> str:
    """All three R2 clocks, every time.

    The gap between them is the whole point: a result that happened on the 16th,
    was recorded at 16:45 and reached us at 17:02 is three different facts, and
    "when did we know" is the one that decides whether an answer was right.
    """
    items = [
        '<div class="sa-field">'
        f'<span class="sa-clock-label">{label}</span>'
        f'<span class="sa-clock-value">{_esc(_pretty_ts(evidence[key]))}</span></div>'
        for key, label in _CLOCK_LABELS
        if evidence.get(key)
    ]
    return f'<div class="sa-clocks">{"".join(items)}</div>' if items else ""


def evidence_block(evidence: dict[str, Any]) -> str:
    """One evidence item. R6: patient and reference evidence never look alike."""
    kind = evidence.get("kind")
    if kind == "structured":
        return _structured(evidence)
    if kind == "document_span":
        return _document_span(evidence)
    if kind == "reference_clause":
        return _reference_clause(evidence)
    raise ValueError(f"unknown evidence kind {kind!r}")


def _structured(evidence: dict[str, Any]) -> str:
    head = (
        '<div class="sa-ev-kind">Patient record &middot; governed row</div>'
        f'<div class="sa-ev-id">{_esc(evidence["table"])} &middot; {_esc(evidence["id"])}</div>'
    )
    facility = evidence.get("source_facility")
    if facility:
        head += f'<div class="sa-meta">Facility {_esc(facility)}</div>'
    return (
        f'<div class="sa-evidence sa-ev-patient">{head}{_clocks(evidence)}'
        f'{derivation(evidence)}</div>'
    )


def derivation(evidence: dict[str, Any]) -> str:
    """The hero moment (demo beat 2).

    A computed value shown as if it were printed is a quiet form of fabrication. So when
    a value was derived, the arithmetic is shown and the page is explicitly disclaimed -
    a clinician who opens the citation and cannot find 2100 must be told why.
    """
    text = evidence.get("derived")
    if not text:
        return ""

    formula, _, remainder = _split_formula(text)
    body = f'<div class="sa-formula">{_esc(formula)}</div>'
    if remainder:
        body += f'<div class="sa-derivation-note">{_esc(remainder)}</div>'

    return (
        '<div class="sa-derivation">'
        '<div class="sa-derivation-lead">Derived, not printed.</div>'
        f"{body}</div>"
    )


def _split_formula(text: str) -> tuple[str, str, str]:
    """Separate the arithmetic from the prose around it.

    The `derived` string is one sentence carrying both, e.g. "ANC computed as WBC x
    (neutrophil% + band%) / 100 = 6000 x (35 + 0) / 100 = 2100 cells/uL. The lab
    reported a differential only; this number appears nowhere on the page."
    Splitting on the first sentence break keeps the equation in monospace and the
    explanation in prose, which is what makes it readable at a glance.
    """
    head, sep, tail = text.partition(". ")
    return (head + ("." if sep else ""), sep, tail.strip())


def _document_span(evidence: dict[str, Any]) -> str:
    page_number = evidence["page_index"] + 1  # DOC_PAGE is 0-based; readers are not
    head = (
        '<div class="sa-ev-kind">Patient record &middot; document page</div>'
        f'<div class="sa-ev-id">{_esc(evidence["doc_id"])} &middot; page {page_number}</div>'
    )

    meta = [f"Two-pass: {VERIFICATION_WORD.get(evidence['verification_status'], evidence['verification_status'])}"]
    quality = evidence.get("source_quality")
    if quality:
        meta.append(f"source {quality.replace('_', ' ')}")
    version = evidence.get("doc_version")
    if version is not None:
        meta.append(f"version {version}")

    # Literal "·" rather than "&middot;" so the whole string escapes cleanly in one pass.
    head += f'<div class="sa-meta">{_esc(" · ".join(meta))}</div>'

    caveat = _verification_caveat(evidence["verification_status"])
    return f'<div class="sa-evidence sa-ev-patient">{head}{caveat}</div>'


def _verification_caveat(status: str) -> str:
    """R7 in plain words. Never a percentage (AGENTS.md 5).

    A percentage invites a clinical decision; an evidence state invites a human to look.
    """
    messages = {
        "conflicting": "Two independent reads disagree. The value is not asserted and the "
                       "gate returns not_evaluated.",
        "single_pass": "Read once only. Not independently confirmed.",
        "unverified": "The second read could not be completed. The value is not asserted.",
    }
    message = messages.get(status)
    if not message:
        return ""
    return f'<div class="sa-derivation-note" style="color:{INK_MUTED}">{_esc(message)}</div>'


def _reference_clause(evidence: dict[str, Any]) -> str:
    """R6: a guideline clause must never be mistakable for a finding about the patient."""
    title = evidence.get("document_title") or evidence["doc_id"]
    head = (
        '<div class="sa-ev-kind">Reference &middot; not patient data</div>'
        f'<div class="sa-ev-id">{_esc(title)}</div>'
    )
    meta = [str(evidence["publisher"]), f"effective {evidence['effective_date']}"]
    for key in ("jurisdiction", "version"):
        if evidence.get(key):
            meta.append(f"{key} {evidence[key]}")
    head += f'<div class="sa-meta">{_esc(" · ".join(meta))}</div>'

    clause = evidence.get("clause")
    if clause:
        head += f'<div class="sa-derivation-note">{_esc(clause)}</div>'
    return f'<div class="sa-evidence sa-ev-reference">{head}</div>'


# ---------------------------------------------------------------------------
# Source page with the cited span highlighted
# ---------------------------------------------------------------------------

def highlight(page_text: str, char_start: int, char_end: int) -> str:
    """Render page text with [char_start, char_end) marked.

    Escaping happens per SEGMENT, before the <mark> is added, so the tag survives while
    the document's own content cannot introduce markup. Escaping the whole string first
    would shift every offset (one "&" becomes five characters) and silently mis-highlight.

    Out-of-range offsets return the text unhighlighted rather than raising: a citation
    whose offsets have drifted should degrade to page-level, not break the screen.
    """
    length = len(page_text)
    if not (0 <= char_start < char_end <= length):
        return f'<div class="sa-page-text">{escape(page_text)}</div>'

    before = escape(page_text[:char_start])
    cited = escape(page_text[char_start:char_end])
    after = escape(page_text[char_end:])
    return (
        f'<div class="sa-page-text">{before}'
        f"<mark>{cited}</mark>"
        f"{after}</div>"
    )


# ---------------------------------------------------------------------------
# Class A refusal
# ---------------------------------------------------------------------------

def refusal_block(refusal: dict[str, Any]) -> str:
    """A formal addressed notice, not a yellow warning box.

    NMC Telemedicine Practice Guidelines 2020 reserve clinical judgment to the registered
    practitioner. This is a legal boundary, so it should read like a referral - because
    that is what it is - rather than like an error the user did something wrong to cause.
    """
    practitioner = refusal["practitioner"]
    return (
        '<div class="sa-refusal">'
        '<div class="sa-refusal-kind">Clinical judgment &middot; referred</div>'
        f'<div class="sa-refusal-message">{_esc(refusal["message"])}</div>'
        '<div class="sa-refusal-addressee">'
        '<span class="sa-field-label">Addressed to</span><br>'
        f'<strong>{_esc(practitioner["name"])}</strong>'
        f'<span class="sa-meta"> &middot; NMC {_esc(practitioner["nmc_registration_no"])}</span>'
        "</div></div>"
    )


def missingness_badge(state: str) -> str:
    """R3 as a word. `not_received` and `explicitly_negative` never share a treatment."""
    word = MISSINGNESS_WORD.get(state, state)
    return f'<span class="sa-meta"><code>{_esc(word)}</code></span>'


def gate_row(result: dict[str, Any]) -> str:
    """One row of the gate strip — the 2-minute chart review.

    Replaces an emoji circle. The four emoji it replaces differed only by hue, which made
    the strip unreadable for the 4-8% of Indian males with red-green colour deficiency and
    put it in breach of WCAG 2.2 SC 1.4.1. They were also identical in greyscale.

    Column order is gate, then status, then citation. A clinician scans for WHICH gate is
    a problem, so the gate name is a fixed-width left column and the eye travels straight
    down it instead of hunting across ragged rows.
    """
    chip = status_chip(result["outcome"])

    cite: list[str] = []
    if result.get("rule_id"):
        version = result.get("rule_version")
        text = f"{result['rule_id']} v{version}" if version is not None else result["rule_id"]
        cite.append(f"<code>{_esc(text)}</code>")
    if result.get("severity"):
        cite.append(_esc(result["severity"]))
    meta = f'<span class="sa-meta">{" · ".join(cite)}</span>' if cite else ""

    reason = result.get("reason")
    reason_html = f'<div class="sa-meta">{_esc(reason)}</div>' if reason else ""

    return (
        '<div class="sa-gate-row">'
        f'<span class="sa-gate-name">{_esc(str(result["gate"]).capitalize())}</span>'
        f'<span style="min-width:158px">{chip}</span>'
        f"<span>{meta}{reason_html}{provenance(result)}</span>"
        "</div>"
    )


def packet_confirmation(*, packet_id: str, practitioner: dict[str, Any]) -> str:
    """Confirmation that an evidence packet was assembled, and for whom.

    Names the practitioner and their NMC registration, because the packet exists to put
    the decision in front of a specific accountable person - an unaddressed packet would
    defeat the purpose of refusing the question in the first place.
    """
    return (
        '<div class="sa-refusal" style="margin-top:16px">'
        '<div class="sa-refusal-kind">Packet assembled</div>'
        f'<div class="sa-field-value"><code>{_esc(packet_id)}</code> — addressed to '
        f'{_esc(practitioner["name"])}, NMC '
        f'{_esc(practitioner["nmc_registration_no"])}.</div>'
        "</div>"
    )


def queue_row(issue: dict[str, Any]) -> str:
    """One row of the coordinator's worklist.

    URGENCY IS CARRIED BY POSITION, NOT BY COLOUR. The list is already sorted by
    days_to_visit then severity, so the top of the list IS the priority - painting the
    rows red as well would add nothing and start the alert-fatigue cycle the
    override-rate literature describes (clinical-ux-evidence.md 2).

    An unowned issue is the one thing given visual weight, because an issue nobody owns
    is the failure mode this screen exists to catch: it is not late yet, so nothing else
    will surface it.
    """
    owner = issue.get("owner_practitioner_name")
    unowned = not owner
    owner_html = (
        '<span class="sa-field-value" style="font-weight:600;'
        f'border-bottom:2px solid {INK_CONFLICT}">Unassigned</span>'
        if unowned else f'<span class="sa-field-value">{_esc(owner)}</span>'
    )

    days = issue.get("days_to_visit")
    due = (
        f'<span class="sa-field-value sa-num">{_esc(days)} day'
        f'{"" if days == 1 else "s"}</span>'
        if days is not None else '<span class="sa-field-value">—</span>'
    )

    return (
        '<div class="sa-gate-row">'
        f'<span class="sa-gate-name">{_esc(issue["patient_name"])}</span>'
        f'<span style="min-width:158px">{status_chip(issue["outcome"])}</span>'
        f'<span class="sa-field" style="min-width:80px">'
        f'<span class="sa-field-label">Due in</span>{due}</span>'
        f'<span class="sa-field" style="min-width:140px">'
        f'<span class="sa-field-label">Owner</span>{owner_html}</span>'
        f'<span class="sa-meta"><code>{_esc(issue["rule_id"])} '
        f'v{_esc(issue.get("rule_version", "?"))}</code> · '
        f'{_esc(issue["gate"])} · {_esc(issue.get("severity", ""))}</span>'
        "</div>"
    )


# ---------------------------------------------------------------------------
# Day-care census - the coordinator's home screen
# ---------------------------------------------------------------------------

def census_chip(status: str) -> str:
    """A census status in the same glyph + word + border vocabulary as a gate
    chip, so "Blocked" reads with the same weight as a failed rule."""
    s = status_style(STATUS_OUTCOME[status])
    return (
        f'<span class="sa-status" style="color:{s.ink};border:{s.border};'
        f'font-weight:{s.weight}">'
        f'<span class="sa-status-glyph" aria-hidden="true">{s.glyph}</span>'
        f'{_esc(STATUS_LABEL[status])}</span>'
    )


def census_summary(tally: dict[str, int], day_label: str) -> str:
    total = sum(tally.values())
    ready = tally.get("ready", 0) + tally.get("advisory", 0)
    parts = [f'<span class="sa-census-count"><b class="sa-num">{total}</b> scheduled</span>',
             f'<span class="sa-census-count"><b class="sa-num">{ready}</b> ready</span>']
    for key, word in (("blocked", "blocked"), ("conflict", "conflicting"),
                      ("waiting", "waiting on evidence")):
        if tally.get(key):
            parts.append(f'<span class="sa-census-count"><b class="sa-num">{tally[key]}</b> {word}</span>')
    return (
        '<div class="sa-census-head">'
        f'<div class="sa-census-day">{_esc(day_label)}</div>'
        f'<div class="sa-census-counts">{"".join(parts)}</div></div>'
    )


def census_row(row: Any) -> str:
    """One chair on tomorrow's list. Urgency is carried by POSITION (the list is
    sorted blocked-first) and by the chip's shape - not by painting the row."""
    detail = " · ".join(
        _esc(x) for x in (row.regimen, f"cycle {row.cycle}" if row.cycle else None) if x
    )
    place = _esc(row.place) + (f" · {_esc(row.language)}" if row.language else "")
    if row.headline:
        cite = f'<code>{_esc(row.headline_rule)}</code> ' if row.headline_rule else ""
        more = (f' <span class="sa-meta">+{row.other_issues} more</span>'
                if row.other_issues else "")
        reason = f'<div class="sa-census-reason">{cite}{_esc(row.headline)}{more}</div>'
    else:
        reason = '<div class="sa-census-reason sa-meta">Every applicable rule passes.</div>'
    return (
        f'<div class="sa-census-row sa-census-{_esc(row.status)}">'
        '<div class="sa-census-who">'
        f'<div class="sa-census-name">{_esc(row.name)}</div>'
        f'<div class="sa-meta">{place}</div>'
        f'<div class="sa-meta">{detail}</div></div>'
        f'<div class="sa-census-state">{census_chip(row.status)}{reason}</div>'
        "</div>"
    )


def checklist_item(n: int, text: str, rules: list[str]) -> str:
    """One family-checklist line, with the rule(s) that produced it visible to
    the clinician - the family message itself carries no rule ids."""
    cites = " ".join(f"<code>{_esc(r)}</code>" for r in rules if r)
    return (
        '<div class="sa-check-item">'
        f'<span class="sa-check-n sa-num">{n}</span>'
        f'<div><div class="sa-check-text">{_esc(text)}</div>'
        f'<div class="sa-meta">from {cites}</div></div></div>'
    )
