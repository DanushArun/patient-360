"""Source checks for SQL/YAML boundaries; live Snowflake compilation is separate."""
from pathlib import Path
import re

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]


def sql_keyword_class(question):
    source = (ROOT / 'backend/sql/procedures/classify_question.sql').read_text()
    clinical, record = source.split('v_q :=', 1)[1].split('-- 2. Structure scan', 1)
    record = record.split('v_class := \'CLASS_B\'', 1)[0]
    for section, outcome in [(clinical, 'CLASS_A'), (record, 'CLASS_B')]:
        patterns = re.findall(r"v_q RLIKE '((?:''|[^'])*)'", section)
        for pattern in patterns:
            pattern = pattern.replace("''", "'").replace('\\\\', '\\')
            if re.fullmatch(pattern, question.lower()):
                return outcome
    return None


@pytest.mark.parametrize('question, expected', [
    ("What is wrong with this patient?", 'CLASS_A'),
    ("What is wrong with this patient's record?", 'CLASS_B'),
    ("What are the conflicts?", 'CLASS_B'),
    ("What are the contradictions?", 'CLASS_B'),
    ("Should she proceed?", 'CLASS_A'),
    ("List the safest dose", 'CLASS_A'),
    ("Which dose would you choose?", 'CLASS_A'),
])
def test_keyword_routing(question, expected):
    # Executes the SQL's actual regexes using Python's engine. This is a
    # regression check, not proof of Snowflake regex dialect compatibility.
    assert sql_keyword_class(question) == expected


def test_agent_orchestration_is_a_separate_instruction():
    source = (ROOT / 'backend/sql/agent/saarthi_agent.sql').read_text()
    spec = yaml.safe_load(source.split('$$')[1])
    assert 'orchestration' in spec['instructions']
    assert 'orchestration: >' not in spec['instructions']['response']


def test_deployment_manifest_contains_no_conflict_markers():
    source = (ROOT / 'backend/sql/setup.sql').read_text()
    assert not re.search(r'^(<<<<<<<|=======|>>>>>>>)', source, re.MULTILINE)


@pytest.mark.parametrize('name', ['07_get_changes.sql', '08_create_review_task.sql'])
def test_patient_tools_recheck_consent_before_data_or_write(name):
    source = (ROOT / 'backend/sql/procedures/tools' / name).read_text()
    start = source.index('-- >>> SAARTHI PREAMBLE v1 BEGIN')
    end = source.index('-- <<< SAARTHI PREAMBLE v1 END')
    block = source[start:end]
    assert 'SAARTHI.GOVERNANCE.CONSENT' in block
    assert "'access_withdrawn'" in block
    assert 'CURRENT_USER()' in block


def test_review_task_scope_is_checked_before_idempotency_replay():
    source = (ROOT / 'backend/sql/procedures/tools/08_create_review_task.sql').read_text()
    guard = source.index('IF (NOT v_issue_in_scope)')
    replay = source.index('v_existing :=')
    write = source.index('MERGE INTO SAARTHI.OPERATIONAL.REVIEW_TASK')
    assert guard < replay < write
    assert "patient_id || ':' || rule_id = :ISSUE_ID" in source
    assert 'patient_id = :v_patient_id' in source
    assert 'issue_id = :ISSUE_ID AND actor_practitioner_id = :v_practitioner' in source
    assert ':ACTION IS NULL' in source
    assert ':IDEMPOTENCY_KEY IS NULL' in source


def test_binding_release_uses_scoped_owner_procedure():
    connector = (ROOT / 'web/lib/snowflake.ts').read_text()
    procedure = (ROOT / 'backend/sql/procedures/release_patient_binding.sql').read_text()
    assert 'CALL SAARTHI.OPERATIONAL.RELEASE_PATIENT_BINDING()' in connector
    assert 'UPDATE SAARTHI.GOVERNANCE.PATIENT_BINDING' not in connector
    assert 'session_id = CURRENT_SESSION()' in procedure
    assert 'snowflake_user = CURRENT_USER()' in procedure
    assert 'EXECUTE AS OWNER' in procedure


def test_manifest_gate_rejects_conflicts_even_when_targets_exist(tmp_path, monkeypatch):
    from backend.scripts import check_gate as gate
    sql = tmp_path / 'backend/sql'
    sql.mkdir(parents=True)
    (sql / 'real.sql').write_text('-- existing file')
    (sql / 'setup.sql').write_text("<<<<<<< source\nEXECUTE IMMEDIATE FROM './real.sql';\n=======\n>>>>>>> branch\n")
    monkeypatch.setattr(gate, 'ROOT', tmp_path)
    monkeypatch.setattr(gate, 'results', [])
    gate.check_manifest()
    assert any(status == gate.FAIL for status, _, _ in gate.results)


@pytest.mark.parametrize('filename', ['01_get_patient_facts.sql', '04_search_reference_documents.sql', '05_cohort_query.sql'])
def test_preamble_gate_detects_removed_access_checks(tmp_path, monkeypatch, filename):
    from backend.scripts import check_gate as gate
    import shutil
    tools = tmp_path / 'backend/sql/procedures/tools'
    shutil.copytree(ROOT / 'backend/sql/procedures/tools', tools)
    path = tools / filename
    path.write_text(path.read_text().replace('snowflake_user = CURRENT_USER()', 'snowflake_user = \'UNSCOPED\''))
    monkeypatch.setattr(gate, 'ROOT', tmp_path)
    monkeypatch.setattr(gate, 'results', [])
    gate.check_preamble()
    assert any(status == gate.FAIL and name.endswith(filename) for status, name, _ in gate.results)
