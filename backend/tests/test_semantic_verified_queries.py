"""Contract: every verified query (VQR) in the semantic view uses only columns the view defines (offline, no Snowflake).

Also: VQR questions are Class B by the repo's own deterministic classifier rules (never Class A), VQR SQL is
read-only, no patient_id literal or parameter, and the agent tool schemas still omit patient_id (AGENTS.md 3.5).
"""
import re
from pathlib import Path

import pytest

from backend.eval.harness.deterministic_routing_baseline import _patterns, classify, SQL as CLASSIFY_SQL

ROOT = Path(__file__).resolve().parents[2]
VIEW = (ROOT / "backend/sql/semantic/01_semantic_view.sql").read_text()
VIEW_CODE = re.sub(r"(?m)^\s*--[^\n]*$", "", VIEW)

# physical table -> (file defining its columns, logical alias in the view)
TABLE_FILES = {
    "SAARTHI.OPERATIONAL.READINESS_STATE": "backend/sql/tables/50_operational.sql",
    "SAARTHI.OPERATIONAL.REVIEW_ISSUE": "backend/sql/tables/50_operational.sql",
    "SAARTHI.CORE.AUTHORIZATION": "backend/sql/tables/20_core.sql",
    "SAARTHI.CORE.PATIENT": "backend/sql/tables/20_core.sql",
    "SAARTHI.CORE.ENCOUNTER": "backend/sql/tables/20_core.sql",
}
DT_FILE = "backend/sql/dynamic_tables/04_scheme_eligibility.sql"


def table_columns(fqn):
    if fqn == "SAARTHI.OPERATIONAL.DT_SCHEME_ELIGIBILITY":
        sel = (ROOT / DT_FILE).read_text()
        sel = sel[sel.index("\nSELECT") + 7: sel.index("\nFROM SAARTHI.CORE.PATIENT p")]
        cols = set()
        for item in re.split(r",\n", sel):
            item = re.sub(r"(?m)--.*$", "", item).strip()
            m = re.search(r"(?:\bAS\s+)?(\w+)\s*$", item)
            cols.add(m.group(1).lower())
        return cols
    text = (ROOT / TABLE_FILES[fqn]).read_text()
    body = text[text.index(f"CREATE TABLE IF NOT EXISTS {fqn} (") :]
    body = body[body.index("(") + 1: body.index("\n);")]
    cols = set()
    for line in body.splitlines():
        line = re.sub(r"--.*$", "", line).strip()
        m = re.match(r"(\w+)\s+(VARCHAR|INT|FLOAT|DATE|BOOLEAN|ARRAY|TIMESTAMP_NTZ)", line, re.I)
        if m:
            cols.add(m.group(1).lower())
    return cols


def parse_vqrs():
    block = VIEW_CODE[VIEW_CODE.index("AI_VERIFIED_QUERIES"):]
    out = []
    for m in re.finditer(r"(\w+) AS \(\s*QUESTION '((?:[^']|'')*)'\s*SQL '((?:[^']|'')*)'\s*\)", block):
        out.append((m.group(1), m.group(2).replace("''", "'"), m.group(3).replace("''", "'")))
    return out


def view_tables():
    return dict((m.group(2).upper(), m.group(1)) for m in
                re.finditer(r"(\w+) AS (SAARTHI\.\w+\.\w+) PRIMARY KEY", VIEW_CODE))


def exposed_columns(alias):
    """Columns of logical table `alias` that the view exposes: referenced as alias.col in dims/facts/metrics, or key columns."""
    cols = set(re.findall(rf"\b{alias}\.(\w+)\b", VIEW_CODE.lower()))
    return cols


VQRS = parse_vqrs()


def test_at_least_six_verified_queries_with_unique_names():
    assert len(VQRS) >= 6
    assert len({n for n, _, _ in VQRS}) == len(VQRS)


@pytest.mark.parametrize("name,question,sql", VQRS)
def test_vqr_uses_only_tables_and_columns_defined_in_the_view(name, question, sql):
    tables = view_tables()
    froms = re.findall(r"\bFROM\s+(SAARTHI\.\w+\.\w+)", sql, re.I)
    assert froms, name
    assert "JOIN" not in sql.upper()           # single-table verified queries only
    for f in froms:
        fqn = f.upper()
        assert fqn in tables, f"{name}: {fqn} is not a table of the view"
        alias = tables[fqn]
        real = table_columns(fqn)
        exposed = exposed_columns(alias)
        stripped = re.sub(r"'[^']*'", "", sql)
        stripped = re.sub(r"\bSAARTHI\.\w+\.\w+", "", stripped)
        aliases = set(re.findall(r"\bAS\s+(\w+)", stripped, re.I))
        keywords = {"select", "from", "where", "group", "by", "order", "count", "and", "or", "as", "desc", "asc",
                    "true", "false", "not", "null", "is", "in"}
        used = {w.lower() for w in re.findall(r"\b[a-z_][a-z_0-9]*\b", stripped, re.I)} - keywords - {a.lower() for a in aliases}
        assert used, name
        for col in used:
            assert col in real, f"{name}: {col} is not a column of {fqn}"
            assert col in exposed, f"{name}: {col} is not defined in the semantic view for {alias}"


@pytest.mark.parametrize("name,question,sql", VQRS)
def test_vqr_is_read_only_class_b_and_has_no_patient_scope_injection(name, question, sql):
    assert re.match(r"\s*SELECT\b", sql, re.I)
    assert not re.search(r"\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|CALL)\b", sql, re.I)
    assert not re.search(r"patient_id\s*=", sql, re.I) and "PAT-" not in sql
    a_pats, b_pats = _patterns(CLASSIFY_SQL.read_text())
    cls, _ = classify(question, a_pats, b_pats)
    assert cls != "A", f"{name}: question trips the Class A keyword scan"


def test_view_states_class_b_scope_and_marks_clause_unverified():
    assert "AI_QUESTION_CATEGORIZATION" in VIEW_CODE
    assert "unverified-needs-deploy" in VIEW
    assert "Class B" in VIEW


def test_agent_tool_schemas_still_omit_patient_id_and_have_no_cortex_analyst_tool():
    agent = (ROOT / "backend/sql/agent/saarthi_agent.sql").read_text()
    spec = agent[agent.index("FROM SPECIFICATION"):]
    tools = spec[spec.index("  tools:"): spec.index("  tool_resources:")]
    assert "patient_id" not in tools
    assert "cortex_analyst" not in spec.lower() and "cortex_search" not in spec.lower()
