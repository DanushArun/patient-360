from decimal import Decimal

import pytest


def test_consumption_when_agent_usage_missing_preserves_unmeasured_llm() -> None:
    from backend.verification.consumption import summarize_usage

    rows = {'warehouse': [{'CREDITS_USED_COMPUTE': Decimal('0.1')}],
            'functions': [{'TOKEN_CREDITS': Decimal('0.01'), 'TOKENS': 100}],
            'agents': [], 'search': [{'CREDITS': Decimal('0.02')}]}
    assert summarize_usage(rows)['llm_credits'] is None


def test_consumption_when_actual_rows_present_sums_separate_credit_sources() -> None:
    from backend.verification.consumption import summarize_usage

    rows = {'warehouse': [{'CREDITS_USED_COMPUTE': Decimal('0.1')}],
            'functions': [{'TOKEN_CREDITS': Decimal('0.01'), 'TOKENS': 100}],
            'agents': [{'TOKEN_CREDITS': Decimal('0.03'), 'TOKENS': 400}],
            'search': [{'CREDITS': Decimal('0.02')}]}
    assert summarize_usage(rows)['llm_credits'] == 0.04


def test_consumption_when_window_not_whole_utc_hours_rejects_allocation() -> None:
    from backend.verification.consumption import checked_window

    with pytest.raises(ValueError, match='whole UTC hours'):
        checked_window('2026-10-04T12:01:00+00:00', '2026-10-04T13:00:00+00:00')
