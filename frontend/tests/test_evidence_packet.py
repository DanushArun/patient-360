"""Tests for frontend/core/evidence_packet.py — Class A's EVIDENCE_PACKET.

SPEC.md 398 (EVIDENCE_PACKET: packet_id PK, practitioner FK, question,
consent_id) and 790: "Class A response offers evidence rather than refusing
flatly — it generates an EVIDENCE_PACKET addressed to the named treating
practitioner. Useful, not obstructive." No live Snowflake connection this
session, so the Day-1 fixture demo needs a real (if offline) packet_id
generator rather than a decorative button — deterministic so the same
question, asked twice by the same practitioner at the same known_as_of,
addresses the same packet rather than minting a new one every click.
"""

from __future__ import annotations

import re

from frontend.core.evidence_packet import generate_packet_id

_ID_PATTERN = re.compile(r"^EVP-[0-9A-F]{8}$")


def test_packet_id_matches_the_evp_format():
    packet_id = generate_packet_id(
        practitioner_id="PRC-0012", known_as_of="2026-09-18T09:00:00",
        question="Should she proceed with cycle 4?",
    )
    assert _ID_PATTERN.match(packet_id)


def test_same_inputs_produce_the_same_packet_id():
    kwargs = dict(
        practitioner_id="PRC-0012", known_as_of="2026-09-18T09:00:00",
        question="Should she proceed with cycle 4?",
    )
    assert generate_packet_id(**kwargs) == generate_packet_id(**kwargs)


def test_a_different_question_produces_a_different_packet_id():
    a = generate_packet_id(
        practitioner_id="PRC-0012", known_as_of="2026-09-18T09:00:00", question="Question A",
    )
    b = generate_packet_id(
        practitioner_id="PRC-0012", known_as_of="2026-09-18T09:00:00", question="Question B",
    )
    assert a != b


def test_a_different_practitioner_produces_a_different_packet_id():
    a = generate_packet_id(
        practitioner_id="PRC-0012", known_as_of="2026-09-18T09:00:00", question="Same question",
    )
    b = generate_packet_id(
        practitioner_id="PRC-0099", known_as_of="2026-09-18T09:00:00", question="Same question",
    )
    assert a != b
