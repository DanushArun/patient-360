"""Contracts for the demo hero, the demo prep runner and the R7 pairing they depend on."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def test_task_extraction_pairs_the_two_readers_by_exact_quote_not_by_labels():
    sql = read("backend/sql/tasks/extract_assertions.sql")
    pairing = sql[sql.index("SELECT COUNT(*) INTO :v_first_matches"):sql.index("IF (v_first_matches=1")]
    assert "value:quote::VARCHAR=:v_quote" in pairing
    # Free-form labels differ between model families; they must not decide agreement.
    assert "value:predicate" not in pairing and "value:subject" not in pairing
    # Agreement on the fact itself is still required.
    for check in ("EQUAL_NULL(NULLIF(v_value,'null'),v_pass2_value)",
                  "v_missing=v_result_b:missingness_state::VARCHAR",
                  "POSITION(v_quote,v_page_text,POSITION(v_quote,v_page_text)+1)=0"):
        assert check in sql


def test_hero_seed_is_synthetic_relative_and_re_anchoring():
    sql = read("backend/sql/demo/load_demo_hero.sql")
    assert "PAT-DC-12" in sql and "SYNTHETIC" in sql
    # Every clinical date is computed from tomorrow's anchor; no literal visit or event date.
    body = "\n".join(line for line in sql.splitlines() if not line.lstrip().startswith("--"))
    assert not re.search(r"'20\d\d-\d\d-\d\d", body.replace("'1980-03-14'", ""))
    assert "WHEN MATCHED THEN UPDATE SET t.scheduled_time" in sql
    # Page text is only ever rewritten in place at the same length (cited spans never move).
    assert "LENGTH(t.text) = LENGTH(s.page_text)" in sql


def test_hero_expected_outcomes_are_the_demo_story():
    from backend.scripts.prepare_demo import EXPECTED, HERO_DOCS

    assert EXPECTED["PAT-DC-12"] == {"SURV-LVEF-002": "fail", "COV-AUTH-001": "conflicting"}
    assert len(HERO_DOCS) == 5
    assert all(doc.endswith("-DC-12") for doc in HERO_DOCS)


def test_cohort_document_re_anchor_only_rewrites_the_printed_date():
    sql = read("backend/sql/demo/reanchor_cohort_documents.sql")
    assert "Report date: [0-9]{4}-[0-9]{2}-[0-9]{2}" in sql
    assert "LENGTH(t.text) = LENGTH(s.text)" in sql
    assert "PAT-DC-(0[1-9]|1[01])" in sql  # the hero writes its own pages
