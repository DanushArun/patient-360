# SAARTHI — keynote demo

One patient, one evening, one coordinator. Four minutes, mostly live.

**Format.** Apple's keynote grammar for the framing: one idea per slide, a headline and almost
nothing else, a three-act shape (setup, conflict, resolution). OpenAI's launch grammar for the
demo: the product does real work, live, in real time, and the presenter talks to it naturally.
The slides only frame. The demo carries the argument.

**The patient.** `PAT-DC-12` Anjali Deshpande, 46, Pune. HER2-positive breast cancer, weekly
paclitaxel + trastuzumab, cycle 7 tomorrow 09:30. Her record lives in four places: Tata Memorial
(treating), Apollo (outside biopsy), HCG (echo), and the PM-JAY payer. All synthetic.
Seed: `backend/sql/demo/load_demo_hero.sql`.

**What the record checks say, from versioned SQL rules, not from a model.**

| Check | Outcome | Why |
|---|---|---|
| `SURV-LVEF-002` v1 cardiac safety | ✕ Blocked | LVEF 63% → 49%: below 50 with a drop of 10 or more, the trastuzumab hold criterion |
| `COV-AUTH-001` v1 pre-authorisation | ⇄ Conflict | TPA table says *pending*; the insurer's letter says *approved* |
| `DOC-DISC-001` v1 discordance | ✓ both surfaced | HER2 2+ on the Apollo core biopsy, 3+ on the Tata surgical specimen: never auto-resolved |
| `CLIN-ANC-001` / `CLIN-PLT-001` | ✓ | ANC 3,016 computed in SQL from WBC 5,800 × 52%; platelets 2,28,000 |
| `CLIN-CRCL-001` | ✓ | Cockcroft-Gault from creatinine, weight, age and sex |
| Identity, consent, coverage limit, HbA1c, DEXA | ✓ | Four records linked by ABHA or recorded verification, never by name |

---

## Before you go on stage

1. `.venv/bin/python -m backend.scripts.prepare_demo` → must print `"status": "PASS"`.
   It moves every visit to tomorrow, loads the hero, runs the two-model extraction and
   recomputes readiness. Re-run it on the morning of each demo day.
2. `cd web && npm run demo:check` → must print `PASS` for every beat. It walks this exact
   script in a browser against live data and saves a screenshot per beat in `evidence/demo/`.
3. Browser: Chrome, 1440 wide, light appearance, zoom 100%, Copilot switch **on**,
   chat closed, sidebar open, on the Day care page. Microphone allowed. Notifications off.
4. Warm the path once (open Anjali, ask one question) so the first live answer is not a cold start.

---

## Act 1 — The problem (0:00–0:40) · slides

| Slide | On screen | Say |
|---|---|---|
| 1 | **Tomorrow, 9:30.** | "Every evening, in every cancer day-care unit in India, someone has to answer one question." |
| 2 | **Who can be treated?** | "Not *should* they be treated. That is the doctor's call. *Can* they: is everything the doctor needs actually there?" |
| 3 | **4 hospitals. 1 payer. 0 shared records.** | "The answer is spread across hospitals that don't talk to each other, an insurer's portal, and photos on WhatsApp. A coordinator stitches it together by hand, at night." |
| 4 | **Saarthi** · *the charioteer* | "Saarthi doesn't drive. It makes sure the person who does has everything. Let me show you." |

## Act 2 — The demo (0:40–3:20) · live

| Time | Do | Say |
|---|---|---|
| 0:40 | Day care page. Pause on the board. | "This is tomorrow's list. Every column comes from versioned SQL rules: blocked, waiting on evidence, advisory, checks met. No model ranks these patients." |
| 0:55 | Press the mic: **"Who is blocked today?"** | "I can just ask." *(Cards light up on the board; the answer arrives in the chat.)* "It answered from the same rules, and pointed at the patients on the screen." |
| 1:10 | Press the mic: **"Open Anjali's record."** Dock asks *Open Anjali Deshpande's record?* Click **Open record**. | "It heard a name, but it won't open a record on its own. A person confirms. Every time." |
| 1:20 | Overview. Point at the two rows. | "Anjali has chemo tomorrow. Two things stop it. Her heart. And her paperwork." |
| 1:30 | Type or say: **"Why is she blocked?"** | "Her ejection fraction fell from 63 to 49. That crosses the trastuzumab hold criterion. Rule SURV-LVEF-002, version 1. Look at the citation." |
| 1:45 | Click the cited echo → source page opens on **LVEF (biplane Simpson): 49 %**. | "That number came out of an echo report from a different hospital. Two different AI model families read it independently. They had to agree before it became a fact." |
| 2:05 | Back. Ask: **"Is her pre-authorisation approved?"** | "The payer's system says pending. The payer's own letter says approved. Saarthi doesn't pick one. It shows both, and a person reconciles them." |
| 2:20 | Coverage → **Compare sources**. | "Both sources, both clocks: when it happened, when it was recorded, when we learned it." |
| 2:35 | Overview → *Other checks* → discordance row. | "Same thing with her pathology. Her outside biopsy says HER2 2+. Her surgical specimen says 3+. Both are on the record. Nothing is silently overwritten." |
| 2:50 | Ask: **"Should we hold her trastuzumab?"** | "Now the question a coordinator must never answer." *(Refusal.)* "That's a clinical decision. Saarthi refuses, by law, and prepares the evidence packet for Dr. Test Oncologist instead." |
| 3:05 | Click **Prepare evidence for Dr. Test Oncologist**. | "Everything she needs, cited, in one place. The decision stays hers." |

## Act 3 — How it works (3:20–3:50) · one slide

| Slide | On screen | Say |
|---|---|---|
| 5 | **The model never decides.** · 16 versioned rules · 2 model families per extracted fact · 3 clocks on every answer · 0 confidence scores | "Language models read documents and understand questions. Every status, number and threshold comes from SQL, with its version and its source. When the evidence isn't there, Saarthi says *not received*, never *negative*." |

## One more thing (3:50–4:10)

| Slide / do | Say |
|---|---|
| Live: **Family** tab, Marathi selected. | "Anjali's family speaks Marathi. Tonight they get a checklist in Marathi: what's ready, what's still missing, what to bring tomorrow. Made from the same record checks, not from a chatbot." |
| Slide 6: **Saarthi** · synthetic data only · not clinical validation | "Saarthi. Every answer cited. Every decision left to the person accountable for it. Thank you." |

---

## If something goes wrong on stage

| Symptom | Recover with |
|---|---|
| Mic doesn't hear you | Type the same sentence in the chat. The planner is the same. |
| An answer takes more than 10 s | Keep talking over the progress steps ("checking access, reading the record, validating every citation"). They're real phases, not a spinner. |
| A record question is refused | Use the starter wording: *What is missing in the record?*, *Show me the latest lab results*, *Status of pre-authorisation and coverage*. |
| The copilot moves the screen when you didn't want it to | Click anywhere. It pauses at once ("Paused because you took over"). |
| The list is empty or stale | You skipped step 1. `prepare_demo` re-anchors every visit to tomorrow. |

## What not to claim

- No clinical validation. These are engineering checks on synthetic data.
- No confidence percentages, no predictions, no "AI recommends".
- The two-model agreement is on the parsed page text, not the original image (see
  `backend/sql/tasks/extract_assertions.sql`).
- Speech uses the browser's recogniser. It stays on the device only where the browser supports on-device recognition.
