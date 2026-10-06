from pathlib import Path
import re


TASKS = {
    'TASK_EXTRACT_ASSERTIONS': 'extract_assertions.sql',
    'TASK_FLATTEN_FHIR': 'flatten_fhir.sql',
    'TASK_NOTIFY': 'notify.sql',
    'TASK_PARSE_DOCUMENTS': 'parse_documents.sql',
    'TASK_RECONCILE_EVIDENCE': 'reconcile_evidence.sql',
    'TASK_REFRESH_READINESS': 'refresh_readiness.sql',
    'TASK_SAARTHI_ORCHESTRATOR': 'orchestrator.sql',
}


def test_every_scheduled_task_uses_utc_for_snapshot_clocks() -> None:
    root = Path('backend/sql/tasks')
    for task, filename in TASKS.items():
        source = (root / filename).read_text()
        match = re.search(rf'CREATE OR REPLACE TASK SAARTHI\.OPERATIONAL\.{task}\b(.*?)\nAS\b',
                          source, re.IGNORECASE | re.DOTALL)
        assert match, f'{task} definition missing'
        assert re.search(r"\bTIMEZONE\s*=\s*'UTC'", match[1], re.IGNORECASE), task
