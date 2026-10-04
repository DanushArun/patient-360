# SAARTHI — Copilot Specification

**The copilot is the deliverable. Everything else in this repository exists to make its answers trustworthy.**

The brief asks for exactly one thing to be *delivered*: *"Deliver a question and answer experience with clear source evidence."* Everything else — unification, risk stratification, evidence retrieval — is what the copilot needs in order to answer. This document specifies the copilot itself: how it knows who it is talking about, what it does across turns, what a citation resolves to, how it refuses, and the exact questions it will be asked on stage.

Supersedes nothing. Fills the gap between `SPEC.md` (data and rules) and `AI-INTEGRATION-ARCHITECTURE.md` (models and tools).

---

## 0. A fatal gap found while writing this, and its fix

**The architecture never defined how the copilot knows which patient a question is about.**

`AI-INTEGRATION-ARCHITECTURE.md` §2 describes `GetTimeline` as returning "the chronology for **the bound patient**" — the phrase appears exactly once, and **nothing in either document establishes the binding.** Step 5a of the call path derives a *permitted patient set* from `CURRENT_USER() → PRACTITIONER → CARE_TEAM`, and the design then treats that set as if it were the subject.

**A permitted set is not a subject.** A coordinator is on the care team for forty patients. `GetPatientFacts(domain='labs')` with no patient parameter and forty permitted patients either returns forty patients' labs or picks one arbitrarily. Both are wrong; the second is worse because it looks right.

**Two distinct concepts were collapsed into one:**

| Concept | Question it answers | Was it designed? |
|---|---|---|
| **Authorisation** | May this user see patient X at all? | Yes — `CARE_TEAM` ∩ `CONSENT`, three enforcement layers, empirically verified |
| **Selection** | Which patient is *this question* about? | **No. Undefined.** |

**And A1 leaks back in through a different parameter name.** `GetReadiness(encounter_id)` accepts an encounter id from the agent. An encounter id identifies a patient. So the agent still selects the subject from the question text — exactly the pattern A1 proved worthless — while `patient_id` sits absent from the schema giving the appearance of a control. **Removing `patient_id` closed one door and left the window open.**

### The fix: explicit session binding, set by a human click

**Selection is an application concern, performed by the user, recorded in the audit log. It is never inferred from question text and never chosen by the agent.**

```sql
-- The binding record. One row per bind action, append-only.
CREATE TABLE SAARTHI.GOVERNANCE.PATIENT_BINDING (
    binding_id      VARCHAR    DEFAULT UUID_STRING() PRIMARY KEY,
    session_id      VARCHAR    NOT NULL,          -- CURRENT_SESSION()
    snowflake_user  VARCHAR    NOT NULL,          -- CURRENT_USER() at bind time
    patient_id      VARCHAR    NOT NULL,
    care_team_id    VARCHAR    NOT NULL,          -- the relationship that authorised it
    consent_id      VARCHAR    NOT NULL,          -- the consent that authorised it
    bound_at        TIMESTAMP_NTZ NOT NULL,
    released_at     TIMESTAMP_NTZ                 -- set when the user switches patient
);

-- Binding is a procedure, not an INSERT. It validates before it writes.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.bind_patient(p_patient_id VARCHAR)
  RETURNS VARCHAR
  EXECUTE AS OWNER
AS $$
-- 1. resolve CURRENT_USER() -> PRACTITIONER
-- 2. require an ACTIVE CARE_TEAM row for (practitioner, p_patient_id) today
-- 3. require a valid CONSENT covering purpose and today's date
-- 4. release any prior binding for CURRENT_SESSION()
-- 5. insert the new binding, return binding_id
-- Any failure: raise. No binding is created. No detail about why is returned.
$$;
```

**Every patient-scoped tool reads the binding from `CURRENT_SESSION()`. No tool takes a patient selector of any kind.**

```
Tool call  ──►  resolve binding for CURRENT_SESSION()
                  │
                  ├── no binding ──────► {"error":"no_patient_bound"}
                  │                       UI prompts the user to choose a patient.
                  │
                  ├── binding exists ──► RE-VALIDATE care team + consent NOW
                  │                       │
                  │                       └── revoked or expired ──► {"error":"access_withdrawn"}
                  │                                                   binding released, context cleared
                  ▼
              proceed with patient_id from the binding
```

**Re-validation on every call is not redundant.** Consent can be revoked mid-session and a `CARE_TEAM.active_to` can pass while a conversation is open. A binding is a record of a selection, **never a cached authorisation.** Trusting it would reintroduce the exact staleness that made query-time consent checking a requirement in the first place.

**`GetReadiness` changes signature.** It no longer accepts an arbitrary `encounter_id`. It accepts an *optional* `encounter_ref` that must resolve to an encounter **belonging to the bound patient**; omitted, it uses the next scheduled encounter. An encounter id from another patient does not fail on authorisation — it fails on **binding mismatch**, which is a cleaner and earlier rejection.

```yaml
  - tool_spec:
      type: generic
      name: GetReadiness
      description: >
        Returns the five care-readiness gates for the BOUND patient. Takes no patient
        selector. encounter_ref is optional and must belong to the bound patient;
        omit it for the next scheduled encounter.
      input_schema:
        type: object
        properties:
          encounter_ref: {type: string}
          known_as_of:   {type: string}
        required: []
```

### Why this is a stronger claim than what it replaced

The old claim was *"the agent cannot supply `patient_id`."* The new claim is:

> **Every answer's subject was chosen by a human clicking a name in a list that was itself filtered by care relationship and consent — and that click is a row in an append-only table, joined to the answer in `ANSWER_RUN`.**

That is provable from the audit log rather than argued from an absent parameter. It also means the question text is **untrusted input with no privileged effect whatsoever** — it can influence *what is asked*, never *whom it is asked about*. Prompt injection cannot change the subject, because the subject does not come from the prompt.

`CohortQuery` is the deliberate exception: it has no single subject, operates over the permitted set, and is limited to what the semantic view exposes. **It is unavailable while a patient is bound** — mixing a bound-patient conversation with cross-patient results is how a coordinator misreads one patient's data as another's.

---

## 1. Conversation model

Also undefined before this document. A copilot is not a search box.

| Element | Rule |
|---|---|
| **Binding** | Survives turns. Shown persistently in the header. Changing it is an explicit action. |
| **`known_as_of`** | Survives turns once set. Displayed on every answer. R2 requires that an answer state the moment it is true as of; silently resetting it between turns would make two answers in one conversation incomparable. |
| **History** | Last 6 turns passed as context. Tool *outputs* are never replayed from history — a follow-up re-calls the tool. Stale facts are worse than an extra call. |
| **Follow-up resolution** | *"What about her platelets?"* resolves the subject from the **binding**, not from pronoun resolution by the model. The model resolves only *what is being asked*. |
| **Patient switch** | **Clears conversation history and the answer pane.** Non-negotiable — see below. |
| **Class A turn** | Refusal does not enter history as an answer. It cannot be built on in the next turn. |

**Why a patient switch must clear history.** Turn 1: *"is the pathology final?"* about Patient A. User switches to Patient B. Turn 2: *"and the platelets?"* If history persists, the model has Patient A's pathology in context while answering about Patient B, and may carry a value across. Every claim would still be individually cited and individually correct, and the **conversation** would still be clinically misleading. Citations do not protect against this. Only clearing does.

The switch is confirmed explicitly, and it is logged: `PATIENT_BINDING.released_at` plus a new row.

---

## 2. Evidence references — a typed contract

The frozen answer schema carries `evidence_ids` as opaque strings. That is under-specified: the example `CE-LAB-441` is a `CLINICAL_EVENT` row, while a pathology citation is a **page span**. These render completely differently, and the UI cannot dispatch on an opaque string.

**Evidence is one of three types, and the type is explicit:**

```json
{
  "claims": [{
    "text": "ANC is 2100/µL, above the 1500 threshold",
    "claim_type": "numeric",
    "asserted_value": 2100,
    "asserted_unit": "cells/uL",
    "evidence": [
      {
        "kind": "structured",
        "id": "CE-LAB-441",
        "table": "CLINICAL_EVENT",
        "event_time": "2026-09-16T08:30:00",
        "source_recorded_at": "2026-09-16T16:45:00",
        "source_facility": "FAC-002",
        "derived": "ANC computed as WBC x (neutrophil% + band%) / 100"
      },
      {
        "kind": "document_span",
        "id": "AS-7741",
        "doc_id": "DOC-0031",
        "page_index": 2,
        "char_start": 1840,
        "char_end": 1876,
        "verification_status": "verified",
        "source_quality": "clean_pdf"
      }
    ]
  }],
  "limitations": [],
  "overall_status": "supported",
  "known_as_of": "2026-09-18T09:00:00",
  "binding_id": "BND-0007",
  "consent_id": "CON-0031",
  "rule_versions": {"CLIN-ANC-001": 3}
}
```

| `kind` | Resolves to | Renders as |
|---|---|---|
| `structured` | a governed row | the value, its three R2 clocks, the source facility, and the derivation if the number was computed rather than read |
| `document_span` | `DOC_PAGE` + `char_start..char_end` | the page with the span highlighted, plus a verification badge |
| `reference_clause` | a reference-corpus chunk | publisher, document, version, effective date, clause — **visually distinct from patient evidence (R6)** |

**Three properties the UI must guarantee:**

**`derived` is mandatory when a number was computed.** `DT_HARMONIZED_EVENTS` computes ANC from a differential because the real lab reported only percentages. A clinician who clicks the citation and cannot find `2100` on the page must be told the number was derived and how. Presenting a computed value as if it were printed is a subtle form of fabrication.

**The verification badge is never a percentage.** `verified` (two model families agreed) · `single_pass` (non-critical, one read) · `conflicting` (**the value is not asserted at all**) · `unverified` (pass B unavailable).

**Reference evidence is visually separated from patient evidence.** R6 is not only about ranked lists. A guideline clause rendered in the same panel style as a pathology page invites reading it as a finding about the patient.

---

## 3. The ten Class B question types, with the copilot's actual behaviour

All ten have a tool path. These are the worked examples the eval set is built from.

| # | Type | Example | Tools | What makes the answer good |
|---|---|---|---|---|
| 1 | **Status lookup** | "Is the pathology final?" | `SearchPatientDocuments` | Distinguishes *final* from *preliminary* from *not received* — R3, not a boolean |
| 2 | **Gap identification** ⭐ | "What is missing before Thursday?" | `GetReadiness` | Returns `fail` and `not_evaluated` **separately**, each with the rule version and an action for a named person |
| 3 | **Conflict detection** ⭐ | "Does anything contradict anything?" | `GetReadiness` + `SearchPatientDocuments` | Surfaces `discordant_across_specimens` — the finding that changed the real patient's treatment |
| 4 | **Timeline** | "When did the FISH result arrive?" | `GetTimeline` | Three R2 clocks, not one date, plus the sending facility |
| 5 | **Document lookup** | "What did the surgical pathology say about margins?" | `SearchPatientDocuments` | Page-anchored span, verification badge, supersession chain if amended |
| 6 | **Regulatory lookup** | "What does PM-JAY require for this package?" | `SearchReferenceDocuments` | Clause-level citation with effective date. **No patient data in the answer.** |
| 7 | **Cohort** | "Which patients lack a final report before this week's cycle?" | `CohortQuery` | Unavailable while a patient is bound. Counts and lists, never row-level PHI beyond the semantic view |
| 8 | **Change detection** ⭐ | "What changed since 09:00?" | `GetChanges` | Diffs two `known_as_of` states. Answers a question not seen in the competitor code we reviewed |
| 9 | **Provenance** | "Where did this HER2 status come from?" | `GetTimeline` + `SearchPatientDocuments` | Facility, accession, specimen, and both discordant reads if they exist |
| 10 | **Coverage utilisation** | "How much of the limit is left?" | `GetPatientFacts(coverage)` | Patient-level limit with an explicit statement when `is_family_floater` is true and the shared balance is unknown |

⭐ = in the live demo.

### Type 2 in full, because it is the flagship

**Question:** *"What is missing before Thursday?"*

**Answer as rendered:**

> **Three items are outstanding for the 19 September cycle.** *Known as of 18 Sep 2026, 09:00.*
>
> **1 — Final histopathology not received** · `not_evaluated`
> The surgical specimen report is recorded as *preliminary*. A final report has not been received from Facility B.
> → *Obtain the final histopathology report — Facility B, accession SP-24-8891.*
> `DOC-PATH-001 v3` · evidence: DOC-0031 p2
>
> **2 — LVEF assessment is 104 days old** · `fail`
> Trastuzumab requires an assessment within 90 days. Last recorded 6 June 2026.
> → *Schedule an echocardiogram.*
> `CARD-LVEF-001 v2` · evidence: CE-ECHO-118
>
> **3 — Authorisation state disagrees between two sources** · `conflicting`
> The payer table shows *pending*; the authorisation letter dated 14 September states *approved*. A human must reconcile these.
> → *Confirm with the payer desk before the cycle.*
> `COV-AUTH-002 v1` · evidence: CE-AUTH-77, DOC-0044 p1
>
> **Platelet count could not be verified.** Two independent reads of the 16 September CBC disagree on the platelet value; the page is a photograph. The value is not asserted and the platelet gate returns *not evaluated*.
> → *Confirm against the original report.*
>
> *Gate outcomes are produced by versioned SQL rules over the record as it stands. Your treating team decides whether treatment proceeds.*

**Every design decision in this specification is visible in that one answer:** four distinct outcome states rather than a boolean, a rule id and version behind each, an action addressed to a named facility, `known_as_of` stated, a refusal to assert an unverifiable number, and a standing deferral to the practitioner. **We did not see any competitor output containing the fourth paragraph** — none of the reviewed projects appeared to know when their own extraction is unreliable.

---

## 4. Refusal and fallback — what the user actually sees

`[BONUS]` guardrails and graceful fallback. Every one of these is a demo beat.

| Situation | What the user sees | Never |
|---|---|---|
| **Class A question** | *"That is a clinical decision for your treating team. I can assemble the evidence they would need."* → **Generate evidence packet** button, addressed to the named practitioner via `nmc_registration_no` | A hedged clinical opinion |
| **No patient bound** | Patient picker, filtered to the care team | A guess, or an empty answer |
| **Consent revoked mid-session** | *"Access to this record has been withdrawn."* Context cleared, binding released | Any cached content |
| **No care relationship** | *"No accessible record for that request."* Nothing about why | Confirmation the patient exists |
| **Extraction conflict (R7)** | The value is absent, the disagreement is stated, resolution is named | The pass-A value with a caveat |
| **Claim stripped by validator** | The claim is replaced by an explicit limitation | Silent removal |
| **Cortex Search down** | Structured facts answer; `overall_status: "partial"`, naming the missing capability | A confident partial answer |
| **Agent unreachable** | Deterministic Python router over the same 8 procedures | An error page |
| **Malformed agent JSON** | One reparse, then the deterministic router | Raw model output |
| **Injected instruction in a document** | Quoted as content, labelled as document text | Obedience |
| **Nothing found** | *"Nothing found as of 18 Sep 09:00"* — with the timestamp | *"No results"* |

**The distinction between the third and fourth rows is deliberate.** *"Access withdrawn"* confirms a record exists; *"no accessible record"* does not. Consent revocation is told to a user who previously had legitimate access, because they need to know why their view changed. A user who never had access learns nothing.

---

## 5. Demo script — six minutes

Ordered so each beat lands on a different judging criterion.

| # | Beat | Action | Criterion |
|---|---|---|---|
| 0 | **Bind** | Coordinator signs in, picks the patient from a care-team-filtered list. Header shows the binding. | Sets up every claim that follows |
| 1 | **Gap identification** | *"What is missing before Thursday?"* → the answer in §3 | RWR + TE |
| 2 | **Click a citation** | Opens the page, span highlighted, verification badge. Then click the derived ANC → shows `WBC x (neut% + band%) / 100` | *"clear source evidence"* |
| 3 | **Extraction refusal** | Point at paragraph 4. *"Two reads disagree, so it will not assert the number."* | **TE — not found in the competitor code we reviewed** |
| 4 | **Class A refusal** | *"Should she proceed on Thursday?"* → refused, evidence packet offered, practitioner named | RWR — legal boundary |
| 5 | **Consent revocation** | Revoke in a second window. Re-ask beat 1. Returns nothing, context clears. | **TE — not found in the competitor code we reviewed** |
| 6 | **Change detection** | Re-bind, set `known_as_of` to 09:00, then to now. Two different, both correct, answers. | TE — R2 made visible |
| 7 | **Judge Console** | Run the naive search probe live → returns another patient's pathology. Then ours → nothing. Query IDs on screen. | **TE — the strongest single claim** |
| 8 | **Family view** | Same patient, caretaker role, bring-list in Hindi | RWR + completeness |

**Beat 7 is the one that wins.** It is not a feature demonstration; it is a live reproduction of a vulnerability that two of four competitors ship, with the query ID visible.

---

## 6. Coverage check against the brief

| Brief line | Where the copilot satisfies it |
|---|---|
| *"unifies data into a patient or member 360"* | Binding + `GetPatientFacts` across 6 domains. Patient 360; the family/member dimension is declared out of scope. |
| *"answers clinical, safety, or regulatory questions"* | 10 Class B types; safety gate; reference corpus for regulatory |
| *"with cited evidence"* | Typed evidence contract, §2 — three kinds, each with its own resolution and rendering |
| *"risk stratification ... never opaque predictions"* | 5 gates, 4 outcomes, rule id + version on every line. No trained model anywhere |
| *"evidence retrieval"* | Dual corpora, physically separate services |
| *"a cited answer"* | The frozen schema; unsupported claims are stripped, not softened |
| *"Q&A experience with clear source evidence"* | Ask + Evidence is the primary screen, not one tab of six |
| *"Combine structured records with unstructured documents"* | A single answer mixes `structured` and `document_span` evidence — visible in §3 |

| Ingenuity category | In the copilot |
|---|---|
| Reusable skills | 4 skills; `clinical-question-routing` and `evidence-retrieval` are called on every turn |
| MCP connectors | `create_review_task` turns an answer into a ticket — read-only analysis becomes action |
| Custom tools / function calling | 8 procedures the agent calls |
| Multi-agent orchestration | `TASK_SAARTHI_ORCHESTRATOR` chains the 4 skills |
| Guardrails / graceful fallback | §4 in full — eleven named situations, all fail-closed |
| Automations | Nightly readiness refresh; notification on blocker with ≤3 days |

---

## 7. What this document changed

| Finding | Change | Severity |
|---|---|---|
| **Patient binding was never defined** | `PATIENT_BINDING` table, `bind_patient` procedure, session-resolved scope, re-validated per call | **Fatal — the copilot could not have worked** |
| `GetReadiness(encounter_id)` reintroduced agent-controlled selection | Signature changed to optional `encounter_ref`, validated against the binding | **Fatal** |
| Conversation model absent | §1 — binding and `known_as_of` persist, history clears on patient switch | High |
| `evidence_ids` were opaque strings | Typed evidence contract with three kinds, §2 | High |
| Derived values indistinguishable from printed ones | `derived` field mandatory when a value was computed | High |
| `CohortQuery` mixable with a bound conversation | Unavailable while a patient is bound | Medium |

**Three tables and one procedure are added to the object inventory:** `PATIENT_BINDING`, and `bind_patient` as procedure 11. `SPEC.md` §2 and `AI-INTEGRATION-ARCHITECTURE.md` §2/§5/§10 are updated to match.

The gap was found by writing down what the user sees, turn by turn, rather than what the system contains. **It was invisible at the architecture level because every individual component was correct** — authorisation was verified three ways, the agent genuinely cannot supply `patient_id`, and the tools genuinely enforce consent. The missing piece was not a component. It was the answer to *"which patient?"*, which every component assumed somebody else had established.
