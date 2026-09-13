"""
Synthetic patient generator — Task 1, Step 6-8 (team plan, planning/dev2-brief).

Produces a plain list of ~10 fake patients as dictionaries. Every field is
invented; no real patient data. Run directly, no Snowflake dependency.

Step 7 requires two patients broken on purpose, because these are exactly
the cases the app must catch rather than silently swallow:
  - P-006: lab report stuck at "pending" forever
  - P-007: authorization disagrees between two sources for the same request

Run:    python data/generator/generate_patients.py
Output: data/fixtures/patients.json
"""

import json
import random
from pathlib import Path

random.seed(17)  # fixed seed so the same fake data regenerates every run

DIAGNOSES = [
    "Invasive ductal carcinoma, HER2-positive",
    "Invasive ductal carcinoma, ER/PR-positive HER2-negative",
    "Triple-negative breast carcinoma",
]


def make_patient(idx: int) -> dict:
    return {
        "patient_id": f"P-{idx:03d}",
        "diagnosis": random.choice(DIAGNOSES),
        "encounter_date": f"2026-09-{random.randint(15, 29):02d}",
        "lab_report_status": "final",
        "authorization": {
            "table_status": "approved",
            "letter_status": "approved",
        },
    }


def generate(n: int = 10) -> list[dict]:
    patients = [make_patient(i) for i in range(1, n + 1)]

    # Broken case 1: lab report stuck at "pending" forever
    patients[5]["lab_report_status"] = "pending"

    # Broken case 2: same authorization request, two sources disagree
    patients[6]["authorization"] = {"table_status": "pending", "letter_status": "approved"}

    return patients


def main():
    out_path = Path(__file__).resolve().parents[1] / "fixtures" / "patients.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    patients = generate(10)
    out_path.write_text(json.dumps(patients, indent=2))
    print(f"Wrote {len(patients)} synthetic patients to {out_path}")


if __name__ == "__main__":
    main()
