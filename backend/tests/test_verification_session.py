"""Offline tests of live-runner evidence capture; no Snowflake success is simulated."""
from types import SimpleNamespace
from pathlib import Path

import pytest


def test_query_when_success_records_real_cursor_identifier() -> None:
    from backend.verification.session import Session

    cursor = SimpleNamespace(sfqid="qid-from-driver", description=[("RESULT",)],
                             execute=lambda *a, **k: None, fetchall=lambda: [("ok",)],
                             close=lambda: None)
    session = Session(SimpleNamespace(cursor=lambda: cursor))
    session.query("SELECT 1", label="positive")
    assert session.events[0]["query_id"] == "qid-from-driver"


def test_call_when_identifier_is_injected_rejects_before_execution() -> None:
    from backend.verification.session import Session

    with pytest.raises(ValueError, match="procedure"):
        Session(None).call("X); DROP DATABASE SAARTHI", [])


def test_variant_when_database_returns_error_rejects_positive_control() -> None:
    from backend.verification.session import require_success

    with pytest.raises(AssertionError, match="access_withdrawn"):
        require_success({"error": "access_withdrawn"})


def test_success_when_pipeline_phase_errors_rejects_nested_failure() -> None:
    from backend.verification.session import require_success
    import pytest

    with pytest.raises(AssertionError, match='pass_b_invalid'):
        require_success({'extract': {'error': 'pass_b_invalid'}})


def test_connection_when_options_built_pins_utc_snapshot_clocks(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    from backend.verification import session

    key = tmp_path / 'key.p8'
    key.write_text('test key path only; connector is not called')
    # Hermetic: the allowed account comes from the test, never from this machine's web/.env.local.
    monkeypatch.setenv('SNOWFLAKE_ACCOUNT', 'KGTPGHJ-YJ28449')
    monkeypatch.setenv('SAARTHI_SNOWFLAKE_ALLOWED_ACCOUNT', 'KGTPGHJ-YJ28449')
    monkeypatch.setenv('SNOWFLAKE_USER', 'TEST_USER')
    monkeypatch.setenv('SNOWFLAKE_PRIVATE_KEY_PATH', str(key))
    assert session.connection_options('SAARTHI_APP')['session_parameters']['TIMEZONE'] == 'UTC'
