"""create_review_task — SPEC.md 373/601/605, WORK-PLAN.md 567: "the only
write tool. Idempotent via idempotency_key. Restricted to
treating|coordinator — patient_navigator cannot create tasks."

`action` is a closed enum of documentation actions, never a clinical one —
SPEC.md 605's own example of what must be rejected is "approve treatment".
This is R1 drawn as a literal enum boundary: the tool can create a task
about the record, never a decision about the patient.

Idempotency is real, not decorative: the same idempotency_key returns the
existing task rather than minting a duplicate, mirroring what the real
create_review_task procedure guarantees via a UNIQUE constraint on that
column (SPEC.md 377) — no live Snowflake connection this session, so this
module is the offline stand-in, not the production path.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime

_ALLOWED_ROLES = frozenset({"treating", "coordinator"})
# Must match the live procedure's enum exactly (backend/sql/procedures/tools/
# 08_create_review_task.sql). An earlier offline-only enum had drifted from it,
# so the UI offered actions the live proc rejected as invalid_argument.
_ALLOWED_ACTIONS = frozenset({"request_document", "escalate", "reassign", "close"})


@dataclass(frozen=True)
class ReviewTask:
    task_id: str
    issue_id: str
    action: str
    reason: str
    actor_practitioner_id: str
    idempotency_key: str
    state: str = "open"
    history: tuple[dict, ...] = field(default_factory=tuple)


def _task_id(idempotency_key: str) -> str:
    digest = hashlib.sha256(idempotency_key.encode()).hexdigest()[:8].upper()
    return f"RT-{digest}"


def create_review_task(
    existing_tasks: list[ReviewTask], *, issue_id: str, action: str, reason: str,
    actor_practitioner_id: str, actor_role: str, idempotency_key: str,
    created_at: datetime | None = None,
) -> ReviewTask:
    if actor_role not in _ALLOWED_ROLES:
        raise PermissionError(
            f"role {actor_role!r} cannot create review tasks — "
            f"treating|coordinator only (patient_navigator cannot create tasks)"
        )
    if action not in _ALLOWED_ACTIONS:
        raise ValueError(
            f"{action!r} is not a valid review-task action — "
            f"'approve treatment' and similar clinical decisions are never a value"
        )

    existing = next((t for t in existing_tasks if t.idempotency_key == idempotency_key), None)
    if existing is not None:
        return existing

    at = (created_at or datetime.now()).isoformat()
    return ReviewTask(
        task_id=_task_id(idempotency_key), issue_id=issue_id, action=action, reason=reason,
        actor_practitioner_id=actor_practitioner_id, idempotency_key=idempotency_key,
        history=(
            {"from_state": None, "to_state": "open", "actor": actor_practitioner_id, "reason": reason, "at": at},
        ),
    )
