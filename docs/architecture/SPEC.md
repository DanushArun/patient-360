# SAARTHI — Architecture Specification v2 (FINAL)

### The buildable contract. Every object justified against the rubric.

**Written 17 Sept 2026. Supersedes SPEC.md v1 entirely.**

**Absorbs:** 50 findings from `SPEC-REVIEW.md` (21) · `SCALE-REVIEW.md` (15) · `DEEP-REVIEW-3.md` (14) · `DECISION-department-scope.md` · `PROBLEM-STATEMENT.md` · `explainer-session-findings.md` · **10 empirically verified behaviours** in `VERIFIED-platform-behaviour.md`.

---

## 0. The rubric, and how this document answers it

Confirmed from the event page: **Real-World Relevance 30% · Technical Execution 40% · Solution Completeness 30%.**
Confirmed two-stage judging: **async repo evaluation 5–22 Oct (team absent)** → shortlist 23 Oct → **live demo 27–30 Oct**.

Every section below carries a scoring tag. If a section cannot justify itself against the rubric, it does not belong here.

| Tag | Meaning |
|---|---|
| `[TE]` | Technical Execution — 40% |
| `[RWR]` | Real-World Relevance — 30% |
| `[SC]` | Solution Completeness — 30% |
| `[BONUS]` | Named CoCo bonus category |

**Brief requirements, mapped once, explicitly:**

| Brief text | Where satisfied |
|---|---|
| "unifies data into a patient or member 360" | §2 data model — 3 ingestion paths, 34 tables. Patient 360; family dimension out of scope, stated. |
| "answers clinical, safety, or regulatory questions" | §6 Class A/B + question taxonomy; safety gate in §4 |
| "with cited evidence" | §7 validator — 6 checks, per-claim evidence IDs |
| "fully synthetic or de-identified data only" | §9 generator — seeded, 100% synthetic |
| "Combine structured records with unstructured clinical, regulatory, or legal documents" | §2 structured + §5 dual corpora (patient + real regulatory) |
| "Produce **risk stratification**, evidence retrieval, or a cited answer" | §4 — deterministic risk stratification over care gaps |
| "**never opaque predictions**" | R1 — LLM structurally cannot emit a status. **No trained model anywhere.** |
| "Deliver a question and answer experience with clear source evidence" | §10 Ask + Evidence is the app's centrepiece |
| Explainer: "semi-structured" | §3 FHIR JSON → VARIANT → flatten |
| Explainer: "separate skills per process" | §11 — 4 skills + orchestrating Task |
| Explainer: "verified queries… very very crucial" | §8 semantic view + 6 VQRs |

---

## 1. Non-negotiable rules (R1–R7)

R1–R6 carry over from `plan.md`. **R7 is new and comes from empirical testing.**

| Rule | Statement | Verified basis |
|---|---|---|
| **R1** | The LLM never decides. It extracts typed assertions, interprets questions into bounded tool calls, ranks passages, and phrases answers from supplied facts. Every status, number, date, threshold comparison and gate outcome is produced by SQL against a versioned rule. | Design |
| **R2** | Three clocks: `event_time`, `source_recorded_at`, `ingested_at`. Every answer carries `known_as_of`. | Design |
| **R3** | Missingness is a type: `present · explicitly_negative · pending · not_received · conflicting · unreadable · superseded`. **Mapped to `Observation.dataAbsentReason` where FHIR has an equivalent code — see §2.6. Claimed as *enforced*, not novel: FHIR provides the vocabulary but compels nobody to populate it, and we did not find a typed taxonomy in the competitor code we reviewed.** | `fhir-field-mapping.md` §0.1 |
| **R4** | Identity is ABHA-anchored and federated. Never joined on name. Ambiguous matches quarantine and contribute **no** evidence. | `abdm-architecture.md` |
| **R5** | Scope is enforced server-side before retrieval, in three layers. | **F3, F5, F6, F7 verified** |
| **R6** | Two document corpora, never mixed in one ranked list. Physically separate services. | **F4 verified — platform-forced** |
| **R7** | **Extraction is never trusted on a single pass for safety-critical fields.** Two passes; disagreement yields `conflicting` and the gate returns `not_evaluated`. A value is never asserted from one unverified read. | `DEEP-REVIEW-3.md` D1 |

**R7 is a differentiator not found in the competitor code we reviewed.** `[TE]` `[RWR]`

### R5 — the three layers, as verified

| Layer | Mechanism | Verified by |
|---|---|---|
| **1. No direct reach** | App role has **no `USAGE`** on either search service. Retrieval only via owner's-rights procedures. **Requires `USE SECONDARY ROLES NONE` or a dedicated service user** — otherwise a secondary ACCOUNTADMIN satisfies the check through the back door. | **F7** — tested; unfiltered query succeeded until secondary roles were disabled, then correctly returned `390404` |
| **2. Server-injected filter** | The procedure derives scope from `CURRENT_USER()` → `CARE_TEAM` → injects `@eq` attribute filter. The question never supplies scope. | **F6** — `@eq` filter verified working |
| **3. Content re-fetch through governed tables** | Search returns **chunk IDs only**. The procedure re-fetches text from RAP-protected `DOC_PAGE`. Even a leaked ID yields nothing. | **F3** — `CURRENT_USER()` survives owner's-rights elevation, so RAP still filters by the real caller |

**The vulnerability this defeats is demonstrable:** F5 showed the search service returning `PAT-0002`'s pathology text to a user scoped only to `PAT-0001`. That is the hole in every surveyed competitor. `[TE]`

**Mandatory implementation rule from F3:** every row access policy keys on **`CURRENT_USER()`**, never `CURRENT_ROLE()`. A role-keyed policy sees the owner's privileged role inside any owner's-rights procedure and returns every patient.

---

## 2. Data model — 34 tables built, 7 designed-only

Four content schemas plus governance and stages. Marked `[B]` built or `[D]` designed-only. Honest accounting is a **`[SC]`** requirement for the 18-day unattended evaluation.

### 2.1 Identity & organisation — replaces the flat access map

`SCALE-REVIEW.md` F2/F6: access is not user→patient. It is *practitioner, at a facility, in a department, with a care relationship, inside a consent window, for a purpose.*

```
ORGANIZATION            [B]  org_id PK · name · type(hospital_network|lab|payer|scheme)
                             · state · created_at

FACILITY                [B]  facility_id PK · org_id FK · name
                             · hfr_id            -- Health Facility Registry ID (ABDM)
                             · facility_type(hub|spoke|lab|imaging|pharmacy)
                             · district · state · created_at

DEPARTMENT              [B]  department_id PK · facility_id FK
                             · specialty(medical_oncology|cardiology|nephrology
                                        |hepatology|endocrinology|general_surgery
                                        |radiation_oncology|pathology)
                             · name

PRACTITIONER            [B]  practitioner_id PK · facility_id FK · department_id FK
                             · name · nmc_registration_no · qualification
                             · snowflake_user     -- links CURRENT_USER() to a real clinician
                             · active · created_at

CARE_TEAM               [B]  care_team_id PK
                             · practitioner_id FK · patient_id FK · facility_id FK
                             · role_type(treating|coordinator|consulting|patient_navigator)
                             · active_from · active_to      -- relationship has a lifetime
                             · granted_by · created_at
                             UNIQUE(practitioner_id, patient_id, facility_id, role_type)

PATIENT_BINDING         [B]  binding_id PK · session_id (CURRENT_SESSION())
                             · snowflake_user · patient_id FK
                             · care_team_id FK · consent_id FK
                             · bound_at · released_at
                             -- WHICH patient a question is about. Append-only.
                             -- Set by an explicit user click, never by question text.
                             -- See COPILOT-SPEC.md §0.
```

**`CARE_TEAM` answers *may this user see patient X*. `PATIENT_BINDING` answers *which patient is this question about*.** `COPILOT-SPEC.md` §0 documents why conflating the two was a fatal gap: a permitted set is not a subject, and a coordinator is on the care team for dozens of patients. Selection is an application concern performed by a human and recorded; authorisation is re-validated on every tool call and never cached in the binding.

**`CARE_TEAM` replaces `ROLE_PATIENT_MAP`.** `[TE]` It is what every RAP reads, and what every tool derives scope from.

*Why `nmc_registration_no`:* NMC rules make the registered practitioner solely accountable, and `law-medical-records.md` establishes adverse inference from record gaps. When the system says "your treating team decides," it must **name them**. `[RWR]`

*Why `snowflake_user`:* this is the join that makes F3 usable — `CURRENT_USER()` → `PRACTITIONER` → `CARE_TEAM` → permitted patients.

### 2.2 Consent — the largest gap in v1, now first-class

`SCALE-REVIEW.md` F1. Required by `abdm-architecture.md` §5 and `law-dpdp.md` implication #4, both of which say **checked at query time, not at ingest**.

```
CONSENT                 [B]  consent_id PK · patient_id FK
                             · granted_to_facility_id FK
                             · granted_to_org_id FK          -- either facility or org scope
                             · granted_by(patient|guardian) · grantor_name
                             · purpose_code(treatment|coordination|claim|second_opinion)
                             · data_categories ARRAY         -- clinical|financial|identity
                             · date_range_from · date_range_to   -- which records
                             · valid_from · valid_until          -- consent lifetime
                             · status(active|revoked|expired)
                             · revoked_at · revocation_reason
                             · artifact_hash                 -- signed consent document
                             · abdm_consent_ref              -- nullable; ABDM linkage
                             · created_at
```

**Enforcement points — all three, or it isn't real:**
1. Every retrieval tool (§6) checks consent validity **at query time**.
2. `ANSWER_RUN` records the `consent_id` that authorised each answer.
3. Revocation takes effect immediately — no cache survives it.

*Scoring:* `[RWR]` structurally correct for ABDM · `[TE]` real enforcement · **not found in the competitor code we reviewed** · demos in 30 seconds.

### 2.3 Patient core

```
PATIENT                 [B]  patient_id PK · abha_ref (nullable — most Indian
                             patients have none) · name · dob · gender
                             · district · state · primary_language
                             · created_at

ID_MAP                  [B]  map_id PK · patient_id FK · source_system
                             · source_patient_id
                             · link_status(abha_linked|manually_verified|quarantined)
                             · link_evidence · linked_at
                             UNIQUE(source_system, source_patient_id)

REFERRAL                [B]  referral_id PK · patient_id FK
                             · from_facility_id FK · to_facility_id FK
                             · referring_practitioner_id FK
                             · reason · referral_date · consent_id FK
                             · documents_expected ARRAY
                             · documents_received ARRAY
                             · status(open|partial|complete)
```

**Family-floater coverage is explicitly out of scope.** PM-JAY is ₹5 lakh **per family per year**, and base FHIR has no native home for a family limit — `Coverage.beneficiary` is a single Patient reference. Modelling it correctly requires a `HOUSEHOLD` entity, household-keyed coverage, and member-centric aggregation. **We do not build it.** `COV-LIMIT-001` evaluates the patient-level annual limit only, and the scope boundary is stated wherever coverage surfaces. See `DECISION-household-removal.md`.

The brief says *"patient **or** member 360"* — patient 360 alone satisfies the requirement, which is why `PROBLEM-STATEMENT.md` G2 already downgraded this from FATAL. Claiming family-floater arithmetic we have not built would be exactly the overclaiming we document in competitors.

**`REFERRAL` is the product's central moment.** 74% of patients cross ≥2 facilities; 82.6% hit a delay. `documents_expected` minus `documents_received` **is the bring-list** — a principled derivation instead of inferring it from gate failures. `[RWR]`

### 2.4 Clinical events

```
ENCOUNTER               [B]  encounter_id PK · patient_id FK · facility_id FK
                             · department_id FK
                             · encounter_type(opd|daycare|inpatient|imaging|lab_visit)
                             · scheduled_time · event_time          -- R2
                             · cycle_number · status
                             · delay_reason
                             · gap_type(documentation|clinical_complication
                                        |financial|logistics|none)
                             · version INT DEFAULT 1                -- optimistic locking
                             · ingested_at

CLINICAL_EVENT          [B]  event_id PK · patient_id FK · encounter_id FK
                             · event_type(lab|vitals|diagnosis|staging|imaging
                                          |medication|pathology|treatment_plan_change)
                             · concept_id FK → CLINICAL_ONTOLOGY
                             · code_system · code · display
                             · value_text · value_num · unit
                             · original_value · original_unit    -- source text preserved
                             · abnormal_flag                     -- the L/H suffix
                             · specimen_id · accession_id
                             · status(preliminary|final|amended|cancelled
                                      |ordered|administered|dispensed)
                             · negation BOOLEAN
                             · event_time · source_recorded_at · ingested_at   -- R2
                             · valid_until                        -- D6 validity interval

TREATMENT_PLAN          [B]  plan_id PK · patient_id FK · version INT
                             · regimen_code · regimen_display
                             · intent(curative|palliative|adjuvant|neoadjuvant)
                             · planned_cycles · decided_at
                             · decided_by_practitioner_id FK
                             · decision_forum(tumour_board|opd|mdt)
                             · supersedes_plan_id FK · reason_for_change
```

*Why `vitals` as an event type:* Cockcroft-Gault CrCl needs weight, which changes between cycles. `SPEC-REVIEW.md` **C3** flagged the missing `weight_kg`; putting weight on `CLINICAL_EVENT` as a vitals row is the clinically correct fix, not a static column on `PATIENT`.

*Why `abnormal_flag` separate:* Dipali's reports show `10.3 L` and `38 H` — the L/H suffix is a flag, not part of the value. Parsing it into `value_num` corrupts every threshold comparison. `real-patient-dipali.md` §5

*Why `valid_until`:* D6. Labs are valid 72h, LVEF 90 days, authorisations to a date. Computing validity once at ingestion makes "is this still valid at the planned encounter?" one uniform comparison instead of 16 bespoke ones — and makes reschedule recomputation (S1) tractable.

*Why `TREATMENT_PLAN` versioned:* Dipali's plan changed **four times** in 18 months, each change generating documents and invalidating prior assumptions. `[RWR]`

### 2.5 Coverage

```
COVERAGE                [B]  coverage_id PK · patient_id FK
                             · payer_type(scheme|private_insurance|self_pay)
                             · payer_name · policy_number
                             · is_family_floater BOOLEAN   -- flag only; see note
                             · effective_from · effective_to
                             · annual_limit · used_amount  -- patient-level
                             · priority INT                   -- primary vs secondary payer
                             · portability(cross_state|within_state|none)

AUTHORIZATION           [B]  auth_id PK · coverage_id FK · encounter_id FK
                             · package_code · requested_amount · approved_amount
                             · status(pending|approved|denied|partial
                                      |expired|conflicting)
                             · denial_reason · denial_is_curable BOOLEAN
                             · requested_at · responded_at · valid_until
```

`status` gains **`partial`** and **`conflicting`** — both recommended by `insurance-irdai-nhcx.md` §5.4 and omitted in v1. **`conflicting` is what our flagship demo scenario requires** (table says pending, letter says approved).

`denial_is_curable` encodes the ₹30,000 cr finding: **60–70% of denials are procedurally curable and knowable pre-admission.** `[RWR]`

**`is_family_floater` is a flag, not an arithmetic input.** When true, the UI states that the limit is shared across a family and that **SAARTHI tracks the patient-level figure only**. `annual_limit` and `used_amount` are patient-scoped. A floater's true remaining balance depends on other members' consumption, which we do not model — so the system reports what it knows and says what it does not. This is R3 applied to coverage: an unknown is declared, never estimated.

### 2.6 Documents & evidence

```
DOCUMENT                [B]  doc_id PK · patient_id FK (NULL for reference)
                             · scope(patient|reference)               -- R6 starts here
                             · doc_type · version · accession_id
                             · revision_type(original|appended|amended|corrected)
                             · file_hash            -- SHA-256, ours, for dedup
                             · attachment_hash      -- SHA-1, from FHIR Attachment.hash
                             · source_quality(clean_pdf|scanned|photo
                                              |rotated_photo|handwritten)
                             · signed_at · effective_at · ingested_at  -- R2
                             · supersedes_doc_id FK
                             · source_facility_id FK
                             · ingestion_method(fhir_bundle|hl7|digital_emr
                                                |physical_folder|whatsapp_photo
                                                |downloaded_pdf)
                             · jurisdiction · effective_date           -- reference docs
                             · status(active|duplicate|unreadable)

DOC_PAGE                [B]  doc_id FK · page_index · text · char_count
                             ⚠️ RAP-PROTECTED — the governed content store (F3, F4)

DOC_CHUNK               [B]  chunk_id PK · doc_id FK · page_index · chunk_index
                             · text · doc_scope · patient_id · doc_type · doc_version
                             · jurisdiction · effective_date
                             ⚠️ NO RAP — search index source (F4 forces this)

ASSERTION               [B]  assertion_id PK · doc_id FK · page_index
                             · concept_id FK → CLINICAL_ONTOLOGY
                             · subject · predicate · value · unit
                             · negation BOOLEAN
                             · missingness_state                      -- R3, 7 values
                             · fhir_absent_reason                     -- maps R3 → FHIR
                             · extraction_confidence FLOAT            -- R7
                             · verification_status(verified|conflicting
                                                   |unverified|single_pass)  -- R7
                             · pass1_value · pass2_value               -- R7 audit trail
                             · extractor_version · char_start · char_end

EVIDENCE_LINK           [B]  link_id PK · assertion_id FK
                             · target_type · target_id
                             · relation(supports|conflicts_with|supersedes
                                        |complemented_by|discordant_across_specimens)
```

**The `DOC_PAGE` / `DOC_CHUNK` split is platform-forced, not stylistic.** F4: `CREATE CORTEX SEARCH SERVICE` fails with *"Change tracking is not supported on queries with correlated subquery expressions"* when the source table carries a mapping-table RAP. So the index must be un-RAP'd and return IDs; the content lives in a RAP-protected table. This is exactly Layer 3 of R5. `[TE]`

**`discordant_across_specimens`** — D3. Dipali's outside biopsy read Grade II / HER2 IHC 1+; the CMC surgical specimen read Grade III / IHC 2+. Different accession IDs, so specimen-keyed matching never collides and no conflict is detected — yet clinically this is the finding that triggered FISH and changed her treatment. Neither a match nor an error: a third relation. `[RWR]` — modelled by nobody in the field.

**`verification_status` + `pass1_value` + `pass2_value`** — R7. See §7.

### 2.6a FHIR-derived corrections

Field-level FHIR mapping (`research/clinical/fhir-field-mapping.md`) forced six corrections. Each also strengthens the interoperability story. `[TE]` `[RWR]`

**`revision_type` — an addendum is not a supersession.** FHIR `DiagnosticReport.status` distinguishes `appended` (information added) from `amended`/`corrected` (previous value was wrong). Dipali's FISH result arrived as an "ADDITIONAL REPORT" appended to an existing surgical pathology report two weeks after the IHC. v1 collapsed both into `supersedes_doc_id`, which is wrong: an append does not invalidate the original, a correction does. **They drive different clinical actions** — an append completes the record, a correction means a prior decision may have rested on a wrong value.

**`fhir_absent_reason` — R3 has prior art.** `Observation.dataAbsentReason` (`http://terminology.hl7.org/CodeSystem/data-absent-reason`) provides `not-asked`, `asked-declined`, `masked`, `not-performed`, `error` and more. R3 is therefore **less novel than `should-close-gaps.md` assessed, and better grounded than we knew.** Two consequences, both applied: we no longer claim R3 as novel (we claim it as *enforced*), and we map to the standard vocabulary. R3 still adds three states FHIR lacks here — `pending` (FHIR expresses via `status`), `conflicting`, `superseded`.

**`attachment_hash` kept separate from `file_hash`.** `Attachment.hash` is SHA-1; our dedup uses SHA-256. Conflating them would silently break duplicate detection.

**`scheduled_time` is NULL when no `Appointment` exists.** `Encounter` alone does not carry a scheduled time — it resolves through `Encounter.appointment[] → Appointment.start`. If a bundle omits `Appointment`, the scheduled time is genuinely unknown and **must not default to `period.start`**, which would erase the R2 delay signal entirely. This is the single most likely silent data-quality bug in the FHIR path.

**`AUTHORIZATION.status = 'denied'` is derived, not mapped.** `ClaimResponse.outcome` has no `denied` value — denial is `complete` with zero or absent benefit adjudication plus a reason code. Documented so the mapping is not misread as one-to-one.

**Family coverage has no native home in base FHIR, and we do not model it.** `Coverage.beneficiary` is a single Patient reference, so a PM-JAY ₹5-lakh-per-family limit cannot be expressed without either `Coverage.class[type=group].value` or a `Group` resource — and neither is verified against the NRCeS IG. Rather than build an unverified workaround, `COVERAGE` is patient-keyed and the family dimension is declared out of scope. `is_family_floater` records that a shared limit exists; the arithmetic over it does not. See `DECISION-household-removal.md`.

**One stated simplification:** FHIR uses two resources for medication lifecycle — `MedicationRequest` (ordered) and `MedicationAdministration` (administered, linked by `request.reference`). Our single `CLINICAL_EVENT.status` enum spanning `ordered|administered|dispensed` is a deliberate compression. `clinical-thresholds.md` §8 requires the distinction be preserved semantically, and it is; the physical model is simpler than FHIR's. Stated rather than hidden, because a FHIR-literate judge will notice.

**Validation that R2 is not over-engineering:** the worked example in the mapping file is an ordinary CBC with `effectiveDateTime` 08:30 (blood drawn) and `issued` 16:45 (report released) — **an 8-hour gap between R2 clocks 1 and 2 in a single routine lab result**, expressed natively by the standard.

### 2.7 Ontology & normalisation — closes G5 and D2 together

```
CLINICAL_ONTOLOGY       [B]  concept_id PK
                             · concept_type(analyte|biomarker|procedure|diagnosis
                                            |medication|document_type)
                             · canonical_name · code_system · code
                             · specialty · synonyms ARRAY
                             · is_safety_critical BOOLEAN         -- drives R7 two-pass
                             · reflexes_to_concept_id FK          -- IHC 2+ → FISH

UNIT_REGISTRY           [B]  registry_id PK · concept_id FK
                             · canonical_unit
                             · source_unit_pattern                -- 'GM%','/CUMM','mg%'
                             · conversion_factor
                             · plausible_min · plausible_max
                             · notes
```

"Ontology" is named **twice** in the brief's CoCo guidelines, including in the Planning phase judges are told to inspect first. `[BONUS]` `[TE]`

`synonyms` carries the real-world mess: `SGOT→AST`, `SGPT→ALT`, `platelets|PLT|thrombocytes`, `Haemoglobin|Hb|HGB`.

**`UNIT_REGISTRY` prevents a patient-safety bug.** Creatinine in `mg/dL` vs `µmol/L` differs by **88.4×**, and CrCl is inversely proportional to it — a missed conversion turns a contraindication into a green light. Post-normalisation, any value outside `plausible_min..plausible_max` is **rejected** as `unreadable`, never stored. `[RWR]` `[TE]`

`is_safety_critical` is the flag that selects which fields get R7's second pass: ANC, platelets, creatinine, bilirubin, AST, HER2_IHC, HER2_FISH, LVEF, grade, stage, and drug doses.

### 2.8 Rules & operations

```
RULE_CATALOG            [B]  rule_id · rule_version  (composite PK)
                             · gate(clinical|safety|documentation|coverage|identity)
                             · specialty · disease_scope · specificity INT
                             · display_name · description
                             · threshold_json VARIANT
                             · guideline_ref · applies_to
                             · severity(blocker|advisory)
                             · effective_from · effective_to

REVIEW_ISSUE            [B]  issue_id PK · rule_id · rule_version
                             · patient_id FK · encounter_id FK · gate
                             · state(open|evidence_received|closed|escalated)
                             · outcome(pass|fail|not_evaluated|conflicting)
                             · reason · evidence_ids ARRAY
                             · severity · days_to_visit
                             · version INT DEFAULT 1              -- S4 optimistic locking
                             · created_at

REVIEW_TASK             [B]  task_id PK · issue_id FK
                             · owner_practitioner_id FK
                             · state · decision · reason
                             · actor_practitioner_id FK
                             · idempotency_key UNIQUE · created_at
                             -- named REVIEW_TASK, not TASK: a table called TASK
                             -- collides confusingly with Snowflake TASK objects

READINESS_STATE         [B]  patient_id FK · encounter_id FK · gate
                             · rule_id · rule_version
                             · outcome(pass|fail|not_evaluated|conflicting)
                             · severity · reason · evidence_ids ARRAY
                             · known_as_of · computed_at
                             PRIMARY KEY(patient_id, encounter_id, gate, rule_id)
                             -- materialised by TASK_REFRESH_READINESS calling
                             -- evaluate_gates. Read by get_readiness.

ANSWER_RUN              [B]  run_id PK · question · question_class(A|B)
                             · practitioner_id FK · patient_id FK
                             · consent_id FK
                             · known_as_of · answer_status
                             · claims_json · evidence_ids ARRAY   -- POINTERS, not content
                             · model_version · validation_results
                             · latency_ms · created_at

EVIDENCE_PACKET         [B]  packet_id PK · patient_id FK · question
                             · created_by_practitioner_id FK
                             · evidence_ids ARRAY · gate_snapshot VARIANT
                             · consent_id FK
                             · delivered_to_practitioner_id FK · delivered_at

SECURITY_EVENT          [B]  event_id PK · event_time · practitioner_id
                             · event_type(cross_scope_attempt|consent_violation
                                          |validator_strip|injection_detected)
                             · detail VARIANT · query_id
                             ⚠️ 1-year retention — DPDP Rule 6(e)

NOTIFICATION            [B]  notification_id PK · issue_id FK
                             · channel(email|slack) · recipient
                             · sent_at · escalation_level

SOURCE_SYSTEM           [B]  source_id PK · facility_id FK · system_name
                             · ingestion_method · fhir_capable BOOLEAN · endpoint_ref

INGESTION_RUN           [B]  run_id PK · source_id FK · started_at · completed_at
                             · records_received · records_loaded · records_failed
                             · error_detail · file_hashes ARRAY

SCHEME_REGISTRY         [B]  scheme_id PK · scheme_name · scheme_type
                             · eligibility_json · covered_packages ARRAY
                             · annual_limit · state_scope
```

**`ANSWER_RUN` stores pointers, never content.** `law-dpdp.md` implication #2: erasure (s.12(3)) must remove clinical content while the access record survives Rule 6(e)'s 1-year retention. Storing answer text inline makes those two obligations **mutually unsatisfiable**. This must be right in the first migration. `[RWR]`

**`EVIDENCE_PACKET`** — D8. Every Class A refusal promises to route evidence "to the treating team." That packet is the actual output of the most safety-critical path in the system, and v1 never defined it.

**`SECURITY_EVENT`** — DPDP Rule 6(e) mandates access-anomaly logs retained ≥1 year; Rule 7 requires 72-hour breach notification with **no materiality threshold**. v1's validator "logged a security event" to nothing.

### Designed-only `[D]` — stated plainly in `IMPLEMENTATION-STATUS.md`

`DERIVED_ARTIFACT` (retention purge for embeddings/caches) · `CONSENT_ARTIFACT` (signed document store) · `FHIR_MAPPING` (declarative path config; v1 hardcodes) · per-region search shards · `FACILITY_ONBOARDING` · `MODEL_RISK_REGISTER` as a table (ships as a markdown deliverable instead) · `AUDIT_EXPORT`.

---

## 3. Three ingestion paths — the brief names all three

`[TE]` `[SC]` — explainer: *"I've covered structured, I've covered unstructured, I've covered semi-structured, all of these parts."*

| Path | Input | Mechanism | Lands in |
|---|---|---|---|
| **Structured** | CSV per source system | `COPY INTO` → staging → DT | `CORE` tables |
| **Semi-structured** | **FHIR R4 JSON bundles** | `VARIANT` → `LATERAL FLATTEN` | `CORE` tables |
| **Unstructured** | PDF / JPEG / PNG | `AI_PARSE_DOCUMENT(LAYOUT, page_split)` | `DOCUMENT`/`DOC_PAGE` |

```
RAW_FHIR_BUNDLE         [B]  bundle_id PK · source_id FK · payload VARIANT
                             · bundle_type · received_at · processed_at
                             · process_status · error_detail
```

**Why this closes two gaps at once:** the explainer names "semi-structured" as a distinct category, and `SCALE-REVIEW.md` F4 flagged that "siloed EHR" — the brief's *first* named challenge — had no ingestion architecture beyond a single `ingestion_method` field. FHIR bundles are JSON, so one path satisfies both. It also directly contests CareCompass, whose HL7/FHIR pipeline across 10 source systems is the strongest data-engineering work in the field.

**Research gap G2 is closed.** `research/clinical/fhir-field-mapping.md` (462 lines) now carries every field-level path needed: the `Bundle.entry[]` flatten pattern, all nine resource mappings, choice-type handling for `effective[x]` and `value[x]`, the canonical system URIs, and a worked bundle. Six corrections it forced are in §2.6a.

**The flatten pattern:**

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

**Two traps documented in the mapping file:**

`effective[x]` and `value[x]` are choice types — exactly one variant is present, so every read must `COALESCE` across `effectiveDateTime`, `effectivePeriod.start`, and `effectiveInstant`. Reading only `effectiveDateTime` silently drops every observation that used a period.

`Observation.interpretation[0].coding[0].code` carries the `H`/`L` flags. **It must land in `abnormal_flag`, never in `value_num`** — this is the exact trap Dipali's `10.3 L` and `38 H` values represent, and parsing the flag into the number corrupts every threshold comparison downstream.

---

## 4. Risk stratification over care gaps — 16 rules, 6 specialties

`[RWR]` `[TE]` — the brief invites *"risk stratification"*; the explainer says *"risk stratification metrics, care gap indicators."* v1 deliberately avoided both terms. **We adopt the vocabulary with an explicit scope disclosure:**

> **Care Readiness Risk Stratification** — stratifies *documentation, coverage, and safety-surveillance* risk. Does **not** model clinical deterioration, prognosis, or survival. Every score opens to its rule, its version, and the exact row or page that produced it.

That disclosure is a differentiator, not a hedge: it is what "never opaque predictions" looks like when implemented honestly.

### 4.1 The five gates

| Gate | Question | Evidence |
|---|---|---|
| **Clinical** | Do the numbers permit the next step? | structured rows |
| **Safety** | Is required surveillance current and within limits? | rows + protocol doc |
| **Documentation** | Is the record complete, final, and not superseded? | parsed docs + version chain |
| **Coverage** | Is this authorised, funded, and within limit? | claims rows + letter |
| **Identity** | Does all evidence resolve to one linked identity? | ID map |

"Surveillance" is renamed **Safety** — the brief names *"clinical, safety, or regulatory questions"* and this gate already *was* the safety gate (cardiotoxicity monitoring). `[RWR]`

### 4.2 Four-valued outcomes — `[TE]`

`pass` · `fail` · `not_evaluated` · `conflicting`

`not_evaluated` is not `fail`. A missing lab does not mean ANC is low — it means we do not know. That distinction changes the action: `fail` → fix this thing; `not_evaluated` → obtain this evidence (bring-list); `conflicting` → a human must reconcile two sources. Collapsing them destroys information the coordinator needs. **R3 applied at the gate layer.**

### 4.3 The catalog — breadth was already there

The 13 v1 rules already spanned four organ systems and were mislabelled "oncology" because the patient has cancer. Adding `specialty` makes existing breadth visible for ~15 minutes of work.

| Specialty | Rules | Source | New? |
|---|---|---|---|
| Medical oncology | 5 — ANC ≥1500, platelets ≥100k, HER2 FISH if IHC 2+, final pathology present, biomarker discordance | `clinical-thresholds.md` §1,2,6 | existing |
| Cardiology | 2 — LVEF ≤90d, FDA decline criteria | §3 | existing |
| Nephrology | 1 — CrCl per agent (Cockcroft-Gault) | §4 | existing |
| Hepatology | 1 — bilirubin/AST per agent | §5 | existing |
| Endocrinology | 2 — `ENDO-HBA1C-001`, `ENDO-DEXA-001` | **§9, §10** | **sourced** |
| General surgery | 1 — `SURG-CLEAR-001` | **§11** | **sourced** |
| Cross-cutting | 4 — coverage ×2, identity ×2 (**all specialties**) | existing | existing |
| **Total** | **16** | | **3 sourced** |

**Research gap G1 is closed.** `clinical-thresholds.md` §9–§11 now carry sourced thresholds for all three previously unsourced rules. Three findings changed the rule definitions:

**`ENDO-HBA1C-001` is `severity = 'advisory'`, never a blocker.** HbA1c < 8.5% (69 mmol/mol) within 90 days — CPOC UK 2022 and Association of Anaesthetists 2021. But **both explicitly state cancer surgery should not be deferred for glycaemic optimisation**, because oncologic delay risk outweighs it. The gate flags for endocrine review and must not block. It also returns `not_evaluated` rather than `fail` where a haemoglobinopathy is recorded — thalassaemia trait is prevalent in parts of India and makes HbA1c unreliable.

**`ENDO-DEXA-001` is T-score stratified**: 24 months if normal (≥ -1.0), 12 months for osteopenia, osteoporosis, or any patient on a bone-modifying agent. NCCN v4.2024 says annually for osteopenia on an aromatase inhibitor; ASCO permits 1–2 years. **We implement NCCN's 12 months** — the tighter interval is the safer default for a gate whose failure mode is a missed surveillance scan. A quantitative-ultrasound result yields `not_evaluated`, never a pass, because QUS cannot produce a T-score. Exercised twice over by the Dipali-derived patient, who has DEXA-confirmed osteopenia *and* receives zoledronic acid.

**`SURG-CLEAR-001` has one hard gate and one soft default, labelled differently.** The anti-VEGF 28-day interval (bevacizumab, ramucirumab, ziv-aflibercept) is **FDA-label mandated — genuinely hard**. But **no guideline mandates a universal post-surgery interval for cytotoxic chemotherapy**; NCCN gives 2–4 weeks varying by disease site, ESMO 3–4 weeks. We ship 21 days configurable, plus a 42-day contaminated-wound flag for cases like Dipali's perforated appendix — **both labelled as practice consensus, not guideline requirement, wherever surfaced.** Presenting institutional practice as a guideline mandate would be the same dishonesty we document in competitors.

The rule also **requires a documented clearance event and must not infer clearance from elapsed time alone.** In Indian practice surgical clearance is frequently verbal and never written into the discharge summary — which is exactly the record-state failure this system exists to catch. `[RWR]`

`specificity INT` resolves rule precedence (D5): the most specific matching rule for a patient/regimen suppresses more general ones for the same `(gate, concept)`.

### 4.4 The engine — a Task, not a Dynamic Table

**`SPEC-REVIEW.md` C2 identified a contradiction:** v1 said the rule engine must be a procedure (it needs `known_as_of` as a parameter) *and* that `DT_READINESS_STATE` materialises it. A DT cannot call a procedure, so the rules would exist in two places and drift.

**Resolution: `evaluate_gates` is the single source of truth. A scheduled Task materialises it.**

```
PROCEDURE evaluate_gates(p_patient_id, p_encounter_id, p_known_as_of) RETURNS VARIANT
```
1. Load rules effective at `p_known_as_of`, matching specialty/regimen, ordered by `specificity`.
2. Query evidence with `ingested_at <= p_known_as_of` **and** `valid_until >= encounter.scheduled_time`.
3. Evaluate `threshold_json`; skip any assertion whose `verification_status = 'conflicting'` → `not_evaluated`.
4. Emit `{gate, rule_id, rule_version, outcome, evidence_ids[], reason, severity}`.

`TASK_REFRESH_READINESS` runs every 5 minutes, calls the procedure per patient with `known_as_of = CURRENT_TIMESTAMP()`, writes `READINESS_STATE`. Event-driven for changed patients only — full-table refresh does not scale (S3), and we say so.

**Reschedule cascade (S1):** a trigger on `ENCOUNTER.scheduled_time` change re-evaluates that patient. 14% of cycles are missed with a **median 13.75-day delay** — rescheduling is the most common event in the workflow, not an edge case. `[RWR]`

---

## 5. Dual corpora — R6, platform-enforced

`[TE]` `[RWR]`

```sql
-- Patient corpus
CREATE CORTEX SEARCH SERVICE SAARTHI.DOCUMENTS.PATIENT_DOC_SEARCH
  ON text
  ATTRIBUTES patient_id, doc_id, doc_type, page_index, doc_version
  WAREHOUSE = SAARTHI_AI_WH
  TARGET_LAG = '1 minute'          -- live enough for the mid-demo addendum
  AS (SELECT chunk_id, text, patient_id, doc_id, doc_type, page_index, doc_version
      FROM SAARTHI.DOCUMENTS.DOC_CHUNK WHERE doc_scope = 'patient');

-- Reference corpus — real regulatory text, no patient data
CREATE CORTEX SEARCH SERVICE SAARTHI.DOCUMENTS.REFERENCE_DOC_SEARCH
  ON text
  ATTRIBUTES doc_id, doc_type, page_index, jurisdiction, effective_date
  WAREHOUSE = SAARTHI_AI_WH
  TARGET_LAG = '1 hour'
  AS (SELECT chunk_id, text, doc_id, doc_type, page_index, jurisdiction, effective_date
      FROM SAARTHI.DOCUMENTS.DOC_CHUNK WHERE doc_scope = 'reference');
```

**Two services, not one filtered service.** A single index lets "PM-JAY requirements" surface a patient note that mentions PM-JAY. Separate services make cross-contamination *structurally impossible* — the tools physically cannot reach the other corpus. ATLAS and SynapseCortex both have confirmed mixed indexes.

**Chunking:** page-level primary (preserves page citations); pages over ~1000 tokens split on markdown H2/H3 from `AI_PARSE_DOCUMENT` LAYOUT output; markdown tables never split mid-row.

**Reference corpus — hard dependency, currently unmet.** `data/reference/` does not exist. Tier 1 per `reference-corpus-sources.md`: PM-JAY Operation Manual, trastuzumab FDA label, NCG breast guidelines. **Owner: C, day 1, parallel work.** Cost must be measured first (see §14 U1) — the existing 250–310 page estimate is internally inconsistent about dollars.

---

## 6. Tools — 8 agent-facing procedures, scope injected

*(11 procedures exist in total: these 8 plus `bind_patient`, `evaluate_gates` and `validate_answer`. The latter three are never exposed to the agent.)*

`[TE]` `[BONUS]` custom tools & function calling

All `EXECUTE AS OWNER`. All derive scope from `CURRENT_USER()` → `PRACTITIONER` → `CARE_TEAM`, and **all check `CONSENT` at query time**. The question never supplies patient_id.

| # | Tool | Purpose | Write? |
|---|---|---|---|
| 1 | `get_patient_facts(domain, known_as_of)` | structured facts by domain | no |
| 2 | `get_readiness(encounter_id, known_as_of)` | 5 gates + rule versions + evidence IDs | no |
| 3 | `search_patient_documents(query, known_as_of)` | patient corpus; 3-layer R5 | no |
| 4 | `search_reference_documents(query, jurisdiction, effective_date)` | reference corpus; no patient data | no |
| 5 | `cohort_query(question)` | Cortex Analyst over semantic view | no |
| 6 | `get_timeline(known_as_of)` | **new (D10)** — chronology, provenance per facility | no |
| 7 | `get_changes(from_ts, to_ts)` | **new (D10)** — diff two `known_as_of` states | no |
| 8 | `create_review_task(issue_id, action, reason, idempotency_key)` | the only write tool | **yes** |

Tools 6 and 7 close a real hole: D10 found **four Class B question types with no tool path**, two of which are demo questions ("what changed since 09:00?" is Q3). The agent would have refused a legitimate question or hallucinated.

`create_review_task` is restricted to `treating|coordinator` roles — `patient_navigator` cannot create tasks. `action` is an enum; "approve treatment" does not exist as a value.

**Session requirement from F7:** the app session must execute `USE SECONDARY ROLES NONE`, or authenticate as a dedicated service user granted only the app role. Otherwise a secondary ACCOUNTADMIN silently satisfies Layer 1's privilege check.

---

## 7. Answer validator — 6 checks

`[TE]` `[BONUS]` guardrails & graceful fallback

**Check 6 is new and it is the most important thing in this document.**

`DEEP-REVIEW-3.md` D1: v1 validated **claim ↔ evidence** consistency, never **evidence ↔ reality**. If `AI_PARSE_DOCUMENT` reads a rotated photo and extracts `ANC = 1200` where the page says `2100`, all five v1 checks pass. The answer is perfectly cited and clinically wrong. Our own research cites 3–18% hallucination rates in AI clinical summaries — we cited it to justify citations, then built a validator blind to that error class.

| # | Check | Failure action |
|---|---|---|
| 1 | Evidence exists | strip claim |
| 2 | Evidence in bound scope | strip + `SECURITY_EVENT` |
| 3 | `ingested_at <= known_as_of` | strip + log temporal violation |
| 4 | **Polarity** via `AI_FILTER` | strip + log |
| 5 | Type match (numeric/date/status within tolerance) | strip + log mismatch |
| 6 | **Assertion trustworthiness (R7)** | downgrade to explicit limitation |

**Check 4 — exact verified syntax (F8).** `AI_FILTER` text form takes **one** argument; the two-argument form is images only. Four earlier attempts failed on this.
```sql
AI_FILTER(PROMPT('Does this passage confirm that {0}? Passage: {1}', :claim, text))
```
Verified discriminating correctly. Inputs must be non-NULL. Text only — image filtering is limited to four AWS regions we are not in.

**Check 6 logic:** a claim resting on an assertion with `verification_status IN ('conflicting','unverified')`, or `source_quality = 'rotated_photo'`, or `extraction_confidence` below threshold, does **not** assert the value. It returns:

> *"A value was read from a low-quality image and could not be verified on a second pass. Confirm against the original report."*

### R7 — two-pass extraction

For every concept with `is_safety_critical = TRUE`:
1. Pass 1 — extraction prompt A, model `llama3.3-70b`.
2. Pass 2 — differently-worded prompt B.
3. Agreement → `verified`. Disagreement → `conflicting`, both values retained in `pass1_value`/`pass2_value`, and **the gate returns `not_evaluated` rather than a number**.

This converts our safety claim from *"we cite our sources"* to *"we know when our sources are unreliable, and we say so."* Cost: doubles parse spend on critical fields only — affordable at $1,200. **We did not find extraction verification in the competitor code we reviewed.**

**Answer output schema** — frozen, because both the agent prompt and the validator depend on it (C5):
```json
{
  "classification": "CLASS_B",
  "claims": [{
    "text": "ANC is 2100/µL, above the 1500 threshold",
    "evidence_ids": ["CE-LAB-441"],
    "claim_type": "numeric",
    "asserted_value": 2100,
    "asserted_unit": "cells/uL"
  }],
  "limitations": [],
  "overall_status": "supported",
  "known_as_of": "2026-09-18T09:00:00",
  "consent_id": "CON-0031"
}
```

---

## 8. Semantic view + verified queries

`[TE]` `[SC]` — explainer: *"verified queries is a very very crucial part of semantic views that adds more confidence and better results accuracies."* v1's weakest section was the one emphasised most.

**Entities:** patients · encounters · clinical_events · review_issues · documents · practitioners · facilities · coverage
**Metrics:** `open_blocker_count` · `days_to_next_visit` · `gate_pass_rate` · `avg_resolution_hours` · `patient_limit_remaining` · `curable_denial_count`
**Time dimensions:** `encounter_date` · `event_time` · `known_as_of` · `ingested_at`

Six verified queries, covering the demo plus the likely judge probes:

| Verified question | Demo beat |
|---|---|
| Which patients lack a final report before this week's cycle? | Q6 |
| How many open blockers per gate? | judge probe |
| Which patients have conflicting authorisation status? | judge probe |
| Which patients on trastuzumab have LVEF older than 90 days? | judge probe |
| Which patients are within 10% of their recorded annual limit? | judge probe |
| Average hours to resolve a documentation gap? | judge probe |

RAP on base tables propagates to the semantic view — Cortex Analyst generates SQL that runs in the caller's session.

---

## 9. Synthetic data generator

`[SC]` `[BONUS]` synthetic data generation · `[RWR]`

Seeded deterministic fact ledger — same seed, identical output. Reproducibility is a judge requirement; the generator also **knows ground truth**, which is what makes the 80-question eval auto-truthable.

```
ledger.py       → canonical fact history (single source of truth)
projections.py  → per-source-system CSVs with local IDs
fhir_bundles.py → FHIR R4 JSON for the semi-structured path
documents.py    → PDFs via fpdf2, Indian lab formats
corruptions.py  → 12 named, seeded defects
eval_questions.py → 80 questions + ground-truth answers
```

**100 patients, ~85k rows.** Every patient carries 1–3 comorbidities at realistic Indian prevalence (diabetes ~25%, hypertension ~30%, CKD ~10%, hypothyroidism ~10%, post-treatment osteopenia ~20%). **≥15 patients carry a cross-department interruption** modelled on Dipali's appendectomy.

### The 12 corruption scenarios

| # | Scenario | Tests | Correct behaviour |
|---|---|---|---|
| 1 | Late-arriving addendum | R2 | answer changes; old cutoff returns old answer |
| 2 | Grade discordance across specimens | R3/D3 | both shown, flagged discordant, not auto-resolved |
| 3 | IHC discordance between labs | R3/D3 | both shown; FISH requirement fires from the 2+ |
| 4 | Unit chaos (`1.9 lakhs` vs `190000`, `GM%`, `mg%`) | UNIT_REGISTRY | both normalise; implausible rejected |
| 5 | Missing FISH after IHC 2+ | documentation gate | fails; bring-list says "bring FISH report" |
| 6 | Auth pending in table, approved in letter | coverage gate | `conflicting`, both retained |
| 7 | Stale LVEF >90d | safety gate | blocker per rule |
| 8 | Quarantined identity | identity gate | contributes no evidence |
| 9 | Duplicate upload | idempotency | hash-detected, skipped |
| 10 | Prompt injection inside a document | security | treated as content, never executed |
| 11 | Cross-patient ID supplied in the question | R5 | scope from session; returns nothing |
| 12 | Appendectomy mid-treatment | `gap_type` | `clinical_complication`, not documentation |
| **13** | **Rotated/low-quality photo with a misread value** | **R7** | **two-pass disagrees → refuses to assert** |

Scenario 13 is new and it is what proves R7.

A first synthetic document already exists — `data/synthetic_docs/lab_cbc_meera_20260908.pdf` — encoding the real traps from `real-patient-dipali.md` §5: `GM%`, `/CUMM`, `1,50,000 - 4,50,000` comma notation, `L`/`H` flags, neutrophils as differential `%` with no absolute ANC, `mg%` creatinine.

---

## 10. Application — 6 screens, Ask + Evidence at the centre

`[SC]` — the brief: *"Deliver a question and answer experience with clear source evidence."* That is the product, not one tab of six.

| Screen | User · moment | Prevents |
|---|---|---|
| **Ask + Evidence** ⭐ | any role | the core Q&A: cited answer, `known_as_of` slider, evidence pane, Class A refusal + packet offer |
| Review Queue | coordinator, between cycles | open gate failures by urgency; the unowned Stage-9 gap |
| Patient 360 | oncologist, on rounds | 2-minute chart review: gate strip, facility timeline, discordance flags |
| Review + History | coordinator | task lifecycle, version chain, `ANSWER_RUN` history |
| Navigator View | navigator, pre-travel | bring-list in Hindi/Tamil/Bengali/Marathi + eligible schemes |
| **Judge Console** | judges | live security probes, metrics, CoCo evidence index |

Streamlit in Snowflake. `AGENT_RUN` (F1) means warehouse runtime is a proven fallback if container runtime disappoints.

**Bring-list derivation is principled, not inferred:** `REFERRAL.documents_expected` − `documents_received`, plus `not_evaluated` gate items. Translated with `AI_TRANSLATE`. Carries a standing *"your treating team decides"* notice and renders only coordinator-reviewed issues.

**Judge Console probes** — each a button, each showing the SQL and the result:
1. Cross-scope attempt → blocked (`CURRENT_USER()` RAP)
2. **Search without the filter → returns another patient's text** (F5 — the competitor failure mode, live)
3. Consent revoked → same question returns nothing
4. Injected instruction in a document → treated as content
5. Fabricated claim → validator strips it, logs it
6. Low-quality image → two-pass disagrees → refuses to assert
7. Time-travel replay → two cutoffs, two correct answers
8. Baseline RAG delta

---

## 11. Four skills + one orchestrating Task

`[BONUS]` — *"reusable skills remain the headline bonus"* · explainer: *"create separate skills for… clinical questions, the evidence retrieval, and the risk score"* then *"a task on top which orchestrates between the three of them."*

v1 planned **one** skill. That was wrong on both counts.

| Skill | Process | Wraps |
|---|---|---|
| `clinical-question-routing` | "clinical questions" | Class A/B classifier |
| `evidence-retrieval` | "the evidence retrieval" | dual-corpus search + governed re-fetch |
| `risk-stratification` | "the risk score" | rule engine + 5 gates |
| `evidence-reconciliation` | ours | assertion matching, discordance, supersession |

`TASK_SAARTHI_ORCHESTRATOR` chains them — satisfying **multi-agent orchestration** in the same move.

**Reuse proof** (`plan.md` §10): run `evidence-reconciliation` against a second synthetic schema with different column names. Show one successful mapping **and one ambiguity it correctly refuses to resolve.** The refusal is the stronger demo.

---

## 12. Class A/B classification

`[RWR]` — NMC TPG 2020 prohibits AI platforms from clinical counselling. This is a legal boundary, not a product preference.

1. **Keyword scan** (zero latency): `should · recommend · right · correct · safe · dangerous · prognosis · survival · survive · mortality · die · best treatment · change dose · switch regimen · advise` → **Class A**.
2. **Structure scan**: state/status/list/comparison/lookup → **Class B**.
3. **LLM fallback** only for the residue.
4. **Default → Class A.** Err toward refusal.

Keyword-first because the highest-harm error is a Class A question answered as Class B, and because a system relying on the LLM to decide whether to use the LLM is circular.

**Class A response offers evidence rather than refusing flatly** — it generates an `EVIDENCE_PACKET` addressed to the named treating practitioner. Useful, not obstructive.

**Class B taxonomy — all 10 types now have a tool path** (D10): status lookup · gap identification · conflict detection · timeline · document lookup · regulatory lookup · cohort · change detection · provenance · coverage utilisation.

---

## 13. Pipeline topology

`[TE]` — explainer: *"dynamic table… CDC technique… streams."*

```
Stage (SNOWFLAKE_SSE — F9)          RAW_FHIR_BUNDLE           CSV
        │                                  │                    │
   Directory Table                         │                    │
        │ Stream                           │ Stream             │ COPY INTO
        ▼                                  ▼                    ▼
TASK parse_documents              TASK flatten_fhir        staging tables
 AI_PARSE_DOCUMENT(LAYOUT,             LATERAL FLATTEN
   page_split) → DOCUMENT/DOC_PAGE          │
        │  dedup on file_hash               │
        ▼                                   │
TASK extract_assertions  ── R7 two-pass ────┤
        │                                   │
        ▼                                   │
TASK reconcile_evidence  ── discordance ────┤
        │                                   │
        ▼                                   ▼
   ┌────────────── DYNAMIC TABLES (deterministic only) ──────────────┐
   │ DT_HARMONIZED_EVENTS   (unit normalisation, ANC calc, CrCl)     │
   │ DT_DOC_CHUNK           (page → chunks; NO RAP — F4)             │
   │ DT_REVIEW_QUEUE        (open failures × days-to-visit)          │
   │ DT_SCHEME_ELIGIBILITY  (patient × scheme registry)              │
   │ DT_TREATMENT_PLAN      (current version per patient)            │
   └─────────────────────────────────────────────────────────────────┘
                                    │
              TASK_REFRESH_READINESS (calls evaluate_gates) → READINESS_STATE
                                    │
                     TASK_NOTIFY (blocker + days_to_visit ≤ 3)
```

**AI steps live in Tasks, deterministic steps in Dynamic Tables** — `AI_PARSE_DOCUMENT` and `AI_COMPLETE` are non-deterministic and cannot sit inside a DT. Five DTs, exactly as the explainer describes.

`DT_HARMONIZED_EVENTS` does the work that makes rules simple: `UNIT_REGISTRY` normalisation with plausibility rejection, **ANC computed as `WBC × (neutrophil% + band%) / 100`** when the lab reports only a differential (as Dipali's did), and Cockcroft-Gault CrCl joining the latest `vitals` weight.

---

## 14. Deployment, evaluation, and the two stages

### One-script deploy `[SC]`
`setup.sql` — idempotent, clean-account safe: database → 7 schemas → 34 tables → 3 stages → governance (tags, RAP on `CURRENT_USER()`, masking, 5 roles) → ontology + unit registry seed → 16 rules → 11 procedures → 3 streams → 7 tasks → 5 DTs → 2 search services → semantic view + 6 VQRs → grants → data load → reference corpus → initial pipeline run.
`teardown.sql` — `DROP DATABASE` + warehouse + roles.
Git integration: `EXECUTE IMMEDIATE FROM @SAARTHI_REPO/branches/main/src/sql/setup.sql`.

### Eval harness `[SC]`
80 questions, **40 dev / 40 held out**, split by patient *and* document layout so no layout leaks. Truth key in an `EVAL` schema **inaccessible to the app role**. Machine-readable results. Baseline plain-RAG comparison on the same held-out set, reported in both directions.

Targets: cross-scope leakage **0** · evidence coverage **100%** · citation precision **≥95%** · held-out correctness **≥90%** · designed missing/conflict cases **100%** · supported-answer recall **≥90%** (so refusal alone cannot score well) · warm p95 **15s**.

Absolute counts alongside rates. Cold starts separate. **These are engineering gates on synthetic tests, not clinical validation** — stated in the deck.

### Rule fixtures `[SC]` `[BONUS]`
16 rules × 5 cases (pass, fail, exact-boundary, missing-input, conflicting-input) = **80 SQL assertions.** Doubles as CoCo Testing-phase evidence, which our research says most competitors omit.

### Latency budget (M1)
search 2s + re-fetch 1s + gates 2s + `AI_FILTER` batched 3s + phrasing 4s ≈ **12s**. `AI_FILTER` batched in one call rather than per-passage; polarity cached on `(claim_hash, evidence_id)` since it never changes.

### Three unproven items → Day 1
| # | Test | Fallback |
|---|---|---|
| U1 | `AI_PARSE_DOCUMENT` cost/page + trap survival — needs one client-side `PUT` | cost only; R7 handles quality |
| U2 | `CURRENT_USER()` inside deployed Streamlit | if it returns the owner → dedicated service user (F7 path 2) |
| U3 | `CREATE STREAMLIT … COMPUTE_POOL` on trial | warehouse runtime + `AGENT_RUN` (F1, proven) |

### Stage 1 vs Stage 2 `[SC]`
**Stage 1 (5–22 Oct, team absent)** — clean-account deploy · README a stranger can follow · re-runnable tests · **`IMPLEMENTATION-STATUS.md`** marking every component `built|partial|designed-only` · CoCo evidence across all 4 phases. A judge with 18 days will find every gap; our own accurate list beats their discovery that we overclaimed — the exact failure we document in competitors.
**Stage 2 (27–30 Oct)** — Judge Console, consent revocation, cross-department scenario, correction replay.

---

## 15. Hackathon-optimal vs product-optimal

Recorded so nothing needs unpicking if this gets funded.

| Decision | Hackathon | Product | Chosen |
|---|---|---|---|
| Federation | one database, labelled index vs cached | true federated fetch per consent | **hackathon**, schema shaped for product |
| Rule breadth | 16 rules, fully tested | hundreds across specialties | **hackathon** — Completeness penalises untested breadth |
| Readiness refresh | 5-min Task | event-driven per patient | **hackathon**, documented |
| Search sharding | 2 services | per-region shards >400M chunks | **hackathon**, documented |
| Consent | enforced, synthetic artifacts | ABDM Consent Manager integration | **hackathon** — enforcement is real, linkage is stubbed |
| Handwriting | **attempted through the same `AI_PARSE_DOCUMENT` → R7 two-pass pipeline as every other document, no separate subsystem** — `source_quality='handwritten'` tags it, and accuracy is reported broken out by `source_quality` tier rather than one blended number | required | **revised 21 Sept** — the original "refuse, not attempted" call in `WINNING-PLAN.md`/`plan.md` was a scope-protection decision under 18-day pressure, not a technical wall. No code ever actually excluded it: `source_quality` already includes `handwritten` (§2.6) and neither `parse_documents` nor `extract_assertions` filters on it. R7's two-pass verification is the correct mechanism for an unreliable source — expect a materially higher `conflicting`/`unverified` rate on handwriting, and say so with real numbers rather than refusing outright. |

---

## 16. Task distribution

### Day 1 — all three, in parallel
| Owner | Task |
|---|---|
| **all** | Commit everything now — the git trail proving planning preceded development is the cheapest lifecycle evidence and it is currently unbanked |
| **A** | `setup.sql` skeleton: database, 7 schemas, 34 tables, RAP on `CURRENT_USER()`, 5 roles, `USE SECONDARY ROLES NONE` in app session |
| **B** | Freeze answer JSON schema (§7) · run U1 `PUT` + measure parse cost · source the 3 missing thresholds (§4.3) |
| **C** | Download Tier 1 reference corpus into `data/reference/` · create `evidence/coco/planning.yaml` and retro-log this session |

### Days 2–5 — vertical slice, deployed. **Hard gate.**
| Owner | Task |
|---|---|
| **A** | `ledger.py` → 1 patient → CSV + FHIR bundle + PDF; `COPY INTO`; governance live |
| **B** | Parse → **R7 two-pass** → assertion → ontology normalise → `CLIN-ANC-001` → cited answer via tools 1–3 |
| **C** | Ask + Evidence screen: question in, cited answer out, evidence pane opens the exact page, under real `CARE_TEAM` + `CONSENT` |

**If one patient does not flow end-to-end by end of Day 5, cut scope immediately — not at Day 12.**

### Days 6–10 — scale
**A:** 100 patients + 13 corruptions + comorbidities · 5 DTs · semantic view + 6 VQRs
**B:** all 16 rules + 80 fixtures · validator all 6 checks · both search services · consent revocation
**C:** Review Queue · Patient 360 · Review + History · notifications

### Days 11–14 — proof and bonuses
**A:** `setup.sql`/`teardown.sql` clean-account rehearsal · Git integration
**B:** 80-question eval + baseline RAG · 4 skills + orchestrating Task
**C:** Judge Console (8 probes) · Family view + translate · MCP connector

### Days 15–17 — freeze. **Target completion 1 Oct.**
README · `IMPLEMENTATION-STATUS.md` · demo video · **cold-start test by whoever built least of it** · CoCo evidence manifest across all 4 phases · model-risk register.
**2–4 Oct: contingency only. Submit early.**

---

## 17. Go / no-go

No-go if: any answer is hard-coded · evidence links are decorative · the agent can cross patient scope · consent revocation does not actually block · the late-update path is simulated rather than real · two-pass verification is claimed but not wired · CoCo evidence exists only for code generation.

**Honesty rules:** no README claim that isn't demonstrable from the repo · absolute counts alongside rates · synthetic data only in the system, with the real reports credited as format research only, consent noted, handled with dignity · `QUERY_HISTORY` for live evidence and `ACCESS_HISTORY` (≤180 min lag) for the written pack, labelled as such · competitor comparisons cite file and line.
