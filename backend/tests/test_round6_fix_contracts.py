"""Round 6 contracts (offline; every Snowflake-side behaviour here is unverified-needs-deploy)."""
import json
import re
import subprocess
import sys
from pathlib import Path

from backend.eval.harness.deterministic_routing_baseline import run
from backend.scripts import build_deploy_bundle as bundle

ROOT = Path(__file__).resolve().parents[2]
read = lambda rel: (ROOT / rel).read_text()


def test_parse_task_dedupes_on_stable_source_path_and_records_it_on_every_new_row():
    sql = read("backend/sql/tasks/parse_documents.sql")
    # Both cursors key on the stage path first; etag only as a legacy fallback for rows with no source_path.
    assert sql.count("doc.source_path = d.relative_path") == 2
    assert "doc.file_hash = d.etag" in sql and sql.count("doc.file_hash = d.etag") == 2
    assert not re.search(r"WHERE doc\.file_hash = d\.etag\s*\)", sql)       # never etag alone
    inserts = re.findall(r"INSERT INTO SAARTHI\.DOCUMENTS\.DOCUMENT\s*\(([^)]*)\)", sql)
    assert len(inserts) >= 4 and all("source_path" in cols for cols in inserts)
    assert "source_path VARCHAR" in read("backend/sql/tables/30_documents.sql")


def test_bundle_carries_the_dedupe_fix_semantic_view_and_skills_without_drops():
    s04 = read("backend/sql/deploy/04_tasks_and_grants.sql")
    assert "ADD COLUMN IF NOT EXISTS source_path" in s04
    assert "doc.source_path = d.relative_path" in s04
    assert s04.index("ADD COLUMN IF NOT EXISTS source_path") < s04.index("CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.parse_documents_proc")
    assert "PARSE_DOCUMENTS_PROC" in s04.upper()
    assert "CREATE OR REPLACE TASK SAARTHI.OPERATIONAL.TASK_PARSE_DOCUMENTS" not in s04   # SITAR user is account-specific
    assert s04.count("COPY INTO @SAARTHI.STAGES.SKILLS/") == 4
    s02 = read("backend/sql/deploy/02_gates_and_scheme_table.sql")
    assert "AI_VERIFIED_QUERIES" in s02 and "EXCEPTION" in s02[s02.index("CREATE OR REPLACE SEMANTIC VIEW"):]
    for n in ("02_gates_and_scheme_table.sql", "04_tasks_and_grants.sql"):
        assert not re.search(r"(?i)DROP\s+TABLE", read("backend/sql/deploy/" + n))


def test_skills_upload_sql_round_trips_each_skill_md_exactly_and_is_current():
    sql = read("backend/skills/upload_skills.sql")
    assert sql == bundle.skills_upload_sql()
    for name in bundle.SKILL_NAMES:
        m = re.search(rf"COPY INTO @SAARTHI\.STAGES\.SKILLS/{name}/SKILL\.md\nFROM \(SELECT '(.*?)'\)\nFILE_FORMAT", sql, re.S)
        assert m, name
        assert m.group(1).replace("''", "'").replace("\\\\", "\\") == read(f"backend/skills/{name}/SKILL.md")
    assert "SINGLE = TRUE OVERWRITE = TRUE" in sql and "\nPUT " not in sql


def test_setup_loads_skills_before_agent_and_agent_references_skill_folders_not_files():
    setup = read("backend/sql/setup.sql")
    assert setup.index("../skills/upload_skills.sql") < setup.index("./agent/saarthi_agent.sql")
    assert not re.search(r"(?m)^--\s*EXECUTE IMMEDIATE FROM '\.\./skills/upload_skills\.sql'", setup)
    agent = read("backend/sql/agent/saarthi_agent.sql")
    for name in bundle.SKILL_NAMES:
        assert f'path: "@SAARTHI.STAGES.SKILLS/{name}"' in agent
    assert "SKILL.md\"" not in agent.split("tools:")[0].split("skills:")[-1]


def test_answer_gateway_validates_before_and_after_inference():
    gateway = read("backend/sql/agent/ask_saarthi.sql")
    finalizer = read("backend/sql/procedures/answer_gateway_finalize.sql")
    assert "VALIDATE_ANSWER" in gateway and "VALIDATE_ANSWER" in finalizer


def test_deterministic_routing_baseline_counts_are_reproducible_and_fail_closed():
    report, results = run(ROOT / "data/eval/dev.jsonl")
    # absolute counts measured offline (rules only; AI_CLASSIFY fallback not run).
    # 4 Oct 2026: 15 decided, 25 residue, 6 of 9 Class A refused, 14 correct.
    # 6 Oct 2026, after the wider judgment and record scans: the numbers below. Residue is
    # refused on an account without AI_CLASSIFY, so it is over-refusal there, never an answer.
    assert report["questions"] == 40 and report["decided_by_rules"] == 34
    assert report["residue_needs_llm_fallback"] == 6
    assert report["class_a_total"] == 9 and report["class_a_refused_by_rules"] == 8
    assert report["class_a_answered_as_b_by_rules"] == []              # the highest-harm error did not occur
    assert report["class_b_over_refused_by_rules"] == ["DEV-018"]
    assert report["class_correct_of_decided"] == 33
    saved = json.loads(read("backend/eval/results/dev_deterministic_routing_report.json"))
    assert saved == json.loads(json.dumps(report))

