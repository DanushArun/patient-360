# Deep Review 3 — Safety, Federation, Extensibility

**Reviewed 2026-09-17. Third pass. SPEC-REVIEW.md found 21 component issues. SCALE-REVIEW.md found 15 structural gaps. This pass examines three dimensions neither touched: (1) patient safety of the AI extraction layer, (2) the centralised-vs-federated contradiction, (3) extensibility beyond a single cancer type. Plus the question taxonomy and the honesty artifact.**

**Verdict: 14 further issues. 3 are the most dangerous findings across all three reviews.**

---

## PART 1 — PATIENT SAFETY OF THE AI LAYER (the deepest gap in the whole design)

### D1. The validator validates the wrong thing — FATAL

This is the most important finding across all three reviews.

`SPEC.md` §3 validates **claim ↔ evidence consistency**. It does not validate **evidence ↔ reality consistency**.

Concretely: `AI_PARSE_DOCUMENT` reads a rotated WhatsApp photo of a CBC and extracts `ANC = 1200`. The true value on the page is `2100`. The extraction is wrong. An `ASSERTION` row is created with value 1200.

The LLM then says *"ANC is 1200/µL, below the 1500 threshold."* The validator runs all 5 checks:
- Check 1 (existence) — evidence exists. **PASS**
- Check 2 (scope) — right patient. **PASS**
- Check 3 (version) — within `known_as_of`. **PASS**
- Check 4 (polarity) — passage supports the claim. **PASS**
- Check 5 (type match) — claim says 1200, evidence says 1200. **PASS**

**All 5 checks pass. The answer is perfectly cited and clinically wrong.** The patient's cycle is delayed for no reason, or worse, the inverse error lets an unsafe cycle proceed.

Our entire safety story — five checks, citations, R1 — is built on the assumption that the extracted assertion is correct. Nothing in the architecture verifies that assumption. `ASSERTION` has `extractor_version` but **no confidence score, no image-quality flag, no second-pass verification, and no human-review trigger for safety-critical fields.**

This matters more for us than for any competitor because we make the strongest safety claims. `evidence-why-citations.md` documents 3–18% hallucination rates in AI clinical summaries — we cited that research to justify citations, then built a validator that cannot catch the error class the research describes.

**Required — a three-part fix:**

1. **`ASSERTION.extraction_confidence FLOAT` + `ASSERTION.source_quality VARCHAR`** — source_quality ∈ `clean_pdf | scanned | photo | rotated_photo | handwritten`. Derived at parse time. Dipali's reports included fully inverted pages; this is the norm, not an edge case.

2. **Two-pass verification on safety-critical fields.** A defined critical set (`ANC`, `platelets`, `creatinine`, `bilirubin`, `HER2_IHC`, `HER2_FISH`, `LVEF`, `grade`, `stage`, drug doses) is extracted **twice** — different prompt, and where possible a different model. Agreement → `verified`. Disagreement → `missingness_state = 'conflicting'` and the gate returns `not_evaluated`, never a number. This is the assertion-level analog of Verity's two-stage retrieval, applied to extraction instead of retrieval.

3. **Check 6 in the validator — assertion trustworthiness.** A claim resting on an assertion with `extraction_confidence` below threshold, or `source_quality = 'rotated_photo'`, or unverified two-pass status, is downgraded: the value is not asserted, and the answer states *"a value was read from a low-quality image and has not been verified — confirm against the original report."*

**This single addition is stronger differentiation than anything else in the architecture.** We did not find extraction verification in the competitor code we reviewed. It converts our safety claim from "we cite our sources" to "we know when our sources are unreliable and we say so."

---

### D2. Unit normalisation has no verification — a silent 88× error is possible

`lab-reporting-india.md` and `real-patient-dipali.md` document the trap in detail: haemoglobin as `10.3 GM%`, `10.7 L gm/dl`, `12.0 g/dL`; platelets as `228000 /CUMM` with reference `1,50,000-4,50,000`; creatinine as `0.71 mg%` and `0.68 mg/dL`.

`CLINICAL_EVENT` correctly preserves `original_value` / `original_unit`. But **nothing validates that the normalisation was correct.** There is no unit-conversion registry, no plausibility range check, and no reconciliation of normalised value against the source reference range printed on the report.

The concrete danger: creatinine in mg/dL vs µmol/L differs by a factor of 88.4. Cockcroft-Gault CrCl is inversely proportional to creatinine. A missed conversion turns CrCl 60 into CrCl 0.68 — or a contraindication into a green light.

**Required:**
- `UNIT_REGISTRY(analyte_code, canonical_unit, source_unit_pattern, conversion_factor, plausible_min, plausible_max)`
- Post-normalisation plausibility gate: a normalised value outside `plausible_min..plausible_max` is **rejected**, not stored — `missingness_state = 'unreadable'`.
- Where the report prints its own reference range, compare it against the registry's expected range for that unit. Mismatch → flag. This catches the "the lab reports in a unit we didn't expect" case using evidence already on the page.

---

### D3. Reconciliation cannot distinguish discordance from disagreement

`SPEC.md` §4.1 matches assertions to clinical events by `(subject, predicate, specimen_id/accession_id)`.

Dipali's actual records break this:
- Outside lab, biopsy `R20287/24`: Grade **II**, HER2 IHC **1+**
- CMC Vellore, surgical specimen `R21369/24`: Grade **III**, HER2 IHC **2+**

Different accession IDs, so the matching key never collides — **no conflict is detected.** But we *want* this surfaced. `real-patient-dipali.md` §2 is explicit about the consequence: with only the outside result, HER2 reads negative, no FISH is ordered, and the patient is mis-stratified. The CMC re-test caught it.

The system must express a third relation that the current model cannot: **"same patient, same biomarker, different specimen, different result — both valid, clinically significant, requires clinician awareness."** That is neither a match nor an error. `real-patient-dipali.md` design correction #1 says exactly this, and `EVIDENCE_LINK.relation` (`supports | conflicts_with | supersedes`) has no value for it.

**Required:**
- `EVIDENCE_LINK.relation` gains `discordant_across_specimens`.
- Reconciliation adds a second matching pass on `(patient_id, subject, predicate)` **ignoring specimen**, comparing results across specimens, emitting discordance links.
- A rule — `DOC-DISCORD-001` — surfaces biomarker discordance as an advisory with both values, both specimens, both labs, and both dates. Never auto-resolved to the newer value.

This is a demo beat drawn directly from a real patient's records, and it is a failure mode not found in the competitor code we reviewed.

---

### D4. No fixture tests for the rule engine

13 rules produce gate outcomes that gate patient treatment. There is no specified test suite. A single inverted comparison operator (`>=` for `<=`) silently reverses a clinical gate.

**Required**: per-rule fixtures — for each of the 13 rules, a table of `(inputs, expected_outcome, expected_reason)` covering pass, fail, boundary (exactly at threshold), missing-input (`not_evaluated`), and conflicting-input cases. 13 rules × 5 cases = 65 assertions, executable as SQL. This is also strong CoCo *Testing-phase* lifecycle evidence — a category our research says most competitors miss entirely.

---

### D5. No rule precedence model

`RULE_CATALOG.applies_to` allows a regimen-specific override (`ANC >= 1000` for weekly paclitaxel per `clinical-thresholds.md` §1). But if both `CLIN-ANC-001` (`>= 1500`, applies_to `ALL`) and a regimen override are active, which wins? Undefined. Both would fire, producing contradictory gate outcomes for the same patient.

**Required**: `RULE_CATALOG.specificity INT` (higher wins) and a documented resolution rule — the most specific matching rule for a given patient/regimen suppresses more general ones for the same `(gate, analyte)` pair.

---

### D6. No validity-interval model — every rule reinvents its own clock

R2 gives three *timestamps*. But the rules actually need *intervals*: labs valid 72h, LVEF valid 90 days, authorisation valid until a date, consent valid for a window.

Each rule currently hardcodes its own window inside `threshold_json`. With 13 rules that is tolerable; across specialties it becomes unmanageable and inconsistent. And when an encounter is rescheduled (S1), every hardcoded window must be re-derived independently.

**Required**: an explicit `valid_from` / `valid_until` concept on evidence, computed at ingestion from the analyte's validity policy, so "is this evidence still valid at the planned encounter time?" is one uniform comparison rather than 13 bespoke ones.

---

## PART 2 — THE CENTRALISED-VS-FEDERATED CONTRADICTION

### D7. The architecture contradicts its own founding rationale — must be resolved explicitly

The framing is "a centralised DB with each patient's record." But `plan.md` R4's justification for rejecting fuzzy matching says the opposite:

> *"ABDM's real architecture is federated-with-consent with no central data lake, so a central merge would be factually wrong about India."*

So: R4 is justified on the grounds that India is federated, while the implementation is a single central `SAARTHI` database holding every patient's clinical content. A judge who knows ABDM will find this immediately, and it undermines the credibility of our strongest identity argument.

**This is resolvable, and resolving it well is a scoring win.** The correct position is a **centralised evidence index over federated source data**:

| Layer | Where it lives | What it holds |
|---|---|---|
| Source clinical data | At the facility (HIP) | The authoritative record |
| Evidence index | Central (Saarthi) | Assertions, pointers, hashes, gate state, consent state — **not** the source-of-truth payload |
| Retrieval | Consent-mediated | Content fetched under a valid consent, cached only for the consent window |

This is exactly what ABDM's HIP/HIU model describes, it makes `CONSENT` (F1) load-bearing rather than decorative, and it makes `DERIVED_ARTIFACT` retention (K1) necessary rather than optional. Our `ANSWER_RUN` "pointers not content" decision — made for DPDP erasure reasons — turns out to be the same shape. That is a genuinely strong architectural story.

For the hackathon we still deploy one database. But the schema must mark which tables are *index* and which are *cached federated content*, with a stated cache lifetime tied to consent. Honest, defensible, and directly aligned with the national architecture.

---

### D8. No evidence packet — the deliverable of every Class A refusal is undefined

`plan.md` §1.2: Class A questions are *"routed to the treating team with the evidence packet attached."* Nowhere is the evidence packet defined.

It is the actual output of a refusal — the most safety-critical path in the system — and it has no object, no format, and no delivery mechanism.

**Required**: `EVIDENCE_PACKET(packet_id, patient_id, question, created_by, created_at, evidence_ids[], gate_snapshot VARIANT, consent_id, delivered_to_practitioner_id, delivered_at, format)`. Rendered as a citable document. This is what a doctor actually receives, and it is what makes the refusal useful rather than obstructive.

---

## PART 3 — EXTENSIBILITY AND SCOPE HONESTY

### D9. All 13 rules are HER2+ breast cancer — no disease-level scoping exists

`RULE_CATALOG` scopes by `applies_to` (regimen). There is no disease or specialty dimension. A pan-India multi-hospital system encounters lung, cervical, head-and-neck, and haematological cancers on day one, and eventually non-oncology specialties.

The good news, on inspection: the five `threshold_json` shapes — `lab_threshold`, `assessment_recency`, `assertion_completeness`, `authorization_check`, `identity_check` — are **genuinely generic**. That is a real strength of the design and we never claimed it.

**Required:**
- `RULE_CATALOG.disease_scope` and `specialty_scope` columns.
- **Prove extensibility by adding one non-breast rule** — e.g. cisplatin CrCl ≥ 60 for a head-and-neck regimen (thresholds already in `clinical-thresholds.md` §4). One rule, different disease, same engine, zero code change. That converts "extensible" from an assertion into a demonstration.
- State the scope boundary explicitly: oncology care-readiness, HER2+ breast cancer as the depth case, one second disease as the breadth proof.

### D10. The Class B question taxonomy is not enumerated — the agent will hit dead ends

We have 6 demo questions and a Class A/B split. But *within* Class B, no taxonomy exists, so there is no guarantee every question type has a tool path. Enumerating it:

| Class B sub-type | Example | Tool | Covered? |
|---|---|---|---|
| Status lookup | "What's her latest ANC?" | `get_patient_facts` | Yes |
| Gap identification | "What's missing for cycle 4?" | `get_readiness` | Yes |
| Conflict detection | "Does anything contradict?" | `get_readiness` | Partly — needs discordance (D3) |
| Timeline reconstruction | "When did the FISH result arrive?" | — | **No tool** |
| Document lookup | "What does the pathology report say about grade?" | `search_patient_documents` | Yes |
| Regulatory lookup | "What does PM-JAY require?" | `search_reference_documents` | Yes |
| Cohort filtering | "Which patients lack a final report?" | `cohort_query` | Yes |
| Change detection | "What changed since 09:00?" | — | **No tool** (M4) |
| Cross-facility provenance | "Which hospital sent this?" | — | **No tool** |
| Coverage utilisation | "How much of the ₹5 lakh is left?" | — | **No tool** (needs F5 household) |

**Four question types have no tool path.** The agent will either refuse a legitimate Class B question or hallucinate. Timeline reconstruction and change detection are both *demo questions* (Q3 is literally "what changed since 09:00").

**Required**: `get_timeline(patient_id, known_as_of)` and `get_changes(patient_id, from_ts, to_ts)` as tools 7 and 8; provenance and utilisation folded into `get_patient_facts` domains.

### D11. No load or concurrency analysis

15s p95 is stated for a single query. No analysis of 50 concurrent coordinators against Cortex Search's documented **20 QPS/service, 140 QPS/account**, warehouse queueing, or the per-claim `AI_FILTER` fan-out (3 claims × 2 polarity calls = 6 model calls per answer). At any realistic concurrency the AI_FILTER fan-out alone becomes the bottleneck.

**Required**: a stated concurrency budget, `AI_FILTER` batching (one call over a set of passages rather than per-passage), and a cache keyed on `(claim_hash, evidence_id)` since polarity for a given claim/evidence pair never changes.

### D12. No built-vs-designed artifact — the exact dishonesty we attack competitors for

We will design ~31 tables and build fewer. Our own field report condemns competitors for claiming enforcement their source doesn't implement (CareCompass's `st.radio`, SynapseCortex's absent RLS). If our README implies 31 tables of working system, we commit the same offence.

**Required**: `IMPLEMENTATION-STATUS.md` — every component marked `built | partial | designed-only`, with the reason. This is a *credibility asset*, not an admission. Judges trust a team that states its limits precisely.

### D13. No facility onboarding flow

At scale, how does facility #501 join? Registry entry, source-system config, consent templates, practitioner provisioning, historical backfill, verification. Unspecified. Needs to be a documented sequence even if not built.

### D14. "Recommend" — our recommendation surface is thinner than it should be

The system correctly refuses clinical recommendations (Class A, NMC-grounded). But it *does* recommend: documentation actions, coverage actions, scheme applications, referral packets. That surface is currently thin — mostly `REVIEW_ISSUE` rows.

Given "recommend based on the medical professional's queries" is the expectation, the non-clinical recommendation surface should be explicit and rich: a bring-list per referral, a scheme application recommendation when the PM-JAY ceiling is projected to exhaust, a suggested pre-auth resubmission when a denial reason is procedurally curable (`insurance-irdai-nhcx.md` §4: **60–70% of denials are knowable pre-admission**), a next-action for every open gate failure with a named owner.

That is a lot of genuine, legally safe recommendation value that the architecture currently under-delivers — and it directly serves the ₹30,000 cr repudiation narrative.

---

## CONSOLIDATED: all three reviews

| Review | Focus | Issues | Fatal |
|---|---|---|---|
| SPEC-REVIEW.md | Component correctness | 21 | 7 |
| SCALE-REVIEW.md | Multi-facility / pan-India shape | 15 | 6 |
| DEEP-REVIEW-3.md | Safety, federation, extensibility | 14 | 3 |
| **Total** | | **50** | **16** |

### The 5 that decide whether we win

1. **D1 — extraction verification.** Our safety story currently cannot catch a wrong extracted value. Fixing it is the strongest differentiator in the entire design; not found in the competitor code we reviewed.
2. **F1 — consent, enforced at query time.** Legally mandatory, uniquely Indian, not found in the competitor code we reviewed, demoable in 30 seconds.
3. **C1 / F2 — real identity and access.** `CURRENT_USER()` in container runtime returns the app owner. Until this is fixed, our security claim is exactly as cosmetic as CareCompass's role picker — the flaw we built the pitch around attacking.
4. **D7 — federated index positioning.** Resolves a self-contradiction a knowledgeable judge will find, and converts it into the strongest architectural narrative available.
5. **D3 — biomarker discordance.** Straight from Dipali's real reports, modelled by nobody, and the most vivid clinical failure we can demonstrate.

### The recurring root cause

Across all three reviews, the same pattern: **the research is right and the architecture didn't absorb it.**

Consent, the FHIR mapping, the family floater, the `conflicting` status, retention clocks, the model-risk register, extraction quality on rotated photos, unit-conversion traps, specimen-level discordance, the 60–70% curable-denial statistic — all documented in `docs/research/` with citations, none carried into SPEC.md.

The fix is not more research. It is a rewrite of SPEC.md that treats every research file as a checklist to be closed out, with a traceability matrix proving each finding landed in a specific object.
