# SAARTHI — Architecture Handoff

**For the three people building this. Read §1 and §2 before writing a line of code.**

The architecture is complete and internally consistent. 5,800 lines of specification across 7 documents, 15 diagrams in two renderings, 26 research files, 10 empirically verified platform behaviours. **Nothing below requires further design decisions.**

This document exists for one reason: **three people, seventeen days, and no time for anyone to wait on anyone else.** It freezes the interfaces between the work streams so all three can start on day one and integrate on day five.

| | |
|---|---|
| **Submission** | 4 Oct 2026 · target completion **1 Oct**, contingency 2–4 Oct |
| **Async judging** | 5–22 Oct — judges alone with this repository for **18 days** |
| **Live demo** | 27–30 Oct, only if shortlisted |
| **Rubric** | Real-World Relevance 30% · **Technical Execution 40%** · Solution Completeness 30% |
| **Budget** | ~$1,200 across three accounts. $386 remaining on the primary. |

---

## 1. Read this much, in this order

**Everyone reads the first three. Ninety minutes, and it is not optional** — the interfaces in §2 will not make sense without them.

| Order | Document | Why | Time |
|---|---|---|---|
| 1 | `AGENTS.md` (repo root) | R1–R7 and the 10 verified platform facts. **Violating one of these is a defect, not a design choice.** | 10 min |
| 2 | `COPILOT-SPEC.md` | The thing we are actually delivering. §0 documents a fatal gap found late — read it first, because it changes how every tool is called. | 25 min |
| 3 | `ARCHITECTURE-DIAGRAMS.md` diagrams 3, 6, 8 | Containers, trust boundaries, R7. The three pictures that carry the submission. | 20 min |
| 4 | `SPEC.md` §2 | The data model. Skim the rest. | 30 min |
| 5 | `AI-INTEGRATION-ARCHITECTURE.md` §2, §5 | Agent spec and the call path. | 20 min |
| 6 | Your own stream's section in §3 below | | 10 min |

**Read only when you need them:** `FINAL-VALIDATION.md` (proof we cover the brief), `VERIFIED-platform-behaviour.md` (the query IDs behind every "verified" claim), the four review documents (why things are the way they are), `research/` (26 files, the evidence base).


### The five things that win, ranked

If the schedule collapses, these survive in this order.

1. **R7 two-pass extraction verification** — we did not find extraction verification in the competitor code we reviewed
2. **Consent enforced at query time** — we did not find consent modelling in the competitor code we reviewed
3. **`CURRENT_USER()`-keyed RAP, proven** — competitor access control we reviewed was a UI role picker or coarse role grants (file-level, 16 Sept; not re-verifiable here)
4. **4 skills + orchestrating Task** — hits both named bonus categories
5. **A working vertical slice, deployed** — the category is *Technical Execution*

---

## 2. The five frozen contracts

**These are frozen. Changing one requires telling the other two people before you change it.** They exist so that nobody is ever blocked: every stream builds against the contract, with stubs where the other side does not exist yet.

### Contract 1 — Physical schema

**Owner: Stream A.** Source of truth: `SPEC.md` §2. 34 tables built, 7 designed-only.

Frozen names that everything else depends on. If you need a column that is not here, ask — do not add it silently.

```
GOVERNANCE   ORGANIZATION · FACILITY · DEPARTMENT · PRACTITIONER · CARE_TEAM
             CONSENT · PATIENT_BINDING · SECURITY_EVENT
CORE         PATIENT · ID_MAP · ENCOUNTER · CLINICAL_EVENT
             COVERAGE · AUTHORIZATION · REFERRAL · TREATMENT_PLAN
DOCUMENTS    DOCUMENT · DOC_PAGE · DOC_CHUNK · RAW_FHIR_BUNDLE
EVIDENCE     ASSERTION · EVIDENCE_LINK · ANSWER_RUN
OPERATIONAL  RULE_CATALOG · REVIEW_ISSUE · REVIEW_TASK · READINESS_STATE
             CLINICAL_ONTOLOGY · UNIT_REGISTRY · SCHEME_REGISTRY
```

**Three schema rules that are not negotiable:**

- `DOC_PAGE` carries the row access policy. `DOC_CHUNK` carries **none** — F4 makes a Cortex Search service impossible over a RAP-protected table. Content lives behind the policy; the index returns IDs.
- The row access policy keys on **`CURRENT_USER()`**, never `CURRENT_ROLE()` — F3. A role-keyed policy returns every patient inside an owner's-rights procedure and looks perfect in single-user testing.
- `ANSWER_RUN` stores **evidence pointers, never answer text.** DPDP s.12(3) erasure and Rule 6(e) retention cannot both be satisfied otherwise.

### Contract 2 — Tool signatures

**Owner: Stream B specifies, Stream A implements the bodies.** Source: `AI-INTEGRATION-ARCHITECTURE.md` §2.

**No tool takes a patient selector. Ever.** The subject comes from `PATIENT_BINDING` resolved on `CURRENT_SESSION()`. This is `COPILOT-SPEC.md` §0 and it is the single most important line in this document.

| # | Procedure | Input | Returns |
|---|---|---|---|
| 1 | `get_patient_facts` | `domain`, `known_as_of?` | structured facts for the bound patient |
| 2 | `get_readiness` | `encounter_ref?`, `known_as_of?` | 5 gates, outcome + rule id + version + evidence ids |
| 3 | `search_patient_documents` | `query`, `known_as_of?` | page-anchored passages, patient scope injected server-side |
| 4 | `search_reference_documents` | `query`, `jurisdiction?`, `effective_date?` | clause citations, **no patient data** |
| 5 | `cohort_query` | `question` | aggregates. **Unavailable while a patient is bound** |
| 6 | `get_timeline` | `known_as_of?` | chronology with all three R2 clocks + facility |
| 7 | `get_changes` | `from_ts`, `to_ts` | diff of two knowledge states |
| 8 | `create_review_task` | `issue_id`, `action`, `reason`, `idempotency_key` | the only write tool |
| 9 | `bind_patient` | `patient_id` | `binding_id`. Validates care team + consent before writing |
| 10 | `evaluate_gates` | `patient_id`, `encounter_id`, `known_as_of` | internal — not an agent tool |
| 11 | `validate_answer` | draft + evidence ids | internal — not an agent tool |

Every one is `EXECUTE AS OWNER`. Every one re-validates care team and consent **on every call** — a binding records a selection, never a cached authorisation.

**Uniform error shape.** Any stream can handle these without knowing the others' internals:

```json
{"error": "no_patient_bound" | "no_patient_access" | "access_withdrawn"
        | "binding_mismatch" | "consent_not_valid", "known_as_of": "<ts>"}
```

`no_patient_access` deliberately reveals nothing about whether the patient exists. `access_withdrawn` deliberately does — it goes only to a user who previously had legitimate access and needs to know why their view changed.

### Contract 3 — Answer JSON

**Owner: Stream B.** Frozen because the agent prompt, the validator, and the UI all depend on it. Full form in `COPILOT-SPEC.md` §2.

```json
{
  "classification": "CLASS_B",
  "claims": [{
    "text": "ANC is 2100/µL, above the 1500 threshold",
    "claim_type": "numeric",
    "asserted_value": 2100,
    "asserted_unit": "cells/uL",
    "evidence": [{"kind": "structured|document_span|reference_clause", "...": "..."}]
  }],
  "limitations": [],
  "overall_status": "supported|partial|refused",
  "known_as_of": "2026-09-18T09:00:00",
  "binding_id": "BND-0007",
  "consent_id": "CON-0031",
  "rule_versions": {"CLIN-ANC-001": 3}
}
```

**`evidence` is typed, not a list of opaque ids.** Three kinds, three renderings. `derived` is **mandatory** on a `structured` reference whose value was computed rather than read — ANC comes from a differential, and a clinician who clicks through and cannot find the number on the page must be told why.

### Contract 4 — Rule definition

**Owner: Stream A.** Source: `SPEC.md` §4, thresholds in `research/clinical/clinical-thresholds.md`.

```
RULE_CATALOG  rule_id · rule_version · gate(clinical|safety|documentation|coverage|identity)
      · specialty · concept_id · operator · threshold_value · unit
      · severity(blocker|advisory) · specificity INT
      · guideline_ref · provenance_note
```

Sixteen rules, six specialties. **Four-valued outcome, never a boolean:** `pass` · `fail` · `not_evaluated` · `conflicting`.

**`provenance_note` is mandatory and it is a scoring decision.** Where a threshold is practice consensus rather than a guideline requirement — the 21-day post-operative interval, the 42-day contaminated-wound extension — it says so, and the UI shows it. Presenting institutional practice as a guideline mandate is the same dishonesty we document in competitors.

### Contract 5 — Synthetic data

**Owner: Stream C.** Source: `SPEC.md` §9.

A **seeded fact ledger** is generated first; every projection — tables, FHIR bundles, PDFs — derives from it. That is what makes the eval answers knowable: the ledger *is* the ground truth. 100% synthetic; the 19 real reports informed format research only.

Frozen so A and B can write tests before the data exists:

| | |
|---|---|
| Patients | 100, one deep case derived from the real record |
| Deep case | 4 facilities · 7 identifiers · **0 ABHA** · appendectomy mid-chemo · DEXA osteopenia · HER2 discordant across specimens |
| Corruption scenarios | 13, each mapped to the rule it exercises |
| Eval questions | 80 dev + 80 held-out, with expected tool invocations |
| Rule fixtures | 80, one per rule per outcome state |

**The deep case must exercise `discordant_across_specimens` and an R7 disagreement.** Those two are the demo. Without them in the data, the two strongest claims cannot be shown.

---

## 3. Three streams, one integration point

Named by function. Reassign the letters as you like, but **keep one owner per stream** — shared ownership of an interface is how integration slips.

### Stream A — Platform and rules

`setup.sql` · 34 tables · governance · the rule engine · pipeline · the tool procedure bodies

Day 1 deliverable: `setup.sql` runs clean on a fresh account and creates every table, role, policy and stage. Idempotent. **The first line is `ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'ANY_REGION'`** — `GCP_ME_CENTRAL2` has no local `AI_COMPLETE` and nothing in the AI path runs without it.

Owns: Contracts 1 and 4. Blocked by nobody.

### Stream B — Copilot

Agent spec · the 8 tools' schemas · Class A/B classifier · the validator · Streamlit · the evidence pane

Day 1 deliverable: the answer JSON schema frozen and committed, plus a **hard-coded fixture answer rendering in Streamlit with a clickable citation.** Build the whole UI against a fixture; swap in real procedures on day 4. Do not wait for Stream A.

Owns: Contracts 2 and 3. Blocked by nobody if the fixture is built first.

### Stream C — Data, corpus, evidence

Seeded ledger · synthetic documents · reference corpus · eval sets · the CoCo evidence pack

Day 1 deliverable: the ledger generator emitting one patient end to end, and Tier 1 reference PDFs downloaded into `data/reference/`. **Measure `AI_PARSE_DOCUMENT` cost on one real page before committing to the full corpus** — the estimate in `reference-corpus-sources.md` is internally inconsistent by roughly an order of magnitude (U1).

Owns: Contract 5. Blocked by nobody.

### The Day 5 gate — one hard stop

**One patient must flow: document → parse → R7 two-pass verify → assertion → ontology normalise → `CLIN-ANC-001` → cited answer on screen, under a real `CARE_TEAM` and `CONSENT`, with a clickable page-level citation.**

If that is not working at the end of Day 5, **cut scope that day.** Not on Day 12. In order: drop the MCP server, then `get_changes`, then two specialties, then the Navigator View. **Never cut R7, consent, or the citation path** — those are items 1, 2 and 5 of what wins.

---

## 4. Definition of done

A component is done when all of its row is true. "It works on my machine" is not a row.

| Component | Done means |
|---|---|
| A table | in `setup.sql`, idempotent, RAP/masking attached where §2 says, referenced by a passing fixture |
| A rule | in `RULE_CATALOG` with a version, `guideline_ref`, `provenance_note`, and fixtures for **all four** outcomes |
| A tool procedure | `EXECUTE AS OWNER`, resolves binding, re-validates consent, returns the uniform error shape, has a negative test proving it returns nothing for an unauthorised user |
| The extraction path | R7 two-pass on safety-critical concepts, disagreement produces `conflicting`, and a **deliberately ambiguous page proves the refusal** |
| The validator | all 6 checks, each with a test that makes it fire, `AI_FILTER` failure **fails closed** |
| The copilot | answers all 10 Class B types, refuses Class A, states `known_as_of`, every claim clickable to a page or row |
| A skill | `SKILL.md` on the stage, invoked by the orchestrating Task, and **reuse-tested against a second schema** — including one ambiguity it correctly refuses to resolve |
| The eval | `EXECUTE_AI_EVALUATION` runs on both sets, machine-readable results committed, baseline RAG delta reported |
| Anything at all | its row in `IMPLEMENTATION-STATUS.md` is accurate |

---

## 5. Seventeen days

| Days | Focus | Gate |
|---|---|---|
| **1** | Three streams start in parallel. A: `setup.sql`. B: schema frozen + fixture UI. C: ledger + corpus + U1 cost. | `setup.sql` runs clean on a fresh account |
| **2–5** | Vertical slice, deployed | **HARD GATE — see §3. Cut scope on Day 5 if it fails.** |
| **6–10** | Scale: 16 rules, 100 patients, 3 ingestion paths, dual corpora, 6 screens | All 10 Class B types answerable |
| **11–14** | Proof and bonuses: 4 skills, orchestrating Task, MCP, eval harness, Judge Console | 8 judge probes reproducible from a read-only role |
| **15–17** | Freeze: `IMPLEMENTATION-STATUS.md` honest, one-script deploy verified on a **clean account**, README, demo rehearsed | A stranger can deploy and reproduce every claim |

**Reserve a full half-day in 15–17 for a clean-account deploy from scratch.** Judges get 18 days alone with this repository. A deploy that only works on an account with leftover state from development is the most likely way to lose Solution Completeness, and it is invisible until you test it.

---

## 6. When you are blocked

| Blocker | Do this |
|---|---|
| Another stream's component does not exist | Build against the contract in §2 with a stub. **Never wait.** |
| A contract seems wrong | Say so before changing it. It is frozen for the other two, not for its owner. |
| A platform behaviour surprises you | Test it, record the query ID in `evidence/coco/verification-query-ids.md`, then design around what you observed. **Ten of our best claims came from doing exactly this.** |
| An AI function will not compile | Run `cortex search docs` before guessing. Four consecutive failed guesses at `AI_FILTER` syntax cost real time; the docs had it. |
| You are tempted to add a table or feature | Don't. `SPEC.md` is the scope. **Designing more than we build is actively negative on Completeness.** |
| A threshold has no source | Mark it `provenance_note: practice consensus` and move on. Do not invent a guideline citation. |

**Record failures.** Failure-and-fix pairs are the most credible CoCo lifecycle evidence available, and judges are explicitly looking for evidence at every phase. Do not curate them out.

---

## 7. What we are deliberately not building

Stated so nobody builds them by accident, and so the submission can say we refused rather than missed.

| Not building | Why |
|---|---|
| Any trained predictive model, Cortex ML included | The brief says *"never opaque predictions."* Risk stratification is versioned SQL. **This is a refusal, not an omission.** |
| Clinical decision support of any kind | NMC TPG 2020. A legal boundary, not a preference. Class A is refused for every role including the oncologist. |
| Confidence percentages | A percentage invites a clinical decision. We report the evidence state instead. |
| Search sharding beyond 400M chunks | Documented in `SCALE-REVIEW.md`, out of scope at 100 patients |
| FRAX fracture-risk scoring | Needs inputs we do not model. The T-score gate is the tractable one. |
| Multilingual query **input** | Output translation is verified; input is a Day-1 test, not a commitment |

---

## 8. The four residual risks

From `FINAL-VALIDATION.md` Part 5. None is an architectural flaw; all four are execution risks.

| # | Risk | Mitigation |
|---|---|---|
| 1 | **Zero shipped code, 17 days.** Two competitors have live URLs and the category is *Technical Execution*. **Highest risk by far.** | The Day-5 gate. Architecture is complete enough that build is mechanical — the object inventory exists so `setup.sql` needs no design decisions. |
| 2 | `AI_PARSE_DOCUMENT` cost unmeasured (U1) | Stream C measures one page on Day 1. Do not commit to Tier 2 corpus first. |
| 3 | `CURRENT_USER()` inside deployed Streamlit unconfirmed (U2) | F3 proves the mechanism at the procedure layer; F7 gives the service-user fallback; `AGENT_RUN` means warehouse runtime works regardless. Day-1 check. |
| 4 | Five NRCeS ABDM FHIR claims unverified | All flagged ⚠️ in `fhir-field-mapping.md` §12. Base-FHIR paths are stable. **No India-profile claim ships unverified.** |

---

## 9. The honesty rules, because they are worth 30%

Judges spend 5–22 October alone with this repository. Completeness is decided by reproducibility and honesty, not polish.

- **No claim in the README or the deck that is not demonstrable from the repo.** `IMPLEMENTATION-STATUS.md` marks every component `built | partial | designed-only`.
- **Absolute counts alongside rates.** "94% on 80 questions" not "94% accuracy". Cold starts reported separately.
- **Engineering gates on synthetic tests are not clinical validation.** Say so.
- **`QUERY_HISTORY` is live evidence; `ACCESS_HISTORY` lags up to 180 minutes.** Label which is which. Never present stale data as live.
- **Competitor comparisons cite file and line** from public source, never inference from a gap in a README.
- **Synthetic data only in the system.** The 19 real reports informed format research. Consent is held — the patient's son is on this team. Credited with dignity, never used as system data and never as sympathy leverage.

---

## 10. Git

**`AGENTS.md` rule #1: never commit.** Agents do not run `git commit`, `push`, `merge`, `rebase`, `reset` or `tag`. Danush handles all commits.

Feature branches, never straight to main. Imperative commit messages under 72 characters. One logical change per commit.

---

**The architecture is done. Every decision traces to a verbatim brief requirement, a rubric criterion, a verified platform behaviour, or a documented competitor gap. There is nothing left to research.**

**Build starts.**
