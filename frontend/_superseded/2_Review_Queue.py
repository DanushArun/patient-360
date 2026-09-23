"""Review Queue — README: "coordinator, between cycles | open gate failures by urgency;
the unowned gap." SPEC.md 364 (REVIEW_ISSUE).

Ordering and exclusion are frontend/core/review_queue.py's job, tested separately. This
page renders the ordered list it returns.

DESIGN NOTE — why this is not a wall of red
    Urgency is carried by POSITION. The list is sorted by days_to_visit then severity, so
    the top of the list is the priority; colouring the rows as well would add no
    information and would start the alert-fatigue cycle the override-rate literature
    describes — ~90% of interruptive CDS alerts are overridden, and the driver is alerts
    that are not specific to the case in hand (clinical-ux-evidence.md 2.1-2.2).

    The one thing given visual weight is an UNOWNED issue, because that is the failure
    mode this screen exists to catch: it is not late yet, so nothing else will surface it.
"""

from __future__ import annotations

import json
from pathlib import Path

import streamlit as st

from frontend.core import answer_render as ar
from frontend.core.design import stylesheet
from frontend.core.review_queue import open_issues_by_urgency

_FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "review_queue.json"

st.set_page_config(page_title="Review Queue — SAARTHI", layout="wide")

with st.sidebar:
    st.markdown("**Demo controls**")
    greyscale = st.toggle(
        "Greyscale audit",
        help="Urgency must survive colour removal — it is carried by order, not hue.",
        key="queue_greyscale",
    )

st.html(stylesheet(greyscale_audit=greyscale))

issues = json.loads(_FIXTURE_PATH.read_text())["issues"]
queue = open_issues_by_urgency(issues)

# This screen is cross-patient by nature - it is the coordinator's worklist, not a
# bound-patient view - so it carries no binding masthead. It states its own scope instead.
st.html(
    '<div class="sa-masthead">'
    '<div class="sa-masthead-patient">Review queue</div>'
    '<div class="sa-field"><span class="sa-field-label">Showing</span>'
    f'<span class="sa-field-value sa-num">{len(queue)} open of {len(issues)}</span></div>'
    '<div class="sa-field"><span class="sa-field-label">Order</span>'
    '<span class="sa-field-value">soonest first, blockers before advisories</span></div>'
    "</div>"
)

if not queue:
    # Never a bare "no results".
    st.html('<div class="sa-limitation">Nothing open in the queue.</div>')
else:
    for issue in queue:
        st.html(ar.queue_row(issue))

st.html(
    '<div class="sa-meta" style="margin-top:24px;max-width:68ch">Closed and escalated '
    "issues are excluded. Gate outcomes come from versioned SQL rules; a task here is a "
    "request about the record, never a decision about the patient.</div>"
)
