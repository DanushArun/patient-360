"""Verify existing SQL task history without invoking an AI model."""
from __future__ import annotations

import argparse
from pathlib import Path
import re

from snowflake.connector.errors import Error as SnowflakeError

from backend.verification.history import verify_history
from backend.verification.report import write_report
from backend.verification.session import connect, require_success


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--patient', required=True)
    parser.add_argument('--task', required=True)
    parser.add_argument('--rule', required=True)
    parser.add_argument('--output', type=Path, default=Path('evidence/qa/history-live.json'))
    args = parser.parse_args()
    report = {'status': 'FAIL', 'events': []}
    try:
        if not re.fullmatch(r'PAT-[A-Z0-9-]+', args.patient):
            raise ValueError('only synthetic patient identifiers are allowed')
        with connect('ACCOUNTADMIN') as admin, connect() as session:
            try:
                require_success(session.call('BIND_PATIENT', [args.patient]))
                report.update(verify_history(admin, session, args.task, args.rule))
            finally:
                report['events'] = admin.events + session.events
    except (AssertionError, KeyError, ValueError, OSError, SnowflakeError) as error:
        report.update(error_type=type(error).__name__, error=str(error)[:300])
    write_report(args.output, report)
    return 0 if report['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
