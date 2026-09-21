"""Review Queue — README: "coordinator, between cycles | open gate
failures by urgency; the unowned gap." SPEC.md 364 (REVIEW_ISSUE).

Ordering and exclusion are frontend/core/review_queue.py's job, tested on
their own; this page just renders the ordered list it returns.
"""

from __future__ import annotations

import json
from pathlib import Path

import streamlit as st

from frontend.components.binding_header import render_binding_header
from frontend.core.gate_render import describe_gate
from frontend.core.review_queue import open_issues_by_urgency

_FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "review_queue.json"

st.title("Review Queue")
render_binding_header(practitioner_name="Dr. Meera Iyer")

issues = json.loads(_FIXTURE_PATH.read_text())["issues"]
queue = open_issues_by_urgency(issues)

for issue in queue:
    description = describe_gate(issue)
    owner = issue["owner_practitioner_name"] or "**unassigned**"
    st.markdown(
        f"**{issue['patient_name']}** — {description.gate} · {description.label} "
        f"({description.detail}) · due in {issue['days_to_visit']}d · owner: {owner}"
    )
