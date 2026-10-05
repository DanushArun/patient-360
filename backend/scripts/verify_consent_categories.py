"""Verify category isolation with a reversible financial-only synthetic consent fixture."""
import argparse
from pathlib import Path

from snowflake.connector.errors import Error as SnowflakeError

from backend.verification.consent_categories import verify_categories
from backend.verification.report import write_report
from backend.verification.session import connect


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--allow-consent-narrowing', action='store_true', required=True)
    parser.add_argument('--admin-role', default='ACCOUNTADMIN')
    parser.add_argument('--output', type=Path, default=Path('evidence/qa/consent-categories.json'))
    arguments = parser.parse_args()
    report = {'status': 'FAIL', 'events': []}
    try:
        with connect() as session, connect(arguments.admin_role) as admin:
            try:
                report.update(verify_categories(admin, session))
            finally:
                report['events'].extend(session.events + admin.events)
    except (AssertionError, ValueError, KeyError, TypeError, OSError, SnowflakeError) as error:
        report.update(status='FAIL', error_type=type(error).__name__, error=str(error)[:300])
    write_report(arguments.output, report)
    return 0 if report['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
