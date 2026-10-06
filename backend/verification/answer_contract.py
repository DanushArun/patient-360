"""Validates a SAARTHI answer against Contract 3 (frontend/contracts/answer_schema.json).

The schema is frozen (COPILOT-SPEC.md 2 / ARCHITECTURE-HANDOFF.md Contract 3) and
consumed here as data, never duplicated: this module is a thin, correct wrapper
around it, not a second copy of its rules.

Scope: structural/contract validation only (what the JSON Schema itself can
express — required fields, enums, the Class A/B shape split, "no claim without
evidence"). Semantic checks that need live data (evidence existence, scope,
supersession, polarity, verification_status) belong to the validate_answer SQL
procedure (SPEC.md 7), not here.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import jsonschema

_SCHEMA_PATH = Path(__file__).resolve().parents[2] / "frontend" / "contracts" / "answer_schema.json"


@lru_cache(maxsize=1)
def _compiled_validator() -> jsonschema.protocols.Validator:
    """Parses and compiles the schema once; every call after the first is O(1)."""
    schema = json.loads(_SCHEMA_PATH.read_text())
    validator_cls = jsonschema.validators.validator_for(schema)
    validator_cls.check_schema(schema)
    return validator_cls(schema)


@dataclass(frozen=True)
class ValidationResult:
    valid: bool
    errors: list[str] = field(default_factory=list)


def _format_error(error: jsonschema.exceptions.ValidationError) -> str:
    location = "/".join(str(part) for part in error.path) or "<root>"
    return f"{location}: {error.message}"


def validate_answer(answer: dict[str, Any]) -> ValidationResult:
    """Validates `answer` against the frozen answer schema.

    Returns every violation found (not just the first) so a caller — the
    Streamlit UI, the eval harness, or a test — can report all defects in
    one pass instead of fixing and re-validating one error at a time.
    """
    validator = _compiled_validator()
    errors = sorted(validator.iter_errors(answer), key=lambda e: list(map(str, e.path)))
    messages = [_format_error(e) for e in errors]
    return ValidationResult(valid=not messages, errors=messages)
