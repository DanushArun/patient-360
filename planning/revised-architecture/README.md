# SAARTHI — Revised Architecture

**5 detailed draw.io diagrams built from 24 research files and 19 real patient report photos.**

Open each `.drawio` file in [draw.io](https://app.diagrams.net) (free, no account needed).

---

## The 5 Diagrams

### 01-system-overview.drawio
**Start here.** Written for someone who is NOT a medical professional.

Shows:
- **Who uses the system** — oncologist (2-minute chart review), coordinator (between-cycle gap), patient's family (bring-list before traveling 1,400 km)
- **The problem it solves** — records don't travel between hospitals in India. One patient has 7 identifiers across 3 hospitals and 0 national health ID. Discordant results between labs go unnoticed.
- **What the system does** — 5 readiness gates (clinical, surveillance, documentation, coverage, identity), each with a rule ID, version, and click-through to the source
- **What it does NOT do** — never recommends treatment, never predicts, never displays a confidence percentage

### 02-data-pipeline.drawio
**The most detailed diagram.** Shows every step from synthetic data generation to validated answer.

7 layers:
1. **Local generation** — seeded fact ledger → projections → documents → corruptions → eval questions
2. **Snowflake RAW** — internal stages, raw tables (18 tables), streams for change detection
3. **Document processing** — AI_PARSE_DOCUMENT → typed extraction → deterministic reconciliation (Task-driven, NOT Dynamic Tables — AI steps are non-deterministic)
4. **Harmonization** — 5 Dynamic Tables for normalized events, readiness gates, review queue, scheme eligibility, treatment plan
5. **Search & analytics** — dual Cortex Search (patient + reference, NEVER merged), semantic view + verified query repository
6. **Intelligence** — Class A/B classifier → 6 SQL procedures → deterministic router (primary) / Cortex Agent (layer) → 5-check answer validator
7. **Output & audit** — ANSWER_RUN (pointers not content for DPDP compliance), Cortex Guard, QUERY_HISTORY for leakage proof

Every Snowflake feature annotated with ❄️. Every research source annotated with 📄.

### 03-security-architecture.drawio
**The diagram that beats every competitor.** Shows the R5 three-layer defense in detail.

- **Layer 1** — app role has NO USAGE on search services (why: Cortex Search ignores row access policies)
- **Layer 2** — stored procedure reads CURRENT_USER(), injects scope from ROLE_PATIENT_MAP (why: question can never supply scope)
- **Layer 3** — search returns chunk IDs only, content re-fetched through governed tables (why: even a leaked ID yields nothing)

Side-by-side comparison with every competitor's confirmed security gaps. The Judge Console security probes. Full legal basis (DPDP, BSA, NMC, adverse inference doctrine).

### 04-data-model.drawio
**18 tables across 4 schemas.** Every field, every relationship, every constraint.

Key design decisions annotated:
- Three timestamp columns on every evidence-bearing table (R2)
- missingness_state enum on ASSERTION (R3 — "not received" ≠ "negative")
- scope field on DOCUMENT (R6 — corpus separation starts at registration)
- link_status on ID_MAP (R4 — quarantined = contributes no evidence)
- Pointers not content in ANSWER_RUN (DPDP erasure compliance)
- SCHEME_REGISTRY + SCHEME_ELIGIBILITY for government scheme matching
- FACILITY_REGISTRY for multi-hospital tracking
- TREATMENT_PLAN versioned (Dipali had 4 changes in 18 months)

Volume model: ~85,000 rows for 100 patients.

### 05-screens-workflow.drawio
**How the 9-stage chemo cycle maps to 6 screens.** Each screen annotated with:
- Which user, at which stage, in which moment
- Exactly what they see
- What real failure it prevents
- What actions are available

Includes:
- **Review Queue** (coordinator, Stage 9) — open gate failures sorted by urgency
- **Patient 360** (oncologist, Stage 3) — gate strip + facility timeline + clinical sections in review order
- **Ask + Evidence** (any role, Stages 4/9) — cited answers with known_as_of slider, evidence pane, Class A refusal
- **Review + History** (coordinator, Stage 9) — task lifecycle, version chain, ANSWER_RUN history
- **Judge Console** (hackathon judges) — live security probes, metrics, CoCo evidence index
- **Family View** (caretaker, Stage 1) — bring-list in Hindi/Tamil/Bengali/Marathi, eligible schemes, "your treating team decides"
- **Coverage Gap → Scheme Finder** detail — when PM-JAY ceiling is exhausted, shows Rashtriya Arogya Nidhi, state schemes, NGOs

---

## Visual Language (consistent across all 5 diagrams)

| Color | Meaning |
|---|---|
| Blue border | AI / Cortex component (Search, Agent, Analyst, AI functions) |
| Green border | Dynamic Table (auto-refreshing, deterministic) |
| Purple border | Task / Procedure (triggered by stream or manual action) |
| Amber border | Guard / Validator (can refuse or strip) |
| Red border | Refusal / Stop (Class A, security denial) |
| Grey border | Data store (tables, stages) |
| Dashed grey | External system / reference data |
| Yellow note | Annotation explaining WHY something is designed this way |
| Blue badge | Architecture rule (R1-R6) |
| Cyan badge | Snowflake feature (❄️) |
| Yellow badge | Research source (📄) |

---

## Snowflake Features Used (14 distinct)

1. ❄️ Cortex Search (×2 services — patient + reference)
2. ❄️ Cortex Analyst (Semantic View + Verified Query Repository)
3. ❄️ Cortex Agent (AGENT_RUN via SQL)
4. ❄️ Cortex Guard (model safety)
5. ❄️ Cortex TRANSLATE (bring-list in Indian languages)
6. ❄️ AI_PARSE_DOCUMENT (LAYOUT mode, page_split)
7. ❄️ AI_COMPLETE (typed extraction)
8. ❄️ AI_FILTER (polarity checking in validator)
9. ❄️ Dynamic Tables (×5 — harmonized events, gates, queue, schemes, treatment plan)
10. ❄️ Streams + Tasks (document processing pipeline)
11. ❄️ Stored Procedures (6 scoped tools)
12. ❄️ Row Access Policies + Masking Policies + Object Tags
13. ❄️ QUERY_HISTORY / ACCESS_HISTORY (leakage proof)
14. ❄️ Git Integration (one-script deploy)

---

## Research Backing

Every design decision traces to one of the 24 research files in `planning/research/`. The research index is at `planning/research/README.md`.
