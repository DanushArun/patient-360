import hashlib
import json
from pathlib import Path

from pypdf import PdfReader
import pytest


def test_evaluation_pack_when_prepared_has_disjoint_actual_documents(tmp_path: Path) -> None:
    from backend.scripts.prepare_independent_evaluation import prepare
    from backend.verification.metrics import verify_gold, verify_split

    result = prepare(Path('data/generated/cohort_events.json'), tmp_path)
    dev = result['dev']
    heldout = result['heldout']
    verify_split(dev, heldout)
    verify_gold(result['structured_gold'])
    assert len(dev) == len(heldout) == 48 and len(result['structured_gold']) == 44


def test_evaluation_when_prepared_has_missing_and_conflict_gold_before_model_runs(
    tmp_path: Path,
) -> None:
    from backend.scripts.prepare_independent_evaluation import prepare

    result = prepare(Path('data/generated/cohort_events.json'), tmp_path)
    edges = [row for row in result['structured_gold'] if row.get('missing_conflict')]
    assert len(edges) == 8 and {row['expected_claims'][0]['outcome'] for row in edges} == {
        'not_evaluated', 'conflicting'}


def test_evaluation_pack_when_frozen_hashes_match_written_files(tmp_path: Path) -> None:
    from backend.scripts.prepare_independent_evaluation import prepare

    prepare(Path('data/generated/cohort_events.json'), tmp_path)
    freeze = json.loads((tmp_path / 'freeze.json').read_text())
    assert all(freeze[name] == hashlib.sha256((tmp_path / f'{name}.jsonl').read_bytes()).hexdigest()
               for name in ['dev', 'heldout', 'structured_gold'])


def test_evaluation_documents_when_rendered_preserve_synthetic_identity(tmp_path: Path) -> None:
    from backend.scripts.prepare_independent_evaluation import prepare

    pack = prepare(Path('data/generated/cohort_events.json'), tmp_path)
    assert all('SYNTHETIC' in '\n'.join(page.extract_text() for page in PdfReader(
        tmp_path / row['path']).pages) for row in pack['documents'])


def test_evaluation_prepare_when_final_frozen_refuses_regeneration(tmp_path: Path) -> None:
    from backend.scripts.prepare_independent_evaluation import prepare

    (tmp_path / 'freeze.json').write_text(json.dumps({'status': 'FROZEN'}))
    with pytest.raises(ValueError, match='immutable'):
        prepare(Path('data/generated/cohort_events.json'), tmp_path)
