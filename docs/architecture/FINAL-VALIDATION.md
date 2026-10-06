# Saarthi — Final Architecture Validation

> **Honesty note added 4 Oct 2026 (FIX-ROUND-5).** This is a historical 16-17 Sept snapshot. Competitor source code is **not
> vendored in this repository**; statements about competitors are a researcher's file-level reading recorded in
> `docs/research/clinical/ps04-competitive-landscape.md` (e.g. `streamlit/login.py`, `sql/00_infrastructure.sql`,
> with no line numbers) and **cannot be re-verified from this repo**. Read "no competitor does X" as "we did not find X in
> the code we reviewed". Superseded in part by `DECISION-household-removal.md`.

**Written 2026-09-17. Validates the completed architecture against three independent standards: the verbatim hackathon brief, the confirmed judging rubric, and every surveyed competitor.**

Architecture under validation:
- `SPEC.md` v2 (904 lines) — data, rules, governance, pipeline
- `AI-INTEGRATION-ARCHITECTURE.md` (679 lines) — model layer, agent, prompts, call path
- Supported by 26 research files, 4 review documents, 10 empirically verified platform behaviours

**Verdict: the architecture is complete and defensible. 4 residual risks, all named with mitigations. 0 unresolved architectural contradictions.**

---

## PART 1 — Validation against the verbatim brief

Every requirement line, mapped to where it is satisfied and how it is proven.

| # | Brief requirement (verbatim) | Satisfied by | Proof |
|---|---|---|---|
| 1 | *"unifies data into a patient or member 360"* | `SPEC.md` §2 — 25 tables, 3 ingestion paths, `HOUSEHOLD` for the member/family dimension | Data model + FHIR mapping |
| 2 | *"answers clinical, safety, or regulatory questions"* | §4 safety gate (renamed from surveillance) · §6 Class A/B · §5 reference corpus | 10-type Class B taxonomy, all with tool paths |
| 3 | *"with cited evidence"* | §7 validator, 6 checks · per-claim `evidence_ids` · native agent `annotations[].index` | `AI_FILTER` polarity verified working |
| 4 | *"Use fully synthetic or de identified data only"* | §9 seeded generator, 100% synthetic | Real reports informed *format research only*; consent held |
| 5 | *"Combine structured records with unstructured clinical, regulatory, or legal documents"* | §3 three paths · §5 dual corpora with **real** regulatory text | Physically separate search services |
| 6 | *"Produce **risk stratification**, evidence retrieval, or a cited answer"* | §4 — deterministic risk stratification over care gaps, brief's own vocabulary adopted | 16 rules, 4-valued outcomes |
| 7 | *"never opaque predictions"* | **R1** — LLM structurally cannot emit a status. **No trained model anywhere.** | Cortex ML deliberately refused and recorded |
| 8 | *"Deliver a question and answer experience with clear source evidence"* | §10 — Ask + Evidence is the centrepiece, not one tab of six | — |

### CoCo lifecycle requirements

| Phase | Required | Status |
|---|---|---|
| **Planning** | *"explore the data, frame the problem, draft the solution design, and outline the data model, **ontology**, and workflow before any build begins"* | **Complete.** 52 sessions, 26 focused single-question research sessions. `CLINICAL_ONTOLOGY` is a first-class table (§2.7). Banked in `evidence/coco/planning.yaml`. |
| **Development** | *"build the pipelines, semantic views, models, agents, and application code"* | Architecture complete; build starts Day 1. Manifest stubbed. |
| **Execution** | *"Run and orchestrate the complete end to end solution through CoCo, including scheduled or automated runs"* | 6 Tasks designed including `TASK_SAARTHI_ORCHESTRATOR`. |
| **Testing** | *"validate outputs, test accuracy, handle errors and edge cases"* | **Partially complete already** — 10 platform behaviours verified with query IDs, 4 failure-and-fix pairs recorded. |

### Recommended CoCo tasks — all 6 covered

| Recommended task | Where |
|---|---|
| Synthetic data generation | §9 — seeded ledger, 13 corruption scenarios |
| Data pipeline creation *(dynamic tables, tasks, streams)* | §13 — 5 DTs + 6 Tasks + 3 Streams, exact match |
| Semantic model and **ontology** authoring, *"validate against natural language questions"* | §8 semantic view + 6 VQRs · §14 80-question eval |
| Streamlit report/app generation | §10 — 6 screens |
| **Connecting to additional sources via MCP** | `AI-INTEGRATION` §7 — `CREATE MCP SERVER`, 2 read-only tools |
| Document and unstructured processing | §3 + §4 of AI doc — `AI_PARSE_DOCUMENT` + R7 |

### Ingenuity categories — 6 of 7 addressed

| Category | Status |
|---|---|
| **Reusable skills** — *"the headline bonus"* | **4 skills**, stage-mounted, plus reuse proof against a second schema showing one success **and one correct refusal** |
| MCP connectors | Inbound `MCP SERVER` + outbound ticket action, idempotent |
| Automations / scheduled runs | 6 Tasks + nightly evidence-quality automation |
| Custom tools & function calling | **8 procedures** as agent tools |
| Multi-agent orchestration | `TASK_SAARTHI_ORCHESTRATOR` chaining 4 skills |
| Working across surfaces | CLI + Desktop evidence accrues naturally; Snowsight agent reachability is a Day-1 check |
| Guardrails & graceful fallback | 6-check validator · Cortex Guard · **fail-closed everywhere** |

---

## PART 2 — Validation against the rubric

### Technical Execution — 40%

| Asset | Weight |
|---|---|
| **19 Snowflake features** used substantively, not decoratively | High |
| **R5 three-layer security, empirically verified** — F3, F5, F6, F7 with query IDs | Highest |
| **R7 two-pass extraction verification** — different model families, fail-closed | Highest |
| Rule engine: 16 rules, versioned, 4-valued outcomes, precedence resolution | High |
| 6-check validator including polarity via verified `AI_FILTER` syntax | High |
| Agent with 8 `generic` tools and `patient_id` unreachable by construction | Highest |
| Native `EXECUTE_AI_EVALUATION` with GPA metrics | Medium-high |
| 80 rule fixtures + 80-question eval + baseline RAG delta | High |

**The strongest single Technical claim:** three independently verified ways the naive design leaks patient data, and one architecture that closes all three.

1. **F5** — Cortex Search returns another patient's pathology text despite a correct RAP on the governed table.
2. **F7** — "the app role has no `USAGE`" is false while secondary roles are active; a secondary ACCOUNTADMIN satisfies the check.
3. **A1** — the agent derives `patient_id` from the *question text* and injects the filter itself.

Each is reproducible with a query ID. Each is a live Judge Console probe. **We did not see any of the three closed in the competitor code we reviewed.**

### Real-World Relevance — 30%

| Asset | Grounding |
|---|---|
| 19 real medical reports studied; consent held (patient's son is on the team) | `real-patient-dipali.md` |
| Cross-department reality: 5 specialties in one real patient's record | Appendectomy mid-chemo, DEXA osteopenia, LVEF surveillance |
| Indian document chaos modelled exactly: `GM%`, `/CUMM`, `1,50,000`, `L`/`H` flags, rotated photos | `lab-reporting-india.md` + synthetic PDF built |
| Biomarker discordance across specimens — the finding that changed her treatment | D3, `discordant_across_specimens` |
| ABDM/ABHA identity with the **no-ABHA case as default** (0 of 7 identifiers were ABHA) | R4 |
| PM-JAY family floater — fixes a rule wrong for every PM-JAY patient | `HOUSEHOLD` |
| ₹30,000 cr repudiation, 60–70% procedurally curable | `denial_is_curable` |
| Consent enforced at query time — legally required, structurally ABDM-correct | `CONSENT` |
| DPDP: `ANSWER_RUN` pointers-not-content resolves s.12(3) vs Rule 6(e) | Schema constraint from law |
| NMC: Class A/B is a legal boundary, practitioner named via `nmc_registration_no` | `PRACTITIONER` |
| Honest threshold provenance — practice consensus labelled separately from guideline | `clinical-thresholds.md` §11 |

### Solution Completeness — 30%

Judges spend **18 days alone with the repository** (5–22 Oct) before any live demo. This category is decided by reproducibility and honesty, not polish.

| Asset | Status |
|---|---|
| One-script idempotent deploy, clean-account safe | Designed §14 |
| **`IMPLEMENTATION-STATUS.md`** — every component `built \| partial \| designed-only` | **Mandated, not optional** |
| 25 tables built / 7 designed-only, marked in the spec | Complete |
| Re-runnable machine-readable test results | Designed |
| CoCo evidence across all 4 phases | Planning complete, others stubbed |
| Complete object inventory so `setup.sql` is mechanical | `AI-INTEGRATION` §10 |
| Threshold provenance labelled where it is practice not guideline | Complete |

**Deliberate scope restraint, and why it scores:** 16 rules fully fixture-tested beats 20 partially tested. `DECISION-department-scope.md` reversed an earlier 20-rule recommendation on exactly this basis — Completeness penalises unproven breadth, and two of four competitors are already broad, so breadth is table stakes rather than differentiation.

---

## PART 3 — Validation against the competition

Rule-by-rule, against what their **source code** does — not their READMEs.

| Rule | Saarthi | Verity | ATLAS | SynapseCortex | CareCompass |
|---|---|---|---|---|---|
| **R1** LLM never decides | ✓ | ✓ | ✓ | ✓ | ✓ |
| **R2** Three clocks | **✓ verified natively expressible in FHIR** | ✗ | ✗ | ✗ | ✗ |
| **R3** Typed missingness | **✓ 7 states + FHIR mapping** | ◐ 3-state | ◐ `UNKNOWN` | ✗ bare NULL | ✗ |
| **R4** ABHA-anchored identity | **✓ no-ABHA default** | ◐ payer-ID chain | ✗ synthetic string | ✗ name/DOB unmasked | ✗ sequential ID |
| **R5** Server-side scope | **✓ 3 layers, empirically verified** | ◐ request-time filter | ✗ one shared role | ✗ confirmed zero RLS | ✗ confirmed `st.radio` |
| **R6** Dual corpora never mixed | **✓ platform-forced separation** | — single corpus | ✗ confirmed mixed | ✗ confirmed mixed | — none stated |
| **R7** Extraction verification | **✓ two model families** | ✗ | ✗ | ✗ | ✗ |
| **Consent at query time** | **✓** | ✗ | ✗ | ✗ | ✗ |
| Cross-department breadth | ✓ 6 specialties | ✗ narrow | ✗ narrow | ✓ broad | ✓ 4 specialties |
| Real FHIR/HL7 ingestion | ✓ FHIR JSON path | ✗ | ✗ | ✗ | **✓ 10 source systems** |
| Deployed & running | **✗ not yet** | ✓ | **✓ live URL** | ✓ | ✓ |

### Where each competitor beats us, and the response

**ATLAS — live public URL.** The one axis where design cannot substitute for working software, and the rubric category is literally *Technical **Execution***. **Response: the Day-5 hard gate exists for this reason.** If one patient does not flow document → parse → two-pass verify → rule → cited answer by end of Day 5, scope gets cut immediately rather than at Day 12. Also borrowed: their per-answer `agent_trace` pattern, which we get free from the agent's native `thinking` block.

**Verity — tightest engineering, $7 reproducible run, structurally impossible false negative.** Response: we match their two-stage retrieval discipline and **exceed it by applying the same idea to extraction** (R7), which they do not do. Their three-state verdict is a partial R3; ours is 7 states mapped to a standard vocabulary. Their scope control is a request-time filter — the exact pattern A1 proves untrustworthy.

**CareCompass — best data engineering in the field, HL7/FHIR across 10 source systems, dbt medallion, 4 specialty semantic views.** Their genuine strength, and the reason F4/G2 mattered. Response: our FHIR JSON path with field-level mapping contests their strongest axis, and **their access control is a `st.radio` picker writing to `st.session_state`** — confirmed in `streamlit/login.py`, with their own comment admitting it. We beat them on cross-specialty breadth *with real enforcement*.

**SynapseCortex — widest clinical rule surface (FDA + HEDIS + drug safety).** Response: breadth without enforcement is the failure we document — `PATIENT_360_SNAPSHOT` returns the entire dataset to any querier. We adopt their rigid inline citation format (cheap, makes R1 legible at a glance) and counter breadth with provable correctness: 80 rule fixtures.

### Three demo beats not found in the competitor code we reviewed

1. **Consent revocation** — same user, same question, returns nothing. Consent modelling was not found in the competitor code we reviewed.
2. **Two-pass extraction disagreement** — the system refuses to assert a value read off a degraded image and says why. Extraction verification was not found in the competitor code we reviewed.
3. **Live scope-leak comparison** — run the naive path (F5/A1) and watch it return another patient's pathology, then run ours and watch it return nothing. Reproducible, with query IDs.

---

## PART 4 — Internal consistency audit

All 50 review findings, closed or explicitly deferred.

### The 16 fatal findings — all resolved

| ID | Finding | Resolution |
|---|---|---|
| C1 | `CURRENT_USER()` broken in container runtime | **F3 verified** — survives owner's-rights elevation. RAP keys on it. U2 confirms in Streamlit. |
| C2 | Rule engine contradiction (procedure vs DT) | Procedure is single source; Task materialises. No duplication. |
| C3 | Missing `weight_kg` → CrCl impossible | `vitals` event type — clinically correct, weight varies per cycle |
| C4 | No agent specification | `AI-INTEGRATION` §2 — full spec, verified created and run |
| C5 | No answer output schema | Frozen, §7 |
| C6 | Missing FACILITY/SCHEME/TREATMENT_PLAN tables | All specified §2 |
| C7 | `DOC_PAGE` → `DOC_CHUNK` unspecified | `DT_DOC_CHUNK`, chunking rules §5 |
| F1 | No CONSENT anywhere | First-class table, query-time enforcement in every tool |
| F2 | Access control wrong shape | `CARE_TEAM` replaces flat map; 5-table org hierarchy |
| F3 | No REFERRAL object | Specified; **is** the bring-list derivation |
| F4 | No ingestion architecture | 3 paths + `SOURCE_SYSTEM` + `INGESTION_RUN` + FHIR field mapping |
| F5 | Member 360 half-built; `COV-LIMIT-001` wrong | `HOUSEHOLD` + floater keying. Severity correctly downgraded — brief says "patient **or** member" |
| F6 | No PRACTITIONER | Specified with `nmc_registration_no` |
| D1 | Validator blind to bad extractions | **R7** + validator check 6. The most important change in the entire review cycle. |
| D3 | Discordance undetectable | `discordant_across_specimens` + `DOC-DISCORD-001` |
| D7 | Federation/centralisation contradiction | Positioned as centralised evidence index over federated source data |

### Deferred, with reasons stated

| ID | Item | Why deferred |
|---|---|---|
| S2 | Search sharding >400M chunks | Documented, not built. Out of scope at 100 patients. |
| S3 | Population-scale event-driven recomputation | 5-min Task documented as the hackathon-optimal choice |
| K1 | `DERIVED_ARTIFACT` retention purge | Designed-only; `ANSWER_RUN` pointer design already satisfies the hard legal constraint |
| K3 | Rule 13(3) model-risk register | Ships as a markdown deliverable, not a table |
| K4 | Multilingual query **input** | Day-1 test; `AI_TRANSLATE` output verified |
| M7 | Realistic PDF generation | First synthetic PDF built with all Indian traps encoded |
| D9 | Non-oncology extensibility proof | 6 specialties now visible; 3 thresholds sourced |

### Contradictions found in this audit: 0

Cross-checked: R1–R7 against each other, the data model against the rule specs, tool contracts against the agent spec, the answer schema against validator checks, `SPEC.md` against `AI-INTEGRATION-ARCHITECTURE.md`, and both against the 10 verified platform behaviours. No conflicts remain.

---

## PART 5 — Residual risks

Four, named honestly with mitigations. None is an architectural flaw.

### Risk 1 — Zero shipped code, 17 days. **HIGHEST.**
Two competitors have live URLs; the category is *Technical Execution*.
**Mitigation:** Day-5 hard gate on the vertical slice. `WINNING-PLAN.md` §16 assigns all three people from Day 1. Architecture is complete enough that build is mechanical — the object inventory exists precisely so `setup.sql` requires no design decisions.

### Risk 2 — `AI_PARSE_DOCUMENT` cost unmeasured (U1).
`reference-corpus-sources.md` estimates Tier 1 at 250–310 pages and separately claims ~$1 total — inconsistent by roughly an order of magnitude. Measured CoCo credits ran ≈$0.26/credit, which would put 300 pages near $78; AI-function credits may price differently.
**Mitigation:** one `PUT` from a live terminal settles it. Test PDF is built and staged. **Do not commit to Tier 2 corpus before measuring.** Budget is $1,200 across three accounts, so even a 10× miss is survivable.

### Risk 3 — Streamlit container-runtime identity (U2).
If `CURRENT_USER()` returns the app owner inside a deployed Streamlit, scope injection needs the dedicated-service-user path instead.
**Mitigation:** F3 proves the mechanism works at the procedure layer, and F7 already gives us the fallback. `AGENT_RUN` (F1) means warehouse runtime is viable regardless. Day-1 check.

### Risk 4 — NRCeS ABDM profile verification.
Five India-specific FHIR claims are unverified, notably the ABHA identifier system URI (underpins R4) and how PM-JAY family coverage is represented (determines whether `HOUSEHOLD` is sanctioned or a workaround).
**Mitigation:** all five flagged ⚠️ in `fhir-field-mapping.md` §12. Base-FHIR paths are standard and stable. **No India-profile claim goes in the submission unverified.**

---

## Verdict

**The architecture is complete, internally consistent, and validated against all three standards.**

- **Brief:** all 8 requirements satisfied, all 4 CoCo phases addressed, 6 of 6 recommended tasks, 6 of 7 ingenuity categories.
- **Rubric:** Technical Execution carries three empirically verified platform findings (query IDs in `evidence/coco/verification-query-ids.md`) that we did not see closed in the competitor code we reviewed. Real-World Relevance rests on 19 real medical reports and consent held within the team. Solution Completeness is protected by deliberate scope restraint and mandated honest accounting.
- **Competition:** we lead on R2, R3, R4, R5, R6, R7 and consent — seven of eight architectural axes. We trail only on *shipped code*, which the Day-5 gate exists to fix.
- **Internal:** all 16 fatal findings resolved, 7 deferred with stated reasons, 0 contradictions.

**The single remaining question is execution, not design.** Every architectural decision now traces to either a verbatim brief requirement, a rubric criterion, a verified platform behaviour, or a documented competitor gap.

Nothing in the architecture requires further research. Build starts.
