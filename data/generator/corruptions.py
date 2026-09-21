"""Corruption scenario 13 — SPEC.md 9: "Rotated/low-quality photo with a
misread value." Tests R7; correct downstream behaviour is "two-pass
disagrees -> refuses to assert." WORK-PLAN.md names this as a Day 1-2
deep-case deliverable: the one deliberately ambiguous CBC page where the
platelet count is genuinely hard to read.

This module produces the corrupted source document and a typed statement of
both plausible readings. It does not implement R7's two-pass extraction or
the disagreement logic itself — those are a later Stream 1 task that
consumes `resolve_platelet_ambiguity()` as its fixture.

The corruption is scoped to exactly one digit, chosen by a fixed priority
of visually-plausible confusions for a rotated or low-quality capture:
6/9 (a 180-degree rotation, the mechanism the scenario name actually
describes) ranks first, then 1/7 and 0/8 (capture-quality confusions) as
fallbacks for platelet counts that have no 6 or 9. The rightmost matching
digit is corrupted, not an arbitrary one — a single misread glyph should
change the value by a few units, not its whole order of magnitude, or a
human reviewer would catch it on sight and the ambiguity would not be
genuine.
"""

from __future__ import annotations

from dataclasses import dataclass

from data.generator._pdf_render import new_pdf, render_line
from data.generator.documents import indian_digit_grouping
from data.generator.ledger import ClinicalEvent, Ledger

# Priority order: the mechanism most consistent with "rotated/low-quality
# photo" (SPEC.md 9) is tried first. Each pair is one direction only — a
# value containing digit `d` is misread as `m`, never the reverse in the
# same scan.
_MISREAD_PAIRS: tuple[tuple[str, str, str], ...] = (
    ("6", "9", "rotation"),
    ("9", "6", "rotation"),
    ("1", "7", "low-quality capture"),
    ("7", "1", "low-quality capture"),
    ("0", "8", "smudge"),
    ("8", "0", "smudge"),
)


@dataclass(frozen=True)
class AmbiguousReading:
    true_value: int
    misread_value: int
    digit_position: int
    true_digit: str
    misread_digit: str
    mechanism: str


def resolve_platelet_ambiguity(true_value: int) -> AmbiguousReading:
    """Finds the highest-priority plausible misread of `true_value`'s
    rightmost confusable digit. Raises `ValueError` if no digit in the
    value has a defined confusion pair — a value built entirely from
    digits 2/3/4/5 cannot be corrupted this way, and pretending it found
    an ambiguity anyway would defeat the point of this fixture."""
    digits = str(true_value)

    for digit, misread, mechanism in _MISREAD_PAIRS:
        positions = [i for i, ch in enumerate(digits) if ch == digit]
        if not positions:
            continue
        pos = positions[-1]  # rightmost — keeps the misread close in magnitude
        misread_digits = digits[:pos] + misread + digits[pos + 1:]
        return AmbiguousReading(
            true_value=true_value,
            misread_value=int(misread_digits),
            digit_position=pos,
            true_digit=digit,
            misread_digit=misread,
            mechanism=mechanism,
        )

    raise ValueError(
        f"{true_value} has no digit with a defined rotation/capture confusion "
        "pair — cannot construct a plausible misread"
    )


def render_ambiguous_cbc_report(event: ClinicalEvent, ledger: Ledger) -> bytes:
    """Renders the same CBC report as `documents.render_cbc_report`, except
    the platelet count printed on the page is the *misread* value, not
    ground truth — this is what a faithful read of the degraded capture
    actually shows. `resolve_platelet_ambiguity(event.platelet_count)`
    carries the true value separately, for whatever consumes this as a
    fixture."""
    reading = resolve_platelet_ambiguity(event.platelet_count)
    facility = next(f for f in ledger.facilities if f.facility_id == event.facility_id)

    pdf = new_pdf()
    render_line(pdf, facility.name, bold=True)
    render_line(pdf, "COMPLETE BLOOD COUNT")
    render_line(pdf, "Scan quality: LOW - rotated capture")
    render_line(pdf, f"Patient: {ledger.patient_id}")
    render_line(pdf, f"Report date: {event.event_time.date().isoformat()}")
    render_line(pdf, "")
    render_line(pdf, f"WBC: {indian_digit_grouping(event.wbc_per_uL)} /CUMM")
    render_line(pdf, f"Neutrophils (differential): {event.neutrophil_pct}%")
    with pdf.rotation(angle=3, x=pdf.get_x(), y=pdf.get_y()):
        render_line(pdf, f"Platelet count: {indian_digit_grouping(reading.misread_value)} /CUMM")
    return bytes(pdf.output())
