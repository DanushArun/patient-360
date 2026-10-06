# Decision Record — Department Scope

**Decided 2026-09-17. Supersedes the implicit oncology-only scoping in SPEC.md and corrects DEEP-REVIEW-3.md D9, which recommended only "one non-breast rule" — too timid.**

**REVISED same day** after grounding the decision in the three governing inputs (hackathon requirements, judging criteria, competitor positions). The first version proposed 20 rules across 5 departments at ~9 h. That over-called breadth: **Completeness 30% actively penalises unproven breadth**, and two of four competitors are already broad, so breadth is table stakes rather than differentiation. Revised to ~16 rules, ~5 h, with the freed hours redirected to extraction verification (D1). See "Derivation from the three inputs" below.

---

## ⚠️ Unresolved dependency — the rubric is unconfirmed

`plan.md:386` records that the event page states **Relevance 30 / Technical 40 / Completeness 30**, while the linked T&C document states *different dates and four different judging dimensions*. That action item — email `cococlihackgcc-support@hack2skill.com` — **has never been closed.** The verbatim problem statement is also not stored in this repo; only `plan.md`'s paraphrase.

This decision is derived from the event-page rubric. **If the T&C's four-dimension rubric governs instead, the breadth calculus may change.** Closing this is a 10-minute action with real decision value and should happen before the rule catalog is finalised.

---

## Decision

**SAARTHI is a department-agnostic patient-360 readiness engine. Oncology is the depth case, not the boundary.**

The engine, the five gates, and the five rule shapes are specialty-neutral by construction. The rule catalog makes that neutrality **visible** across four organ systems already present, plus one light addition — rather than inventing breadth.

---

## Derivation from the three governing inputs

### Input 1 — Requirements: "Patient and Member 360"

**"360" is a data-completeness requirement, not a rule-breadth requirement.** A 360 view means the record holds everything about the person: comorbidities, cross-department events, claims, coverage. It does not require authoring clinical rules for every specialty.

- Schema completeness: **mandatory**, and already satisfied — the data model is specialty-agnostic.
- Rule breadth: **a choice**, to be justified separately.

The first version of this decision conflated the two.

### Input 2 — Judging criteria (event-page rubric)

| Criterion | Weight | Effect of rule breadth |
|---|---|---|
| Technical | 40% | ≈ Zero. More rules = more rows in a catalog table, same engine. Depth properties (extraction verification, consent, real RBAC) move this substantially. |
| Real World Relevance | 30% | Mildly positive — real Indian patients carry comorbidities (diabetes ~25%, hypertension ~30%). |
| Solution Completeness | 30% | **Negative.** 20 rules with partial fixture coverage scores worse than 12 rules fully tested. |

**Net: the rubric does not support aggressive breadth.** The Completeness penalty exceeds the Relevance gain.

### Input 3 — Competitor positions

| Competitor | Breadth posture | Consequence for us |
|---|---|---|
| **CareCompass** | Cross-specialty is their *entire thesis* — 4 specialty semantic views (Endocrine, Cardio, Renal, Notes), 10 source systems, dbt medallion | Head-to-head on breadth means fighting their most-invested axis with less shipped code |
| **SynapseCortex** | Widest clinical-rule surface in the field (FDA + HEDIS + drug safety) | Breadth alone does not distinguish us |
| **Verity** | Narrow (prior auth) but tightest engineering | Depth beats breadth on the judging floor |
| **ATLAS** | Narrow (trial eligibility) but only live public URL | Shipped beats broad |

**Two of four are already broad → breadth is table stakes, not differentiation.**

What **zero** competitors have: R2 three clocks, R5+R6 together, consent, extraction verification. Typed missingness only partially (Verity 3-state, ATLAS `UNKNOWN` enum).

**But** the asymmetry that prevents pure-narrow: an oncology-only scope is a deficit visible *at a glance*, whereas our enforcement advantage requires a judge to dig into source. We cannot afford the glance-level comparison against CareCompass.

### Synthesis

**Enough breadth to neutralise the glance-level comparison. Every remaining hour into depth properties nobody has.**

---

## Why the oncology-only path loses

1. **The problem statement says "Patient and Member 360."** Not oncology 360. A system that structurally cannot hold a cardiology event fails the brief's own framing.
2. **Real patients are never single-department.** Dipali's 19 real reports span medical oncology, radiation oncology, general surgery (appendectomy for perforation, mid-chemo), endocrine/bone health (DEXA-confirmed osteopenia), and cardio-oncology (LVEF surveillance). Five departments, one patient. We documented this in `real-patient-dipali.md` and then designed for one.
3. **We already encoded multi-department reality and didn't build for it.** `ENCOUNTER.gap_type = 'clinical_complication'` exists *because* of the appendectomy — a non-oncology event that halted oncology treatment.
4. **We would cede CareCompass's strongest axis.** Our own field report calls their cross-specialty contraindication thesis "the sharpest clinical narrative in the field." Their access control is a `st.radio` picker (`streamlit/login.py`, confirmed in source). Going oncology-narrow hands them breadth uncontested; going broad lets us beat them on their own axis *with* real enforcement.

## Why "broad but shallow" also loses

SynapseCortex has the widest clinical-rule surface in the field (FDA + HEDIS + drug safety) and **confirmed zero row-level security**, with `PATIENT_360_SNAPSHOT` returning the entire dataset to any querier. Breadth without enforcement is not a differentiator — it is the failure we are attacking.

The resolution is not "pick one." It is: **generic engine, multi-department catalog, one department deep enough to be provably correct.**

---

## What was already department-agnostic (verified against schema)

- `PATIENT`, `ENCOUNTER`, `CLINICAL_EVENT`, `COVERAGE`, `AUTHORIZATION`, `DOCUMENT`, `DOC_PAGE`, `ASSERTION`, `EVIDENCE_LINK`, `REVIEW_ISSUE`, `TASK`, `ANSWER_RUN` — no oncology assumptions.
- **The 5 gates** — clinical, surveillance, documentation, coverage, identity. Every specialty asks exactly these five questions.
- **The 5 `threshold_json` shapes** — `lab_threshold`, `assessment_recency`, `assertion_completeness`, `authorization_check`, `identity_check`. A cardiology anticoagulation rule and an oncology ANC rule are the same shape with different parameters.
- **The core question** in `plan.md`: *"ready for the next step of care"* — already specialty-neutral.

Only `CLINICAL_EVENT.event_type = 'staging'` is oncology-flavoured, and it is harmless as an optional enum value.

## What drifted oncology-only

- All 13 rules in `RULE_CATALOG`
- Synthetic data: 100 single-disease patients, no comorbidities
- Demo narrative: single-disease readiness

**The engine is right. The content was narrow.** This is a content fix, not an architectural rewrite.

---

## Changes

### 1. Rule scoping columns

```
RULE_CATALOG
+ specialty      VARCHAR(50)   -- 'medical_oncology' | 'cardiology' | 'nephrology'
                               -- | 'endocrinology' | 'general_surgery' | 'ANY'
+ disease_scope  VARCHAR(100)  -- ICD-10 prefix or 'ANY'
+ specificity    INT           -- precedence: higher wins (closes D5)
```

### 2. Rule catalog — ~16 rules, four organ systems already present + one light addition

**Key finding: the existing 13 rules already span four organ systems.** We labelled them "oncology" because the patient has cancer, but they are organ-system rules:

| Existing rule | Actual specialty |
|---|---|
| `SURV-LVEF-001`, `SURV-LVEF-002` | **Cardiology** (cardio-oncology) |
| `CLIN-CRCL-001` | **Nephrology** |
| `CLIN-BILI-001` | **Hepatology** |
| `CLIN-ANC-001`, `CLIN-PLT-001`, `DOC-HER2-001`, `DOC-PATH-001`, `DOC-CONSENT-001` | Medical oncology |
| `COV-AUTH-001`, `COV-LIMIT-001`, `ID-LINK-001`, `ID-QUAR-001` | Cross-cutting (**every** specialty) |

**Adding the `specialty` column makes existing breadth visible at zero authoring cost.** This is the cheapest Relevance gain available.

| Specialty | Rules | Source | New? |
|---|---|---|---|
| Medical oncology | 5 | `clinical-thresholds.md` §1,2,6 | existing |
| Cardiology | 2 | §3 (LVEF recency + FDA decline) | existing |
| Nephrology | 1 | §4 (CrCl per agent) | existing |
| Hepatology | 1 | §5 (bilirubin/AST per agent) | existing |
| Endocrinology | 2 | HbA1c currency pre-procedure; DEXA/bone-density surveillance (Dipali osteopenia) | **new** |
| General surgery | 1 | Post-op clearance documented before resuming systemic therapy | **new** |
| Cross-cutting | 4 | Coverage ×2, identity ×2 — apply to every specialty | existing |
| **Total** | **16** | | **3 new** |

All 16 use the same 5 gates and the same 5 `threshold_json` shapes. **Zero new engine code per rule.** Genericity is demonstrated, not asserted.

The 3 new rules are chosen specifically because they are the ones the cross-department demo (§4) requires — not to inflate the count.

### 3. Synthetic data — comorbidities become mandatory

100 patients, each with 1–3 comorbidities drawn from realistic Indian prevalence (diabetes ~25%, hypertension ~30%, CKD ~10%, hypothyroidism ~10%, osteopenia post-treatment ~20%). At least 15 patients carry a **cross-department interruption event** (surgical emergency, cardiac event, infection) modelled on Dipali's appendectomy.

### 4. The flagship demo becomes cross-department

> *"She had an appendectomy three weeks ago. Is she ready to resume chemotherapy?"*

Requires simultaneously:
- **General surgery** — post-op clearance documented? wound review complete?
- **Medical oncology** — has ANC recovered? platelets?
- **Cardiology** — is the LVEF assessment still inside 90 days, or did the 6-week interruption push it stale?
- **Coverage** — is the authorisation still valid after the gap, or did it expire?

Four departments, four gates, one question, every claim cited. We did not see this Patient-360 demonstration in the competitor code we reviewed.

### 5. Positioning

| Before | After |
|---|---|
| "Oncology care-readiness copilot" | "Patient-360 care-readiness engine — department-agnostic, oncology as the depth case" |

Scope boundary stated honestly: five departments implemented, oncology deepest (8 rules, full document pipeline, real regulatory corpus), engine demonstrably extensible to any specialty using the same five shapes.

---

## What does not change

Every depth differentiator is cross-cutting and unaffected:

- **R2** three clocks — applies in every department
- **R3** typed missingness — every department
- **R5** consent + server-side scope — every department
- **Extraction verification** (two-pass on safety-critical fields, D1) — every department
- **Discordance detection** (D3) — every department
- **Answer validator** (6 checks) — every department

Depth lives in these properties, not in rule count. Adding departments does not dilute them.

---

## Cost

| Item | Effort |
|---|---|
| 3 scoping columns (`specialty`, `disease_scope`, `specificity`) | trivial |
| Label 13 existing rules by specialty | ~15 min |
| 3 additional rules (endocrine ×2, general surgery ×1) | ~1.5 h |
| Comorbidity + interruption generation in synthetic data | ~3 h |
| Cross-department demo scenario | ~2 h |
| **Total** | **~5 h** |

**4 hours freed** versus the first version of this decision. Those hours are redirected to **D1 — extraction verification** (two-pass on safety-critical fields), which is the highest-value differentiator in the entire design and which we did not find in the competitor code we reviewed.

Bought for ~5 h: satisfaction of the brief's "Patient 360" framing, neutralisation of CareCompass's strongest axis, a cross-department demo (none seen in the competitor code we reviewed), and a defensible extensibility claim — without the Completeness penalty that 20 partially-tested rules would incur.

---

## Consequence for the reviews

- **DEEP-REVIEW-3.md D9** is upgraded from "add one non-breast rule" to this decision record.
- **SCALE-REVIEW.md F5** (Member 360 / household) becomes more important, not less — a multi-department patient consumes one family floater across many specialties, so `COV-LIMIT-001` is wrong in more ways than first assessed.
- `oncology-department-map.md` (140 lines, 9-stage cycle) remains valid as the **depth-case** documentation. Lighter equivalents are needed for the other four departments — the gate structure is identical, only the clinical content differs.
