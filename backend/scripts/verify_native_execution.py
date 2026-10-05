"""Capture actual SQL execution and agent observability; definitions are not invocation proof."""
from __future__ import annotations

import argparse
from pathlib import Path

from snowflake.connector.errors import Error as SnowflakeError

from backend.verification.native import incremental, verified_queries
from backend.verification.report import write_report
from backend.verification.session import ROOT, connect, require_success


def execute(args: argparse.Namespace, report: dict) -> None:
    with connect(args.role) as session:
        try:
            source = ROOT / 'backend/sql/semantic/01_semantic_view.sql'
            report['query_results'] = [
                {**query, 'rows': session.query(query['sql'], label=query['name'])}
                for query in verified_queries(source.read_text())]
            require_success(session.call('BIND_PATIENT', [args.patient]))
            report['answer'] = require_success(session.call('ASK_SAARTHI', [args.question]))
            report['observability'] = session.query(
                "SELECT * FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_OBSERVABILITY_EVENTS("
                "'SAARTHI','OPERATIONAL','SAARTHI_AGENT','CORTEX AGENT')) "
                "WHERE TIMESTAMP >= DATEADD('minute',-10,CURRENT_TIMESTAMP())",
                label='actual_agent_observability')
            if not report['observability']:
                raise AssertionError('no actual agent trace captured')
            if args.incremental:
                report['incremental'] = incremental(session)
            report['status'] = 'PARTIAL'
            report['reason'] = 'Trace correlation and skill invocation require adjudication'
            report['skill_invocation_status'] = 'requires_trace_adjudication'
            report['vqr_status'] = 'SQL pairs executed; Analyst VQR selection not proven'
        finally:
            report['events'] = session.events


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--role', default='SAARTHI_APP')
    parser.add_argument('--patient', default='PAT-DC-04')
    parser.add_argument('--question', default='What recorded evidence is missing?')
    parser.add_argument('--incremental', action='store_true')
    parser.add_argument('--output', type=Path, default=Path('evidence/qa/native-live.json'))
    args = parser.parse_args()
    report = {'status': 'FAIL', 'events': []}
    try:
        execute(args, report)
    except (AssertionError, ValueError, OSError, SnowflakeError) as error:
        report['error'] = str(error)
    write_report(args.output, report)
    return 0 if report['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
