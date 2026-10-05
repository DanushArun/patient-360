from pathlib import Path

import pytest


SOURCE = Path('backend/sql/procedures/evaluate_gates.sql')


@pytest.mark.parametrize('table', ['PATIENT', 'ENCOUNTER', 'TREATMENT_PLAN', 'ID_MAP',
                                  'COVERAGE', 'AUTHORIZATION', 'CLINICAL_EVENT'])
def test_gate_when_historical_snapshot_requested_reads_mutable_rows_at_cutoff(table: str) -> None:
    source = SOURCE.read_text()
    assert f'SAARTHI.CORE.{table} AT(TIMESTAMP => :v_snapshot)' in source


def test_authorization_when_replayed_checks_expiry_against_snapshot_not_wall_clock() -> None:
    source = SOURCE.read_text().split("ELSEIF (v_rule_id = 'COV-AUTH-001') THEN", 1)[1]
    source = source.split("ELSEIF (v_rule_id = 'CLIN-CRCL-001') THEN", 1)[0]
    assert 'expires_at > CURRENT_TIMESTAMP()' not in source and 'expires_at > :v_known_as_of' in source


def test_readiness_when_snapshot_dependency_fails_returns_error_with_clock() -> None:
    source = Path('backend/sql/procedures/tools/02_get_readiness.sql').read_text()
    assert "'readiness_snapshot_unavailable'" in source and 'EXCEPTION WHEN STATEMENT_ERROR' in source
