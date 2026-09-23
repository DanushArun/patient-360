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
| `frontend/contracts/answer_schema.json` + `error_shape.json` + `tool_signatures.yaml` | **built** — Contract 3 and Contract 2, verified by a passing check |
| `frontend/fixtures/` — 3 answer fixtures, 3 page fixtures | **built** — validate against the schema; char offsets generated from the page text |
| `backend/scripts/check_gate.py` — 5 mechanical checks | **built** — verified to catch injected violations, not only to pass |
| `backend/scripts/deploy.sh` — manifest-driven deploy | **partial** — parsing and dry-run tested; never run against an account |
| `backend/sql/setup.sql` — 21-step manifest | **partial** — every step present, every line commented. Deploys nothing yet. |
| `backend/sql/procedures/tools/_preamble.sql` | **designed-only** — written, **never compiled**; no `GOVERNANCE` tables exist |
| `backend/sql/prompts/` | **partial** — `pass_a_lab` and `pass_b_verify` verbatim from the spec; four type-specific prompts are `@0.x` drafts, **never run against a page** |
| `backend/skills/` — 4 `SKILL.md` | **designed-only** — frontmatter correct, bodies are scaffolds |
| `backend/tests/TEST-MANIFEST.md` — 36+ named tests | **designed-only** — named, none written |
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

## 3. Rules — 16 built + live-tested on JN89282

`SPEC.md` §4. Thresholds sourced in `research/clinical/clinical-thresholds.md`.

| Specialty | Rules | Threshold provenance | Build status |
|---|---|---|---|
| Medical oncology | 5 | NCCN/ASCO, ASCO-CAP 2018 | **built + live** — 28/28 fixture tests pass |
| Cardiology | 2 | FDA label, NCCN | **built + live** — SURV-LVEF-001 freshness-only, SURV-LVEF-002 delta rule (baseline-vs-current) |
| Nephrology | 1 | NCCN/FDA, Cockcroft-Gault | **built + live** — real Cockcroft-Gault evaluator with per-agent minima |
| Hepatology | 1 | FDA label | **built + live** — per-agent bilirubin thresholds |
| Endocrinology | 2 | CPOC 2022, NCCN v4.2024 | **built + live** — DEXA stratified T-score branch, HbA1c simple-threshold |
| General surgery | 1 | FDA label + ⚠️ practice consensus | **built + live** — 3-assertion check (wound/infection/clearance signature) |
| Cross-cutting | 4 | — | **built + live** — COV-AUTH (with letter-vs-table drift detection), COV-LIMIT, ID-LINK, ID-QUAR |

**Three thresholds carry ⚠️ and must be labelled as practice consensus wherever surfaced:** the 21-day general post-operative interval, the 42-day contaminated-wound extension, and the surgical-clearance checklist. **No guideline mandates them.** The anti-VEGF 28-day interval is the only genuinely hard post-operative gate (FDA label).

`ENDO-HBA1C-001` is `severity = 'advisory'` and **must never block** — CPOC 2022 and the Association of Anaesthetists both state cancer surgery should not be deferred for glycaemic optimisation.

---

## 4. Copilot — built + live end-to-end

`COPILOT-SPEC.md`. **Deployed and live on JN89282; the vertical slice is testable end-to-end.**

| Component | Status |
|---|---|
| `PATIENT_BINDING` + `bind_patient` — patient selection | **built + live** |
| Agent specification, 8 generic tools | **built + live** — SAARTHI_AGENT with 8 tool procedures |
| Class A/B classifier (keyword → structure → LLM → default A) | **built + live** — `classify_question.sql` |
| Answer validator, 6 checks | **built + live** — all 6 checks; Check 4 uses AI_FILTER with return_error_details=TRUE (fail-closed); Check 5 uses 1% relative-numeric tolerance |
| R7 two-pass extraction | **built** — `extract_assertions.sql` task deployed (has not yet fired live because parse_documents queue is empty) |
| Typed evidence contract, 3 kinds | **built** — structured / document_span / reference_clause |
| Conversation model — binding and `known_as_of` persist, history clears on switch | designed-only (frontend concern) |
| 10 Class B question types | **built + live** — deep-case ASK_SAARTHI returns cited answers |
| 12 named failure behaviours | **built** — `frontend/core/errors.py`, 10 tests, data-driven off `error_shape.json` |

---

## 5. Application — 6 screens

**Design system: `planning/research/design/DESIGN-SYSTEM.md`.** Grounded in three research
files in the same directory (1,526 lines) — Apple HIG fetched live, clinical UX evidence with
19 cited sources, and empirically probed Streamlit-in-Snowflake capabilities. Every token is
either traced to a source or explicitly marked as a judgment call.

| Screen | Status |
|---|---|
| Ask + Evidence ⭐ | **partial** — designed and built against fixtures. Masthead, claim ledger, persistent evidence margin, derivation trace, character-range citation highlight, Class A referral notice. **Not yet wired to the live tool procedures.** |
| Review Queue | **partial** — urgency-ordered, unowned issues flagged. Fixture-driven. |
| Patient 360 | **partial** — gate strip rebuilt to the status vocabulary. Facility timeline and discordance flags **not built**. |
| Review + History | **partial** — role restriction and idempotency demonstrable live. Fixture-driven. |
| Navigator View (4 languages) | designed-only |
| Judge Console (8 probes) | designed-only |

**All four built screens read fixtures, not Snowflake.** The backend tool procedures exist and
are live (§6), but the frontend is not yet calling them. That wiring is the remaining step, and
nothing here should be described as end-to-end until it is done.

### Design decisions worth defending

| Decision | Basis |
|---|---|
| Status is a **glyph + word + border style**, never hue | WCAG 2.2 SC 1.4.1; 4–8% of Indian males are red-green deficient. The `🟢🔴🟠⚪` emoji this replaced were **identical in greyscale**. |
| Gate failures are **quiet and specific**, not alert tiles | ~90% override rate for interruptive CDS alerts; 95.1–99.3% for the top-50 DDI alerts (Phansalkar et al., JAMIA — confirmed full text). |
| `not_evaluated` styled **neutral and dashed**, never as failure | R3. "A missing lab does not mean ANC is low — it means we do not know." |
| Evidence margin is **persistent, never a modal** | Verifying a citation requires seeing claim and source simultaneously. |
| **Tabular numerals** on every value and timestamp | Digits align for comparison, and change in place rather than jittering when `known_as_of` moves. |
| Source pages render `white-space: pre`, not wrapped | A lab report is columnar; wrapping breaks the alignment where the `GM%` / `/CUMM` / lakh-comma traps live. |
| Type scale derived from **Apple's published macOS styles** at 1pt = 4/3px | `apple-hig-primary.md` §2.4. Body lands on 17px, matching Apple's iOS Body of 17pt. |

**Inter, not SF Pro.** SF Pro is not licensed for web redistribution. "Apple typography" here
means Apple's scale and restraint, not Apple's typeface. Do not claim SF Pro anywhere.

**Apple's current principles are eight** — Purpose, Agency, Responsibility, Familiarity,
Flexibility, Simplicity, Craft, Delight (verified live, 8 June 2026). The widely-repeated
"Clarity, Deference, Depth" is **retired** and should not be cited.

### Verified by screenshot — `planning/research/design/screens/`

Captured from the running app, not mockups. `05-gate-strip-greyscale-audit.png` is the
accessibility proof: with all colour removed, all four outcomes remain unambiguous.

### Known limitations of the current UI

1. **`char_start` / `char_end` work in the fixtures but the extraction pipeline does not populate them** (§R7 defect). Against live data the citation degrades to page level. `highlight()` handles bad offsets by degrading rather than raising, and there is a test for it.
2. **The SiS runtime Streamlit version is unverified.** Local is 1.64.0. `[[theme.fontFaces]]` and `st.html` need a deploy probe before being relied on.
3. **`st.html` output is invisible to Streamlit's `AppTest`.** Rendering is therefore asserted against pure builder functions in `test_answer_render.py`; page tests cover wiring only. This is stronger than what it replaced — the old tests asserted on `st.info` panel text and would have passed with the evidence pane in the wrong colour.
4. **Indian-script typography rests on a thin evidence base.** Devanagari/Tamil/Bengali need greater line-height than Latin; the sources are W3C drafts, not clinical research. Navigator View must state this.
5. `playwright` was installed into `venv/` as a screenshot tool. It is **not** an app dependency and is deliberately absent from `requirements.txt`.

---

## 6. Snowflake objects — inventory vs reality

| Type | Designed | Built |
|---|---|---|
| Database / schemas | 1 / 7 | **1 / 7 — SAARTHI + 7 schemas live on JN89282** |
| Tables | 34 | **35 built and populated** — 34 per SPEC + `SCHEME_REGISTRY`, `PRE_AUTHORIZATION` retired 23 Sept (columns merged into `AUTHORIZATION`) |
| Stages | 3 | **3 built** — `PATIENT_DOCS`, `REFERENCE_DOCS`, `SKILLS` (all `SNOWFLAKE_SSE`) |
| Roles | 5 | **5 built** — SAARTHI_APP, SAARTHI_COORDINATOR, SAARTHI_ONCOLOGIST, SAARTHI_NAVIGATOR, SAARTHI_JUDGE |
| Row access policy | 1 | **1 built** — `patient_scope` with reference-scope OR-branch, keyed on `CURRENT_USER()` per F3 |
| Masking policies | 2 | **2 built** — `mask_direct_identifier`, `mask_dob` |
| Procedures | 11 | **18 built + live** — bind_patient, evaluate_gates (all 16 rules dispatch), classify_question, validate_answer, chunk_documents, parse_documents_proc, extract_assertions_proc, reconcile_evidence_proc, refresh_readiness_proc, notify_proc, flatten_fhir_proc, orchestrator_proc, 8 tool procs |
| Tasks | 7 | **6 of 7 built + live** — parse_documents, extract_assertions, reconcile_evidence, notify, refresh_readiness, flatten_fhir, TASK_SAARTHI_ORCHESTRATOR (the headline-bonus "task on top") |
| Dynamic Tables | 5 | **4 built + live** — DT_HARMONIZED_EVENTS, DT_REVIEW_QUEUE, DT_SCHEME_ELIGIBILITY, DT_TREATMENT_PLAN. Fifth listed as DT_DOC_CHUNK is a procedure not a DT (RAP-on-source forced synchronous population per F4) |
| Cortex Search services | 2 | **2 built + live** — PATIENT_DOC_SEARCH, REFERENCE_DOC_SEARCH (WHO + NCD guidelines, 159 chunks) |
| Semantic view + VQRs | 1 + 6 | **1 built** — SAARTHI_SEMANTIC_VIEW live |
| Agent | 1 | **1 built + live** — SAARTHI_AGENT with 8 tools |
| MCP server | 1 | 0 — DDL rejected by Snowflake (spec syntax preview-gated); file present at `backend/sql/agent/saarthi_mcp.sql` |
| Skills | 4 | **4 built** — all 4 SKILL.md files with 60+ line bodies |
| Eval datasets | 2 | **2 built** — `data/eval/dev.jsonl` (40 rows) + `data/eval/held_out.jsonl` (40 rows) per SPEC §14 (80 total, corrected from earlier "80+80=160") |

**The v2 schema is live.** All 35 tables + 4 DTs + 6 tasks + 8 tool procedures + agent + 2 search services deployed on JN89282. Cross-check via `python3 backend/scripts/check_gate.py --manifest` = PASS (32 active deploy steps).

---

## 7. Data and corpus

| Artifact | Status |
|---|---|
| Seeded fact ledger generator | **built** — `data/generator/ledger.py` (247 lines), deterministic per seed; deep-case audit 23 Sept confirmed 14 named facts land in DB (7 identifiers, 0 ABHA, 4 facilities, 6 chemo cycles, appendectomy at FAC-03, discordant HER2, DEXA osteopenia, zoledronic infusion, 4 treatment-plan versions with supersession chain) |
| 100 synthetic patients | **1 of 100 built** — deep case only. Multi-patient generation would need `ledger.py` parameterisation (deferred; row-count without variance is theatre per REMAINING-WORK.md §5 gap 11) |
| Deep case from the real record | **built + audited** — PAT-DEEP-0001 (Baseerah) live on JN89282. 14 ledger facts present + 7 additional seeded (LVEF, HbA1c, creatinine, weight, bilirubin, AST, PM-JAY coverage + AUTHORIZATION); 28/28 rule-fixture tests pass end-to-end |
| 13 corruption scenarios | **1 of 13 built** — 12 remaining are `data/generator/corruptions.py` work |
| Synthetic PDF with Indian lab traps | **built** — 1 of ~20. `GM%`, `/CUMM`, `1,50,000`, `L`/`H` flags, differential-only neutrophils |
| Reference corpus Tier 1 | **built + live** — WHO diabetes guideline (72 pages) + NCD treatment guidelines (87 pages) = 159 chunks in `REFERENCE_DOC_SEARCH`; cited answers verified via ASK_SAARTHI |
| 80 rule fixtures | **built + live-tested** — `data/fixtures/rules/rule_fixtures.yaml`, 16 rules × 5 scenarios; `backend/scripts/run_rule_fixtures.py` runs 3-stage harness (structural + deep-case + scratch-patient), 28/28 PASS on JN89282 |
| 80 questions (40 dev + 40 held-out) eval | **built** — `data/eval/dev.jsonl` + `data/eval/held_out.jsonl`. Covers Class A refusals, gate outcomes, missing/pending/superseded/unreadable, reference lookups, Hindi/Marathi/Bangla/Tamil, prompt-injection resistance |
| FHIR R4 bundles | **task built** — `flatten_fhir_proc` deployed; `RAW_FHIR_BUNDLE` empty pending multi-patient generation. Task idles cleanly on empty input |

---

## 8. CoCo lifecycle evidence

The brief requires evidence at **every** phase.

| Phase | Status |
|---|---|
| **Planning** | **complete** — 52 sessions, 26 single-question research sessions, banked in `evidence/coco/planning.yaml` (382 lines) |
| **Development** | **complete** — `evidence/coco/development.yaml` (145 lines), 3 stages spanning Danush's Days 1–5 scaffolding + Daksha's JN89282 deploy and extensions; every file_change carries a `verified_on: JN89282` entry |
| **Execution** | **complete** — `evidence/coco/execution.yaml` (222 lines), 5 stages covering the full vertical-slice deploy; 6 recorded failure-and-fix pairs including AUTHORIZATION consolidation (23 Sept) |
| **Testing and validation** | **partial** — 10 platform behaviours verified with query IDs; **6 failure-and-fix pairs recorded** across the four phases; 28 live rule-fixture tests pass |

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
