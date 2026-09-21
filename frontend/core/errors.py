"""Maps every named failure situation to its UI behaviour — Contract 2, error
half (frontend/contracts/error_shape.json `x-disclosure` and
`x-fallback-behaviours`), COPILOT-SPEC.md 4.

Loaded from the frozen contract, never duplicated here: changing what a
failure state discloses or how it renders means editing the contract and
telling the other builder first, not editing this file. `no_patient_access`
and `access_withdrawn` deliberately disclose different amounts of
information about the same underlying fact (a patient outside — or
previously inside — the caller's scope); collapsing them into one generic
"error" string would erase that asymmetry, which is the actual point of the
contract.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

_ERROR_SHAPE_PATH = Path(__file__).resolve().parent.parent / "contracts" / "error_shape.json"

_METADATA_KEY = "description"  # not a situation — present in both contract sections


@dataclass(frozen=True)
class FailureBehaviour:
    situation: str
    ui: str
    reveals: str | None = None
    never: str | None = None
    why: str | None = None


@lru_cache(maxsize=1)
def _contract() -> dict:
    return json.loads(_ERROR_SHAPE_PATH.read_text())


@lru_cache(maxsize=1)
def known_situations() -> frozenset[str]:
    """Every named failure situation the contract defines — tool-error codes
    (`x-disclosure`) and non-error fallback behaviours (`x-fallback-behaviours`)
    together. Not hardcoded to a fixed count: this module stays correct as
    the contract grows, and a test pins today's actual count separately."""
    contract = _contract()
    disclosure = set(contract["x-disclosure"]) - {_METADATA_KEY}
    fallback = set(contract["x-fallback-behaviours"]) - {_METADATA_KEY}
    return frozenset(disclosure | fallback)


def describe(situation: str) -> FailureBehaviour:
    """Returns the UI behaviour for `situation`. Raises `KeyError` for
    anything not in `known_situations()` — an un-mapped failure must be
    loud, never silently rendered as a generic message."""
    if situation not in known_situations():
        raise KeyError(
            f"{situation!r} is not a known failure situation — "
            f"see frontend/contracts/error_shape.json"
        )

    contract = _contract()
    if situation in contract["x-disclosure"]:
        entry = contract["x-disclosure"][situation]
        return FailureBehaviour(
            situation=situation,
            ui=entry["ui"],
            reveals=entry.get("reveals"),
            never=entry.get("never"),
            why=entry.get("why"),
        )

    entry_ui = contract["x-fallback-behaviours"][situation]
    return FailureBehaviour(situation=situation, ui=entry_ui)
