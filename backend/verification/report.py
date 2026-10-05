"""Persist complete outcomes, including failed and blocked live runs."""
from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
from typing import Any


def write_report(path: Path, payload: dict[str, Any]) -> None:
    revision = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True,
                              text=True, check=True).stdout.strip()
    report = {"recorded_at": datetime.now(timezone.utc).isoformat(),
              "base_revision": revision, "working_tree": True, **payload}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2, default=str) + "\n")
    print(f"{report['status']}: {path}")
