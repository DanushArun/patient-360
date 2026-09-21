# SAARTHI — Build Execution Plan

**Two builders. Seventeen days. One vertical slice by Day 5 or cut scope.**

Every task below names the exact objects to create, the file to create them in, the architecture diagram that specifies the behaviour, and the test that proves it works.

---

## 0. Before you write any code

### Read these, in this order

| # | Document | Why | Time |
|---|---|---|---|
| 1 | `AGENTS.md` (repo root) | R1–R7 and the 10 verified platform facts. Violating one is a defect, not a design choice. | 10 min |
| 2 | `ARCHITECTURE-DIAGRAMS.md` diagram 5 + build order | The 21-step dependency chain. This is the structure of `setup.sql`. | 15 min |
| 3 | `ARCHITECTURE-DIAGRAMS.md` diagrams 3, 6, 8 | Containers, trust boundaries, R7. The three diagrams that carry the submission. | 20 min |
| 4 | `COPILOT-SPEC.md` §0 | Why no tool takes a patient selector. Changes how every tool is called. | 25 min |
| 5 | `SPEC.md` §2 | The data model. 34 tables. | 30 min |
| 6 | Your own stream's section below | | 15 min |

### Stream ownership

| Stream | Owner | Domain |
|---|---|---|
| **Stream 1** | Builder 1 | Copilot, agent, tools, extraction pipeline, validator, skills, eval, Streamlit UI |
| **Stream 2** | Builder 2 | Snowflake deployment, DDL, governance, data generation, ingestion, search services, semantic view, rule engine |

### Frozen contracts

| Contract | Source | Owner | Consumed by |
|---|---|---|---|
| Physical schema — 34 tables | `SPEC.md` §2, diagrams 9 + 10 | Stream 2 | Both |
| Tool signatures — 11 procedures | `AI-INTEGRATION-ARCHITECTURE.md` §2 | Stream 1 specifies, Stream 2 implements bodies | Both |
| Answer JSON | `COPILOT-SPEC.md` §2 | Stream 1 | Stream 1 |
| Rule definitions — 16 rules in `RULE_CATALOG` | `SPEC.md` §4, diagram 15 | Stream 2 | Both |
| Synthetic data shape | `SPEC.md` §9 | Stream 2 | Both |

**Changing a frozen contract requires telling the other person before you change it.**

### Uniform error shape — both streams must handle these

```json
{"error": "no_patient_bound" | "no_patient_access" | "access_withdrawn"
        | "binding_mismatch" | "consent_not_valid", "known_as_of": "<ts>"}
```

`no_patient_access` deliberately reveals nothing about whether the patient exists. `access_withdrawn` deliberately does — it goes only to a user who previously had legitimate access.

---

## Phase 1 — Vertical Slice (Days 1–5)

**Gate:** One patient flows document → parse → R7 two-pass verify → assertion → ontology normalise → `CLIN-ANC-001` → cited answer on screen, under real `CARE_TEAM` + `CONSENT`, with a clickable page-level citation.

**If this does not work by end of Day 5, cut scope that day. Not Day 12.**

---

### Stream 2 — Platform Foundation

#### Day 1 — `setup.sql` and `teardown.sql`

**Reference:** Diagram 5 build order steps 1–9. `SPEC.md` §2 for table definitions. Diagrams 9 and 10 for the ERDs.

**File:** `backend/sql/setup.sql`

| Step | Object | Exact requirement |
|---|---|---|
| 1 | Account parameter | `ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'ANY_REGION';` — **line one.** `GCP_ME_CENTRAL2` has no local `AI_COMPLETE`. |
| 2 | Warehouse | `SAARTHI_AI_WH`, `WAREHOUSE_SIZE = 'SMALL'`, `AUTO_SUSPEND = 60`, `INITIALLY_SUSPENDED = TRUE` |
| 3 | Database + schemas | `SAARTHI` database. Schemas: `CORE`, `DOCUMENTS`, `EVIDENCE`, `OPERATIONAL`, `GOVERNANCE`, `STAGES`, `EVAL` |
| 4 | Roles | `SAARTHI_APP`, `SAARTHI_COORDINATOR`, `SAARTHI_ONCOLOGIST`, `SAARTHI_NAVIGATOR`, `SAARTHI_JUDGE` |
| 5 | Stages | `PATIENT_DOCS`, `REFERENCE_DOCS`, `SKILLS` — all `ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE')`, all `DIRECTORY = (ENABLE = TRUE)` |
| 6 | Tables | 34 tables per `SPEC.md` §2. Every table marked `[B]`. Count per schema from the SPEC, not from memory. |
| 7 | Policies | `patient_scope` RAP keyed on **`CURRENT_USER()`**. 2 masking policies. 1 sensitivity tag. |
| 8 | Attach policies | `DOC_PAGE` gets the RAP. **`DOC_CHUNK` gets none** — F4 makes a search service impossible over a RAP-protected table. |
| 9 | Grants | App role gets **no `USAGE`** on search services. Retrieval only through owner's-rights procedures. |

**Test:** Run `setup.sql` on a fresh account. Run it again — must succeed (idempotent). Run `teardown.sql`. Run `setup.sql` a third time. All three succeed.

**Verify F3 immediately after step 8:**
```sql
-- Inside an EXECUTE AS OWNER procedure, confirm CURRENT_USER() is the caller
-- and CURRENT_ROLE() is the owner. This is why the RAP keys on CURRENT_USER().
```
Record the query ID in `evidence/coco/verification-query-ids.md`.

---

#### Day 1–2 — Deep synthetic patient

**Reference:** `SPEC.md` §9. Contract 5 in `ARCHITECTURE-HANDOFF.md`.

**File:** `data/generator/ledger.py`

Generate a **seeded fact ledger first**, then derive every projection from it. The ledger is the ground truth — that is what makes eval answers knowable.

| Attribute | Value | Why |
|---|---|---|
| Facilities | 4 | Real patient crossed 4. Tests cross-facility identity resolution. |
| Identifiers | 7, **zero ABHA** | Real record had 7 identifiers, none ABHA. R4's design centre. |
| Clinical arc | Appendectomy mid-chemo | Enables the flagship cross-department demo |
| Bone health | DEXA-confirmed osteopenia + zoledronic acid | Exercises `ENDO-DEXA-001` twice |
| Biomarker | HER2 discordant across specimens | Outside biopsy Grade II / IHC 1+; surgical specimen Grade III / IHC 2+. Different accession IDs. |
| Treatment plan | 4 versions | Real plan changed 4 times in 18 months |

**Projections required:**
- CSV files per source system → `COPY INTO` staging
- One FHIR R4 bundle with `Bundle.entry[]` → `RAW_FHIR_BUNDLE`
- Synthetic PDF reports → `PUT` to `PATIENT_DOCS` stage
- **One deliberately ambiguous CBC page** where the platelet count is genuinely hard to read. This is the R7 demo asset.

**Test:** Query each table. Every row traces back to a ledger entry.

---

#### Day 2–3 — Governance live

**Reference:** Diagram 9 (identity ERD). Diagram 6 (trust boundaries). `SPEC.md` §2.1 and §2.2.

| Object | Requirement |
|---|---|
| `PRACTITIONER` rows | 3 test practitioners with `snowflake_user` mapped to real Snowflake users, `nmc_registration_no` populated |
| `CARE_TEAM` rows | Practitioner 1 → Patient 1 (`treating`, active). Practitioner 2 → Patient 2 only (for the cross-scope test). |
| `CONSENT` rows | One `active` covering Patient 1 with `purpose_code = 'treatment'`. One revokable for the demo. |
| `bind_patient` procedure | Validates care team + consent before writing. Returns `binding_id`. Releases prior binding for the session. |
| Session hardening | `USE SECONDARY ROLES NONE` in every app session |

**Tests that must pass:**
1. Practitioner 1 binds to Patient 1 → succeeds, returns `binding_id`
2. Practitioner 1 binds to Patient 2 → fails with `no_patient_access`
3. Revoke the consent → Practitioner 1's next tool call returns nothing
4. Without `USE SECONDARY ROLES NONE`, an unfiltered search succeeds. With it, returns `390404`. **Record both query IDs.**

---

#### Day 3–4 — Ingestion path 1: unstructured

**Reference:** Diagram 11 (pipeline topology) — the `ST → STR1 → T1` path. Diagram 8 (document to verified assertion) steps 1–2.

| Object | Requirement |
|---|---|
| `STREAM` on directory table | `CREATE STREAM doc_stream ON DIRECTORY (@PATIENT_DOCS)` |
| `TASK parse_documents` | `AI_PARSE_DOCUMENT(@stage, {'mode': 'LAYOUT', 'page_split': true})`. Dedup on SHA-256 `file_hash` before parsing. |
| Output | `DOCUMENT` row + `DOC_PAGE` rows (one per page, with `text` and `char_count`) |

**Test:** Upload a PDF. Stream fires. Task runs. `DOC_PAGE` has one row per page with extracted text. Upload the same PDF again → `status = 'duplicate'`, no re-parse.

---

#### Day 4 — Ontology and unit registry

**Reference:** `SPEC.md` §2.7. This closes brief gap G5 (ontology named twice in the CoCo guidelines).

**File:** `backend/sql/data/ontology.sql`

| Concept | `is_safety_critical` | Synonyms | `reflexes_to` |
|---|---|---|---|
| ANC | **true** | absolute neutrophil count, neuts | — |
| Platelets | **true** | PLT, thrombocytes | — |
| HER2 IHC | **true** | HER2 immunohistochemistry | HER2 FISH |
| HER2 FISH | **true** | HER2 in-situ hybridisation | — |
| Creatinine | **true** | Cr, serum creatinine | — |
| Bilirubin | **true** | T.Bil, total bilirubin | — |
| AST | true | SGOT | — |
| ALT | true | SGPT | — |
| LVEF | **true** | ejection fraction, EF | — |
| HbA1c | false | glycated haemoglobin, A1c | — |
| T-score | false | DEXA T-score, BMD | — |
| Weight | false | body weight, wt | — |

**`UNIT_REGISTRY` entries:**

| Source pattern | Canonical | Factor | Plausible range |
|---|---|---|---|
| `GM%` | `g/dL` | 1.0 | 3.0 – 20.0 |
| `/CUMM` | `/µL` | 1.0 | 100 – 100000 |
| `mg%` | `mg/dL` | 1.0 | 0.1 – 20.0 |
| `lakhs/cumm` | `/µL` | 100000 | 10000 – 1000000 |

**Test:** Insert a lab value with `GM%`. Query `DT_HARMONIZED_EVENTS` → value appears in `g/dL`. Insert an implausible value → rejected.

---

#### Day 4–5 — `DT_HARMONIZED_EVENTS`

**Reference:** Diagram 4 (component view) — the `HARM` component. Diagram 11 — `D1`.

This is the single most load-bearing Dynamic Table. It must:

1. **Normalise units** via `UNIT_REGISTRY` join, with plausibility rejection
2. **Derive ANC** when the lab reports only a differential: `WBC × (neutrophil% + band%) / 100`
3. **Compute CrCl** via Cockcroft-Gault using the latest `vitals` weight event: `((140 − age) × weight_kg × (0.85 if female)) / (72 × creatinine_mg_dL)`
4. **Preserve `abnormal_flag` separately** — the `L`/`H` suffix never enters `value_num`
5. **Carry all three R2 clocks** through untouched

**Test:** A patient whose lab reports WBC 6000 and neutrophils 35% with no ANC row. Query the DT → ANC = 2100. The source document never printed that number.

---

#### Day 5 — Rule engine + `CLIN-ANC-001`

**Reference:** Diagram 4 (component view) — `GATES`, `PREC`. Diagram 15 (gate outcomes decision flow).

**File:** `backend/sql/procedures/evaluate_gates.sql`

```
PROCEDURE evaluate_gates(p_patient_id, p_encounter_id, p_known_as_of) RETURNS VARIANT
```

Logic, in order:
1. Load rules effective at `p_known_as_of`, matching specialty, ordered by `specificity` DESC
2. Query evidence with `ingested_at <= p_known_as_of` **and** `valid_until >= encounter.scheduled_time`
3. Skip any assertion where `verification_status = 'conflicting'` → outcome `not_evaluated`
4. Evaluate threshold → `pass` | `fail`
5. Emit `{gate, rule_id, rule_version, outcome, evidence_ids[], reason, severity}`

**`CLIN-ANC-001` must produce all four outcomes on test data:**

| Outcome | Test condition |
|---|---|
| `pass` | ANC 2100, verified, within validity window |
| `fail` | ANC 900, verified |
| `not_evaluated` | No ANC row, or ANC assertion is `conflicting` |
| `conflicting` | Two sources report different ANC values |

**Test:** Four fixture patients, four outcomes, each returning the correct `rule_version` and non-empty `evidence_ids`.

---

### Stream 1 — Copilot Core

#### Day 1 — Model access and availability probe ⚠️ **do this first**

**Reference:** `AI-INTEGRATION-ARCHITECTURE.md` §1.1–§1.3.

**File:** `backend/sql/probes/model_availability.sql`

Nothing in the AI path runs until this passes, and every extraction decision downstream depends on the result.

| Step | Action |
|---|---|
| 1 | `GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE SAARTHI_APP;` |
| 2 | `ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'ANY_REGION';` then `SHOW PARAMETERS LIKE 'CORTEX_ENABLED_CROSS_REGION' IN ACCOUNT;` |
| 3 | Probe every candidate with `AI_COMPLETE` — pass A, pass B and its two fallbacks, the classifier model, and the orchestration candidates |
| 4 | Record **every** result, available or not, in `evidence/coco/verification-query-ids.md` with its query ID |
| 5 | Confirm what `orchestration: auto` resolves to **today**, then pin it |

**Why this is not optional.** `GCP_ME_CENTRAL2` appears in **no** Snowflake regional availability table — every model reaches this account through cross-region inference, so the published roster is an upper bound and never a guarantee. The only evidence of what actually runs here is a probe dated 17 Sept that predates a model generation: it found `claude-4-sonnet` and `mistral-large2` already rejected as legacy, and `llama3.1-70b` has since joined them.

**Test:** each candidate returns a row or a named error. `claude-haiku-4-5` is reachable, or the fallback chain is exercised and the choice is recorded.

**Use `AI_COMPLETE`, not `SNOWFLAKE.CORTEX.COMPLETE`** — the latter is superseded and is what the 17 Sept probe used.

---

#### Day 1 — Answer JSON schema, frozen

**Reference:** `COPILOT-SPEC.md` §2. Contract 3 in `ARCHITECTURE-HANDOFF.md`.

**File:** `frontend/contracts/answer_schema.json`

```json
{
  "classification": "CLASS_B",
  "claims": [{
    "text": "ANC is 2100/µL, above the 1500 threshold",
    "claim_type": "numeric",
    "asserted_value": 2100,
    "asserted_unit": "cells/uL",
    "evidence": [{
      "kind": "structured|document_span|reference_clause",
      "derived": "computed from WBC 6000 × 35% neutrophils"
    }]
  }],
  "limitations": [],
  "overall_status": "supported|partial|refused",
  "known_as_of": "2026-09-18T09:00:00",
  "binding_id": "BND-0007",
  "consent_id": "CON-0031",
  "rule_versions": {"CLIN-ANC-001": 3}
}
```

**`derived` is mandatory** on a `structured` evidence reference whose value was computed rather than read. A clinician who clicks through and cannot find the number on the page must be told why.

**Commit this on Day 1.** The validator, the agent prompt, and the UI all depend on it.

---

#### Day 1 — Streamlit scaffold against a fixture

**Reference:** `SPEC.md` §10 (6 screens). Diagram 7 (question to cited answer sequence).

**File:** `frontend/streamlit_app.py`

Build the **entire UI** against a hard-coded fixture answer. Do not wait for Stream 2.

Must render:
- Question input box
- Answer text with per-claim rendering
- Evidence pane that opens on claim click
- `known_as_of` display
- Class A refusal state with the evidence packet offer
- The three evidence kinds rendered differently: `structured` (a row), `document_span` (a page with highlight), `reference_clause` (a citation)

**Test:** Load the app. Click a claim. The evidence pane opens showing the fixture's page. Switch to a Class A fixture → refusal renders with the named practitioner.

---

#### Day 2 — Class A/B classifier

**Reference:** Diagram 14 (Class A/B routing) — including the classification criteria tables added below the diagram.

**File:** `backend/sql/procedures/classify_question.sql`

`AI_CLASSIFY` with the criteria from diagram 14:

**Class A triggers (any one):** patient-specific treatment recommendation · medication or procedure decision · risk assessment or prognosis · emergency clinical advice · dosing/timing/sequencing · ambiguous

**Class B categories:** record completeness · source contradiction · coverage/authorisation · treatment plan status · timeline/history · gate outcomes

**The boundary test:** if the answer requires the word *"should"*, it is Class A.

**Test:** 20 questions, 10 per class. Every Class A question is refused before any retrieval happens. Ambiguous questions default to Class A.

---

#### Day 2–3 — R7 two-pass extraction

**Reference:** Diagram 8 (document to verified assertion) — the full flow. Diagram 12 (assertion verification lifecycle) — the legal state transitions.

**File:** `backend/sql/tasks/extract_assertions.sql`

| Step | Action |
|---|---|
| 1 | Read `DOC_PAGE` text for unprocessed pages |
| 2 | Route by `doc_type` (lab, pathology, imaging, discharge, claim) → type-specific prompt |
| 3 | **Pass A:** `AI_COMPLETE(model => 'llama3.3-70b', prompt => …, model_parameters => {'temperature': 0})` → `pass1_value` |
| 4 | Check `CLINICAL_ONTOLOGY.is_safety_critical` for the concept |
| 5 | If not safety-critical → `verification_status = 'single_pass'`, proceed |
| 6 | If safety-critical → **Pass B:** `AI_COMPLETE(model => 'claude-haiku-4-5', prompt => …, model_parameters => {'temperature': 0})` → `pass2_value` |
| 7 | `pass1_value = pass2_value` → `verified` |
| 8 | `pass1_value ≠ pass2_value` → **`conflicting`. Value NOT asserted.** |
| 9 | Pass B errors or times out → **`unverified`. Value NOT asserted. Fail closed.** |

**Why two different model families:** running `llama3.3-70b` twice correlates its errors. The same architecture misreads the same degraded glyph the same way. Cross-family disagreement measures correctness; same-model agreement measures only confidence.

⚠️ **Pass B changed on 20 Sept.** It was `llama3.1-70b`, which is **the same Meta family as pass A** — so the independence the claim rests on did not exist. It is also now marked `[legacy]` with no published removal date. Pass B is `claude-haiku-4-5`: different vendor, different architecture, current, and priced for per-page volume. Fallbacks if the probe says it is unreachable: `mistral-large3`, then `qwen3-32b`. **Never fall back to a second Llama.** Full reasoning in `AI-INTEGRATION-ARCHITECTURE.md` §1.1.

**`temperature: 0` on both passes.** A sampled disagreement is not an independent read, and R7 cannot tell the two apart.

**The critical constraint from diagram 12:** there is **no transition** from `Conflicting` or `Unverified` to `Asserted`. R7 is enforced by the absence of a transition, not by a validation rule.

**Test:** Feed the deliberately ambiguous CBC page. The passes disagree. `ASSERTION.verification_status = 'conflicting'`. `pass1_value` and `pass2_value` are both recorded. `CLIN-ANC-001` returns `not_evaluated`.

---

#### Day 3–4 — Tool procedures 1–4

**Reference:** Contract 2 in `ARCHITECTURE-HANDOFF.md`. Diagram 6 (trust boundaries) — the TB4 layer. `COPILOT-SPEC.md` §0.

**Files:** `backend/sql/procedures/tools/*.sql`

| # | Procedure | Input | Returns |
|---|---|---|---|
| 1 | `get_patient_facts` | `domain`, `known_as_of?` | structured facts for the bound patient |
| 2 | `get_readiness` | `encounter_ref?`, `known_as_of?` | 5 gates, outcome + rule id + version + evidence ids |
| 3 | `search_patient_documents` | `query`, `known_as_of?` | page-anchored passages, patient scope injected server-side |
| 4 | `search_reference_documents` | `query`, `jurisdiction?`, `effective_date?` | clause citations, **no patient data** |

**Every procedure must:**
1. Be `EXECUTE AS OWNER`
2. Resolve `PATIENT_BINDING` from `CURRENT_SESSION()` — **no tool takes a patient selector**
3. Re-validate `CARE_TEAM` and `CONSENT` on **every call** — a binding records selection, never cached authorisation
4. Return the uniform error shape on any failure
5. For tool 3: inject the `@eq` patient filter server-side, get **chunk IDs only**, then re-fetch text from RAP-protected `DOC_PAGE`

**Test per procedure:** A negative test proving it returns nothing for an unauthorised user. Not an error — nothing.

---

#### Day 4–5 — Agent wired to real tools

**Reference:** Diagram 3 (containers). Diagram 6 (TB3 — the agent is untrusted). `AI-INTEGRATION-ARCHITECTURE.md` §2.

**File:** `backend/sql/agent/saarthi_agent.sql`

| Requirement | Why |
|---|---|
| `orchestration: auto` | Resolves to `claude-opus-4-8` on this account |
| Only `generic` tools over procedures | **A1 verified:** given a raw `cortex_search` tool, the agent derives `patient_id` from the question text and injects the filter itself |
| **`patient_id` omitted from every tool input schema** | Unreachable by construction, not by instruction |
| No `encounter_id` accepted from the agent either | An encounter id identifies a patient — `COPILOT-SPEC.md` §0 |

**Test:** Ask a question naming a patient the user has no access to. The agent cannot construct a query for that patient because the parameter does not exist in any schema it can see.

---

#### Day 5 — Answer validator

**Reference:** `SPEC.md` §7. Diagram 3 — the `VALID` container (red = enforcement point).

**File:** `backend/sql/procedures/validate_answer.sql`

| # | Check | Fails when |
|---|---|---|
| 1 | Existence | An evidence ID does not resolve to a real row or page |
| 2 | Scope | An evidence ID belongs to a different patient than the binding |
| 3 | Version | Evidence comes from a superseded document |
| 4 | Polarity | `AI_FILTER` finds the passage contradicts the claim ("no family history" vs "family history") |
| 5 | Type match | A numeric claim cites a non-numeric source |
| 6 | Assertion trustworthiness | The claim rests on an assertion with `verification_status = 'conflicting'` |

**Check 6 is the most important.** Checks 1–5 validate claim ↔ evidence consistency. Check 6 validates evidence ↔ reality. Without it, a misread lab value produces a perfectly cited and clinically wrong answer.

**`AI_FILTER` failure → strip the claim. Fail closed. Never pass by default.**

**`AI_FILTER` syntax — one argument for text:**
```sql
AI_FILTER(PROMPT('Does this passage support the claim: {0}', passage_text))
```
The two-argument form is for images only.

**Test:** Six tests, one per check, each making that check fire.

---

### Day 5 Integration

| Check | Pass condition |
|---|---|
| UI calls real procedures | Fixture removed. Live data renders. |
| Agent calls real tools | Tool invocations visible in query history |
| One patient end-to-end | Document → parse → R7 → assertion → ontology → `CLIN-ANC-001` → cited answer |
| Citation is clickable | Clicking a claim opens the exact page with the span highlighted |
| Scope is enforced | Practitioner 2 asks the same question → nothing |
| Consent works | Revoke → same question returns nothing |

**If any row fails, cut scope today.** Order: MCP → `get_changes` → two specialties → Navigator View. **Never cut R7, consent, or citations.**

---

## Phase 2 — Scale (Days 6–10)

### Stream 2

#### Day 6 — 100 patients with comorbidities

**Reference:** `SPEC.md` §9. `DECISION-department-scope.md` §3.

| Requirement | Detail |
|---|---|
| Patients | 100, each with 1–3 comorbidities |
| Comorbidity prevalence | diabetes ~25%, hypertension ~30%, CKD ~10%, hypothyroidism ~10%, osteopenia ~20% |
| Cross-department interruptions | ≥15 patients with a surgical emergency, cardiac event, or infection |
| Corruption scenarios | 13, each mapped to the rule it exercises |

**Test:** Every corruption scenario triggers its intended rule outcome.

---

#### Day 6–7 — Remaining 15 rules

**Reference:** `SPEC.md` §4.3. Diagram 15. `clinical-thresholds.md` for every threshold.

| Specialty | Rules | Notes |
|---|---|---|
| Medical oncology | `CLIN-PLT-001`, `DOC-HER2-001`, `DOC-PATH-001`, `DOC-DISC-001` | HER2 rule uses `reflexes_to` from the ontology |
| Cardiology | `SURV-LVEF-001`, `SURV-LVEF-002` | 90-day recency + FDA decline criteria (≥16% drop or below 50%) |
| Nephrology | `CLIN-CRCL-001` | Per-agent: cisplatin ≥60, carboplatin ≥30, pemetrexed ≥45 |
| Hepatology | `CLIN-BILI-001` | NCI hepatic classification, per-agent limits |
| Endocrinology | `ENDO-HBA1C-001`, `ENDO-DEXA-001` | **HbA1c is `advisory`, never a blocker** — CPOC 2022 says do not defer cancer surgery for glycaemic control. Returns `not_evaluated` where haemoglobinopathy is recorded. DEXA is T-score stratified: 24mo normal, 12mo osteopenia. QUS → `not_evaluated`, never pass. |
| General surgery | `SURG-CLEAR-001` | Anti-VEGF 28-day is **FDA-mandated hard gate**. General 21-day is **practice consensus** — labelled as such everywhere it surfaces. 42-day contaminated-wound extension. **Requires a documented clearance event — must not infer from elapsed time.** |
| Cross-cutting | `COV-AUTH-001`, `COV-LIMIT-001`, `ID-LINK-001`, `ID-QUAR-001` | `COV-LIMIT-001` checks the **patient-level** annual limit. Where `is_family_floater` is true it must state that the shared balance is unknown — never estimate it. |

**Every rule needs:** `guideline_ref`, `provenance_note`, version, `severity`, `specificity`.

**`provenance_note` is mandatory and it is a scoring decision.** Where a threshold is practice consensus rather than guideline requirement, it says so and the UI shows it.

**64 fixtures required:** 16 rules × 4 outcomes.

---

#### Day 7–8 — Ingestion path 2: FHIR

**Reference:** Diagram 11 — the `RAW → STR2 → T2` path. `fhir-field-mapping.md` for every field path.

**File:** `backend/sql/tasks/flatten_fhir.sql`

```sql
CREATE OR REPLACE VIEW SAARTHI.DOCUMENTS.V_FHIR_ENTRY AS
SELECT b.bundle_id, b.source_id, b.received_at,
       b.payload:type::VARCHAR                 AS bundle_type,
       e.value:fullUrl::VARCHAR                AS full_url,
       e.value:resource:resourceType::VARCHAR  AS resource_type,
       e.value:resource                        AS resource
FROM SAARTHI.DOCUMENTS.RAW_FHIR_BUNDLE b,
     LATERAL FLATTEN(input => b.payload:entry) e;
```

**Three traps that will silently corrupt data:**

1. **`effective[x]` and `value[x]` are choice types.** Exactly one variant is present. Every read must `COALESCE` across `effectiveDateTime`, `effectivePeriod.start`, `effectiveInstant`. Reading only `effectiveDateTime` silently drops every observation that used a period.

2. **`Observation.interpretation[0].coding[0].code` carries `H`/`L`.** It must land in `abnormal_flag`, **never** in `value_num`. This is the `10.3 L` trap — parsing the flag into the number corrupts every threshold comparison in the direction of looking normal.

3. **`scheduled_time` is NULL when no `Appointment` exists.** It resolves through `Encounter.appointment[] → Appointment.start`. **Must not default to `period.start`** — that erases the R2 delay signal entirely. This is the most likely silent data-quality bug in the FHIR path.

**Test:** A bundle with a CBC where `effectiveDateTime` is 08:30 and `issued` is 16:45. Both clocks land correctly, 8 hours apart.

---

#### Day 8–9 — Remaining Dynamic Tables

**Reference:** Diagram 11 — `D2` through `D5`.

| DT | Produces |
|---|---|
| `DT_DOC_CHUNK` | Search-ready chunks. **No RAP** — F4. Carries `patient_id` as a filter attribute only. |
| `DT_REVIEW_QUEUE` | R7 conflicts, missing referral documents, curable denials, unreadable uploads |
| `DT_SCHEME_ELIGIBILITY` | PM-JAY + insurance status from `COVERAGE.annual_limit` and `used_amount`, patient-level. `COVERAGE.priority` for payer sequencing. |
| `DT_TREATMENT_PLAN` | Current plan with cycle status and version chain |

---

#### Day 9 — Both Cortex Search services

**Reference:** `SPEC.md` §5. Diagram 3 — `PIDX` and `RIDX`. R6.

```sql
CREATE CORTEX SEARCH SERVICE SAARTHI.DOCUMENTS.PATIENT_DOC_SEARCH
  ON text
  ATTRIBUTES patient_id, doc_id, doc_type, page_index, doc_version
  WAREHOUSE = SAARTHI_AI_WH
  TARGET_LAG = '1 minute'
  AS (SELECT chunk_id, text, patient_id, doc_id, doc_type, page_index, doc_version
      FROM SAARTHI.DOCUMENTS.DOC_CHUNK WHERE doc_scope = 'patient');
```

**Physically separate services, not one with a filter.** If patient text and guideline text share a ranked list, a guideline sentence can be cited as evidence about a patient. Two of four surveyed competitors mix them.

**`TARGET_LAG = '1 minute'`** so the mid-demo addendum appears live.

**Test:** Query the patient service for a term that appears in both corpora. Reference text never appears in patient results.

---

#### Day 10 — Semantic view + 6 VQRs

**Reference:** `SPEC.md` §8. Brief requirement: *"validate them against natural language questions."* The explainer calls VQRs *"very very crucial."*

**Test:** Each verified query answers its natural language question correctly via `cortex analyst query`.

---

### Stream 1

#### Day 6–7 — Tool procedures 5–9

| # | Procedure | Notes |
|---|---|---|
| 5 | `cohort_query` | **Unavailable while a patient is bound** — prevents cross-patient inference |
| 6 | `get_timeline` | Chronology with all three R2 clocks + facility |
| 7 | `get_changes` | Diff of two knowledge states. Answers "what changed since 09:00?" |
| 8 | `create_review_task` | **The only write tool.** Idempotent via `idempotency_key`. Restricted to `treating|coordinator` — `patient_navigator` cannot create tasks. |
| 9 | `bind_patient` | Validates care team + consent before writing |

---

#### Day 7–8 — All 10 Class B question types

**Reference:** `COPILOT-SPEC.md` question taxonomy. Diagram 14 Class B categories.

Each type must have a tool path. D10 found four Class B types with no tool path — the agent would have refused a legitimate question or hallucinated.

---

#### Day 9–10 — Eval harness

**Reference:** Brief: *"validate outputs, test accuracy, handle errors and edge cases."*

| Requirement | Detail |
|---|---|
| Questions | 80: 40 dev + 40 held-out |
| Per question | Expected tool invocations + expected answer shape |
| Truth key | In `EVAL` schema, **inaccessible to the app role** — prevents answer-key leakage |
| Baseline | A naive RAG comparison. Report the delta. |
| Output | Machine-readable, committed to the repo |

**Report absolute counts alongside rates.** "94% on 80 questions" not "94% accuracy." Cold starts separately.

---

## Phase 3 — Proof and Bonuses (Days 11–14)

### Stream 1

#### Day 11–12 — 4 skills + orchestrating Task

**Reference:** Brief: *"Clearly documented, reusable skills remain the headline bonus."* Explainer X1: expects multiple skills per process.

| Skill | Purpose |
|---|---|
| `clinical-question-routing` | Class A/B classification as a reusable skill |
| `evidence-retrieval` | Scoped retrieval with citation assembly |
| `risk-stratification` | Gate evaluation against versioned rules |
| `evidence-reconciliation` | Discordance and supersession detection |

Each needs `SKILL.md` on the `SKILLS` stage, invoked by the orchestrating Task.

**Reuse proof is required:** run each skill against a **second synthetic schema**. Show one successful mapping **and one correctly refused ambiguity** per skill.

---

#### Day 12–13 — Judge Console, 8 probes

**Reference:** `SPEC.md` §10. Each probe is a button showing the SQL and the result.

| # | Probe | Expected |
|---|---|---|
| 1 | Cross-scope attempt | Blocked by `CURRENT_USER()` RAP |
| 2 | Search without the filter | **Returns another patient's text** — F5, the competitor failure mode, live |
| 3 | Consent revoked | Same question returns nothing |
| 4 | Injected instruction in a document | Treated as content, not instruction |
| 5 | Fabricated claim | Validator strips it, logs to `SECURITY_EVENT` |
| 6 | Low-quality image | Two-pass disagrees → refuses to assert |
| 7 | Class A question | Refused in every role including oncologist |
| 8 | Regulatory question | Answered from the real PM-JAY manual, page and clause |

**Probe 2 is the strongest claim in the submission** — it demonstrates the vulnerability that every surveyed competitor has, then shows it closed.

---

#### Day 13–14 — MCP connector

**Reference:** Brief names MCP twice. Diagram 2 and 3 — the ticketing system.

One action: documentation blocker → tracked ticket. Idempotent. Carries only a synthetic patient ID and an authenticated evidence link. Retry never double-fires.

---

### Stream 2

#### Day 11 — Readiness materialisation + notifications

| Object | Requirement |
|---|---|
| `TASK_REFRESH_READINESS` | 5-minute schedule. Calls `evaluate_gates` per changed patient. Event-driven, not full-table. |
| `READINESS_STATE` | Populated with outcomes + the rule version that decided each |
| `TASK_NOTIFY` | Fires on `blocker` severity AND `days_to_visit <= 3`. Names the responsible practitioner. |
| Notification integration | Email + webhook |

**Reschedule cascade:** a trigger on `ENCOUNTER.scheduled_time` change re-evaluates that patient. 14% of cycles are missed with a median 13.75-day delay — rescheduling is the most common event, not an edge case.

---

#### Day 12 — Reference corpus

**Reference:** R6. `SPEC.md` §5. Brief: *"regulatory, or legal documents."*

Download real regulatory PDFs into `data/reference/`. At minimum: one PM-JAY guideline, one NCCN reference, one FDA label excerpt. Parse into `DOC_PAGE`/`DOC_CHUNK` with `doc_scope = 'reference'`.

**Measure `AI_PARSE_DOCUMENT` cost on one page before committing to the full corpus.** The estimate in `reference-corpus-sources.md` is internally inconsistent by roughly an order of magnitude.

---

#### Day 13 — Navigator View

**Reference:** `SPEC.md` §10. Diagram 2 — the Patient Navigator actor.

Bring-list derived from `REFERRAL.documents_expected − documents_received`, plus `not_evaluated` gate items. Translated with `AI_TRANSLATE` to Hindi/Tamil/Bengali/Marathi. Renders **only coordinator-reviewed issues**. Carries a standing *"your treating team decides"* notice.

**Bring-list derivation is principled, not inferred.** It comes from the referral document manifest, not from guessing at gate failures.

---

#### Day 14 — Ingestion path 3 + all three proven

Structured CSV → `COPY INTO` → staging → `DT_HARMONIZED_EVENTS`.

**Test:** All three paths deliver data for the same patient. The timeline shows events from all three sources with correct provenance.

---

## Phase 4 — Freeze (Days 15–17, target completion 1 Oct)

| Day | Task | Owner |
|---|---|---|
| 15 | **Clean-account deploy from scratch.** Stream 2 runs `setup.sql` + data load on a completely fresh account. Stream 1 verifies agent, tools, and UI work there. | Both |
| 15 | `IMPLEMENTATION-STATUS.md` — every component marked `built \| partial \| designed-only`, accurately | Both |
| 16 | README a stranger can follow. Stream 1 writes it; Stream 2 follows it on the clean account without help. | Both |
| 16 | CoCo evidence manifest across all 4 phases: planning, development, execution, testing | Both |
| 17 | Demo rehearsal — the full 7-beat sequence. Record video. | Both |
| 17 | **Cold-start test by whoever built less of it.** | Both |

**Reserve a full half-day for the clean-account deploy.** A deploy that only works on an account with leftover development state is the most likely way to lose Solution Completeness, and it is invisible until tested.

**2–4 Oct: contingency only. Submit early.**

---

## The demo sequence — 7 beats

**Fixed clock.** Opening question: *"She had an appendectomy three weeks ago. Is she ready to resume chemotherapy?"*

| # | Beat | Proves |
|---|---|---|
| 1 | Four departments respond: surgery clearance, ANC recovery, LVEF staleness, authorisation validity. Two blockers, one advisory, one conflict — each citing a row or page. | Cross-department Patient 360 |
| 2 | Late addendum ingested live → answer changes. Old `known_as_of` returns the old answer. v1 marked superseded. | R2 three clocks |
| 3 | Consent revoked → same question, same user, returns nothing | **Nobody else has this** |
| 4 | Cross-scope attempt → blocked, shown in `QUERY_HISTORY` | `CURRENT_USER()` RAP |
| 5 | Low-quality image → two-pass disagrees → refuses to assert and says why | **Nobody else can show this** |
| 6 | Class A question → refused in every role, evidence packet offered to the named practitioner | NMC compliance |
| 7 | Regulatory question → answered from the real PM-JAY manual, page and clause | R6 dual corpora |

---

## Cut list — in order

1. MCP connector
2. `get_changes` (tool 7)
3. Endocrinology rules (2)
4. Navigator View
5. Notifications
6. Skill reuse tests

**Never cut:** R7 two-pass · consent at query time · `CURRENT_USER()` RAP · 4 skills + orchestrating Task · the working vertical slice.

---

## Definition of done

| Component | Done means |
|---|---|
| A table | In `setup.sql`, idempotent, RAP/masking attached where SPEC says, referenced by a passing fixture |
| A rule | In `RULE_CATALOG` with version, `guideline_ref`, `provenance_note`, fixtures for **all four** outcomes |
| A tool procedure | `EXECUTE AS OWNER`, resolves binding, re-validates consent, uniform error shape, negative test proving it returns nothing for an unauthorised user |
| The extraction path | R7 two-pass on safety-critical concepts, disagreement → `conflicting`, a deliberately ambiguous page proves the refusal |
| The validator | All 6 checks, each with a test that makes it fire, `AI_FILTER` failure fails closed |
| The copilot | Answers all 10 Class B types, refuses Class A, states `known_as_of`, every claim clickable to a page or row |
| A skill | `SKILL.md` on the stage, invoked by the orchestrating Task, reuse-tested against a second schema including one correctly refused ambiguity |
| The eval | Runs on both sets, machine-readable results committed, baseline delta reported |
| The deploy | `setup.sql` + data load + `teardown.sql` all work on a clean account, twice |
| Anything at all | Its row in `IMPLEMENTATION-STATUS.md` is accurate |

---

## Go / no-go

No-go if any of these is true:

- Any answer is hard-coded
- Evidence links are decorative — they do not resolve to a real page or row
- The agent can cross patient scope
- Consent revocation does not actually block
- The late-update path is simulated rather than real
- Two-pass verification is claimed but not wired
- `setup.sql` fails on a clean account
- CoCo evidence exists only for code generation

---

## When you are blocked

| Blocker | Do this |
|---|---|
| The other stream's component does not exist | Build against the contract with a stub. **Never wait.** |
| A contract seems wrong | Say so before changing it. It is frozen for the other person, not for its owner. |
| A platform behaviour surprises you | Test it, record the query ID in `evidence/coco/verification-query-ids.md`, design around what you observed. Ten of the best claims in this submission came from doing exactly that. |
| An AI function will not compile | Run `cortex search docs` before guessing. Four consecutive failed guesses at `AI_FILTER` syntax cost real time; the docs had it. |
| You are tempted to add a table or feature | Don't. `SPEC.md` is the scope. Designing more than we build is actively negative on Completeness. |
| A threshold has no source | Mark it `provenance_note: practice consensus` and move on. Do not invent a guideline citation. |

**Record failures.** Failure-and-fix pairs are the most credible lifecycle evidence available, and judges are explicitly looking for evidence at every phase. Do not curate them out.
