# SAARTHI: architecture and impact

Submission answers for **Section 2 (Architecture Diagram)** and **Section 3 (Impact Statement)**. Compiled from
`README.md`, `docs/project/PROJECT-OVERVIEW.md`, `planning/revised-architecture/ARCHITECTURE-HANDOFF.md`,
`backend/skills/README.md`, `evidence/coco/README.md`, `docs/submission/DECK-OUTLINE.md` and
`planning/research/patient-reality/`. Synthetic data only; engineering checks are not clinical validation.

> **SQL decides. AI extracts and phrases. The practitioner stays accountable.**

## 2. Architecture

Source records and documents land in a governed Snowflake store, pass through parsing, two-model extraction and
versioned SQL rules, and come back to the coordinator as a cited answer stamped with `known_as_of`.

### System and data flow

```mermaid
flowchart TB
  subgraph SRC["Data sources, all synthetic"]
    S1["Structured: FHIR R4 bundles, labs, encounters, ABHA ID map, coverage, PM-JAY pre-auth, claims"]
    S2["Patient documents: 22 PDFs, pathology, referrals, auth letters"]
    S3["Reference documents: 7 public PDFs, 692 pages"]
  end
  subgraph ING["Processing: Tasks, Stream, Dynamic Tables"]
    P1["FLATTEN_FHIR"]
    P2["PARSE_DOCUMENTS with AI_PARSE_DOCUMENT"]
    P3["EXTRACT_ASSERTIONS: 2 passes, 2 model families"]
    P4["RECONCILE_EVIDENCE: supersedes, conflicts, discordant"]
    P5["EVALUATE_GATES: 16 versioned SQL rules"]
    P2 --> P3 --> P4 --> P5
    P1 --> P5
  end
  STORE[("Governed store: 35 tables in GOVERNANCE, CORE, DOCUMENTS, EVIDENCE, OPERATIONAL")]
  subgraph ANS["Answer path"]
    C1["CLASSIFY_QUESTION: Class A refused, Class B answered"]
    AG["Cortex Agent with 8 scoped tools"]
    T1["Cortex Search: patient docs"]
    T2["Cortex Search: reference docs"]
    T3["Cortex Analyst on semantic view"]
    T4["Readiness, timeline, changes"]
    T5["CREATE_REVIEW_TASK: only write, idempotent"]
    C1 --> AG
    AG --> T1
    AG --> T2
    AG --> T3
    AG --> T4
    AG --> T5
  end
  UI["Next.js dashboard: census, patient 360, source viewer, review queue, navigator"]
  S1 --> P1
  S2 --> P2
  S3 --> T2
  P5 --> STORE
  STORE --> ANS
  UI -->|"BIND_PATIENT, scope fixed server-side"| C1
  ANS -->|"cited answer with known_as_of"| UI
```

Security across every layer: row access policy keyed on `CURRENT_USER()`, `USE SECONDARY ROLES NONE`, consent
re-checked on every tool call, and no tool accepts a `patient_id`.

### CoCo CLI skills and how they connect

Four skills in `backend/skills/`, coordinated by `TASK_SAARTHI_ORCHESTRATOR`. A skill describes how to use the tools;
patient scope lives in owner's-rights procedures the agent cannot reach.

| Skill | Wraps | Runs on |
|---|---|---|
| `clinical-question-routing` | Class A/B cascade in `classify_question.sql` | Every question |
| `evidence-retrieval` | Chooses the patient or reference corpus and assembles page-anchored citations | Every question |
| `risk-stratification` | Reports outcomes from the 16 versioned SQL rules; no prediction | Readiness questions |
| `evidence-reconciliation` | Matches findings across sources; never auto-resolves a disagreement | Conflict questions |

- **Reuse proof:** `reuse-tests/` runs evidence-reconciliation against a second schema with different column names,
  producing one successful mapping and one ambiguity it refuses to resolve.
- **CoCo across the lifecycle:** `evidence/coco/` holds planning (52 sessions), development, execution and testing
  manifests, with checkable session IDs and query IDs.

### Data sources

- **Structured:** FHIR R4 bundles, HL7-style labs, encounters, treatment plans, ABHA identity links, coverage,
  PM-JAY pre-authorisation, claims.
- **Unstructured, patient:** 22 synthetic cohort PDFs, including pathology reports, referrals and authorisation letters.
- **Unstructured, reference:** PM-JAY manual, FDA trastuzumab label, ICMR, NCG and AIIMS guidelines.
- The two corpora are kept in physically separate Cortex Search services (rule R6).

### How modules plug together

- **Rules are data.** `RULE_CATALOG` stores ID, version, threshold, severity and guideline. A new check is new rows plus
  fixtures.
- **Scope is server-side.** Tools take no patient selector, so the UI, agent and skills can each be swapped.
- **Five frozen contracts:** schema, tool signatures, answer JSON, rule definition, error shape.
- **Three clocks:** event, source-recorded and ingested times give an answer as known at any past moment.

## 3. Impact

The patient journey fails when the record fails. The published figures below describe the gap SAARTHI targets; the
engineering results show what the prototype already does on synthetic data.

### The problem today

| Figure | Source |
|---|---|
| 14% of scheduled chemo visits missed, median delay 13.75 days (n=870, Indian tertiary centre) | Cancer Reports 2020, PMC7941559 |
| 74% of breast cancer patients consult two or more facilities; 82.6% hit a delay | TMC breast cancer cohort studies |
| 85% of Tata Memorial patients come from outside Mumbai; trips of 500 to 1,400 km | TMC, IIPS-TMC study |
| 2–5 minutes available to an oncologist for pre-consult chart review | `planning/research/patient-reality/` |

### What the prototype shows (synthetic data only)

| Measure | Result |
|---|---|
| Readiness checks automated | 16 versioned SQL rules, each with a cited source row or page |
| Rule fixtures | 80 written; 28 passed live on the earlier account |
| Two-model document extraction | 68 findings verified; 1 invalid page rejected instead of trusted |
| Offline test suite | 405 Python and 257 web unit tests passing |
| Clinical-judgment questions | Refused for every role and routed to the named treating practitioner |

### How to state time saved

```
monthly hours saved  = eligible visits × minutes saved per readiness check ÷ 60
avoided wasted trips = visits per month × share blocked by a gap that could have been caught earlier
```

Fill these in from a timed test: two or three people review the same synthetic patient by hand and then with SAARTHI.
Report the measured minutes and the sample size.

### Scalability

- Snowflake-native: Dynamic Tables, Tasks, Cortex Search and row access policies scale per hospital.
- Separate search services per tenant are part of the design.
- Indian standards (ABHA, FHIR R4, PM-JAY, NHCX) make onboarding a hospital mapping work, not a rewrite.
- New specialties such as dialysis, transplant or cardiac surgery become new rule rows.

### Beyond the demo

- Insurer pre-authorisation pre-check to catch denials before admission.
- NABH audit packets from the versioned answer history.
- A family bring-list in five languages for the 14 to 21 days between cycles.
- The reconciliation skill reused by other teams on their own schemas.

### Not yet live, per `IMPLEMENTATION-STATUS.md`

- The four skills are written but not loaded into the agent; the deploy step is unverified.
- The seven Tasks are created but suspended, so no scheduled run has been shown.
- The answer validator exists but is not in the answer path.
- 80 eval questions written, none scored; no baseline comparison yet.
- 12 of 100 planned patients; localhost, single operator.
