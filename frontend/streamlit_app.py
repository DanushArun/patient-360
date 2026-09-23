"""SAARTHI — one surface.

SPEC.md 10: *"Deliver a question and answer experience with clear source evidence."
That is the product, **not one tab of six.**"*

WHY THIS FILE REPLACED FIVE PAGES
    The previous build exposed the six spec screens as six sidebar destinations. That is
    the codebase's structure offered as navigation, not a user journey: to see one cited
    answer you picked a page, bound a patient, moved to a second page, chose a fixture in
    a sidebar, chose a claim in a radio, scrolled, and expanded a panel. Seven moves and
    five context switches for one question.

    The six screens in SPEC.md are a CONTENT inventory, not an information architecture.
    Read as navigation they produce exactly the tabbed dashboard the spec warns against.

THE SHAPE, AND WHY
    Header   — who is asking, about whom, under what consent, as of when. The patient is
               a CONTROL here, not a destination: binding is one click inside the task,
               never a trip to another screen.
    Gates    — a persistent strip. Readiness is standing context for every answer, so it
               is always on screen. "Patient 360" was never a place; it was this strip.
    Body     — the conversation. This is the product.
    Margin   — evidence, revealed in place beside the claim it supports. Verifying a
               citation means comparing answer and source, which needs both visible at
               once; a modal that covers the answer defeats its own purpose.
    Unbound  — the review queue IS the home state. It is the inbox: the work waiting
               before a patient is chosen.

    Progressive disclosure throughout: nothing is a page, everything reveals.

LIVE, WITH AN HONEST FALLBACK
    Bind and ask run against Snowflake. `bind_patient` writes PATIENT_BINDING keyed on
    CURRENT_SESSION(), and every tool resolves the subject from that row, so the bind and
    the question must share one session — st.connection's cached connection is what makes
    that hold. If the connection is unavailable the app says so plainly and offers
    recorded answers, clearly labelled. It never pretends a fixture is a live answer.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import streamlit as st

from frontend.core import answer_render as ar
from frontend.core.design import stylesheet
from frontend.core.live import AgentTurn, Session, parse_agent_response
from frontend.core.review_queue import open_issues_by_urgency
from frontend.core.review_task import create_review_task as _offline_create_review_task

_FIXTURES = Path(__file__).resolve().parent / "fixtures"
_CONNECTION = "HACKATHON"

st.set_page_config(
    page_title="SAARTHI — Care Readiness & Evidence",
    layout="wide",
    initial_sidebar_state="collapsed",
)


# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------

@st.cache_resource(show_spinner=False)
def _session() -> tuple[Session | None, str | None]:
    """One Snowflake session for the app. Cached so CURRENT_SESSION() is stable —
    that stability is what makes the binding usable by the next tool call."""
    try:
        return Session(st.connection(_CONNECTION, type="snowflake")), None
    except Exception as exc:  # noqa: BLE001 - any failure means "offline", and we say so
        return None, str(exc)


session, connect_error = _session()
live = session is not None

st.html(stylesheet(greyscale_audit=st.session_state.get("greyscale", False)))


def _reset_conversation() -> None:
    """COPILOT-SPEC 1: switching patient clears history. Non-negotiable.

    A value carried from one patient's conversation into another's answer is the
    single worst thing this interface could do.
    """
    st.session_state["turns"] = []
    st.session_state["selected_evidence"] = None


st.session_state.setdefault("turns", [])
st.session_state.setdefault("selected_evidence", None)  # (turn_index, gate_name) | None
st.session_state.setdefault("offline_review_tasks", [])  # in-memory ReviewTask stand-in


# ---------------------------------------------------------------------------
# Header — identity, authority, cutoff
# ---------------------------------------------------------------------------

binding = session.active_binding() if live else st.session_state.get("demo_binding")
practitioner = session.practitioner() if live else ("Dr. Meera Iyer", "NMC-DEMO-0001")

head_left, head_right = st.columns([7, 5], gap="large")

with head_left:
    if binding:
        st.html(
            '<div class="sa-masthead" style="border-bottom:none;margin-bottom:4px">'
            f'<div class="sa-masthead-patient">{binding["patient_name"]}</div>'
            '<div class="sa-field"><span class="sa-field-label">Patient</span>'
            f'<span class="sa-field-value">{binding["patient_id"]}</span></div>'
            '<div class="sa-field"><span class="sa-field-label">Consent</span>'
            f'<span class="sa-field-value">{binding["consent_id"]}</span></div>'
            "</div>"
        )
    else:
        st.html(
            '<div class="sa-masthead" style="border-bottom:none;margin-bottom:4px">'
            '<div class="sa-masthead-patient">SAARTHI</div>'
            '<div class="sa-field"><span class="sa-field-label">Care readiness</span>'
            '<span class="sa-field-value">no patient selected</span></div></div>'
        )

with head_right:
    controls = st.columns([3, 2])

    # The patient selector: a control in the header, not a screen of its own.
    with controls[0]:
        with st.popover(
            binding["patient_name"] if binding else "Select patient",
            use_container_width=True,
        ):
            st.html(
                '<div class="sa-meta">Only patients with an active care-team row and '
                "valid consent appear. The filter runs server-side.</div>"
            )
            if live:
                options = session.bindable_patients()
                if not options:
                    st.html(
                        '<div class="sa-limitation">No accessible record for this user.'
                        "</div>"
                    )
                for patient_id, label in options:
                    if st.button(label, key=f"bind_{patient_id}", use_container_width=True):
                        result = session.bind(patient_id)
                        if result.get("error"):
                            st.session_state["bind_error"] = result["error"]
                        else:
                            _reset_conversation()
                        st.rerun()
            else:
                if st.button("Meera Iyer (recorded)", use_container_width=True):
                    st.session_state["demo_binding"] = {
                        "binding_id": "BND-0007", "patient_id": "PAT-DEEP-0001",
                        "consent_id": "CON-0031", "patient_name": "Meera Iyer",
                    }
                    _reset_conversation()
                    st.rerun()

    with controls[1]:
        st.html(
            '<div class="sa-field" style="padding-top:4px">'
            '<span class="sa-field-label">Practitioner</span>'
            f'<span class="sa-field-value">{practitioner[0] if practitioner else "—"}'
            "</span></div>"
        )

if not live:
    st.html(
        ar.limitation(
            "Not connected to Snowflake — showing recorded answers, not live ones."
            + (f" ({connect_error})" if connect_error else "")
        )
    )
if st.session_state.get("bind_error"):
    st.html(ar.limitation(f"Binding refused: {st.session_state.pop('bind_error')}"))


# ---------------------------------------------------------------------------
# Gate strip — standing context, never a separate screen
# ---------------------------------------------------------------------------

@st.cache_data(show_spinner=False)
def _queue_issues() -> list[dict]:
    return json.loads((_FIXTURES / "review_queue.json").read_text())["issues"]


def _open_issue_for(patient_id: str | None, gate_name: str) -> dict | None:
    """The real open queue issue behind a gate, if one exists.

    Never fabricates an issue_id: an action can only be filed against a row
    that actually exists in the queue, same as the retired Review + History
    page required. If nothing matches, the action simply does not appear —
    that absence is honest, not a bug.
    """
    if not patient_id:
        return None
    for issue in _queue_issues():
        if issue["patient_id"] == patient_id and issue["gate"] == gate_name \
                and issue["state"] in ("open", "evidence_received"):
            return issue
    return None


def _render_action_row(issue: dict) -> None:
    """Request evidence / escalate / mark resolved — the one write action,
    restored from the retired Review + History page. Deliberately absent:
    an "approve treatment" option — SPEC.md 605's own test case for what
    this tool must refuse to become."""
    cols = st.columns(3)
    labels = {"request_evidence": "Request evidence", "escalate": "Escalate",
              "mark_resolved": "Mark resolved"}
    for col, (action, label) in zip(cols, labels.items()):
        key = f"act_{issue['issue_id']}_{action}"
        with col:
            if st.button(label, key=key, use_container_width=True):
                # Stable per issue+action, not per click: a second click on the same
                # button is a retry, and per SPEC.md 373 a retry must return the
                # existing task rather than mint a duplicate.
                idempotency_key = f"{issue['issue_id']}:{action}"
                reason = f"{label} — filed from the conversation on {issue['gate']}"
                if live:
                    result = session.create_review_task(
                        issue_id=issue["issue_id"], action=action, reason=reason,
                        idempotency_key=idempotency_key,
                    )
                else:
                    try:
                        task = _offline_create_review_task(
                            st.session_state["offline_review_tasks"],
                            issue_id=issue["issue_id"], action=action, reason=reason,
                            actor_practitioner_id=practitioner[1] if practitioner else "UNKNOWN",
                            actor_role="treating", idempotency_key=idempotency_key,
                        )
                        st.session_state["offline_review_tasks"].append(task)
                        result = {"task_id": task.task_id}
                    except (PermissionError, ValueError) as exc:
                        result = {"error": str(exc)}
                st.session_state["last_action_result"] = result
                st.rerun()
    result = st.session_state.pop("last_action_result", None)
    if result:
        if result.get("error"):
            st.html(ar.limitation(f"Action refused: {result['error']}"))
        else:
            st.html(
                '<div class="sa-meta">Filed as '
                f'<code>{result.get("task_id", "—")}</code></div>'
            )


def _latest_gates() -> tuple[list[dict], str | None]:
    """Gates from the most recent turn that produced them, else fetched directly."""
    for turn in reversed(st.session_state["turns"]):
        if isinstance(turn, dict) and turn.get("gates"):
            return turn["gates"], turn.get("known_as_of")
    if live and binding:
        readiness = session.readiness()
        if isinstance(readiness, dict):
            return readiness.get("gates", []), readiness.get("known_as_of")
    return [], None


if binding:
    gates, gates_as_of = _latest_gates()
    if gates:
        st.html(
            '<div class="sa-field-label" style="margin:12px 0 4px">Readiness'
            + (
                f' &middot; <span class="sa-num">as of {gates_as_of}</span>'
                if gates_as_of else ""
            )
            + "</div>"
        )
        strip = st.columns(len(gates))
        for column, gate in zip(strip, gates):
            with column:
                st.html(
                    '<div style="padding:8px 0;border-top:1px solid #D8DCDF">'
                    f'<div class="sa-field-label">{gate["gate"]}</div>'
                    f'{ar.status_chip(gate["outcome"])}'
                    f'<div class="sa-meta" style="margin-top:6px">'
                    f'<code>{gate.get("rule_id","")}'
                    f' v{gate.get("rule_version","")}</code></div></div>'
                )

st.html('<hr style="border:none;border-top:1px solid #D8DCDF;margin:16px 0">')


# ---------------------------------------------------------------------------
# Body — the conversation, and the evidence beside it
# ---------------------------------------------------------------------------

body, margin = st.columns([7, 5], gap="large")


def _render_turn(turn: dict, turn_index: int) -> None:
    if turn["role"] == "user":
        with st.chat_message("user"):
            st.write(turn["text"])
        return

    with st.chat_message("assistant"):
        if turn.get("error"):
            st.html(ar.limitation(_ERRORS.get(turn["error"], turn["error"])))
            return
        st.write(turn["text"])
        if turn.get("known_as_of"):
            st.html(
                '<div class="sa-meta sa-num" style="margin-top:8px">'
                f'Known as of {turn["known_as_of"]}</div>'
            )

        # Every gate this answer touched, as a citation attached to the claim it
        # backs — not a generic dump at the bottom of the screen. Clicking one
        # pins its full evidence in the margin, the same way an artifact panel
        # follows what you're looking at rather than showing everything at once.
        gates = turn.get("gates") or []
        if gates:
            st.html('<div style="margin-top:12px"></div>')
            chip_cols = st.columns(len(gates))
            for column, gate in zip(chip_cols, gates):
                with column:
                    st.html(ar.gate_row(gate))
                    is_selected = st.session_state["selected_evidence"] == \
                        (turn_index, gate["gate"])
                    if st.button(
                        "Evidence ▸" if not is_selected else "Evidence ▾",
                        key=f"cite_{turn_index}_{gate['gate']}",
                        use_container_width=True,
                    ):
                        st.session_state["selected_evidence"] = (
                            None if is_selected else (turn_index, gate["gate"])
                        )
                        st.rerun()


_ERRORS = {
    "malformed_agent_json": "The assistant returned a response this app could not read. "
                            "Nothing is asserted from it.",
    "agent_unreachable": "The assistant could not be reached. No answer is shown rather "
                         "than a stale one.",
    "nothing_found": "Nothing found for that question.",
}

with body:
    if not binding:
        # Unbound home state: the inbox. Work waiting, before a patient is chosen.
        st.html('<div class="sa-field-label">Waiting on you</div>')
        issues = _queue_issues()
        queue = open_issues_by_urgency(issues)
        if not queue:
            st.html(
                '<div class="sa-meta" style="margin-bottom:12px">Nothing open, as of '
                f'{datetime.now().strftime("%d %b %Y, %H:%M")}.</div>'
            )
        else:
            st.html(
                '<div class="sa-meta" style="margin-bottom:12px">'
                f"{len(queue)} open of {len(issues)} · soonest first, blockers before "
                "advisories. Select a patient above to ask about one.</div>"
            )
        for issue in queue:
            st.html(ar.queue_row(issue))
            with st.expander("Act on this", expanded=False):
                _render_action_row(issue)
    else:
        for index, turn in enumerate(st.session_state["turns"]):
            _render_turn(turn, index)

        if not st.session_state["turns"]:
            st.html(
                '<div class="sa-meta">Ask about this patient\'s record — what you have, '
                "what is missing, what contradicts what. Clinical decisions are referred "
                "to the treating practitioner.</div>"
            )

        # Follow-ups the agent itself proposed. Cheaper than typing, and they keep the
        # conversation inside what the record can actually answer.
        last = st.session_state["turns"][-1] if st.session_state["turns"] else None
        if isinstance(last, dict) and last.get("suggested"):
            st.html('<div class="sa-field-label" style="margin-top:12px">Follow on</div>')
            for index, suggestion in enumerate(last["suggested"][:3]):
                if st.button(suggestion, key=f"sugg_{index}", use_container_width=True):
                    st.session_state["pending"] = suggestion
                    st.rerun()

with margin:
    turns = st.session_state["turns"]
    last = turns[-1] if turns else None
    selection = st.session_state["selected_evidence"]

    # A specific claim was clicked: the margin follows it, and only it — this is
    # what makes the panel read as "the thing you're looking at" rather than a
    # static sidebar that always shows the same dump regardless of what's asked.
    pinned_gate = None
    if selection:
        sel_index, sel_gate_name = selection
        if 0 <= sel_index < len(turns):
            pinned_gate = next(
                (g for g in turns[sel_index].get("gates", []) if g["gate"] == sel_gate_name),
                None,
            )

    if pinned_gate:
        st.html(
            '<div class="sa-field-label">Evidence · '
            f'{pinned_gate["gate"]}</div>'
        )
        st.html(
            '<div class="sa-evidence sa-ev-patient">'
            f'<div class="sa-ev-kind">{pinned_gate["gate"]} · evidence</div>'
            f'<div class="sa-ev-id">{", ".join(pinned_gate.get("evidence_ids", []))}</div>'
            f'<div class="sa-meta">{pinned_gate.get("reason","")}</div>'
            + (ar.provenance(pinned_gate) if pinned_gate.get("provenance_note") else "")
            + (
                '<div class="sa-derivation"><div class="sa-derivation-lead">'
                "Derived, not printed.</div>"
                f'<div class="sa-formula">{pinned_gate["derived"]}</div></div>'
                if pinned_gate.get("derived") else ""
            )
            + "</div>"
        )
        issue = _open_issue_for(binding.get("patient_id") if binding else None, pinned_gate["gate"])
        if issue and pinned_gate["outcome"] in ("fail", "conflicting", "not_evaluated"):
            st.html('<div class="sa-field-label" style="margin-top:16px">Act on this</div>')
            _render_action_row(issue)
        if st.button("Show everything for this answer instead", key="unpin"):
            st.session_state["selected_evidence"] = None
            st.rerun()

    elif isinstance(last, dict) and last.get("role") == "assistant":
        st.html('<div class="sa-field-label">How this was answered</div>')

        # Which tools ran, and the query ID that proves each one did. This is the
        # provenance of the ANSWER itself, not of a claim: a judge can resolve any of
        # these IDs in QUERY_HISTORY.
        for tool in last.get("tools", []):
            leaked = tool.get("took_patient_id")
            st.html(
                '<div class="sa-evidence sa-ev-patient">'
                '<div class="sa-ev-kind">Tool call</div>'
                f'<div class="sa-ev-id">{tool["name"]}</div>'
                + (
                    '<div class="sa-meta">query '
                    f'<code>{tool.get("query_id") or "—"}</code></div>'
                )
                + (
                    '<div class="sa-derivation-note">Scope was passed in the tool input. '
                    "This must never happen.</div>" if leaked else
                    '<div class="sa-meta">No patient identifier in the tool input — '
                    "scope resolved server-side from the binding.</div>"
                )
                + "</div>"
            )

        for gate in last.get("gates", []):
            if gate.get("evidence_ids"):
                st.html(
                    '<div class="sa-evidence sa-ev-patient">'
                    f'<div class="sa-ev-kind">{gate["gate"]} · evidence</div>'
                    f'<div class="sa-ev-id">{", ".join(gate["evidence_ids"])}</div>'
                    f'<div class="sa-meta">{gate.get("reason","")}</div>'
                    + (
                        '<div class="sa-derivation"><div class="sa-derivation-lead">'
                        "Derived, not printed.</div>"
                        f'<div class="sa-formula">{gate["derived"]}</div></div>'
                        if gate.get("derived") else ""
                    )
                    + "</div>"
                )
        st.html(
            '<div class="sa-meta" style="margin-top:8px">Click "Evidence" on any claim '
            "above to pin just that one here.</div>"
        )

        if last.get("thinking"):
            with st.expander("Assistant's reasoning"):
                st.html(
                    '<div class="sa-meta">Shown because it is inspectable, not because '
                    "it is evidence. Every number above comes from SQL.</div>"
                )
                st.write(last["thinking"])
    elif binding:
        st.html(
            '<div class="sa-meta">Evidence appears here — the tools that ran, their '
            "query IDs, and the rows behind each gate.</div>"
        )


# ---------------------------------------------------------------------------
# Input
# ---------------------------------------------------------------------------

question = st.chat_input(
    "Ask about this patient's record…" if binding else "Select a patient first",
    disabled=not binding,
)
question = question or st.session_state.pop("pending", None)

if question and binding:
    st.session_state["turns"].append({"role": "user", "text": question})

    if live:
        with st.spinner("Consulting the record…"):
            turn: AgentTurn = session.ask(question)
    else:
        recorded = json.loads((_FIXTURES / "agent_turn_recorded.json").read_text())
        turn = parse_agent_response(recorded)

    st.session_state["turns"].append({
        "role": "assistant",
        "text": turn.text,
        "thinking": turn.thinking,
        "tools": [
            {"name": t.name, "query_id": t.query_id, "took_patient_id": t.took_patient_id}
            for t in turn.tools
        ],
        "suggested": turn.suggested,
        "gates": turn.gates,
        "known_as_of": turn.known_as_of,
        "error": turn.error,
    })
    st.rerun()

with st.sidebar:
    st.markdown("**Checks**")
    st.toggle("Greyscale audit", key="greyscale",
              help="No status may depend on colour alone.")
    st.html(
        '<div class="sa-meta">Connection: '
        f'<code>{"live" if live else "offline"}</code></div>'
    )
    if st.button("Clear conversation"):
        _reset_conversation()
        st.rerun()
