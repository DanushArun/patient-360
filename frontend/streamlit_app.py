"""SAARTHI — entry point. Multipage app; Streamlit auto-discovers
frontend/pages/ relative to this file. WORK-PLAN.md Day 1: "Streamlit
scaffold against a fixture." Session hardening (`USE SECONDARY ROLES
NONE`) is a live-connection concern — nothing to harden yet against a
fixture-only demo.
"""

from __future__ import annotations

import streamlit as st

st.set_page_config(page_title="SAARTHI", layout="wide")

st.title("SAARTHI")
st.caption("Care Readiness & Evidence Copilot — fixture-driven Day-1 demo, no live Snowflake connection")

st.markdown(
    """
Use the sidebar to move between screens. Start with **Bind Patient** — every
other screen reads the binding it sets.

| Screen | What it shows |
|---|---|
| 0 · Bind Patient | Care-team-filtered patient picker, persistent binding header |
| 1 · Ask + Evidence | Question → cited answer, evidence pane, Class A refusal + evidence packet |
| 2 · Review Queue | Open gate failures ranked by urgency, unowned issues flagged |
| 3 · Patient 360 | 5-gate strip, all four outcomes (never a boolean) |
| 4 · Review + History | Create a documentation task, idempotent, role-restricted, audit trail |
"""
)
