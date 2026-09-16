# SHOULD-CLOSE Research Gaps — Consolidated

**Researched 2026-09-16. Closes the 7 "should close" gaps from the validation matrix.**

---

## 1. Synthetic data generation best practices for healthcare

### The core problem
Synthetic healthcare data must be: (a) realistic enough to stress-test clinical logic, (b) referentially consistent across tables, (c) obviously not real (no legal risk), (d) contain intentional defects for testing.

### Existing tools
- **Synthea** (synthetichealth.github.io): generates realistic US patient records in FHIR format. 100+ clinical modules. NOT Indian — uses US demographics, US insurance, US clinical protocols. Can be used as a structural template but all content must be replaced.
- **Faker (Python)**: generates fake demographics. No clinical awareness.
- **Our approach (ledger.py)**: a seeded fact ledger that generates tables AND documents from the same facts. This is correct and better than Synthea for our purposes because: (a) we control the clinical logic, (b) documents and tables are guaranteed consistent, (c) intentional corruptions are named and traceable.

### What makes synthetic oncology data realistic
1. **Demographic distribution**: Indian names, Indian cities, Indian age distribution for breast cancer (peak 45-55 in India vs 60-65 in US).
2. **Clinical trajectory**: diagnosis → staging → regimen selection → cycle-by-cycle labs → surveillance → completion. Each step has clinically plausible values.
3. **Intentional gaps**: missing addendum (10% of patients), stale echo (15%), authorization conflict (5%), unit mismatch between labs (10%), identity ambiguity (5%). These percentages should be documented and traceable.
4. **Multi-facility records**: the same patient has records from 2-3 facilities with different MRNs, slightly different spellings, different date formats.
5. **Temporal realism**: reports don't all arrive on the same day. Labs arrive same-day; pathology takes 3-7 days; FISH addendum takes 5-7 more days; insurance authorization takes 2-5 days. The generator must model these lags.

### Pitfalls
- All patients having identical lab patterns → unrealistic.
- No variation in report quality → doesn't test extraction.
- Clean, perfectly formatted documents → doesn't test the parsing pipeline.
- No intentional negation cases → can't test polarity checking.

---

## 2. Stakeholder validation

### What CareCompass did
Referenced "clinical domain experts" in their SDD and BRD. Documented interviews. This reads as validated even if the interviews were brief.

### What we should do (within hackathon constraints)
- Reference the published clinical literature (already done — 30+ citations across research files).
- If any team member has access to a clinician (oncologist, nurse, coordinator), get one 30-minute validation session and document it: "Dr. X reviewed the 9-stage workflow model and the gate definitions on [date]. Feedback incorporated: [specific change]."
- If no clinician access: explicitly state "validated against published workflow literature" and cite the sources. This is honest and defensible. Do NOT fabricate stakeholder validation.

---

## 3. Class A/B edge cases — stress-testing the taxonomy

### The ambiguous questions

| Question | Classification | Reasoning |
|---|---|---|
| "Is this drug interaction dangerous?" | **Class A** — requires clinical judgment about patient-specific risk | Refuse. Cite the interaction from the reference corpus but do not assess danger for this patient. |
| "Are there any drug interactions?" | **Class B** — factual lookup against drug interaction database | Answer with citations. "Metformin + CKD Stage 4 is flagged in [guideline, section X]." |
| "Should she continue trastuzumab?" | **Class A** — treatment decision | Refuse. Show LVEF history, cite the FDA hold criteria, and route to treating team. |
| "Has the LVEF dropped enough to hold trastuzumab?" | **Class B** — threshold comparison against a defined rule | Answer. "LVEF dropped 18% from baseline (62% → 44%). FDA label criteria for hold (drop ≥16%) is met. [FDA label, section X]." |
| "Is she in danger?" | **Class A** — clinical assessment | Refuse. |
| "What's missing from her record?" | **Class B** — record-state query | Answer with specific missing items. |
| "What should the family bring?" | **Class B** — derived from missing documentation | Answer with the bring-list. |
| "Is PM-JAY going to cover this?" | **Borderline** — coverage prediction vs coverage state | Answer the RECORD STATE: "Pre-authorization status is [X]. Required documents: [Y]. Missing: [Z]." Do NOT predict the outcome. |
| "Will she respond to this treatment?" | **Class A** — prognosis | Refuse. |
| "What does the evidence say about response rates for this regimen?" | **Class B** — literature lookup | Answer from reference corpus with citations. Population-level evidence, not patient-specific prediction. |

### The classification rule
**If the answer changes based on THIS PATIENT's clinical state in a way that requires medical judgment → Class A. If the answer is a factual lookup, threshold comparison, or record-state query → Class B.**

The edge cases are questions that SOUND clinical but are actually threshold comparisons (LVEF drop) and questions that SOUND factual but require clinical judgment (drug interaction danger).

---

## 4. Question types Indian clinicians actually ask

### From the oncology department workflow (planning/oncology-department-map.md)

**Stage 3 (pre-consult, 2-5 min)**:
- "What's the tissue diagnosis?" (Class B — pathology record state)
- "Is it final or is FISH pending?" (Class B — addendum state)
- "What was the last imaging?" (Class B — record query)
- "Are today's labs safe?" (Class B — threshold comparison)
- "When was the last echo?" (Class B — date query)
- "Is the authorization in place?" (Class B — coverage state)

**Stage 9 (between-cycle)**:
- "Which patients are coming this week and what's missing?" (Class B — cohort query + gap analysis)
- "Has the spoke hospital sent the report yet?" (Class B — document state)
- "Did the insurance approve the continuation?" (Class B — authorization state)

**Stage 4 (consultation — mostly Class A)**:
- "Should I change the regimen?" (Class A — refuse)
- "Is this toxicity manageable?" (Class A — refuse)
- "What does the guideline recommend for this situation?" (Class B — reference lookup)

### Validation
The Class B questions map directly to our 5 gates + the copilot's question-answering scope. The Class A questions are refused. The taxonomy holds.

---

## 5. known_as_of in FHIR — prior art check

### FHIR Provenance resource
FHIR R4 has a `Provenance` resource with `recorded` (when the provenance was recorded) and `occurred` (when the activity occurred). This maps to our `source_recorded_at` and `event_time`.

### FHIR Meta.lastUpdated
Every FHIR resource carries `meta.lastUpdated` — when the resource was last changed in the server. This is close to our `ingested_at`.

### What FHIR does NOT have
**There is no native FHIR concept equivalent to `known_as_of` — the idea that a query is bound to a specific moment and returns only evidence that existed at that moment.** FHIR versioning tracks resource history, but a query against a FHIR server returns the CURRENT state, not the state at a past point in time. FHIR `_at` and `_since` parameters exist for search but they filter by lastUpdated, not by a logical "what was known when" clock.

### Consequence
**R2 is genuinely novel in this context.** FHIR tracks provenance but does not bind queries to a knowledge-moment. Our three-clock model (event_time, source_recorded_at, ingested_at) with `known_as_of` query binding goes beyond FHIR's temporal model. Say this in the pitch — with the FHIR citation — and it's a defensible novelty claim.

---

## 6. Missingness in FHIR — prior art check

### FHIR's approach
- **DataAbsentReason** extension: a standard extension that explains why a value is missing. Codes include: `unknown`, `asked-unknown`, `temp-unknown`, `not-asked`, `asked-declined`, `masked`, `not-applicable`, `unsupported`, `as-text`, `error`, `not-a-number`, `negative-infinity`, `positive-infinity`, `not-performed`, `not-permitted`.
- This is applied to individual elements within a resource, not to the resource's existence.

### How it compares to R3
Our enum: `present · explicitly_negative · pending · not_received · conflicting · unreadable · superseded`

| Our state | FHIR DataAbsentReason equivalent | Notes |
|---|---|---|
| present | (value exists) | Same |
| explicitly_negative | (value exists, value is "negative") | FHIR doesn't distinguish "test was negative" from "test was done and value is X" |
| pending | `temp-unknown` | Close match |
| not_received | `unknown` or no resource at all | FHIR doesn't cleanly model "the source said it sent this but we haven't received it" |
| conflicting | (no equivalent) | **Novel.** FHIR has no concept of two sources disagreeing about the same fact. |
| unreadable | `error` or `as-text` (partially) | Our concept is specific to document extraction failure |
| superseded | (use versionId / Provenance) | FHIR handles this through resource versioning |

### Consequence
**R3 is partially novel.** `explicitly_negative`, `conflicting`, and `unreadable` go beyond FHIR's DataAbsentReason. The distinction between "HER2 is negative" and "HER2 result has not been received" is exactly the gap FHIR's model doesn't capture cleanly — and it's the gap that causes a woman to receive the wrong regimen.

Cite FHIR DataAbsentReason as prior art, then explain where we go further.

---

## 7. Semantic view best practices + verified queries

### Structure
The semantic view should cover the CONSUMPTION layer (after harmonization):
- **Dimensions**: patient_id, encounter_date, event_type, document_scope, gate_name, review_status
- **Measures**: gate_pass_count, gate_fail_count, open_issues_count, days_to_next_visit
- **Time grain**: per-encounter (for patient-level queries), per-day (for cohort queries)

### Verified queries to pre-build (mapped to demo Q1-Q6)
1. "Which patients have upcoming visits this week with unresolved gate failures?" → Q6
2. "What is the readiness status for patient X for their next encounter?" → Q1
3. "How many patients currently lack a final pathology report?" → Q6 variant
4. "What is the average time between lab collection and cycle date across the cohort?" → operational metric
5. "Which patients have authorization conflicts?" → coverage gate cohort view

### How to create verified queries
```sql
ALTER SEMANTIC VIEW saarthi_semantic_view
ADD VERIFIED QUERY 'patients_missing_final_report'
AS $$
SELECT patient_id, encounter_date, gate_name, gate_state
FROM readiness_gate_state
WHERE gate_name = 'DOCUMENTATION'
  AND gate_state = 'FAIL'
  AND encounter_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
$$;
```

---

## Sources

synthetichealth.github.io/synthea · HL7 FHIR R4 Provenance resource · HL7 FHIR R4 DataAbsentReason extension · docs.snowflake.com: Semantic Views, Verified Query Repository · ASCO/CAP guidelines for the Class A/B edge cases.
