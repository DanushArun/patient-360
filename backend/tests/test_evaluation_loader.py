from pathlib import Path

import pytest

from backend.scripts.prepare_independent_evaluation import prepare


def test_evaluation_sql_when_generated_contains_only_fresh_cohort(tmp_path: Path) -> None:
    from backend.verification.evaluation_loader import prepare_sql

    prepare(Path('data/generated/cohort_events.json'), tmp_path)
    sql = prepare_sql(tmp_path)
    assert 'PAT-EVAL-HELDOUT-04' in sql and 'PAT-DC-04' not in sql and 'AI_COMPLETE' not in sql


def test_evaluation_sql_when_pdf_bytes_change_rejects_loading(tmp_path: Path) -> None:
    from backend.verification.evaluation_loader import prepare_sql

    result = prepare(Path('data/generated/cohort_events.json'), tmp_path)
    (tmp_path / result['documents'][0]['path']).write_bytes(b'changed')
    with pytest.raises(ValueError, match='bytes changed'):
        prepare_sql(tmp_path)


def test_evaluation_sql_when_manifest_changes_rejects_loading(tmp_path: Path) -> None:
    from backend.verification.evaluation_loader import prepare_sql

    prepare(Path('data/generated/cohort_events.json'), tmp_path)
    (tmp_path / 'manifest.json').write_text('{}')
    with pytest.raises(ValueError, match='manifest'):
        prepare_sql(tmp_path)
