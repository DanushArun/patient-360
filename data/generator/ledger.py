"""Seeded deterministic fact ledger — the single source of truth for the
deep-case patient. WORK-PLAN.md Day 1-2, Contract 5 (ARCHITECTURE-HANDOFF.md
146, SPEC.md 9).

Every later projection — per-source-system CSVs, the FHIR R4 bundle,
synthetic PDF reports — is derived from a `Ledger`, never generated
independently. That is what makes the 80-question eval auto-truthable: the
ledger *is* the ground truth, and a projection is just a different rendering
of it.

Determinism is a judge requirement, not a nicety: `generate_deep_case(seed)`
called twice with the same seed must return structurally identical output.
A single `random.Random(seed)` instance (never the `random` module's global
state) is threaded through every generation step to guarantee that — two
ledgers built in the same process, or in two different processes, are equal.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timedelta

_BASE_EPOCH = datetime(2025, 1, 6)  # fixed anchor, not "today" — reproducibility


@dataclass(frozen=True)
class Facility:
    facility_id: str
    name: str
    city: str


@dataclass(frozen=True)
class Identifier:
    facility_id: str
    system: str
    value: str


@dataclass(frozen=True)
class ClinicalEvent:
    event_id: str
    kind: str
    facility_id: str
    event_time: datetime
    source_recorded_at: datetime
    specimen_id: str | None = None
    specimen_source: str | None = None
    grade: str | None = None
    ihc_score: str | None = None
    t_score: float | None = None


@dataclass(frozen=True)
class TreatmentPlanVersion:
    version: int
    effective_from: datetime
    regimen: str
    notes: str


@dataclass(frozen=True)
class Ledger:
    patient_id: str
    seed: int
    facilities: tuple[Facility, ...]
    identifiers: tuple[Identifier, ...]
    events: tuple[ClinicalEvent, ...]
    treatment_plan_versions: tuple[TreatmentPlanVersion, ...]


_FACILITIES = (
    Facility("FAC-01", "Apollo Cancer Centre", "Chennai"),
    Facility("FAC-02", "Tata Memorial Hospital", "Mumbai"),
    Facility("FAC-03", "AIIMS", "New Delhi"),
    Facility("FAC-04", "HCG Cancer Centre", "Bengaluru"),
)


def _identifiers() -> tuple[Identifier, ...]:
    # 7 identifiers across the 4 facilities, zero ABHA — the real record this
    # case is modelled on had 7 identifiers and none was ABHA. That absence
    # is R4's design centre, not an oversight, so it must survive every run.
    specs = (
        ("FAC-01", "MRN"),
        ("FAC-01", "LAB_ACCESSION_ID"),
        ("FAC-02", "MRN"),
        ("FAC-02", "UHID"),
        ("FAC-03", "MRN"),
        ("FAC-04", "MRN"),
        ("FAC-04", "INSURANCE_MEMBER_ID"),
    )
    return tuple(
        Identifier(facility_id=fac, system=system, value=f"{system}-{800000 + i}")
        for i, (fac, system) in enumerate(specs)
    )


def _walk_forward(rng: random.Random, start: datetime, min_days: int, max_days: int) -> datetime:
    return start + timedelta(days=rng.randint(min_days, max_days))


def _recorded_after(rng: random.Random, event_time: datetime) -> datetime:
    # A clinician documents an event within hours, not months — the record
    # clock trails the clinical clock but never leads it (R2).
    return event_time + timedelta(hours=rng.randint(1, 30))


def _chemo_and_appendectomy(rng: random.Random) -> list[ClinicalEvent]:
    """Six chemo cycles with an unplanned appendectomy after the third —
    SPEC.md's flagship cross-department interruption (`gap_type =
    clinical_complication`, not a documentation gap)."""
    events: list[ClinicalEvent] = []
    t = _BASE_EPOCH
    for cycle in range(1, 4):
        t = _walk_forward(rng, t, 18, 24)
        events.append(ClinicalEvent(
            event_id=f"EVT-CHEMO-{cycle:02d}", kind="chemo_cycle", facility_id="FAC-02",
            event_time=t, source_recorded_at=_recorded_after(rng, t),
        ))

    appendectomy_time = _walk_forward(rng, t, 5, 12)
    events.append(ClinicalEvent(
        event_id="EVT-APPENDECTOMY", kind="appendectomy", facility_id="FAC-03",
        event_time=appendectomy_time, source_recorded_at=_recorded_after(rng, appendectomy_time),
    ))

    t = appendectomy_time
    for cycle in range(4, 7):
        t = _walk_forward(rng, t, 18, 24)
        events.append(ClinicalEvent(
            event_id=f"EVT-CHEMO-{cycle:02d}", kind="chemo_cycle", facility_id="FAC-02",
            event_time=t, source_recorded_at=_recorded_after(rng, t),
        ))
    return events


def _her2_results(rng: random.Random) -> list[ClinicalEvent]:
    """Discordant across specimens — outside biopsy Grade II / IHC 1+;
    surgical specimen Grade III / IHC 2+, different accession IDs. Both
    must be shown, flagged discordant, never auto-resolved (R3/D3)."""
    outside_time = _walk_forward(rng, _BASE_EPOCH, -20, -10)
    surgical_time = _walk_forward(rng, _BASE_EPOCH, 30, 45)
    return [
        ClinicalEvent(
            event_id="EVT-HER2-OUTSIDE", kind="her2_result", facility_id="FAC-01",
            event_time=outside_time, source_recorded_at=_recorded_after(rng, outside_time),
            specimen_id="SPEC-OUTSIDE-001", specimen_source="outside_biopsy",
            grade="II", ihc_score="1+",
        ),
        ClinicalEvent(
            event_id="EVT-HER2-SURGICAL", kind="her2_result", facility_id="FAC-02",
            event_time=surgical_time, source_recorded_at=_recorded_after(rng, surgical_time),
            specimen_id="SPEC-SURGICAL-001", specimen_source="surgical_specimen",
            grade="III", ihc_score="2+",
        ),
    ]


def _bone_health(rng: random.Random) -> list[ClinicalEvent]:
    """DEXA-confirmed osteopenia (T-score in -2.5..-1.0) followed by
    zoledronic acid — exercises ENDO-DEXA-001 twice, per WORK-PLAN.md."""
    dexa_time = _walk_forward(rng, _BASE_EPOCH, 60, 75)
    infusion_time = _walk_forward(rng, dexa_time, 3, 10)
    t_score = round(rng.uniform(-2.4, -1.0), 1)
    return [
        ClinicalEvent(
            event_id="EVT-DEXA", kind="dexa_scan", facility_id="FAC-04",
            event_time=dexa_time, source_recorded_at=_recorded_after(rng, dexa_time),
            t_score=t_score,
        ),
        ClinicalEvent(
            event_id="EVT-ZOLEDRONIC", kind="zoledronic_acid_infusion", facility_id="FAC-04",
            event_time=infusion_time, source_recorded_at=_recorded_after(rng, infusion_time),
        ),
    ]


def _treatment_plan_versions(rng: random.Random) -> tuple[TreatmentPlanVersion, ...]:
    """Four versions — the real plan changed four times in 18 months."""
    regimens = (
        "AC-T (doxorubicin/cyclophosphamide, then paclitaxel)",
        "AC-TH (adds trastuzumab after the HER2 surgical result)",
        "AC-TH, dose-delayed post-appendectomy",
        "AC-TH + zoledronic acid for DEXA-confirmed osteopenia",
    )
    t = _BASE_EPOCH - timedelta(days=5)
    versions = []
    for i, regimen in enumerate(regimens, start=1):
        t = _walk_forward(rng, t, 25, 40)
        versions.append(TreatmentPlanVersion(
            version=i, effective_from=t, regimen=regimen,
            notes=f"Plan v{i}",
        ))
    return tuple(versions)


def generate_deep_case(seed: int) -> Ledger:
    """The deep-case patient: 4 facilities, 7 identifiers with zero ABHA, an
    appendectomy mid-chemo, HER2 discordant across specimens, and
    DEXA-confirmed osteopenia treated with zoledronic acid. Deterministic —
    the same seed always returns a structurally identical `Ledger`.
    """
    rng = random.Random(seed)

    events = (
        *_chemo_and_appendectomy(rng),
        *_her2_results(rng),
        *_bone_health(rng),
    )

    return Ledger(
        patient_id="PAT-DEEP-0001",
        seed=seed,
        facilities=_FACILITIES,
        identifiers=_identifiers(),
        events=tuple(sorted(events, key=lambda e: e.event_time)),
        treatment_plan_versions=_treatment_plan_versions(rng),
    )
