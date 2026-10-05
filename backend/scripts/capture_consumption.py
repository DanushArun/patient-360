"""Capture actual account consumption; missing rows are unmeasured, never zero-cost proof."""
from __future__ import annotations

import argparse
from pathlib import Path

from snowflake.connector.errors import Error as SnowflakeError

from backend.verification.consumption import capture_usage, checked_window
from backend.verification.report import write_report
from backend.verification.session import connect


def execute(args: argparse.Namespace, report: dict) -> None:
    window = checked_window(args.start, args.end)
    with connect('ACCOUNTADMIN') as session:
        try:
            report.update(capture_usage(session, window))
        finally:
            report['events'] = session.events
    usage = report['usage']
    complete = all(usage[key] is not None for key in [
        'warehouse_credits', 'llm_credits', 'search_credits'])
    report.update(status='PASS' if complete else 'UNMEASURED',
                  exclusive_window_attested=True, evidence_type='ACCOUNT_USAGE')


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--start', required=True)
    parser.add_argument('--end', required=True)
    parser.add_argument('--exclusive-benchmark-window', action='store_true', required=True,
                        help='Attest no other work used this warehouse/agent/search window')
    parser.add_argument('--output', type=Path, default=Path('evidence/qa/consumption-live.json'))
    args = parser.parse_args()
    report = {'status': 'FAIL', 'events': []}
    try:
        execute(args, report)
    except (ValueError, OSError, SnowflakeError) as error:
        report.update(error_type=type(error).__name__, error_code=getattr(error, 'errno', None))
    write_report(args.output, report)
    if 'usage' in report:
        write_report(args.output.with_name(args.output.stem + '-usage.json'), report['usage'])
    print(f"{report['status']}: actual metering receipt written to {args.output}")
    return 0 if report['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
