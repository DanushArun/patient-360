# Frozen contracts

**Owner: Builder 1. Consumed by both streams. Changing one means telling Builder 2 *before* the edit, not in the commit message.**

| File | Contract | Consumed by |
|---|---|---|
| `answer_schema.json` | 3 — Answer JSON | agent prompt · `validate_answer` · Streamlit · eval harness |
| `error_shape.json` | 2, error half | all 8 tool procedures · `frontend/core/errors.py` |
| `tool_signatures.yaml` | 2 — tool signatures | `backend/sql/agent/saarthi_agent.sql` (generated) · `backend/sql/stubs/` · `backend/scripts/check_gate.py` |

These were committed on Day 1 before any other Builder 1 code, because the validator, the agent prompt and the UI all depend on them and a schema that changes on Day 6 invalidates work in three places at once.

---

## What the schema enforces that a prompt cannot

**`minItems: 1` on `claim.evidence`.** The schema itself rejects an uncited claim. Rule 2 of the agent instructions says the same thing in English; only one of the two is checkable.

**`additionalProperties: false` on a claim.** Stops the agent inventing a `confidence` field. It will try — every model does — and a confidence percentage invites a clinical decision where an evidence state invites a human to look.

**`oneOf` across the three evidence kinds.** Makes the UI's dispatch total. There is no fourth rendering to forget, and `reference_clause` cannot be silently rendered in the patient-evidence panel style (R6).

**Class A carries no claims.** The `if/then` block makes `classification: CLASS_A` require a `refusal` object, force `overall_status: refused`, and cap `claims` at zero items. NMC TPG 2020 is a legal boundary, so it is enforced by the shape of the object rather than by the model's willingness to comply.

**Class B is never `refused`.** "Nothing found" is a *supported* answer carrying a limitation and a timestamp — `"Nothing found as of 18 Sep 09:00"`, never a bare "No results".

### The one thing the schema cannot enforce: `derived`

`derived` is mandatory only when a `structured` value was **computed** rather than read — ANC from a differential, CrCl from Cockcroft-Gault — and JSON Schema cannot see which. **`validate_answer` enforces it:** if the cited row carries a derivation marker from `DT_HARMONIZED_EVENTS` and the evidence object has no `derived` string, the claim is stripped.

This is not pedantry. A clinician who does exactly the right thing — clicks the citation to check the number — and cannot find `2100` anywhere on the page has been misled by a system that was otherwise perfectly correct.

---

## One proposed extension, needing ratification

**`refusal` on `answer_schema.json` is an addition, not a transcription.**

`COPILOT-SPEC.md` §2 shows only a Class B answer. `COPILOT-SPEC.md` §4 requires the Class A refusal to render a *"Generate evidence packet"* button **addressed to the named treating practitioner via `nmc_registration_no`** — and the frozen schema has nowhere to put that practitioner. The UI cannot render a button whose target is buried in a prose string.

Three ways to close it were considered:

| Option | Why not |
|---|---|
| Put the practitioner in `limitations` text | The UI cannot dispatch on prose. The button either disappears or gets built on string parsing. |
| A separate schema for Class A answers | Two shapes for one screen. The UI would branch before it can validate, and the eval harness would need both. |
| **An optional `refusal` object, required when `classification: CLASS_A`** | **Chosen.** One shape, one validator, and the constraint that a refused question carries no claims becomes machine-checkable. |

**Builder 1 owns Contract 3, so this is within Builder 1's authority to call** — but it is flagged here rather than absorbed silently, because `COPILOT-SPEC.md` §7 should gain a row recording it. Raise it with Builder 2 on Day 1 alongside the six items in `planning/builder-1/README.md`.

---

## Two details that look like typos and are not

**`known_as_of` uses `pattern`, not `format: "date-time"`.** RFC 3339 requires a UTC offset. Every timestamp in this system is `TIMESTAMP_NTZ` and carries none — `"2026-09-18T09:00:00"`, which is the form used in `COPILOT-SPEC.md`, `ARCHITECTURE-HANDOFF.md` and `WORK-PLAN.md`. A strict validator with `format: "date-time"` enabled would reject the project's own examples.

**`verification_status` appears on `document_span`, not on the claim.** Verification is a property of the *read*, not of the *statement*. One claim can rest on a `verified` structured row and an `unverified` page span, and the UI must be able to badge them differently in the same evidence pane.
