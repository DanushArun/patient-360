"""Reject incomplete acceptance records; technical checks run separately."""

import argparse
import json
from pathlib import Path
from typing import Any


ACCOUNT = "KGTPGHJ-YJ28449"
REQUIRED_IDS = {f"S{number:02}" for number in range(1, 23)}
REQUIRED_IDS |= {f"X{number}" for number in range(1, 7)}
REQUIRED_IDS |= {f"G{number}" for number in range(1, 10)}
ROOT = Path(__file__).resolve().parents[1]


def evidence_failures(label: str, evidence: object) -> list[str]:
    if not isinstance(evidence, list) or not evidence:
        return [f"{label}: missing evidence"]
    failures = []
    for item in evidence:
        if not isinstance(item, str) or not item or Path(item).is_absolute():
            failures.append(f"{label}: invalid evidence path {item}")
            continue
        try:
            path = (ROOT / item).resolve()
            if not path.is_relative_to(ROOT) or not path.is_file() or path.stat().st_size == 0:
                failures.append(f"{label}: unreadable evidence {item}")
        except (OSError, RuntimeError, ValueError):
            failures.append(f"{label}: unreadable evidence {item}")
    return failures


def requirement_failures(requirement: dict[str, Any]) -> list[str]:
    label = requirement.get("id", "unknown")
    failures = []
    status = requirement.get("status", "pending")
    if status != "passed":
        failures.append(f"{label}: {status}")
    if status != "passed":
        return failures
    failures.extend(evidence_failures(label, requirement.get("evidence")))
    if requirement.get("parent_reviewed") is not True:
        failures.append(f"{label}: parent review required")
    return failures


def acceptance_failures(packet: object) -> list[str]:
    if not isinstance(packet, dict):
        return ["packet must be an object"]
    failures = []
    if packet.get("account") != ACCOUNT:
        failures.append("account mismatch")
    if packet.get("acceptance") != "accepted":
        failures.append("parent acceptance required")
    requirements = packet.get("requirements", [])
    if not isinstance(requirements, list):
        return failures + ["requirements must be a list"]
    if not requirements:
        failures.append("requirements missing")
    valid = [item for item in requirements
             if isinstance(item, dict) and isinstance(item.get("id"), str)]
    if len(valid) != len(requirements):
        failures.append("requirement must be an object with a string ID")
    ids = [item["id"] for item in valid]
    for missing in sorted(REQUIRED_IDS - set(ids)):
        failures.append(f"{missing}: requirement missing")
    if len(set(ids)) != len(ids):
        failures.append("duplicate requirement IDs")
    for requirement in valid:
        failures.extend(requirement_failures(requirement))
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("packet", type=Path)
    args = parser.parse_args()
    try:
        packet = json.loads(args.packet.read_text())
        failures = acceptance_failures(packet)
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        failures = [f"packet unreadable: {error}"]
    print(json.dumps({"accepted": not failures, "failures": failures}, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
