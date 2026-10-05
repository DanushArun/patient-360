"""Read actual metering rows for a declared, whole-hour synthetic benchmark window."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from backend.verification.session import Session


def checked_window(start: str, end: str) -> tuple[datetime, datetime]:
    left, right = datetime.fromisoformat(start), datetime.fromisoformat(end)
    if (any(value.utcoffset() != timedelta(0) or value.minute or value.second
            or value.microsecond for value in [left, right]) or left >= right):
        raise ValueError('metering allocation requires ordered whole UTC hours')
    if right > datetime.now(timezone.utc) - timedelta(hours=8):
        raise ValueError('metering window must end at least eight hours before collection')
    return left, right


def sum_column(rows: list[dict], column: str) -> float | None:
    if not rows or any(row.get(column) is None for row in rows):
        return None
    values = [Decimal(str(row[column])) for row in rows]
    if any(not value.is_finite() or value < 0 for value in values):
        raise ValueError('invalid metering consumption')
    return float(sum(values))


def summarize_usage(rows: dict[str, list[dict]]) -> dict:
    functions = sum_column(rows['functions'], 'TOKEN_CREDITS')
    agents = sum_column(rows['agents'], 'TOKEN_CREDITS')
    return {'warehouse_credits': sum_column(rows['warehouse'], 'CREDITS_USED_COMPUTE'),
            'llm_credits': functions + agents if functions is not None and agents is not None
            else None, 'search_credits': sum_column(rows['search'], 'CREDITS'),
            'function_tokens': sum_column(rows['functions'], 'TOKENS'),
            'agent_tokens': sum_column(rows['agents'], 'TOKENS'),
            'attribution_method': 'Whole-window allocation; requires exclusive benchmark use',
            'cost_boundary': 'Compute, model tokens and search serving; excludes storage/tax',
            'double_count_prevention': 'Do not add agent METADATA AI/SQL credits again'}


def capture_usage(session: Session, window: tuple[datetime, datetime]) -> dict:
    start, end = window
    warehouse = session.query('SELECT start_time,end_time,warehouse_name,credits_used_compute '
        'FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY '
        'WHERE warehouse_name=%s AND start_time>=%s AND end_time<=%s',
        ('SAARTHI_AI_WH', start, end), 'warehouse_metering')
    functions = session.query('SELECT f.query_id,f.model_name,f.warehouse_id,f.function_name,'
        'f.tokens,f.token_credits FROM '
        'SNOWFLAKE.ACCOUNT_USAGE.CORTEX_FUNCTIONS_QUERY_USAGE_HISTORY f '
        'JOIN SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY q ON q.query_id=f.query_id '
        'WHERE q.warehouse_name=%s AND q.start_time>=%s AND q.end_time<=%s '
        "AND f.function_name NOT ILIKE '%AGENT%'",
        ('SAARTHI_AI_WH', start, end), 'function_metering')
    agents = session.query('SELECT start_time,end_time,request_id,parent_request_id,tokens,'
        'token_credits FROM SNOWFLAKE.ACCOUNT_USAGE.CORTEX_AGENT_USAGE_HISTORY '
        "WHERE agent_database_name='SAARTHI' AND agent_schema_name='OPERATIONAL' "
        "AND agent_name='SAARTHI_AGENT' AND start_time>=%s AND end_time<=%s",
        (start, end), 'agent_metering')
    search = session.query('SELECT start_time,end_time,service_name,credits FROM '
        'SNOWFLAKE.ACCOUNT_USAGE.CORTEX_SEARCH_SERVING_USAGE_HISTORY '
        "WHERE database_name='SAARTHI' AND schema_name='DOCUMENTS' "
        "AND service_name IN ('PATIENT_DOC_SEARCH','REFERENCE_DOC_SEARCH') "
        'AND start_time>=%s AND end_time<=%s', (start, end), 'search_metering')
    rows = {'warehouse': warehouse, 'functions': functions, 'agents': agents, 'search': search}
    usage = summarize_usage(rows)
    usage['source_query_ids'] = [event['query_id'] for event in session.events
                                 if event.get('query_id')]
    return {'usage': usage, 'raw_rows': rows, 'window': [start.isoformat(), end.isoformat()]}
