# SAARTHI — Implementation Status

**Every component, marked honestly. Updated as the build progresses.**

`AGENTS.md` §4 mandates this file. Judges spend 5–22 October alone with this repository, and Solution Completeness is 30% of the score. **A claim in the README that is not demonstrable here is a defect.**

| Status | Meaning |
|---|---|
| **built** | Deployed, exercised by a passing test, reproducible from `setup.sql` on a clean account |
| **partial** | Works for the demo path; named limitations below |
| **designed-only** | Specified in the architecture, not built. **Not claimed anywhere as working.** |
| **verified** | Empirically tested against the live account, query ID recorded |
| **refused** | Deliberately not built. Reason stated. |

**Last updated: 20 Sept 2026 — architecture complete; Day-1 scaffold and frozen contracts built, nothing deployed.**

---

## Summary as of 20 Sept 2026

| Phase | State |
|---|---|
| Research | **complete** — 26 files, 19 real reports studied, 10 platform behaviours verified |
| Architecture | **complete** — 7 specification documents, 15 diagrams in 2 renderings, 0 unresolved contradictions |
| Build | **scaffold only** — repository structure, frozen contracts and build gate exist. **No Snowflake object has been created from `setup.sql`.** |

**Nothing in the Build column below is claimed as working. That is the point of this file.**

### Day-1 scaffold — what exists in the repository, and what that does not mean

Structure and contracts are not a deployed system. Marked separately so the distinction survives.

| Artifact | Status |
|---|---|
| `app/contracts/answer_schema.json` + `error_shape.json` + `tool_signatures.yaml` | **built** — Contract 3 and Contract 2, verified by a passing check |
| `app/fixtures/` — 3 answer fixtures, 3 page fixtures | **built** — validate against the schema; char offsets generated from the page text |
| `scripts/check_gate.py` — 5 mechanical checks | **built** — verified to catch injected violations, not only to pass |
| `scripts/deploy.sh` — manifest-driven deploy | **partial** — parsing and dry-run tested; never run against an account |
| `sql/setup.sql` — 21-step manifest | **partial** — every step present, every line commented. Deploys nothing yet. |
| `sql/procedures/tools/_preamble.sql` | **designed-only** — written, **never compiled**; no `GOVERNANCE` tables exist |
| `sql/prompts/` | **partial** — `pass_a_lab` and `pass_b_verify` verbatim from the spec; four type-specific prompts are `@0.x` drafts, **never run against a page** |
| `skills/` — 4 `SKILL.md` | **designed-only** — frontmatter correct, bodies are scaffolds |
| `tests/TEST-MANIFEST.md` — 36+ named tests | **designed-only** — named, none written |
| Everything below this section | unchanged — **designed-only** |

**A draft prompt must not run in a scored evaluation.** A number produced by an unreviewed extractor is not a measurement.

---

## 1. Platform behaviour — verified

Query IDs in `evidence/coco/verification-query-ids.md`. These are findings, not features, and they decided the architecture.

| ID | Finding | Status |
|---|---|---|
| F1 | `AGENT_RUN(VARCHAR)`, `DATA_AGENT_RUN` exist → container runtime optional | **verified** |
| F2 | Row access policies filter strictly, including `ACCOUNTADMIN` | **verified** |
| **F3** | **`CURRENT_USER()` survives owner's-rights elevation; `CURRENT_ROLE()` does not** | **verified — architecture-deciding** |
| F4 | Cortex Search cannot be created over a RAP-protected table | **verified** |
| **F5** | **Cortex Search ignores row access policies — returned another patient's text** | **verified** |
| F6 | `@eq` attribute filter works | **verified** |
| **F7** | **Secondary roles defeat a `USAGE`-based control** | **verified** |
| F8 | `AI_FILTER` text form takes one argument | **verified** |
| F9 | Stages used by AI functions must be `SNOWFLAKE_SSE` | **verified** |
| F10 | Budget: $386.10 of $399.02 remaining on the primary account | **verified** |
| **A1** | **The agent derives `patient_id` from question text and injects the filter itself** | **verified — architecture-deciding** |

| ID | Unverified | Owner | Blocking? |
|---|---|---|---|
| U1 | `AI_PARSE_DOCUMENT` per-page cost | Stream C, Day 1 | Blocks Tier 2 corpus commitment |
| U2 | `CURRENT_USER()` inside deployed Streamlit container runtime | Stream B, Day 1 | Fallback exists (F3, F7) |
| U3 | `CREATE STREAMLIT … COMPUTE_POOL` on trial | Stream B, Day 1 | Warehouse runtime works regardless (F1) |

---

## 2. Data model — 34 built, 7 designed-only

Specified in `SPEC.md` §2. **All currently designed-only; none created yet.**

| Schema | Tables | Status |
|---|---|---|
| `GOVERNANCE` (8) | ORGANIZATION · FACILITY · DEPARTMENT · PRACTITIONER · CARE_TEAM · **PATIENT_BINDING** · CONSENT · SECURITY_EVENT | designed-only |
| `CORE` (8) | PATIENT · ID_MAP · REFERRAL · ENCOUNTER · CLINICAL_EVENT · TREATMENT_PLAN · COVERAGE · AUTHORIZATION | designed-only |
| `DOCUMENTS` (4) | DOCUMENT · DOC_PAGE · DOC_CHUNK · RAW_FHIR_BUNDLE | designed-only |
| `EVIDENCE` (4) | ASSERTION · EVIDENCE_LINK · ANSWER_RUN · EVIDENCE_PACKET | designed-only |
| `OPERATIONAL` (10) | CLINICAL_ONTOLOGY · UNIT_REGISTRY · RULE_CATALOG · REVIEW_ISSUE · REVIEW_TASK · READINESS_STATE · SCHEME_REGISTRY · NOTIFICATION · SOURCE_SYSTEM · INGESTION_RUN | designed-only |

**34 tables marked `[B]` in `SPEC.md` §2. This list is generated from those markings and must stay equal to them.**

**7 designed-only, and they carry no `[B]` marking** — listed in `SPEC.md` §2 "Designed-only": `DERIVED_ARTIFACT` (retention purge for embeddings/caches), `CONSENT_ARTIFACT` (signed document store), `FHIR_MAPPING` (declarative path config), per-region search shards, `FACILITY_ONBOARDING`, `MODEL_RISK_REGISTER` as a table (ships as a markdown deliverable instead), `AUDIT_EXPORT`. **41 declared in total.**

**`HOUSEHOLD` and `HOUSEHOLD_MEMBER` were removed, not deferred** — family-floater coverage is out of scope by decision. See `DECISION-household-removal.md`.

**Created during platform verification and deliberately retained** in `SAARTHI.GOVERNANCE` as judge evidence: `ROLE_PATIENT_MAP` (precursor to `CARE_TEAM`), `R5_TEST_EVIDENCE`, `R5_TEST_CHUNK`, `R5_TEST_SEARCH`, `probe_owner_rights`, `probe_diff_owner`, `R5_OWNER_ROLE`, `TEST_AGENT`. **These are test scaffolding, not the system.**

---

## 3. Rules — 16 designed, 0 built

`SPEC.md` §4. Thresholds sourced in `research/clinical/clinical-thresholds.md`.

| Specialty | Rules | Threshold provenance | Build status |
|---|---|---|---|
| Medical oncology | 5 | NCCN/ASCO, ASCO-CAP 2018 | designed-only |
| Cardiology | 2 | FDA label, NCCN | designed-only |
| Nephrology | 1 | NCCN/FDA, Cockcroft-Gault | designed-only |
| Hepatology | 1 | FDA label | designed-only |
| Endocrinology | 2 | CPOC 2022, NCCN v4.2024 | designed-only |
| General surgery | 1 | FDA label + ⚠️ practice consensus | designed-only |
| Cross-cutting | 4 | — | designed-only |

**Three thresholds carry ⚠️ and must be labelled as practice consensus wherever surfaced:** the 21-day general post-operative interval, the 42-day contaminated-wound extension, and the surgical-clearance checklist. **No guideline mandates them.** The anti-VEGF 28-day interval is the only genuinely hard post-operative gate (FDA label).

`ENDO-HBA1C-001` is `severity = 'advisory'` and **must never block** — CPOC 2022 and the Association of Anaesthetists both state cancer surgery should not be deferred for glycaemic optimisation.

---

## 4. Copilot — designed-only

`COPILOT-SPEC.md`. **This is the deliverable; nothing is built yet.**

| Component | Status |
|---|---|
| `PATIENT_BINDING` + `bind_patient` — patient selection | designed-only. **Day-1 critical: the vertical slice cannot cite an answer without it** |
| Agent specification, 8 generic tools | designed-only |
| Class A/B classifier (keyword → structure → LLM → default A) | designed-only |
| Answer validator, 6 checks | designed-only |
| R7 two-pass extraction | designed-only |
| Typed evidence contract, 3 kinds | designed-only |
| Conversation model — binding and `known_as_of` persist, history clears on switch | designed-only |
| 10 Class B question types | designed-only |
| 11 named failure behaviours | designed-only |

---

## 5. Application — 6 screens, 0 built

| Screen | Status |
|---|---|
| Ask + Evidence ⭐ | designed-only |
| Review Queue | designed-only |
| Patient 360 | designed-only |
| Review + History | designed-only |
| Navigator View (4 languages) | designed-only |
| Judge Console (8 probes) | designed-only |

---

## 6. Snowflake objects — inventory vs reality

| Type | Designed | Built |
|---|---|---|
| Database / schemas | 1 / 7 | **1 / 6** — partial, created during verification |
| Tables | 34 | **5** — PATIENT, ID_MAP, ENCOUNTER, CLINICAL_EVENT, COVERAGE (early skeleton, pre-v2) |
| Stages | 3 | **1** — `PATIENT_DOCS`, `SNOWFLAKE_SSE` |
| Roles | 5 | 0 |
| Row access policy | 1 | 0 — **test policies only, on scaffolding tables** |
| Masking policies | 2 | 0 |
| Procedures | 11 | 0 |
| Tasks | 7 | 0 |
| Dynamic Tables | 5 | 0 |
| Cortex Search services | 2 | **1** — `R5_TEST_SEARCH`, test scaffolding only |
| Semantic view + VQRs | 1 + 6 | 0 |
| Agent | 1 | **1** — `TEST_AGENT`, used to discover A1. Not the product agent |
| MCP server | 1 | 0 |
| Skills | 4 | 0 |
| Eval datasets | 2 | 0 |

**The 5 existing tables predate the v2 architecture and will be replaced by `setup.sql`.** They are not the schema in Contract 1.

---

## 7. Data and corpus

| Artifact | Status |
|---|---|
| Seeded fact ledger generator | **partial** — `data/generator/generate_patients.py` exists, pre-v2 |
| 100 synthetic patients | designed-only |
| Deep case from the real record | designed-only |
| 13 corruption scenarios | designed-only |
| Synthetic PDF with Indian lab traps | **built** — 1 of ~20. `GM%`, `/CUMM`, `1,50,000`, `L`/`H` flags, differential-only neutrophils |
| Reference corpus Tier 1 | **not started** — `data/reference/` does not exist |
| 80 rule fixtures | designed-only |
| 80 dev + 80 held-out eval questions | designed-only |
| FHIR R4 bundles | designed-only — field mapping complete (`fhir-field-mapping.md`, 462 lines) |

---

## 8. CoCo lifecycle evidence

The brief requires evidence at **every** phase.

| Phase | Status |
|---|---|
| **Planning** | **complete** — 52 sessions, 26 single-question research sessions, banked in `evidence/coco/planning.yaml` (382 lines) |
| **Development** | not started |
| **Execution** | not started |
| **Testing and validation** | **partial** — 10 platform behaviours verified with query IDs; **4 failure-and-fix pairs recorded**, including four consecutive `AI_FILTER` syntax failures resolved by reading the docs |

**Failure-and-fix pairs are retained deliberately.** They are the most credible lifecycle evidence available and are not curated out.

---

## 9. Refused, with reasons

| Refused | Reason |
|---|---|
| Cortex ML and any trained predictive model | Brief: *"never opaque predictions."* Risk stratification is versioned SQL. |
| Clinical decision support | NMC TPG 2020 — a legal boundary. Class A refused for every role, including the treating oncologist. |
| Confidence percentages | A percentage invites a clinical decision; an evidence state invites a human to look. |
| Search sharding beyond 400M chunks | Documented in `SCALE-REVIEW.md`; out of scope at 100 patients. |
| FRAX fracture-risk scoring | Requires inputs we do not model. The T-score gate is the tractable one. |
| Real patient data in the system | 19 real reports informed **format research only**. Consent held; the patient's son is on the team. |

---

## 10. Known limitations to state in the submission

Written now so they are not forgotten under deadline pressure.

1. **Engineering gates on synthetic tests are not clinical validation.** No rule here has been validated against real patient outcomes.
2. **Three thresholds are practice consensus, not guideline requirements.** Labelled ⚠️ in §3 and in the UI.
3. **Five NRCeS ABDM FHIR profile claims are unverified** — flagged in `fhir-field-mapping.md` §12. Base-FHIR paths are standard and stable.
4. **`ACCESS_HISTORY` lags up to 180 minutes.** Live probes use `QUERY_HISTORY`; the written pack uses `ACCESS_HISTORY`. Each is labelled.
5. **Competitor comparisons cite public source file and line.** Where we infer from an absence, we say so.
6. **100 patients, not population scale.** Sharding and event-driven recomputation are documented, not built.
