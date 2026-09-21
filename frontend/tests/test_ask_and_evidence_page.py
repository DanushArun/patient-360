"""Tests for frontend/pages/1_Ask_and_Evidence.py — WORK-PLAN.md Day 1:
"Build the entire UI against a hard-coded fixture answer. Do not wait for
Stream 2." Uses Streamlit's own `AppTest` (streamlit.testing.v1) to run the
real page script and assert on what it actually renders — not a mock of
Streamlit, the real script executed headless.

Scope for this first slice: the CLASS_B supported-answer fixture, per-claim
rendering, known_as_of, and the evidence pane opening on click for both
patient-evidence kinds (structured, document_span) present in that fixture.
Class A refusal and reference_clause rendering are separate follow-on
features, tracked in IMPLEMENTATION-STATUS.md, not silently assumed here.
"""

from __future__ import annotations

from pathlib import Path

from streamlit.testing.v1 import AppTest

_PAGE_PATH = Path(__file__).resolve().parent.parent / "pages" / "1_Ask_and_Evidence.py"


def _run_page() -> AppTest:
    at = AppTest.from_file(str(_PAGE_PATH))
    at.run()
    assert not at.exception, [e.value for e in at.exception]
    return at


def test_page_title_is_ask_and_evidence():
    at = _run_page()
    assert at.title[0].value == "Ask + Evidence"


def test_page_shows_a_question_input():
    at = _run_page()
    assert len(at.text_input) == 1


def test_page_states_known_as_of():
    at = _run_page()
    captions = [c.value for c in at.caption]
    assert any("2026-09-18T09:00:00" in c for c in captions)


def test_page_shows_the_claim_text():
    at = _run_page()
    markdown_text = " ".join(m.value for m in at.markdown)
    assert "ANC is 2100" in markdown_text


def test_evidence_is_hidden_until_the_button_is_clicked():
    at = _run_page()
    markdown_text = " ".join(m.value for m in at.markdown)
    assert "CLINICAL_EVENT" not in markdown_text
    assert "DOC-0052" not in markdown_text


def test_clicking_show_evidence_reveals_the_structured_row_with_its_derivation():
    at = _run_page()
    at.button[0].click().run()
    assert not at.exception, [e.value for e in at.exception]

    info_text = " ".join(i.value for i in at.info)
    assert "CLINICAL_EVENT" in info_text
    assert "CE-LAB-441" in info_text
    # R1: a computed value must never look printed - the derivation note is
    # part of the same info panel, not a detail a reader could miss.
    assert "Derived:" in info_text


def test_clicking_show_evidence_reveals_the_document_span_with_page_and_status():
    at = _run_page()
    at.button[0].click().run()

    warning_text = " ".join(w.value for w in at.warning)
    assert "DOC-0052" in warning_text
    assert "page 2" in warning_text  # page_index 1 -> 1-based page 2
    assert "verified" in warning_text.lower()


def test_clicking_show_evidence_again_hides_it():
    at = _run_page()
    at.button[0].click().run()
    at.button[0].click().run()
    info_text = " ".join(i.value for i in at.info)
    assert "CLINICAL_EVENT" not in info_text


# --- fixture switcher + Class A refusal --------------------------------
# WORK-PLAN.md Day 1's own acceptance test: "Switch to a Class A fixture ->
# refusal renders with the named practitioner." Not a separate page - the
# same screen, because a clinician doesn't know in advance which class a
# question will turn out to be.

def _switch_to(at: AppTest, label: str) -> AppTest:
    at.selectbox[0].select(label).run()
    assert not at.exception, [e.value for e in at.exception]
    return at


def test_default_fixture_is_still_the_class_b_supported_answer():
    # Regression guard: adding the switcher must not change what loads by
    # default, or every test above this line would be silently testing the
    # wrong fixture.
    at = _run_page()
    markdown_text = " ".join(m.value for m in at.markdown)
    assert "ANC is 2100" in markdown_text


def test_selecting_class_a_shows_the_refusal_message_not_any_claim():
    at = _run_page()
    at = _switch_to(at, "Refused (CLASS_A) — clinical judgment")

    body_text = " ".join(m.value for m in at.markdown) + " ".join(w.value for w in at.warning)
    assert "That is a clinical decision for your treating team" in body_text
    assert "ANC is 2100" not in body_text  # the CLASS_B claim must not leak through


def test_selecting_class_a_names_the_treating_practitioner():
    at = _run_page()
    at = _switch_to(at, "Refused (CLASS_A) — clinical judgment")

    body_text = " ".join(m.value for m in at.markdown) + " ".join(w.value for w in at.warning)
    assert "Dr A. Rao" in body_text
    assert "KMC-2009-41882" in body_text


def test_class_a_shows_no_evidence_buttons_there_are_no_claims_to_open():
    at = _run_page()
    at = _switch_to(at, "Refused (CLASS_A) — clinical judgment")
    evidence_buttons = [b for b in at.button if b.label == "Show evidence"]
    assert evidence_buttons == []


def test_generate_packet_button_only_appears_for_class_a():
    at = _run_page()  # default is CLASS_B
    packet_buttons = [b for b in at.button if "evidence packet" in b.label.lower()]
    assert packet_buttons == []

    at = _switch_to(at, "Refused (CLASS_A) — clinical judgment")
    packet_buttons = [b for b in at.button if "evidence packet" in b.label.lower()]
    assert len(packet_buttons) == 1


def test_clicking_generate_packet_produces_a_real_packet_id_addressed_to_the_practitioner():
    at = _run_page()
    at = _switch_to(at, "Refused (CLASS_A) — clinical judgment")

    packet_button = next(b for b in at.button if "evidence packet" in b.label.lower())
    packet_button.click().run()
    assert not at.exception, [e.value for e in at.exception]

    body_text = " ".join(s.value for s in at.success)
    assert "EVP-" in body_text
    assert "Dr A. Rao" in body_text


def test_clicking_generate_packet_twice_addresses_the_same_packet():
    # generate_packet_id is deterministic - the same practitioner, question
    # and known_as_of must not mint a fresh packet on a second click.
    at = _run_page()
    at = _switch_to(at, "Refused (CLASS_A) — clinical judgment")
    packet_button = next(b for b in at.button if "evidence packet" in b.label.lower())
    packet_button.click().run()
    first = " ".join(s.value for s in at.success)

    packet_button = next(b for b in at.button if "evidence packet" in b.label.lower())
    packet_button.click().run()
    second = " ".join(s.value for s in at.success)

    assert first == second


def test_no_binding_header_prompts_to_bind_first():
    at = _run_page()
    warning_text = " ".join(w.value for w in at.warning)
    assert "No patient bound" in warning_text


def test_binding_header_shows_once_a_binding_exists_in_session_state():
    from datetime import date

    from frontend.core.binding import Binding

    at = AppTest.from_file(str(_PAGE_PATH))
    at.session_state["binding"] = Binding(
        patient_id="PAT-DEEP-0001", practitioner_id="PRC-001", consent_id="CON-0031", bound_at=date(2026, 9, 18),
    )
    at.session_state["binding_patient_name"] = "Patient (deep case)"
    at.run()
    assert not at.exception, [e.value for e in at.exception]

    body = " ".join(m.value for m in at.markdown)
    assert "Bound to" in body
    assert "Patient (deep case)" in body
    assert "CON-0031" in body


def test_switching_to_conflicting_fixture_shows_all_three_claims_and_the_limitation():
    at = _run_page()
    at = _switch_to(at, "Partial (CLASS_B) — conflicting and discordant evidence")

    markdown_text = " ".join(m.value for m in at.markdown)
    assert "Final histopathology not received" in markdown_text
    assert "LVEF assessment is 104 days old" in markdown_text
    assert "Authorisation state disagrees" in markdown_text

    caption_text = " ".join(c.value for c in at.caption)
    assert "platelet value and the page is a photograph" in caption_text
