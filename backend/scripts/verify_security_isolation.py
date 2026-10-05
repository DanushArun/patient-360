"""Run with python -m backend.scripts.verify_security_isolation; synthetic records only."""
from __future__ import annotations

import argparse
from pathlib import Path
from snowflake.connector.errors import Error as SnowflakeError

from backend.verification.report import write_report
from backend.verification.security import concurrent_probe, cross_patient, positive, revoked_consent
from backend.verification.security import security_status
from backend.verification.session import connect


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--allow-consent-revocation", action="store_true")
    parser.add_argument("--admin-role", default="ACCOUNTADMIN")
    parser.add_argument("--output", type=Path, default=Path("evidence/qa/security-live.json"))
    args = parser.parse_args()
    report = {"status": "FAIL", "probes": {}, "events": []}
    try:
        with connect() as session:
            try:
                positive(session, "PAT-DC-04")
                report["probes"]["A"] = {"status": "PASS", "nonempty": True}
                report["probes"]["B"] = {"status": "PASS", **cross_patient(session, "PAT-DC-07")}
                if not args.allow_consent_revocation:
                    raise ValueError("Probe C requires --allow-consent-revocation")
                with connect(args.admin_role) as admin:
                    try:
                        result = revoked_consent(admin, session)
                        report["probes"]["C"] = {"status": "PASS", **result}
                    finally:
                        report["events"].extend(admin.events)
            finally:
                report["events"].extend(session.events)
        report["probes"]["D"] = {"status": "PASS", "connections": concurrent_probe()}
        report["status"] = security_status(report['probes'])
    except (AssertionError, ValueError, TimeoutError, OSError, SnowflakeError) as error:
        report.update(error_type=type(error).__name__, error=str(error)[:300])
    write_report(args.output, report)
    return {'PASS': 0, 'PARTIAL': 2, 'FAIL': 1}[report['status']]


if __name__ == "__main__":
    raise SystemExit(main())
