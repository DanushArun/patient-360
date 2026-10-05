"""Freeze actual two-pass assertion IDs before running or tuning heldout answers."""
from __future__ import annotations

import argparse
from pathlib import Path

from backend.verification.evaluation_inputs import freeze_gold
from backend.verification.session import connect


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=Path('data/generated/evaluation-v2'))
    args = parser.parse_args()
    with connect('ACCOUNTADMIN') as session:
        freeze = freeze_gold(session, args.directory)
    print(f"PASS: immutable gold frozen; SHA-256 {freeze['gold']}")


if __name__ == '__main__':
    main()
