"""Review + History — README: "create/assign a documentation task, record status changes,
source references, audit trail." WORK-PLAN.md 567: create_review_task is the only write
tool, idempotent via idempotency_key, restricted to treating|coordinator.

The role selector exists so the restriction is DEMONSTRABLE rather than asserted. Picking
patient_navigator and clicking Create task shows the actual refusal, live — the same
posture as the Judge Console probes. A capability claim a judge can exercise themselves is
worth more than one in a README.

DESIGN NOTE — the action vocabulary is a closed enum, on screen
    request_evidence · mark_resolved · escalate · reject. There is deliberately no
    "approve treatment". R1 drawn as a literal enum boundary: this tool can create a task
    ABOUT the record, never a decision about the patient. Showing the closed list makes
    the absence visible, which is the point — a missing option nobody can see proves
    nothing.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import streamlit as st

from frontend.core import answer_render as ar
from frontend.core.design import stylesheet
from frontend.core.review_queue import open_issues_by_urgency
from frontend.core.review_task import create_review_task

_QUEUE_FIXTURE_PATH = (
    Path(__file__).resolve().parent.parent / "fixtures" / "review_queue.json"
)
_KNOWN_AS_OF = datetime(2026, 9, 18, 9, 0, 0)

st.set_page_config(page_title="Review + History — SAARTHI", layout="wide")

with st.sidebar:
    st.markdown("**Demo controls**")
    greyscale = st.toggle("Greyscale audit", key="review_greyscale")

st.html(stylesheet(greyscale_audit=greyscale))

issues = json.loads(_QUEUE_FIXTURE_PATH.read_text())["issues"]
queue = open_issues_by_urgency(issues)
issue_options = {
    f"{i['patient_name']} — {i['gate']} ({i['rule_id']})": i for i in queue
}

st.html(
    '<div class="sa-masthead">'
    '<div class="sa-masthead-patient">Review &amp; history</div>'
    '<div class="sa-field"><span class="sa-field-label">Write tool</span>'
    '<span class="sa-field-value">create_review_task — the only one in the system</span>'
    "</div>"
    '<div class="sa-field"><span class="sa-field-label">Permitted roles</span>'
    '<span class="sa-field-value">treating · coordinator</span></div>'
    "</div>"
)

form, history = st.columns([6, 6], gap="large")

with form:
    st.html('<div class="sa-field-label">Raise a documentation task</div>')
    selected_label = st.selectbox("Open issue", list(issue_options))
    actor_role = st.selectbox(
        "Acting as", ["coordinator", "treating", "consulting", "patient_navigator"],
        help="consulting and patient_navigator are refused — try one.",
    )
    action = st.selectbox(
        "Action", ["request_evidence", "mark_resolved", "escalate", "reject"],
        help="A closed enum. There is no 'approve treatment' — that is R1.",
    )
    reason = st.text_input("Reason", value="Need the final FISH report.")

    if st.button("Create task", type="primary"):
        selected_issue = issue_options[selected_label]
        try:
            task = create_review_task(
                st.session_state.get("review_tasks", []),
                issue_id=selected_issue["issue_id"],
                action=action,
                reason=reason,
                actor_practitioner_id="PRC-001",
                actor_role=actor_role,
                # Keyed on issue + action so the same request twice is one task, not two.
                idempotency_key=f"{selected_issue['issue_id']}:{action}",
                created_at=_KNOWN_AS_OF,
            )
        except PermissionError as exc:
            # The refusal is the feature. Render it plainly and name the role.
            st.html(
                '<div class="sa-refusal" style="margin-top:12px">'
                '<div class="sa-refusal-kind">Refused</div>'
                f'<div class="sa-field-value"><code>{exc}</code></div>'
                '<div class="sa-meta" style="margin-top:8px">'
                f"Role <code>{actor_role}</code> may not create tasks. A task is a request "
                "about the record; only the treating practitioner or the coordinator may "
                "raise one.</div></div>"
            )
        else:
            existing = st.session_state.get("review_tasks", [])
            if task not in existing:
                st.session_state["review_tasks"] = existing + [task]

with history:
    st.html('<div class="sa-field-label">Task history</div>')
    tasks = st.session_state.get("review_tasks", [])
    if not tasks:
        st.html('<div class="sa-limitation">No tasks raised in this session.</div>')
    for task in tasks:
        transitions = "".join(
            f'<div class="sa-meta" style="margin-top:4px">'
            f'<span class="sa-clock-value">{t["at"]}</span> — {t["reason"]}</div>'
            for t in task.history
        )
        st.html(
            '<div class="sa-evidence sa-ev-patient">'
            '<div class="sa-ev-kind">Review task</div>'
            f'<div class="sa-ev-id">{task.task_id} · {task.issue_id}</div>'
            f'<div class="sa-meta">{task.action} · state {task.state}</div>'
            f"{transitions}</div>"
        )

st.html(
    '<div class="sa-meta" style="margin-top:24px;max-width:68ch">'
    "Every transition is appended, never overwritten — the history is the audit trail. "
    "<code>idempotency_key</code> makes a repeated request one task, not two.</div>"
)
