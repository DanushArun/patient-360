"""EVIDENCE_PACKET id generation — SPEC.md 398, 790.

"Class A response offers evidence rather than refusing flatly — it
generates an EVIDENCE_PACKET addressed to the named treating practitioner.
Useful, not obstructive." No live Snowflake connection this session, so the
Day-1 fixture demo needs the button to do something real rather than being
decorative. This is deliberately not the production path (that inserts an
EVIDENCE_PACKET row and returns its real packet_id) — it generates the same
*shape* of id, deterministically, from the inputs that would identify the
same request: the same practitioner asking the same question as of the
same known_as_of addresses the same packet, not a fresh one per click.
"""

from __future__ import annotations

import hashlib


def generate_packet_id(*, practitioner_id: str, known_as_of: str, question: str) -> str:
    digest = hashlib.sha256(f"{practitioner_id}|{known_as_of}|{question}".encode()).hexdigest()
    return f"EVP-{digest[:8].upper()}"
