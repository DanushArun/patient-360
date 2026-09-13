# SAARTHI — Care Readiness & Evidence Copilot
### Snowflake CoCo CLI Hackathon 2026 (GCC Edition) · Problem Statement 04

---

## 0. Context

**Why this is being built.** A teammate's mother is under active treatment for breast cancer, travelling to another city for every review and every cycle. That journey is not an anecdote — it is the statistical norm in Indian oncology, and the published evidence says the thing that breaks is not the medicine. It is the record.

| Finding | Figure | Source |
|---|---|---|
| Tata Memorial patients from outside Mumbai | ~85% (≈60% from other states) | TMC director, ThinkGlobalHealth |
| Cancer patients with catastrophic **non-medical** expenditure | 83.2% | IIPS–TMC study |
| Distress financing (asset sale / borrowing), >500 km travel | 52.8% | IIPS–TMC study |
| Breast cancer cohort (n=500, TMC): catastrophic spend / distress financing | 84.2% / 72.4% | PMC11265332 |
| Breast cancer patients consulting ≥2 facilities | 74% | PMC12374521 |
| Breast cancer patients facing a delay somewhere in the pathway | 82.6% | PMC12374521 |
| Delayed chemotherapy initiation | 32% | PMC12374521 |
| Missed chemo appointments (870 visits, Indian tertiary centre) | 14%, median delay 13.75 days | Cancer Reports 2020 |
| Reasons for those missed cycles | family illness 52.5%, financial 27.5%, transport 10% | Cancer Reports 2020 |
| Health insurance claims repudiated, FY25 | 8% of 3.26 cr claims = **₹30,000 cr** | IRDAI Annual Report 2024–25 |
| Denial reasons knowable *before* admission | ~70% | third-party analysis of IRDAI FY24 data |

**Not one of those failures is a diagnostic failure.** Every one is a record-state or coverage-state failure: a report that did not travel, an authorisation that was never confirmed, a document the family did not know to carry, a cycle missed for money or transport. That is precisely the intersection the challenge brief names — siloed EHR + claims + dense unstructured documents.

**Intended outcome.** One question, answered with inspectable evidence, every 21 days, for every patient on the list:

> **"Is this patient ready for the next step of care — clinically, documentationally, and financially — and exactly what is missing?"**

---

## 1. The two framing decisions, and why

### 1.1 This is a clinician/coordinator system with a derived family surface. It is not a patient chatbot.

**Why not patient-facing as the primary product?** Because it would be illegal in India. The **NMC Telemedicine Practice Guidelines 2020** prohibit AI/ML platforms from counselling patients or prescribing; the RMP must communicate directly and remains solely accountable. A patient-facing system that answers clinical questions from a record is either useless (constant refusal) or unlawful.

**Why then include a family surface at all?** Three interrogations:

1. *Why not clinician-only — isn't the family view decoration?*
   No, because in India **the family is a data-supplying actor, not an audience.** The records physically travel in a plastic folder and in phone photographs (Navya's own intake workflow requires patients to upload phone photos of reports). A system that models the Indian record flow and omits its actual custodian is modelling a hospital that does not exist here.
2. *Why does it earn its place against the 40% technical weighting?*
   Because it is **not a second app and not a second model call.** It is a role-scoped, read-only projection of state the coordinator has already reviewed. Cost: roughly half a day.
3. *Why is it technical evidence rather than a nice screen?*
   Because asking the **same question under the `family` role must return strictly less** than under the `coordinator` role, and must refuse clinical-judgment questions outright. That is a live, judge-challengeable demonstration of the authorisation layer — the single hardest property to fake in this architecture. It converts a UX screen into a security proof.

**Decision: include it, as a role inside the one app.** It renders only coordinator-reviewed issues. It never renders raw model output. It carries a standing "your treating team decides" notice. It is cut item #1 if the schedule slips.

### 1.2 Questions are split by class, not by user.

| Class | Example | System behaviour |
|---|---|---|
| **A — clinical judgment** | "Is this the right regimen?" "Should the dose change?" "Is she in danger?" | **Always refused, for every role.** Routed to the treating team with the evidence packet attached. |
| **B — record & coverage state** | "What do we have? What's missing? What contradicts what? What's expired? What isn't authorised?" | Answered deterministically, with citations. |

**Why this split rather than a confidence threshold?** Because a confidence score on a clinical question is exactly the "opaque prediction" the brief forbids, and because Class B has ground truth you can be measurably right or wrong about, while Class A does not. Every statistic in §0 locates the harm in Class B.

---

## 2. Why *readiness* is the right core question

Interrogated against the alternatives:

- *Why not "summarise this patient"?* Summarisation has no ground truth, no failure mode you can test, and no action at the end. It is the default demo in this category and it is unfalsifiable.
- *Why not "predict deterioration / survival"?* Explicitly forbidden by the brief ("never opaque predictions"), unvalidatable on synthetic data, and fabricating it would be scientific misconduct dressed as a feature.
- *Why not "answer any clinical question"?* That is Class A. See §1.2.
- *Why does readiness force the whole brief open?* Because it **cannot** be answered from one data type:
  - clinical readiness → structured lab/imaging rows
  - surveillance readiness → structured rows **+** a protocol document
  - documentation readiness → parsed unstructured documents and their version chain
  - coverage readiness → claims/authorisation rows **+** an approval or denial letter
  - regulatory readiness → real public scheme/regulatory text
  One question, five evidence types, all three brief requirements. No other question does this as cleanly.
- *Why does it matter in India specifically?* Because 14% of cycles are missed with a median 13.75-day delay, 74% of patients cross ≥2 facilities, 8% of claims are repudiated, and ~60% of hub patients come from another state. The answer to this question is the difference between a 1,400 km trip taken and a 1,400 km trip wasted.

---

## 3. Architectural rules (non-negotiable, enforced in code)

### R1 — The model never decides anything.
The LLM is permitted exactly four jobs:
1. extract typed assertions from document text, with page index and character offsets;
2. interpret a natural-language question into a bounded tool call;
3. rank and locate candidate passages;
4. phrase a final answer using **only** supplied facts and evidence IDs.

Every status, number, date, threshold comparison and gate outcome is produced by **SQL + a versioned rule**. *Why?* Because "never opaque predictions" is a third of the brief text, and the only way to prove it rather than assert it is to make the model structurally incapable of producing a status.

### R2 — Three clocks, and answers are bound to one.
- `event_time` — when care happened
- `source_recorded_at` — when the source system recorded it
- `ingested_at` — when SAARTHI received it

Every answer carries `known_as_of`. *Why?* Because the most dangerous thing a copilot can do is let a report that arrived at 16:00 silently rewrite what was true at the 10:00 tumour board. In a hub-and-spoke system where reports arrive days late by photograph, this is *the* Indian failure mode. Demo replays one question at two cutoffs and returns two correct, different answers.

### R3 — Missingness is a type, not a NULL.
`present · explicitly_negative · pending · not_received · conflicting · unreadable · superseded`

*Why?* Because when "not received" and "negative" collapse into "no", a missing HER2 addendum becomes "HER2 negative" and a woman receives the wrong regimen. This is the highest-harm bug class in the entire problem space. It deserves a type system, not a prompt instruction.

### R4 — Identity is ABHA-anchored and federated; never joined on name.
`PATIENT` anchored on a synthetic ABHA-style address. `ID_MAP(source_system, source_patient_id, link_status, link_evidence, linked_at)` with `link_status ∈ {abha_linked, manually_verified, quarantined}`. Ambiguous matches go to a quarantine queue and contribute **no** evidence.

*Why not fuzzy matching?* Because (a) a wrong merge in oncology is catastrophic, (b) ABDM's real architecture is federated-with-consent with no central data lake, so a central merge would be *factually wrong about India*, and (c) the real problem is not fuzzy names — it is that one patient simultaneously holds an ABHA, a hub MRN, a spoke MRN, a PM-JAY beneficiary ID and an insurer member ID.

### R5 — Scope is enforced in a trusted backend, before retrieval.
Cortex Search executes with **owner's rights** — a caller with service access can query indexed content even without equivalent source-table access. Patient/tenant/role/time scope is bound server-side and cannot be overridden by the question, by chat history, or by text inside a document.

*Why its own rule?* This is the single largest security landmine in the architecture and it gets a dedicated adversarial test family (§8).

### R6 — Two document corpora, never mixed in one ranked list.

| Corpus | Content | Provenance |
|---|---|---|
| **Patient scope** | pathology reports & addenda, discharge summaries, referral notes, prescriptions, PM-JAY pre-auth letters, insurer denial letters, scanned/skewed variants | **100% synthetic**, rendered from the same seeded fact ledger as the structured tables |
| **Reference scope** | ABDM FHIR IG v6.5.0 profile pages, NHCX specification, PM-JAY Operation Manual, DPDP Act 2023 + Rules 2025, IRDAI circulars, NCG published guidelines, trastuzumab label cardiac-monitoring section | **Real, public, citable** |

*Why separate them?* (a) It satisfies "clinical, **regulatory, or legal** documents" with genuinely real regulatory text while every patient fact stays synthetic. (b) "What does the policy require?" and "what does this patient's record say?" are different questions with different evidence standards — mixing them in one ranked list produces a citation that looks right and is meaningless. (c) You must never present a synthetic SOP as a real guideline, nor a real guideline as validated for a specific patient. Separation makes both errors structurally impossible.

**This is also what makes it a *Regulatory Document Copilot* and not a chart summariser** — the second demo question class is *"under PM-JAY / NHCX / DPDP, what is required before this is claimable or shareable, and where does it say so?"*, cited to a real public document, page and clause.

---

## 4. The readiness gates

All deterministic. All versioned. All cited. Each displays its rule ID, rule version, inputs, and the exact row or page that produced the outcome.

| Gate | Evidence | Example rule | Shown citation |
|---|---|---|---|
| **Clinical** | structured rows | ANC ≥1500/µL and platelets ≥100×10⁹/L on a CBC dated within 72 h of the planned cycle | lab row: value, unit, specimen, collected_at, source system |
| **Surveillance** | rows + protocol doc | LVEF assessment within 90 days for a trastuzumab-containing regimen | echo report page **+** protocol section |
| **Documentation** | parsed docs | final pathology addendum for the accession present and not superseded | PDF page **+** version chain |
| **Coverage** | claims rows + doc | valid authorisation covering the planned service and dates | authorisation row **and** approval letter page, with any conflict preserved |
| **Identity** | ID map | all evidence resolves to one linked identity | mapping record + provenance; unlinked → quarantine |

**Review priority score** = count and severity of *open, evidence-backed gate failures*, weighted by days-to-visit. Every point of the score opens to its rule and its evidence.

It is labelled **"documentation & coverage review priority"** everywhere in the UI. *Why the careful naming?* Because calling it "patient risk" would be a lie — it does not model clinical deterioration and must never be mistaken for something that does.

---

## 5. Data model

Source data immutable; all interpretation derived and traceable.

```
PATIENT              abha_ref, tenant_id, patient_id
ID_MAP               source_system, source_patient_id, link_status, link_evidence, linked_at
ENCOUNTER            encounter_id, patient_id, scheduled_time, event_time, org_id, status
CLINICAL_EVENT       event_id, type(diagnosis|lab|imaging|medication), coded_concept,
                     value, unit, status(ordered|administered|dispensed|billed|authorized),
                     specimen_id, accession_id, event_time, source_recorded_at, ingested_at
COVERAGE / CLAIM /
AUTHORIZATION        separate grains; member↔patient map; service link; effective dates; status; amount
DOCUMENT             doc_id, version, scope(patient|reference), file_hash, accession_id,
                     signed_at, effective_at, ingested_at, supersedes_doc_id
DOC_PAGE / DOC_CHUNK page_index, text, char_offsets
ASSERTION            subject, predicate, value, unit, negation, uncertainty,
                     missingness_state, extractor_version
EVIDENCE_LINK        assertion_id → (doc_page span | table row), relation(supports|conflicts_with|supersedes)
REVIEW_ISSUE         rule_id, rule_version, patient_id, encounter_id, state, reason, evidence_ids
TASK                 issue_id, owner, state, decision, reason, idempotency_key, actor, before/after
ANSWER_RUN           question, role, scope, known_as_of, source_versions, claim→evidence map,
                     tool/query ids, model_version, validation_results, timing
```

*Why `ANSWER_RUN` persisted?* Because a previously generated answer must be able to show its original timestamp and must never masquerade as fresh. It is also the audit artifact a judge can open.

---

## 6. Snowflake architecture

```
seeded Python generator
  → stage files + raw tables
  → AI_PARSE_DOCUMENT (mode=LAYOUT, page_split=TRUE)  →  DOCUMENT / DOC_PAGE / DOC_CHUNK
  → LLM extraction (typed, offsets, extractor_version) →  ASSERTION
  → deterministic reconciliation                      →  EVIDENCE_LINK
  → versioned SQL rule engine                         →  REVIEW_ISSUE → TASK
  → Cortex Search ×2  (patient-scope service, reference-scope service)
  → Semantic view (Cortex Analyst) for cohort/aggregate questions
  → Cortex Agent with restricted custom tools
  → deterministic answer validator
  → Streamlit (container runtime), role-scoped
```

**LAYOUT mode + `page_split=TRUE`** because pathology and authorisation documents are table-bearing and citations must resolve to a page index. (Supports PDF/PPTX/DOCX; up to 2,000 pages as of the 30 Apr 2026 release.)

### The only tools the agent may call

| Tool | Contract |
|---|---|
| `get_patient_facts(patient_id, domain, known_as_of)` | parameterised SQL; scope bound server-side |
| `get_readiness(patient_id, encounter_id, known_as_of)` | gate results + rule versions + evidence IDs |
| `search_patient_documents(patient_id, query, known_as_of)` | Cortex Search, mandatory scope + version filter |
| `search_reference_documents(query, jurisdiction, effective_date)` | **separate** service; no patient data |
| `cohort_query(question)` | Cortex Analyst over the semantic view; identifiers only if role permits |
| `create_review_task(...)` | write; idempotency key; requires explicit user action |

*Why restrict rather than prompt?* See R5. A patient-evidence question must never depend on the model remembering to add a `WHERE` clause.

### Answer validator (runs after generation, before display)
Every claim must carry ≥1 evidence ID. Every evidence ID must (a) exist, (b) belong to the bound scope, (c) match the bound version, (d) pass a typed check against the claim — number match, date match, status match, unit conversion. Unsupported sentences are **removed and replaced with an explicit limitation**, and the removal is logged.

`answer_status ∈ {supported, partial, insufficient}`. **No single confidence percentage is ever displayed** — the UI shows the observed evidence state instead ("final report not received", "two sources disagree", "3 claims verified against 5 sources").

### Runtime risk and fallback
Cortex Agents **cannot** be called from Streamlit-in-Snowflake on the warehouse runtime — container runtime (compute pool) is required. **Day 1, hour 1** smoke test: prove the app can (1) call the agent, (2) retrieve one passage, (3) read one structured row, under the intended role. If container access cannot be obtained, fall back to a warehouse-runtime Streamlit app with a deterministic Python router calling supported SQL/Search/AI-function paths — orchestration stays explicit and the change is documented. Never silently route patient scope through an unrestricted tool.

---

## 7. Repository layout

```
saarthi/
├── AGENTS.md                      # project rules CoCo must obey (R1–R6 restated for the agent)
├── planning/                      # CoCo planning transcripts + decisions
├── data/generator/                # seeded generator: fact ledger → tables + rendered PDFs
│   ├── ledger.py                  # canonical event history (single source of truth)
│   ├── projections.py             # per-source-system table projections w/ local IDs
│   ├── documents.py               # PDF rendering from the same facts
│   └── corruptions.py             # named scenarios: late arrival, addendum, dup upload,
│                                  #   conflicting fields, unreadable page, unit mismatch,
│                                  #   invalid identity, embedded prompt injection
├── data/fixtures/                 # frozen demo fixtures (P-017 et al.)
├── data/reference/                # real public regulatory PDFs + license manifest
├── sql/                           # DDL, transforms, rule engine, semantic view
├── app/                           # Streamlit: queue / 360 / ask+evidence / review+history
├── tools/                         # custom agent tools (the six in §6)
├── evals/                         # 80 versioned questions, truth key OUTSIDE app role
├── evidence/coco/                 # per-phase CoCo evidence index (§9)
└── .cortex/skills/evidence-reconciliation/   # the reusable skill (§10)
```

**`evals/` truth key must be inaccessible to the application role.** *Why?* Otherwise the system can retrieve its own answer key and every metric is worthless.

---

## 8. Testing and acceptance

**80 questions: 40 development, 40 held out.** Held-out set frozen before any tuning. Split by patient, scenario and document layout so no layout leaks across the split. Reviewed by someone other than the implementer.

| Family | Required behaviour |
|---|---|
| Joined evidence | answer requires SQL **and** a document; each claim cites the correct one |
| Temporal correction | latest answer uses the addendum; historical answer excludes documents not yet received |
| Clinical semantics | ordered ≠ administered; explicitly negative ≠ missing; a different specimen is not automatically a contradiction |
| Access & injection | wrong patient/tenant ID, chat carryover, altered filter, cached answer, direct citation URL, and instructions embedded in a document all fail to expose disallowed content |
| Missing / corrupt input | partial or unreadable document, unmatched identity, unknown unit, empty retrieval → bounded partial answer or abstention |
| Operational failure | duplicate upload, retry, stale index, timeout, model unavailable → auditability preserved, no double-write |

| Metric | Target |
|---|---|
| Cross-scope evidence leakage | **0 occurrences** |
| Evidence coverage (claims with resolvable evidence) | **100%** |
| Citation support precision (human-reviewed) | **≥95%** |
| Held-out answer correctness | **≥90%** |
| Designed missing/conflict cases handled correctly | **100%** |
| Supported-answer recall on answerable cases | **≥90%** (so refusal alone cannot score well) |
| Warm p95 answer latency / new-file-to-ready | 15 s / 2 min |

Report absolute counts alongside rates. Cold starts reported separately. These are engineering gates on synthetic tests — **not** clinical validation, and the deck must say so.

**Baseline comparison (mandatory).** Same model, same corpus, plain RAG, same held-out set. Report where temporal + structured reconciliation wins and where it does not. *Why?* "Why not just ChatGPT over the PDFs?" is the first judge question and a measured delta is the only convincing answer.

---

## 9. CoCo across the lifecycle

Required by the rules; judges look for evidence at every phase. Save real session records — including failures and fixes.

| Phase | What CoCo does | Evidence saved |
|---|---|---|
| **Planning** | inspect synthetic source samples; identify identity/status/date ambiguities; draft the workflow, schema, ontology and acceptance tests before app code | plan, schema decisions, data profile, session ID, timestamp |
| **Development** | build the generator, ingestion pipeline, semantic view, scoped tools, validator, Streamlit app; explain failing tests before fixing | generated files, reviewed diffs, commits, SQL/object definitions |
| **Execution** | deploy to the hackathon namespace; run ingestion → answer generation; ingest the late-addendum fixture; verify evidence version and task state change | run manifest, query IDs, object states, source hashes |
| **Testing/validation** | run the frozen benchmark under allowed and denied roles; report exact failures, citation checks, latency, missing-evidence behaviour | machine-readable results, before/after failures, final commit, test manifest |

Evidence index: for each phase record purpose, CoCo session/run ID, date, commit, input hash, outputs, query IDs, pass/fail, one screenshot or short clip. Redact credentials and account details. *A screenshot of CoCo open beside hand-written code is not lifecycle evidence.*

---

## 10. Differentiators (build only after §4–§8 pass)

**Reusable skill — `evidence-reconciliation`.** `.cortex/skills/evidence-reconciliation/SKILL.md` + fixtures. Purpose: inspect a schema and generate or validate an evidence contract. Inputs: schema/table list, identity map, source documents, `known_as_of`, allowed scope, rule catalogue. Workflow: profile → map concepts → identify ambiguity → propose scoped queries → validate provenance → run failure cases → report. Boundaries stated in the skill itself: no real patient data, no guessed identity merges, no invented clinical thresholds, no unsigned clinical action, no overwrite of source history.
**Reuse proof:** run it against a *second* synthetic schema with different column names. Show both a successful mapping **and** an ambiguity it correctly refuses to resolve. The refusal is the more valuable demo.

**One CoCo automation — nightly evidence quality check.** 08:00 Asia/Kolkata: inspect the latest ingestion run and the review queue; report failed stages, stale evidence, newly unresolved issues; run the citation and access-control smoke tests; persist a result manifest. Makes no clinical decisions and sends no external notifications. Automations are Preview and run under the creating user's default roles — verify, and note that a "succeeded" task status alone is not proof. Fallback: a Snowflake task for the deterministic checks plus a documented CoCo batch review.

**Optional MCP — only if it survives the core.** One reviewed documentation ticket in a synthetic workspace, carrying only a synthetic patient ID and an authenticated evidence link. Prove retries do not create duplicates. Skip entirely if connection setup threatens the core demo.

---

## 11. Demo case (fixed clock: 18 Sept 2026, 09:00 IST)

Entirely invented. Nothing drawn from any real patient.

**P-017** — HER2-positive breast cancer, resident of a district town, treated at synthetic hub *Hospital A* (metro) with a synthetic spoke *Hospital B*. Cycle 4 of a trastuzumab-containing regimen scheduled **19 Sept**. Family must depart 17 Sept — ~1,400 km, ~₹18,000 they do not have.

**Q1 — "Is P-017 ready for cycle 4 on 19 September?"**
> Two blockers and one advisory.
> **(1)** Final pathology addendum for accession S-882 not received — the preliminary report states an addendum is to follow `[PATH-31 v1, p.2]`; no addendum present in this packet `[ingestion inventory as of 18 Sep 09:00]`.
> **(2)** Authorisation evidence disagrees — the authorisation table reads *pending* `[AUTH-7]` while the matching approval letter for the same service and dates reads *approved* `[LETTER-8, p.1]`. Unresolved; both retained.
> **Advisory:** LVEF assessment is 104 days old `[ECHO-9]`; the coordination protocol requires ≤90 days `[SOP-1 v2 §4]`.
> **Clear:** ANC 2,100/µL, platelets 187×10⁹/L, collected 17 Sep `[LAB-441]`.
> *Treatment readiness cannot be determined from these records. The treating team decides.*

**Q2 — live change.** Ingest `PATH-31 v2` (explicit signed addendum, same accession) through the real pipeline. v1's pending statement is marked **superseded**, v2 is cited, and the missing-report task flips to `evidence_received_review_pending`. A coordinator accepts the documentation resolution. **Authorisation remains unresolved.**

**Q3 — "What changed since 09:00?"** Cites v2, explains supersession, names the task transition, states what is still open. Switching back to the 09:00 cutoff returns the original answer **without** v2.

**Q4 — role switch to `family`, same question as Q1.** Returns a bring-list: *final pathology addendum · insurer approval letter · CBC dated 17–19 Sept*. Then ask *"should she take the treatment?"* → refused, routed to the treating team.

**Q5 — regulatory.** *"What does the scheme require before this claim is submitted?"* → answered from the **real** PM-JAY Operation Manual with page and clause.

**Q6 — cohort.** *"Which upcoming reviews this week lack a final report?"* → semantic view; aggregate cites metric definition, query ID, filters and supporting row set.

**Judge challenge to rehearse:** *"Can treatment proceed?"* → describes available evidence and its limits and routes the decision to the treating team. The system never converts documentation completeness into clinical clearance.

---

## 12. Schedule — 13→30 Sept, 3 people

| Owner | Responsibility | Cross-review |
|---|---|---|
| **A — data & platform** | generator, identity map, raw/curated pipeline, lineage, semantic view, deployment | reviews query correctness + evidence snapshots |
| **B — evidence & evaluation** | document extraction, scoped tools, assertions/reconciliation, answer validator, benchmark | reviews privacy boundaries + app answer behaviour |
| **C — product & demo** | Streamlit, evidence pane, task actions, family role, user interviews, submission package | reviews real usability + end-to-end acceptance |

| Dates | Gate — must be true before moving on |
|---|---|
| **13 Sept** | ✅ registered; container/agent/search/SQL smoke test **passed or fallback chosen**; three sample cases agreed; data and answer contracts frozen |
| 14–16 Sept | **Vertical slice deployed**: one patient → tables + PDF → cited answer → clickable evidence. If this fails, cut architecture immediately. |
| 17–20 Sept | 100-patient generator; review queue; joined semantic query; correction / as-of handling; reviewed task action; incremental update |
| 21–24 Sept | Held-out set locked; permissions, citations and failure evaluation; baseline comparison; user interviews; fix development failures only |
| 25–27 Sept | Reusable skill on a second schema; one verified automation; evidence packet export; family role; metrics |
| 28–29 Sept | Clean deployment rehearsal; full smoke tests; deck, repo, evidence index, demo script; **target completion here** |
| 30 Sept | Contingency only |

**Daily integration checkpoint:** one fixed question, one new test, one denied-access test, one incremental update. Commit + run manifest recorded. Every owner demonstrates their change in the shared app, not a local notebook.

**Cost control:** small warehouse, bounded compute pool, short documents, one indexed corpus per required scope. Cache by evidence version; cap retrieved passages and retries. Track parse / model / search / compute separately. Note: resource monitors cover warehouses, **not** serverless compute — use AI budget monitoring too.

---

## 13. Explicitly not built, and why

| Cut | Why |
|---|---|
| Drug selection, dosing, survival prediction | Class A. Illegal for an AI platform under NMC TPG 2020 and forbidden by the brief. |
| Autonomous clinical clearance / order creation | The workflow ends in a *documentation* task reviewed by a human. Never a clinical order. |
| Broad clinical trial matching | Adds dependency, strengthens nothing central. |
| Handwritten document support | Real and important in India; unachievable reliably in 18 days. Say so honestly. |
| Live hospital / real ABDM sandbox integration | Cannot be validated in the window; synthetic-only is mandated anyway. Model the ABDM *shape*, do not claim the *connection*. |
| Separate mobile app, multiple chat channels | Same state, more surfaces, no new proof. |
| Any real patient record as a generation seed | Prohibited by the brief and by DPDP Act 2023. |
| Presenting a synthetic SOP as hospital-approved, or a real guideline as patient-validated | Fabrication. R6 prevents both structurally. |

---

## 14. Verification — how to prove it works end to end

Run in this order. Each step is a judge-demonstrable artifact, not a self-report.

1. **Runtime gate.** From the deployed Streamlit app under the intended role: call the agent, retrieve one document passage, read one structured row. Record query IDs. *Fails → take the §6 fallback and document it.*
2. **Idempotency.** Run ingestion twice on unchanged inputs. Assert: zero duplicate `DOCUMENT`, `ASSERTION` or `TASK` rows. Compare run manifests.
3. **Joined-evidence proof.** Ask Q1. Assert the answer object contains ≥1 claim whose evidence is a structured row **and** ≥1 whose evidence is a document page. Click both; both must open the exact row and the exact page.
4. **Temporal proof.** Ingest `PATH-31 v2` through the live pipeline. Re-ask Q1 → cites v2, marks v1 superseded, task state changed. Set cutoff back to 18 Sept 09:00 → original answer returns, **without** v2. Diff the two `ANSWER_RUN` records.
5. **Authorisation proof.** Re-ask Q1 as `family`: assert the returned evidence-ID set is a strict subset of the coordinator's. Ask a Class A question in both roles: assert refusal in both.
6. **Adversarial suite.** Run the access-and-injection family: wrong patient ID, wrong tenant, chat carryover, altered filter, direct citation URL, and a document containing embedded instructions. Assert **0** cross-scope evidence returned and that document-embedded instructions are treated as content, never executed.
7. **Validator proof.** Inject a fabricated claim into the generation path. Assert the validator strips it, substitutes an explicit limitation, and logs the removal. *This is the most important single test in the suite.*
8. **Missing-evidence proof.** Remove a required document. Assert the answer degrades to `partial` or `insufficient` with a named missing item — and never asserts a clinical fact in its place.
9. **Benchmark run.** Execute all 80 questions under allowed and denied roles. Emit machine-readable results against the §8 targets. Report failures, do not hide them.
10. **Baseline delta.** Same held-out set against plain RAG. Report the measured difference, both directions.
11. **Skill reuse.** Run `evidence-reconciliation` against the second synthetic schema. Show one successful mapping and one refused ambiguity.
12. **Automation.** Trigger the nightly check; open the resulting CoCo thread; inspect the output manifest. Confirm the run did real work — a "succeeded" status alone is not proof.
13. **Cold start.** One person, from the README only: deploy, ingest, ask a joined question, open its evidence, process the correction, review a task, reproduce the tests.

**Go / no-go before any polish is added.** No-go if: the answer is hard-coded, evidence links are decorative, the agent can cross patient scope, the late-update path is simulated rather than real, or CoCo evidence exists only for code generation.

---

## 15. Immediate actions

1. **Register today** — the event page lists registration closing 12 Sept 2026. Nothing else matters if this lapses.
2. Email `cococlihackgcc-support@hack2skill.com` to confirm in writing: operative deadline and time zone, the rubric that governs (the event page says Relevance 30 / Technical 40 / Completeness 30; the linked T&C document states different dates and four different judging dimensions), the submission portal, and any dataset/employer restrictions.
3. Run the §14 step-1 runtime gate **before** dividing the build.
4. Record the teammate's consent in writing, and agree the narrative boundary: **their voice in the motivation, synthetic data in the system.** The brief mandates synthetic-only regardless — so the story loses nothing and the record stays theirs.
5. Freeze the data contract and the answer contract before writing app code.

---

## Appendix — named sources

**Indian health system.** ABDM / ABHA / HIE-CM (PIB, NHA); NRCeS FHIR R4 Implementation Guide for ABDM v6.5.0 (`nrces.in/ndhm/fhir/r4/`); EHR Standards for India 2016; NHCX (NHA, IRDAI 2026 recommendations); PM-JAY Operation Manual & TMS (`nha.gov.in`); National Cancer Grid (300+ centres, resource-stratified guidelines, virtual tumour boards via Project ECHO); NMC Telemedicine Practice Guidelines 2020; DPDP Act 2023 + DPDP Rules 2025 (notified Nov 2025; full compliance 14 May 2027).

**Clinical evidence.** Delays and pathways: PMC7173377, PMC12374521. Financial toxicity: IIPS–TMC study; PMC11265332. Missed cycles: Cancer Reports 2020 (PMC7941559). Biomarker discordance: JCO Global Oncology (JGO.18.00184). Chemotherapy gating thresholds: Annals of Oncology adjuvant FEC audit. Trastuzumab cardiac surveillance: FDA label; ESC 2022; 3- vs 4-monthly RCT (PMC8700071).

**Platform.** `docs.snowflake.com/en/user-guide/cortex-code/` (overview, bundled skills, automations, CLI reference, changelog); AI_PARSE_DOCUMENT (LAYOUT / `page_split` / 2,000-page limit, 30 Apr 2026 release note); Cortex Search (owner's-rights access model); Cortex Agents (container-runtime requirement); semantic views; dynamic tables (target lag is a goal, not a guarantee).

*Platform documentation is live and changes. Re-verify feature availability in the actual hackathon account before the demo.*
