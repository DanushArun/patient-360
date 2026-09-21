# Day-1 fixtures

**Build the entire Ask + Evidence screen against these. No table needs to exist.**

Every fixture is a *byte-for-byte valid answer object* — no preprocessing, no comment stripping. The UI loads a fixture through exactly the code path it will later use for a live answer, so swapping in the real procedure on Day 5 changes one function, not the renderer.

| File | Renders | Use it to build |
|---|---|---|
| `answer_supported.json` | one numeric claim, two evidence kinds, one derived value | the claim list and the evidence pane |
| `answer_conflicting.json` | the flagship answer — four outcome states in one response | the gate strip, actions, provenance badges, limitations |
| `answer_class_a.json` | refusal with a named practitioner | the refusal state and the evidence-packet button |
| `page_DOC-0052_p1.json` | a CBC page | span highlighting |
| `page_DOC-0031_p2.json` | a preliminary pathology page | span highlighting + supersession affordance |
| `page_DOC-0044_p1.json` | an authorisation letter | the conflicting-coverage rendering |

**Every `char_start`/`char_end` in the answer fixtures resolves into a real page fixture.** They were generated from the page text rather than typed, so a click-through that lands in the wrong place is a bug in the renderer, never in the data. Decorative evidence links are a go/no-go failure; these ones resolve.

---

## What each fixture is teaching

### `answer_supported.json` — the derived value

The claim asserts `ANC 2100`. Open `page_DOC-0052_p1.json` and search for `2100`. **It is not there.** The page reports `Total Leucocyte Count 6000`, `Neutrophils 35 %`, `Band forms 00 %` and a footer saying *"Absolute counts not reported."*

The span therefore points at `Neutrophils            35`, and the structured evidence carries:

> `ANC computed as WBC x (neutrophil% + band%) / 100 = 6000 x (35 + 0) / 100 = 2100 cells/uL. The lab reported a differential only; this number appears nowhere on the page.`

**If the UI can render this claim without showing that sentence, the UI is wrong.** A clinician who clicks a citation to check a number and cannot find it has been misled by an otherwise perfectly correct system.

The page also carries the real Indian-format traps from the source research: `GM%`, `/CUMM`, `mg%`, `10.3 L` and `55 H` where the letter is a flag and not part of the number, and `1,50,000 - 4,50,000` lakh comma notation.

### `answer_conflicting.json` — four outcomes, and the paragraph nobody else can write

One response carrying `not_evaluated`, `fail`, `conflicting` and — in `limitations` — an R7 refusal to assert. Three different people do three different jobs from those four states, which is why a boolean gate cannot dispatch any of them.

**The platelet paragraph is in `limitations`, not `claims`, and that placement is the point.** A `conflicting` assertion is never asserted, so it cannot be the subject of a claim; it can only be stated as something the system knows it does not know. If a future edit moves it into `claims` with a caveat, R7 has been quietly undone.

Note `overall_status: "partial"` — not `supported`. The answer is incomplete and says so.

### `answer_class_a.json` — what refusal looks like

No claims. No hedged opinion. No confidence percentage. **No retrieval happened at all** — `classify_question` returned `CLASS_A` before the agent was called, so there is nothing to cite because nothing was read.

The `refusal` block names the practitioner and carries their `nmc_registration_no`, because *"your treating team decides"* is not a usable sentence unless the system says who they are.

---

## The schema is verified, not asserted

`backend/scripts/check_gate.py --contracts` validates all three fixtures against `frontend/contracts/answer_schema.json` **and** confirms the schema rejects six malformed answers:

| Negative control | Rejected because |
|---|---|
| a Class A answer carrying a claim | `if/then`: `CLASS_A` caps `claims` at zero items |
| a claim with an empty `evidence` array | `minItems: 1` — the schema refuses an uncited claim |
| a claim carrying a `confidence` field | `additionalProperties: false` — a percentage invites a clinical decision |
| a Class B answer marked `refused` | `refused` is `CLASS_A` only; "nothing found" is a *supported* answer with a timestamp |
| a Class A answer naming no practitioner | `refusal.practitioner` is required |
| an answer with no `known_as_of` | R2 — every answer states the moment it is true as of |

**A schema with no conforming instance is untested, and a schema that has never rejected anything is decorative.** Run both halves before trusting it.
