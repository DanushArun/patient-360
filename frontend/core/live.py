"""Live Snowflake access for the copilot.

Two halves, deliberately separated:

  * `AgentTurn` + `parse_agent_response` are PURE. They take the JSON the agent returns
    and produce something renderable. No connection, no Streamlit — so they are unit
    tested against real recorded payloads.
  * `Session` holds the connection and calls the procedures.

WHY A RAW CURSOR, NOT `conn.query()`
    `st.connection("...").query()` calls `fetch_pandas_all()`, which raises
    `NotSupportedError: Unknown error` against these procedures — the result arrives as
    JSON rather than Arrow. Verified live, 21 Sept. The raw cursor is the working path.

WHY THE SESSION MATTERS MORE THAN USUAL
    `bind_patient` writes `PATIENT_BINDING` keyed on `CURRENT_SESSION()`, and every tool
    resolves the subject from that row. So the bind and the question MUST travel down the
    same Snowflake session. `st.connection` caches the connection across reruns, which is
    what makes that hold — verified: same `CURRENT_SESSION()` before and after, binding
    visible to the next call.

    This is also why binding cannot be faked client-side. The client-side mirror in
    binding.py is for offline rendering only; it grants nothing.

`USE SECONDARY ROLES NONE` is issued on every new session. AGENTS.md fact 2: without it a
secondary ACCOUNTADMIN satisfies privilege checks through the back door and "the app role
has no USAGE" becomes a false statement.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Pure parsing
# ---------------------------------------------------------------------------

@dataclass
class ToolCall:
    """One tool the agent invoked, and the query ID that proves it ran."""

    name: str
    query_id: str | None = None
    took_patient_id: bool = False   # must always stay False - see the test
    result: Any = None


@dataclass
class AgentTurn:
    """One assistant turn, flattened into what the interface needs."""

    text: str = ""
    thinking: str = ""
    tools: list[ToolCall] = field(default_factory=list)
    suggested: list[str] = field(default_factory=list)
    gates: list[dict[str, Any]] = field(default_factory=list)
    known_as_of: str | None = None
    raw: Any = None
    error: str | None = None


def parse_agent_response(payload: Any) -> AgentTurn:
    """Flatten DATA_AGENT_RUN's response into an AgentTurn.

    Defensive by design: a malformed agent response is one of the 12 named failure
    situations (`malformed_agent_json`), and the correct behaviour is to surface that
    rather than render half an answer as though it were whole.
    """
    turn = AgentTurn(raw=payload)

    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError:
            turn.error = "malformed_agent_json"
            return turn

    if not isinstance(payload, dict):
        turn.error = "malformed_agent_json"
        return turn

    content = payload.get("content")
    if not isinstance(content, list):
        turn.error = "malformed_agent_json"
        return turn

    texts: list[str] = []
    for block in content:
        if not isinstance(block, dict):
            continue
        kind = block.get("type")

        if kind == "text" and block.get("text"):
            texts.append(block["text"])

        elif kind == "thinking":
            thinking = block.get("thinking") or {}
            if isinstance(thinking, dict) and thinking.get("text"):
                turn.thinking += thinking["text"]

        elif kind == "tool_use":
            use = block.get("tool_use") or {}
            tool_input = use.get("input") or {}
            turn.tools.append(
                ToolCall(
                    name=use.get("name", "unknown"),
                    # If this is ever True, scope leaked into the tool surface (A1).
                    took_patient_id="patient_id" in tool_input,
                )
            )

        elif kind == "tool_result":
            result = block.get("tool_result") or {}
            name = result.get("name")
            for item in result.get("content") or []:
                body = (item or {}).get("json") or {}
                query_id = body.get("query_id")
                parsed = _maybe_json(body.get("result"))
                for call in turn.tools:
                    if call.name == name and call.query_id is None:
                        call.query_id = query_id
                        call.result = parsed
                        break
                if isinstance(parsed, dict):
                    if parsed.get("gates"):
                        turn.gates = parsed["gates"]
                    if parsed.get("known_as_of"):
                        turn.known_as_of = parsed["known_as_of"]

        elif kind == "suggested_queries":
            turn.suggested = [
                s["query"] for s in block.get("suggested_queries") or []
                if isinstance(s, dict) and s.get("query")
            ]

    turn.text = "\n\n".join(texts).strip()
    if not turn.text:
        # The agent returned structure but nothing to say. Not an answer.
        turn.error = turn.error or "nothing_found"
    return turn


def _maybe_json(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


# ---------------------------------------------------------------------------
# Live session
# ---------------------------------------------------------------------------

class Session:
    """Thin wrapper over one Snowflake session. Not cached by Streamlit itself -
    the underlying st.connection is, which is what keeps CURRENT_SESSION() stable."""

    def __init__(self, connection) -> None:
        self._conn = connection
        self._hardened = False

    def _cursor(self):
        return self._conn.raw_connection.cursor()

    def execute(self, sql: str, params: tuple = ()) -> list[tuple]:
        """Parameters use `?` (qmark). st.connection sets paramstyle='qmark' on the
        connection even though the module default reports 'pyformat' - verified live.
        Never interpolate a value into the SQL string."""
        self._harden()
        cur = self._cursor()
        try:
            cur.execute(sql, params)
            return cur.fetchall()
        finally:
            cur.close()

    def _harden(self) -> None:
        """AGENTS.md fact 2. Issued once per session, before anything else runs."""
        if self._hardened:
            return
        cur = self._cursor()
        try:
            cur.execute("USE SECONDARY ROLES NONE")
        finally:
            cur.close()
        self._hardened = True

    # --- procedures --------------------------------------------------------

    def bindable_patients(self) -> list[tuple[str, str]]:
        """Patients this user may bind: an active CARE_TEAM row AND valid CONSENT.

        The filter is in SQL, not in Python. A client-side filter is a display
        convenience; this one is the list the server is willing to admit.
        """
        rows = self.execute(
            """
            SELECT DISTINCT p.patient_id, COALESCE(p.name, p.patient_id) AS label
              FROM SAARTHI.CORE.PATIENT p
              JOIN SAARTHI.GOVERNANCE.CARE_TEAM ct ON ct.patient_id = p.patient_id
              JOIN SAARTHI.GOVERNANCE.PRACTITIONER pr
                    ON pr.practitioner_id = ct.practitioner_id
                   AND UPPER(pr.snowflake_user) = UPPER(CURRENT_USER())
              JOIN SAARTHI.GOVERNANCE.CONSENT c ON c.patient_id = p.patient_id
             WHERE (ct.active_to IS NULL OR ct.active_to >= CURRENT_DATE())
               AND c.status = 'active'
               AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP())
             ORDER BY 2
            """
        )
        return [(r[0], r[1]) for r in rows]

    def practitioner(self) -> tuple[str, str] | None:
        """The signed-in practitioner, resolved from CURRENT_USER() — never from input."""
        rows = self.execute(
            "SELECT name, nmc_registration_no FROM SAARTHI.GOVERNANCE.PRACTITIONER "
            "WHERE UPPER(snowflake_user) = UPPER(CURRENT_USER()) AND active LIMIT 1"
        )
        return (rows[0][0], rows[0][1]) if rows else None

    def active_binding(self) -> dict[str, Any] | None:
        """The binding for THIS session, read back from the server.

        Read back rather than remembered client-side: the server's row is the
        authority, and if consent was revoked mid-session this is what notices.
        """
        rows = self.execute(
            """
            SELECT b.binding_id, b.patient_id, b.consent_id,
                   COALESCE(p.name, b.patient_id)
              FROM SAARTHI.GOVERNANCE.PATIENT_BINDING b
              LEFT JOIN SAARTHI.CORE.PATIENT p ON p.patient_id = b.patient_id
             WHERE b.session_id = CURRENT_SESSION() AND b.released_at IS NULL
             ORDER BY b.bound_at DESC LIMIT 1
            """
        )
        if not rows:
            return None
        return {
            "binding_id": rows[0][0], "patient_id": rows[0][1],
            "consent_id": rows[0][2], "patient_name": rows[0][3],
        }

    def bind(self, patient_id: str) -> dict[str, Any]:
        rows = self.execute(
            "CALL SAARTHI.OPERATIONAL.BIND_PATIENT(?)", (patient_id,)
        )
        return _maybe_json(rows[0][0]) if rows else {}

    def ask(self, question: str) -> AgentTurn:
        rows = self.execute("CALL SAARTHI.OPERATIONAL.ASK_SAARTHI(?)", (question,))
        if not rows:
            return AgentTurn(error="agent_unreachable")
        return parse_agent_response(_maybe_json(rows[0][0]))

    def readiness(self) -> dict[str, Any]:
        rows = self.execute(
            "CALL SAARTHI.OPERATIONAL.GET_READINESS(NULL, NULL)"
        )
        return _maybe_json(rows[0][0]) if rows else {}

    def daycare_census(self, horizon_days: int = 7) -> list[dict[str, Any]]:
        """Upcoming day-care encounters for patients this user may see, one row
        per (encounter, rule) from READINESS_STATE.

        Scope is the same server-side filter as bindable_patients() - an active
        CARE_TEAM row for CURRENT_USER() and valid CONSENT - applied in SQL, not
        in Python. An encounter with no readiness rows still comes back (LEFT
        JOIN) so the census can say "not computed" instead of hiding it.
        """
        rows = self.execute(
            """
            WITH plan AS (
                SELECT patient_id, regimen_display
                  FROM SAARTHI.CORE.TREATMENT_PLAN
                QUALIFY ROW_NUMBER() OVER (PARTITION BY patient_id
                                           ORDER BY version DESC, decided_at DESC NULLS LAST) = 1
            )
            SELECT e.encounter_id, p.patient_id, p.name, p.district, p.state, p.primary_language,
                   plan.regimen_display, e.cycle_number,
                   TO_VARCHAR(e.scheduled_time, 'YYYY-MM-DD"T"HH24:MI:SS'),
                   rs.gate, rs.rule_id, rs.rule_version, rs.outcome, rs.severity, rs.reason
              FROM SAARTHI.CORE.ENCOUNTER e
              JOIN SAARTHI.CORE.PATIENT p ON p.patient_id = e.patient_id
              LEFT JOIN plan ON plan.patient_id = e.patient_id
              LEFT JOIN SAARTHI.OPERATIONAL.READINESS_STATE rs ON rs.encounter_id = e.encounter_id
             WHERE e.encounter_type = 'daycare'
               AND e.scheduled_time >= CURRENT_DATE()
               AND e.scheduled_time <  DATEADD(day, ?, CURRENT_DATE())
               AND EXISTS (
                   SELECT 1 FROM SAARTHI.GOVERNANCE.CARE_TEAM ct
                     JOIN SAARTHI.GOVERNANCE.PRACTITIONER pr ON pr.practitioner_id = ct.practitioner_id
                    WHERE ct.patient_id = e.patient_id
                      AND UPPER(pr.snowflake_user) = UPPER(CURRENT_USER())
                      AND (ct.active_to IS NULL OR ct.active_to >= CURRENT_DATE()))
               AND EXISTS (
                   SELECT 1 FROM SAARTHI.GOVERNANCE.CONSENT c
                    WHERE c.patient_id = e.patient_id AND c.status = 'active'
                      AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP()))
             ORDER BY e.scheduled_time, p.name
            """,
            (horizon_days,),
        )
        keys = ("encounter_id", "patient_id", "name", "district", "state", "language", "regimen",
                "cycle", "scheduled", "gate", "rule_id", "rule_version", "outcome", "severity", "reason")
        return [dict(zip(keys, r)) for r in rows]

    def patient_context(self, patient_id: str) -> dict[str, Any]:
        """Language and next day-care visit for the bound patient - what the
        family checklist needs that the readiness answer does not carry."""
        rows = self.execute(
            """
            SELECT p.primary_language,
                   (SELECT TO_VARCHAR(MIN(e.scheduled_time), 'YYYY-MM-DD')
                      FROM SAARTHI.CORE.ENCOUNTER e
                     WHERE e.patient_id = p.patient_id AND e.encounter_type = 'daycare'
                       AND e.scheduled_time >= CURRENT_DATE())
              FROM SAARTHI.CORE.PATIENT p WHERE p.patient_id = ?
            """,
            (patient_id,),
        )
        if not rows:
            return {}
        return {"language": rows[0][0], "next_visit": rows[0][1]}

    def create_review_task(
        self, *, issue_id: str, action: str, reason: str, idempotency_key: str,
    ) -> dict[str, Any]:
        """CALL SAARTHI.OPERATIONAL.create_review_task — the only write tool.

        Role and practitioner are resolved server-side from CURRENT_SESSION()/
        CURRENT_USER(), never passed in: a client can propose a task, never
        assert who it is or that it is allowed to write one.
        """
        rows = self.execute(
            "CALL SAARTHI.OPERATIONAL.create_review_task(?, ?, ?, ?)",
            (issue_id, action, reason, idempotency_key),
        )
        return _maybe_json(rows[0][0]) if rows else {}

    def page_text(self, doc_id: str, page_index: int) -> str | None:
        """Content comes from the RAP-protected DOC_PAGE, never from the search index.

        R5 layer 3: even a leaked chunk_id yields nothing, because the text is fetched
        through a governed table where CURRENT_USER() survives owner's-rights elevation.
        """
        rows = self.execute(
            "SELECT text FROM SAARTHI.DOCUMENTS.DOC_PAGE "
            "WHERE doc_id = ? AND page_index = ?",
            (doc_id, page_index),
        )
        return rows[0][0] if rows else None
