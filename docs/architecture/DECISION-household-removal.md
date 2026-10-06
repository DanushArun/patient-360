# Decision Record — Remove HOUSEHOLD

**Decided 20 Sept 2026. Supersedes `SCALE-REVIEW.md` F5 recommendation and the `HOUSEHOLD` modelling in `SPEC.md` v2 §2.3 and §2.5.**

---

## Decision

**`HOUSEHOLD` and `HOUSEHOLD_MEMBER` are removed. Family-floater coverage arithmetic is declared out of scope and stated wherever coverage surfaces.**

`COVERAGE` is patient-keyed. `COV-LIMIT-001` evaluates the patient-level annual limit only. `is_family_floater` survives as a flag that records *"a shared limit exists and we do not track it"* — not as an arithmetic input.

Table count: **25 → 23.**

---

## Why

### 1. The brief does not require it

> *"unifies data into a patient **or** member 360"*

`PROBLEM-STATEMENT.md` G2 already established this and downgraded F5 from FATAL to HIGH on exactly these grounds: **patient 360 alone satisfies the requirement.** The title says "and"; the requirement says "or". We build patient 360.

### 2. The FHIR mapping was never verified

`fhir-field-mapping.md` §8 flags this: `Coverage.beneficiary` is a single Patient reference, so a ₹5-lakh-per-family limit has no native home in base FHIR. The two candidate mappings — `Coverage.class[type=group].value` or a `Group` resource — are **both unverified against the NRCeS ABDM IG.**

`FINAL-VALIDATION.md` residual risk #4 lists this among five unverified India-profile FHIR claims. Our own honesty rule is that **no India-profile claim ships unverified.** Building `HOUSEHOLD` on an unverified mapping would violate it.

### 3. Correctness we cannot deliver is worse than scope we decline

A `HOUSEHOLD` table alone does not make floater arithmetic correct. It requires:

- Household membership data for every patient
- Coverage consumption events for **every other member** of that household
- Reconciliation when members are treated at facilities outside our data
- A consent model covering one member's data being used to compute another's balance

We have none of these and cannot generate them credibly in synthetic data. A `HOUSEHOLD` table with one member per household computes exactly the patient-level figure we already have — while *appearing* to model family coverage. **That is a claim the repo cannot support.**

### 4. It reduces build surface at no rubric cost

| Criterion | Effect of removal |
|---|---|
| **Technical Execution (40%)** | Neutral. No engine change — `COV-LIMIT-001` uses the same `threshold_json` shape against a different column. |
| **Real-World Relevance (30%)** | Slightly negative in isolation, **net positive with the scope statement.** Declaring a known limitation precisely is more credible than modelling it badly. PM-JAY remains represented via `SCHEME_REGISTRY` and `payer_type = 'scheme'`. |
| **Solution Completeness (30%)** | **Positive.** Two fewer tables, no household generation in synthetic data, no member-aggregation logic in `DT_SCHEME_ELIGIBILITY`, no unverifiable FHIR claim to defend. |

---

## What replaces it

### `COV-LIMIT-001`, re-scoped

| Before | After |
|---|---|
| Household floater limit minus all members' consumption | `COVERAGE.annual_limit` − `COVERAGE.used_amount`, patient-scoped |
| Outcome assumes family-wide accuracy | Where `is_family_floater = TRUE`, the answer **states that the shared balance is unknown** |

The rule still produces all four outcomes. It never estimates a family balance.

### The honest answer to "how much of the limit is left?"

> *"₹1,20,000 of ₹5,00,000 recorded against this patient has been used. This is a PM-JAY family floater — other family members' consumption is not in this system, so the shared remaining balance cannot be computed from these records."*

This is R3 applied to coverage: **an unknown is declared, never estimated.** It is the same discipline as `not_evaluated` on a clinical gate, and it is more defensible than a number that is confidently wrong.

---

## Consequences

### Changed

| File | Change |
|---|---|
| `SPEC.md` §2.3 | `HOUSEHOLD`, `HOUSEHOLD_MEMBER`, `PATIENT.household_id` removed. Scope statement added. |
| `SPEC.md` §2.5 | `COVERAGE.household_id` removed. `is_family_floater` documented as a flag. |
| `SPEC.md` §2.6a | FHIR note rewritten — family coverage declared out of scope instead of justified. |
| `SPEC.md` §8 | Semantic view: `households` entity and `household_limit_remaining` metric removed. VQR 5 re-scoped to patient level. |
| `SPEC.md` §11 | Pipeline: `DT_SCHEME_ELIGIBILITY` is patient × scheme registry. |
| `ARCHITECTURE-DIAGRAMS.md` diagram 9 | `HOUSEHOLD` entity and the `includes` relationship removed. Prose replaced with the scope boundary. |
| `ARCHITECTURE-DIAGRAMS.md` diagrams 3, 5, 11 | Table count 25 → 23. `DT_SCHEME_ELIGIBILITY` description corrected. |
| `ARCHITECTURE-HANDOFF.md` | Contract 1 schema list and table count. |
| `COPILOT-SPEC.md` | Question type 10 re-scoped. Brief-mapping row corrected. |
| `IMPLEMENTATION-STATUS.md` | `CORE` schema table list. |
| `WINNING-PLAN.md`, `WORK-PLAN.md` | Table counts, rule note, DT description. |
| `tools/drawio/pages_data.py` | `HOUSEHOLD` entity and edge removed; `COVERAGE` attributes updated. |
| `drawio/SAARTHI-architecture.drawio` | Regenerated from the updated generator. |

### Deliberately not changed

Review and research documents are **point-in-time records**. Editing them to match a later decision destroys the audit trail that proves planning preceded development — which is itself CoCo lifecycle evidence the judges are told to look for.

| File | Why it keeps the old reference |
|---|---|
| `SCALE-REVIEW.md` F5 | The finding was correct when made. This record supersedes the recommendation, not the finding. |
| `DEEP-REVIEW-3.md` | Point-in-time review. |
| `FINAL-VALIDATION.md` | Validation snapshot against SPEC v2. |
| `DECISION-department-scope.md` | Earlier decision; its F5 note is historical context. |
| `PROBLEM-STATEMENT.md` G2 | The gap analysis is the reasoning that made this removal defensible. |
| `fhir-field-mapping.md` §8 | The unverified-mapping finding is exactly why we removed it. |
| `lived-experience-patients.md` | "Household consumption" is a health-economics term in a cited statistic — unrelated. |

---

## The scope statement that ships

This text appears in the README, in `IMPLEMENTATION-STATUS.md`, and in the UI wherever a floater coverage figure is shown:

> **Family-floater coverage is out of scope.** PM-JAY provides ₹5 lakh per family per year. SAARTHI tracks the patient-level figure only. Where a coverage record is flagged as a family floater, the system states that other members' consumption is not available to it and does not estimate the shared remaining balance. Modelling this correctly requires household membership, cross-member consumption events, and a consent basis for using one member's data to compute another's — none of which this system implements.

**Stated as a refusal, not discovered as a gap.**
