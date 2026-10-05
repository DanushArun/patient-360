"""Verify platform and HTTP health, or reject a clean install into an existing database."""
from __future__ import annotations

import argparse
from pathlib import Path
from urllib.error import URLError

from snowflake.connector.errors import Error as SnowflakeError

from backend.verification.preflight import check_platform, health, require_empty_database
from backend.verification.report import write_report
from backend.verification.session import Session, connect


def verify_request(session: Session, args: argparse.Namespace) -> dict:
    if args.clean_account:
        require_empty_database(session.query("SHOW DATABASES LIKE 'SAARTHI'"))
        return {'clean_account': True}
    if not args.frontend_url or not args.backend_url or not args.release_revision:
        raise ValueError('frontend URL, backend health URL and release revision required')
    return {'platform': check_platform(session),
            'http': [health(args.frontend_url), health(args.backend_url, args.release_revision)]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--clean-account', action='store_true')
    parser.add_argument('--role', default='SAARTHI_APP')
    parser.add_argument('--frontend-url')
    parser.add_argument('--backend-url')
    parser.add_argument('--release-revision')
    parser.add_argument('--output', type=Path, default=Path('evidence/qa/preflight-live.json'))
    args = parser.parse_args()
    report = {'status': 'FAIL', 'events': []}
    try:
        with connect(args.role) as session:
            try:
                report.update(verify_request(session, args))
                report['status'] = 'PASS'
            finally:
                report['events'] = session.events
    except (AssertionError, ValueError, OSError, URLError, SnowflakeError) as error:
        report['error'] = str(error)
    write_report(args.output, report)
    return 0 if report['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
