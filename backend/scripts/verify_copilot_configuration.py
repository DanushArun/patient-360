"""Check every agent tool schema against its SQL procedure before account deployment."""
from __future__ import annotations

import argparse
from pathlib import Path

from jsonschema.exceptions import SchemaError
import yaml

from backend.verification.copilot import verify_configuration
from backend.verification.report import write_report
from backend.verification.session import ROOT


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path,
                        default=Path('evidence/qa/copilot-source-configuration.json'))
    args = parser.parse_args()
    report = {'status': 'FAIL', 'proof_type': 'offline_configuration'}
    try:
        report['configuration'] = verify_configuration(ROOT / 'backend/sql')
        report['status'] = 'PASS'
    except (ValueError, KeyError, OSError, SchemaError, yaml.YAMLError) as error:
        report['error'] = str(error)
    write_report(args.output, report)
    return 0 if report['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
