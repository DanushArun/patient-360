# Saarthi -- Project Overview

**Last updated: 27 September 2026**

---

## What is Saarthi?

Saarthi is a **pre-treatment readiness system for cancer daycare centres** in India. Before a patient receives chemotherapy, a coordinator must verify approximately 16 things: blood counts are safe, documents exist, insurance is approved, and identity is verified. Today this is manual chart-flipping across multiple systems, often causing avoidable delays, repeat visits, and missed safety checks.

Saarthi automates this by:
1. Pulling clinical data from hospital systems into a governed Snowflake store
2. Running 16 versioned SQL rules against that data (never AI -- Rule R1)
3. Exposing a dashboard where coordinators see every check at a glance
4. Providing a Cortex Agent that answers bounded record questions with citations
5. Generating a multilingual family checklist so patients arrive prepared

**The LLM never decides.** Every pass, fail, conflicting, or not_evaluated comes from a SQL rule with a version number. The AI extracts information from documents, phrases answers, and ranks passages. Clinical decisions are always referred to the treating practitioner.

---

## Architecture at a Glance

```
Family/Patient --> [Navigator View: bring-list in 5 languages]
                        ^
                        | derived from gates
Coordinator --> [Census Homepage] --> [Patient View]
                                        |
                            +-----------+----------+----------+
                            |           |          |          |
                     [Ask the Record] [Timeline] [Checklist] [Evidence Panel]
                            |                                      |
                     Cortex Agent                          [Review Actions]
                     (8 tools)                             Request / Escalate
                            |
              +-------------+-------------+
              |             |             |
        [Patient Docs] [Reference Docs] [Readiness]
        Cortex Search   Cortex Search    SQL Rules
              |             |             |
              +------+------+------+------+
                     |
              [Governed Clinical Store]
              35 tables, RAP on CURRENT_USER()
              USE SECONDARY ROLES NONE
```

### Three Layers

| Layer | What | Technology |
|---|---|---|
| **Frontend** | Next.js 16 dashboard (2 routes, 5 API endpoints) | React 19, TypeScript, Tailwind, shadcn/ui |
| **Agent** | Cortex Agent with 8 tools, Class A/B classifier, 6-check answer validator | Snowflake Cortex, AI_FILTER, AI_CLASSIFY |
| **Backend** | 35 tables, 16 rules, 18 procedures, 2 Cortex Search services, 1 semantic view, 4 dynamic tables, 6 tasks | Snowflake SQL, key-pair JWT auth |

---

## The Seven Architecture Rules

These are the product. Violating one is a defect.

| Rule | Statement |
|---|---|
| **R1** | The LLM never decides. It extracts, interprets, ranks, and phrases. Every status, number, threshold comparison, and gate outcome comes from SQL against a versioned rule. |
| **R2** | Three clocks: `event_time` (when it happened), `source_recorded_at` (when the source recorded it), `ingested_at` (when Saarthi received it). Every answer carries `known_as_of`. |
| **R3** | Missingness is a type, never a NULL: present, explicitly_negative, pending, not_received, conflicting, unreadable, superseded. "Not received" is never "negative". |
| **R4** | Identity is ABHA-anchored and federated. Never join on name. Ambiguous matches quarantine and contribute no evidence. |
| **R5** | Scope is enforced server-side before retrieval, in three layers: (1) binding from PATIENT_BINDING on CURRENT_SESSION, (2) care-team + consent check on CURRENT_USER, (3) per-query consent revalidation. |
| **R6** | Two document corpora, never mixed in one ranked list. Patient docs and reference docs are physically separate Cortex Search services. |
| **R7** | Extraction is never trusted on a single pass for safety-critical fields. Two passes, two different model families. Disagreement marks the value `conflicting` and the gate returns `not_evaluated`. |

---

## The 16 Readiness Rules

Every rule has an ID, a version, a threshold source, and produces one of four outcomes:
- **pass** -- requirement met
- **fail** -- requirement not met (action needed)
- **not_evaluated** -- insufficient evidence (missing lab, unreadable document)
- **conflicting** -- two sources disagree (human reconciles)

| Category | Rule ID | What it checks | Source |
|---|---|---|---|
| **Identity** | ID-LINK-001 | ABHA-linked or manually verified identity | ABDM |
| **Identity** | ID-QUAR-001 | No quarantined identity matches | Internal |
| **Coverage** | COV-AUTH-001 | Pre-authorisation approved and current | PM-JAY / TN-CMHIS / MH-MJPJAY |
| **Coverage** | COV-LIMIT-001 | Treatment cost within annual coverage limit | IRDAI |
| **Documentation** | DOC-PATH-001 | Final pathology report on record | NCCN |
| **Documentation** | DOC-HER2-001 | HER2 status from IHC/FISH/NGS | ASCO-CAP 2018 |
| **Documentation** | DOC-DISC-001 | No cross-source discordance in reports | Internal |
| **Clinical** | CLIN-ANC-001 | Absolute neutrophil count >= 1500 | NCCN/ASCO |
| **Clinical** | CLIN-PLT-001 | Platelet count >= 100,000 | NCCN/ASCO |
| **Clinical** | CLIN-CRCL-001 | Creatinine clearance (Cockcroft-Gault) meets per-agent minimum | NCCN/FDA |
| **Clinical** | CLIN-BILI-001 | Bilirubin within per-agent limit | FDA label |
| **Surveillance** | SURV-LVEF-001 | LVEF measured and current | FDA label (trastuzumab) |
| **Surveillance** | SURV-LVEF-002 | No LVEF drop beyond delta threshold | NCCN |
| **Endocrine** | ENDO-HBA1C-001 | HbA1c within threshold (advisory, never blocks) | CPOC 2022 |
| **Endocrine** | ENDO-DEXA-001 | DEXA scan current per T-score band | NCCN v4.2024 |
| **Surgery** | SURG-CLEAR-001 | Post-operative clearance (wound/infection/signature) | FDA + consensus |

Three thresholds are practice consensus (not guideline-mandated): the 21-day post-op interval, the 42-day contaminated-wound extension, and the surgical-clearance checklist. These are labelled with a `provenance_note` wherever surfaced.

---

## The 8 Agent Tools

The Cortex Agent (`SAARTHI_AGENT`) has access to 8 tools. It cannot select a patient -- the patient comes from a server-side binding. `patient_id` is banned from every tool input schema.

| Tool | Procedure | What it does |
|---|---|---|
| **GetPatientFacts** | `GET_PATIENT_FACTS(domain)` | Structured clinical facts by domain: demographics, labs, coverage, treatment plan, encounters, identity |
| **GetReadiness** | `GET_READINESS(encounter_ref, known_as_of)` | Returns all readiness gate outcomes for the bound patient. Calls `evaluate_gates` internally. |
| **SearchPatientDocuments** | `SEARCH_PATIENT_DOCUMENTS(query)` | Searches the patient document corpus. Returns chunk IDs only; text re-fetched from the RAP-protected table. |
| **SearchReferenceDocuments** | `SEARCH_REFERENCE_DOCUMENTS(query, jurisdiction, effective_date)` | Searches the reference corpus (PM-JAY, guidelines, drug labels). No patient data involved. |
| **CohortQuery** | `COHORT_QUERY(question)` | Cortex Analyst over the semantic view. Unavailable while a patient is bound (different scope). |
| **GetTimeline** | `GET_TIMELINE(known_as_of)` | Chronological event list with all three R2 clocks and facility info. |
| **GetChanges** | `GET_CHANGES(from_ts, to_ts)` | Diffs two time states: what events are new, what values changed since a given timestamp. |
| **CreateReviewTask** | `CREATE_REVIEW_TASK(issue_id, action, reason, idempotency_key)` | The only write tool. Files a review task (request evidence, escalate, accept, reject). Idempotent. |

### 4 Internal Procedures (never agent-visible)

| Procedure | Purpose |
|---|---|
| `BIND_PATIENT` | Called by the UI on patient selection. The one place `patient_id` legitimately enters the system. |
| `EVALUATE_GATES` | Called by GetReadiness and the refresh task. The single source of truth for rule outcomes. |
| `VALIDATE_ANSWER` | Post-agent, pre-display. 6 checks including AI_FILTER for hallucination, with fail-closed behaviour. |
| `CLASSIFY_QUESTION` | Pre-agent. Keyword -> structure -> LLM -> default Class A. Routes clinical questions to refusal. |

### 4 Agent Skills

| Skill | Purpose |
|---|---|
| **clinical-question-routing** | Class A/B classification. Class A (clinical judgment) is always refused. Class B (record state) is answered. |
| **evidence-retrieval** | Selects the correct corpus (patient vs. reference, Rule R6), assembles page-anchored citations. |
| **evidence-reconciliation** | Matches assertions across sources: supports, supersedes, conflicts_with, discordant_across_specimens. Never auto-resolves disagreements. |
| **risk-stratification** | Reports gate outcomes from versioned SQL rules. Does not predict, model deterioration, or compute survival. |

---

## Access Control Model

Three protections, layered:

1. **Binding** -- `BIND_PATIENT(patient_id)` checks care-team membership + active consent using `CURRENT_USER()` (not `CURRENT_ROLE()` -- that is a bypass under owner's-rights elevation). Every API request opens a fresh Snowflake session, binds, does work, releases binding, closes.

2. **Row Access Policy** -- `patient_scope` policy keyed on `CURRENT_USER()` applied to data tables. Cortex Search ignores RAP (verified), so document content is served through a governed re-fetch path.

3. **Secondary Roles** -- Every session runs `USE SECONDARY ROLES NONE` to prevent privilege escalation through back-door `ACCOUNTADMIN`.

The connection role is `SAARTHI_APP` (not ACCOUNTADMIN). Five application roles exist: `SAARTHI_APP`, `SAARTHI_COORDINATOR`, `SAARTHI_ONCOLOGIST`, `SAARTHI_NAVIGATOR`, `SAARTHI_JUDGE`.

---

## Data Model

13 patients (12 daycare cohort + 1 deep-case), all synthetic. 35 tables across 5 schemas:

| Schema | Tables | Content |
|---|---|---|
| **GOVERNANCE** (8) | Organization, Facility, Department, Practitioner, Care_Team, Patient_Binding, Consent, Security_Event | Who can see what |
| **CORE** (8) | Patient, ID_Map, Referral, Encounter, Clinical_Event, Treatment_Plan, Coverage, Authorization | Clinical record |
| **DOCUMENTS** (4) | Document, Doc_Page, Doc_Chunk, Raw_FHIR_Bundle | Source documents and FHIR |
| **EVIDENCE** (4) | Assertion, Evidence_Link, Answer_Run, Evidence_Packet | Extraction and audit trail |
| **OPERATIONAL** (10) | Clinical_Ontology, Unit_Registry, Rule_Catalog, Review_Issue, Review_Task, Readiness_State, Scheme_Registry, Notification, Source_System, Ingestion_Run | Rules, tasks, operational state |

---

## Class A / Class B -- A Legal Boundary

NMC Telemedicine Practice Guidelines 2020 prohibit AI platforms from clinical counselling or prescribing. The registered practitioner remains solely accountable.

- **Class A** -- clinical judgment ("should she proceed?", "is this safe?", prognosis, dosing). **Always refused, every role.** Offers an evidence packet addressed to the named treating practitioner.
- **Class B** -- record and coverage state ("what do we have?", "what's missing?", "what contradicts what?"). Answered deterministically with citations.

Default to Class A when ambiguous. Never output a confidence percentage.

---

## What is Built vs. Not Built

| Component | Status |
|---|---|
| Backend (35 tables, 16 rules, 18 procedures, 2 search services, agent, MCP) | **Built and live** |
| Next.js frontend (census + patient view with 3 tabs) | **Built and live** |
| Streamlit frontend (4 screens, fixture-driven) | **Built, not connected to live backend** |
| Navigator View (standalone screen) | Designed only |
| Judge Console (8 probes) | Designed only |
| Standalone Review Queue | Designed only (Streamlit fixture version exists) |
| R7 two-pass extraction (end-to-end) | Deployed, not fired live (queue empty) |

Refer to `IMPLEMENTATION-STATUS.md` for the complete status of every component.
