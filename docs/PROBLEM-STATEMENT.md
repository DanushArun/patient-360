# PS-04 — Verbatim Problem Statement & Gap Analysis

**Captured 17 Sept 2026 from the official event page. This is the authoritative text. All prior scope reasoning was done against a paraphrase in `plan.md`; this file supersedes it.**

---

## VERBATIM BRIEF

> ### Patient and Member 360 and Clinical or Regulatory Document Copilot
>
> Care and life sciences teams work across siloed EHR and claims data and dense unstructured documents.
>
> Build a copilot that unifies data into a patient or member 360 and answers clinical, safety, or regulatory questions with cited evidence. Use fully synthetic or de identified data only.
>
> - Combine structured records with unstructured clinical, regulatory, or legal documents
> - Produce risk stratification, evidence retrieval, or a cited answer, never opaque predictions
> - Deliver a question and answer experience with clear source evidence
>
> **Judging Focus:** Real World Relevance · Technical Execution · Solution Completeness

## VERBATIM CoCo USAGE GUIDELINES

> All hackathon solutions must use CoCo (CLI, Desktop app) across the full lifecycle, from planning through development to execution and testing. Teams should be able to show CoCo in each phase below, and judges will look for evidence of it at every stage.
>
> - **Planning:** Use CoCo to explore the data, frame the problem, draft the solution design, and outline the data model, **ontology**, and workflow before any build begins.
> - **Development:** Use CoCo to build the pipelines, semantic views, models, agents, and application code, iterating directly in the CLI or Desktop app rather than by hand.
> - **Execution:** Run and orchestrate the complete end to end solution through CoCo, including scheduled or automated runs where the scenario calls for it.
> - **Testing and validation:** Use CoCo to validate outputs, test accuracy, handle errors and edge cases, and confirm the solution behaves correctly before the demo.
>
> **Recommended CoCo tasks to demonstrate**
> 1. Synthetic data generation — realistic, referentially consistent synthetic or de-identified datasets
> 2. Data pipeline creation — dynamic tables, tasks, streams; incremental and near real time flows
> 3. Semantic model and **ontology** authoring — infer and generate semantic views, verified queries, and the ontology from a schema, then **validate them against natural language questions**
> 4. Streamlit report and app generation
> 5. **Connecting to additional sources via MCP** — Jira, Slack, Google Drive, or other MCP servers, so the agent can read from and act across those tools
> 6. Document and unstructured processing
>
> **Ways to showcase ingenuity in CoCo tool usage**
> 1. **Reusable and shareable skills** — "Clearly documented, reusable skills **remain the headline bonus**."
> 2. **MCP connectors to external tools** — "turning read only analysis into cross tool action"
> 3. Automations and scheduled runs
> 4. Custom tools and function calling
> 5. Multi agent orchestration
> 6. **Working across surfaces** — "the CoCo CLI, Desktop app, and **Snowsight Cloud Agents**, and surface it through the **Slackbot** where useful"
> 7. Guardrails and graceful fallback

## CONFIRMED TIMELINE & RUBRIC

| Phase | Dates |
|---|---|
| Prototype Submission | 13 Sept – **4 Oct 2026** |
| Prototype Evaluation (team absent) | 5 – 22 Oct 2026 |
| Final Shortlist | 23 Oct 2026 |
| Induction | 26 Oct 2026 |
| Grand Finale Demo Days | 27 – 30 Oct 2026 |

Real-World Relevance **30%** · Technical Execution **40%** · Solution Completeness **30%** · Prize **$10,000**

---

## GAP ANALYSIS — what the verbatim text changes

### G1. "Risk stratification" is explicitly invited — and we deliberately refused the term

**Brief:** *"Produce **risk stratification**, evidence retrieval, or a cited answer, never opaque predictions"*

**Our position (`plan.md` §4):** *"It is labelled 'documentation & coverage review priority' everywhere in the UI. Why the careful naming? Because calling it 'patient risk' would be a lie."*

We avoided the brief's own vocabulary for good clinical and legal reasons. But the brief names risk stratification as one of three acceptable outputs, and the only prohibition is **opaque** prediction. Our review-priority score is deterministic, rule-versioned, and fully cited — it is *exactly* transparent risk stratification.

Both competitors doing this use the word: SynapseCortex has "risk tiering," CareCompass has contraindication detection.

**Resolution — a positioning change at zero build cost.** Use the brief's vocabulary with explicit scope disclosure:

> **Care Readiness Risk Stratification** — stratifies *documentation, coverage, and surveillance* risk. Does **not** model clinical deterioration or prognosis. Every score opens to its rule, its version, and its evidence.

This satisfies the stated requirement, keeps us honest, and the transparency disclosure becomes a *differentiator* rather than a hedge. **Priority: HIGH. Cost: wording only.**

### G2. It is "patient **or** member 360" — F5 downgrades from FATAL

**Brief body:** *"unifies data into a patient **or** member 360"* (the title says "and", the requirement says "or").

`SCALE-REVIEW.md` **F5** marked missing household/member-360 as FATAL on brief-compliance grounds. That is wrong — patient 360 alone satisfies the requirement.

**However**, the underlying bug is real and independent: PM-JAY is **₹5 lakh per family per year**, `COVERAGE` is keyed on `patient_id`, therefore `COV-LIMIT-001` computes the wrong remaining limit for every PM-JAY patient. That is a *correctness* defect, not a compliance defect.

**Resolution: F5 severity FATAL → HIGH.** Fix the household keying because the rule is wrong; drop the full member-360 view from scope. **Saves effort.**

### G3. "Safety" questions are named and we have no explicit path for them

**Brief:** *"answers clinical, **safety**, or regulatory questions"*

Our Class A/B split covers *clinical judgment* (refused) and *record state* (answered). "Safety" is unmapped — and it is the axis both CareCompass (cross-specialty contraindication) and SynapseCortex (drug-safety flags) compete on.

Safety questions are answerable as Class B when framed as record state:
- "Is cardiotoxicity surveillance current?" → our surveillance gate **already is a safety gate**
- "Has a drug-interaction check been documented?" → documentation gate
- "Is the renal function adequate for this agent?" → our CrCl rule

**Resolution:** explicitly label the surveillance gate a **safety gate**, and add a Class B *safety* question family to the taxonomy (D10) and the eval set. Mostly relabelling work we have already built. **Priority: HIGH. Cost: low.**

### G4. MCP appears TWICE and we cut it — this is a scoring error

**Brief, "Recommended CoCo tasks" #5:** *"Connecting to additional sources via MCP — Jira, Slack, Google Drive, or other MCP servers, so the agent can read from and act across those tools."*

**Brief, "Ingenuity" #2:** *"MCP connectors to external tools — turning read only analysis into cross tool action."*

**Our position (`plan.md` §10):** *"Optional MCP — only if it survives the core... Skip entirely if connection setup threatens the core demo."*
**Our research (`coco-lifecycle-evidence.md`):** MCP rated **"LOW — cut-list item."** That assessment was wrong.

MCP is named in both lists. `plan.md` already sketches the right minimal shape: one reviewed documentation ticket in a synthetic workspace, carrying only a synthetic patient ID and an authenticated evidence link, with retry-idempotency proven.

**Resolution: MCP moves from cut-list to committed scope.** One connector, one action, idempotent. Natural fit: a coordinator escalates an unresolved documentation blocker → creates a tracked ticket. **Priority: HIGH. Cost: ~3 h.**

### G5. "Ontology" is named twice and we have no ontology artifact

**Planning phase:** *"outline the data model, **ontology**, and workflow"*
**Recommended task #3:** *"generate semantic views, verified queries, and **the ontology** from a schema, then **validate them against natural language questions**"*

We have a data model (31 tables) and a semantic view plan. We have `code_system` / `code` columns. **We have no explicit ontology artifact** — no concept registry, no relationship definitions, no code-system bindings.

This is a real gap: named twice, in the phase judges are told to look at first.

**Resolution:** author `CLINICAL_ONTOLOGY` — concepts (analytes, biomarkers, procedures, document types), their code-system bindings (LOINC, ICD-10, SNOMED, AJCC), synonyms as they appear in Indian reports (SGOT→AST, "platelets"→"PLT"→"thrombocytes"), and relationships (HER2_IHC *reflexes_to* HER2_FISH; ANC *derived_from* WBC × differential). This is genuinely useful — it is where the unit-normalisation registry (D2) and the extraction synonym handling belong. **Priority: HIGH. Cost: ~4 h, and it closes D2 simultaneously.**

### G6. "Working across surfaces" names specific surfaces we deprioritised

**Brief:** *"Demonstrate the same solution across the CoCo CLI, Desktop app, and **Snowsight Cloud Agents**, and surface it through the **Slackbot** where useful."*
**Our research:** rated **LOW** — "demo in one surface is enough."

Given Stage 1 is an 18-day *unattended* evaluation, multi-surface evidence is cheap and verifiable without us present. Snowsight Cloud Agents in particular means our Cortex Agent should be reachable from Snowsight, not only our Streamlit app.

**Resolution:** raise to MEDIUM. Ensure the agent is callable from Snowsight; capture CLI and Desktop evidence during normal work (we are already generating it). Slackbot only if trivial. **Cost: near zero for CLI/Desktop; ~1 h to verify Snowsight.**

### G7. "Reusable skills remain the headline bonus" — stronger wording than we assumed

Our research rated the `evidence-reconciliation` skill HIGH. The brief calls documented reusable skills **"the headline bonus."** That is the single strongest bonus signal in the text. `plan.md` §10 already specifies the skill and — importantly — the reuse proof (run against a second synthetic schema; show one successful mapping *and* one correctly refused ambiguity).

**Resolution: confirm as committed scope, not a differentiator to build "only after §4–§8 pass."** Protect it from schedule slip.

### G8. Confirmed with no change required

| Brief requirement | Our design | Status |
|---|---|---|
| "fully synthetic or de identified data only" | Seeded generator, 100% synthetic patient data | ✓ |
| "never opaque predictions" | R1 — LLM never produces a status; all outcomes from versioned SQL | ✓ Our strongest alignment |
| "cited evidence" | Per-claim evidence IDs + 6-check validator | ✓ |
| "combine structured with unstructured" | Structured tables + dual document corpora | ✓ |
| "question and answer experience with clear source evidence" | Ask + Evidence screen | ✓ — but must be the **centrepiece**, not one of six screens |
| Pipelines: "dynamic tables, tasks, streams" | 5 DTs + 3 Tasks + Streams | ✓ Exact match |
| "validate semantic views against natural language questions" | 80-question eval set + VQR | ✓ |

---

## ⚠️ Compliance note — the real medical reports

The brief mandates *"fully synthetic or de identified data only."*

`research/patient-reality/real-patient-dipali.md` is a study of **19 photographs of a real patient's records**, used to understand document formats and failure modes. No real data enters the system, and the file carries a disclaimer.

Two actions required:
1. **`plan.md` §15 action #4 — written consent from the teammate — status unknown. Must be confirmed.**
2. The submission must state unambiguously that the *system* contains only synthetic data, and that real reports informed *format research only*. Framed correctly this is a Real-World Relevance strength; framed loosely it is a compliance question we do not want asked.

---

## Net effect on scope

| Item | Before | After | Cost |
|---|---|---|---|
| Risk stratification vocabulary | Deliberately avoided | Adopted with scope disclosure | wording |
| Member/household 360 | FATAL (F5) | HIGH — fix keying bug only | reduced |
| Safety question path | Unmapped | Surveillance gate relabelled + question family | low |
| MCP connector | Cut-list | **Committed** | ~3 h |
| Clinical ontology | Absent | **Committed** (also closes D2) | ~4 h |
| Cross-surface evidence | LOW | MEDIUM | ~1 h |
| Reusable skill | "build after core" | **Protected scope** | unchanged |

Roughly **+8 hours committed, offset by the F5 reduction.** Every addition is directly traceable to a named line in the brief.
