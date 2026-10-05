"""Produce reviewable pre-AI Snowflake input SQL; does not execute or grant privileges."""
from __future__ import annotations

import argparse
from pathlib import Path

from backend.verification.evaluation_loader import prepare_sql


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=Path('data/generated/evaluation-v2'))
    parser.add_argument('--output', type=Path,
                        default=Path('data/generated/evaluation-v2/load_pre_ai.sql'))
    args = parser.parse_args()
    sql = prepare_sql(args.directory)
    args.output.write_text(sql)
    print(f'PASS: bounded synthetic input SQL prepared at {args.output}')


if __name__ == '__main__':
    main()
