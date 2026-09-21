"""Review + History — README: "create/assign a documentation task, record
status changes, source references, audit trail." WORK-PLAN.md 567:
create_review_task is the only write tool, idempotent via idempotency_key,
restricted to treating|coordinator.

The role selector exists so the restriction is demonstrable, not asserted —
picking patient_navigator and clicking Create Task shows the actual
refusal, live, the same way the Judge Console's probes are meant to.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import streamlit as st

from frontend.components.binding_header import render_binding_header
from frontend.core.review_queue import open_issues_by_urgency
from frontend.core.review_task import create_review_task

_QUEUE_FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "review_queue.json"
_KNOWN_AS_OF = datetime(2026, 9, 18, 9, 0, 0)

st.title("Review + History")
render_binding_header(practitioner_name="Dr. Meera Iyer")

issues = json.loads(_QUEUE_FIXTURE_PATH.read_text())["issues"]
queue = open_issues_by_urgency(issues)
issue_options = {f"{i['patient_name']} — {i['gate']} ({i['rule_id']})": i for i in queue}

selected_label = st.selectbox("Open issue", list(issue_options.keys()))
actor_role = st.selectbox("Acting as", ["coordinator", "treating", "consulting", "patient_navigator"])
reason = st.text_input("Reason", value="Need the final FISH report.")

if st.button("Create task"):
    selected_issue = issue_options[selected_label]
    idempotency_key = f"{selected_issue['issue_id']}:request_evidence"
    try:
        task = create_review_task(
            st.session_state.get("review_tasks", []),
            issue_id=selected_issue["issue_id"], action="request_evidence", reason=reason,
            actor_practitioner_id="PRC-001", actor_role=actor_role,
            idempotency_key=idempotency_key, created_at=_KNOWN_AS_OF,
        )
    except PermissionError as exc:
        st.error(str(exc))
    else:
        existing_tasks = st.session_state.get("review_tasks", [])
        if task not in existing_tasks:
            st.session_state["review_tasks"] = existing_tasks + [task]

st.subheader("Task history")
for task in st.session_state.get("review_tasks", []):
    st.markdown(f"**{task.task_id}** — {task.issue_id} · {task.action} · state: {task.state}")
    for transition in task.history:
        st.caption(f"{transition['at']} — {transition['reason']}")
