# Snowflake Implementation Patterns for Healthcare

**Researched 2026-09-16. What Snowflake's own HCLS team recommends and what judges expect.**

> **Headline finding: Snowflake's official healthcare reference (`sf-hcls-solutions`) establishes a clear pattern judges will benchmark against: a real multi-table clinical data model, Cortex Agent with multiple tools (Analyst + Search + action), one-script idempotent setup, and a guided demo storyline. Dynamic tables for pipeline refresh and semantic views for governed analytics are the two features most commonly highlighted in Snowflake's own healthcare marketing but least commonly implemented by hackathon teams — using both is a differentiation signal.**

---

## 1. The sf-hcls-solutions benchmark (what judges compare you to)

### Clinical Quality and Patient Safety Agent
- **Data model**: 8 tables, 75K synthetic patients (PATIENTS, ADMISSIONS, DIAGNOSES, PROCEDURES, INFECTIONS, QUALITY_EVENTS, OUTCOMES, RISK_FACTORS). Intentional data quality degradation for demo impact (worsening trends over time).
- **Agent**: Cortex Agent with 3 tools: Cortex Analyst (text-to-SQL over semantic model), Cortex Search (PubMed 38M+ articles via Marketplace CKE), Email notification tool.
- **Demo flow**: scripted 6-step storyline (Discovery → Trends → Root Cause → Actionable → Evidence → Email). Not open-ended "ask anything."
- **Setup**: single idempotent script. Judges can reproduce.
- **What it does NOT have**: no document pipeline, no temporal model, no answer validation, no RLS/governance, no dynamic tables.

### What this tells us about judge expectations
1. **A real data model** — not 3 flat tables. 8+ tables with realistic clinical data.
2. **Multi-tool agent** — not just Search or just Analyst. The agent should orchestrate across both.
3. **Scripted demo** — guided storyline beats open-ended chat.
4. **One-script setup** — reproducibility is baseline.
5. **PubMed or equivalent real corpus** — at least one real, external knowledge source.

---

## 2. Dynamic Tables for clinical pipelines

### Why judges notice them
Dynamic tables are Snowflake's declarative pipeline primitive. Using them signals:
- You understand incremental refresh (not just batch scripts).
- You trust the platform to manage pipeline freshness.
- Your pipeline is a living system, not a one-time load.

### Recommended pattern for SAARTHI
```
RAW tables (immutable source)
  → Dynamic Table: HARMONIZED_CLINICAL_EVENT (parsed, normalized, typed)
    → Dynamic Table: READINESS_GATE_STATE (deterministic rules applied)
      → Dynamic Table: REVIEW_QUEUE (aggregated gate failures, weighted by days-to-visit)
```

Target lag options:
- `TARGET_LAG = '1 minute'` for the demo (shows "live" refresh when a document is ingested).
- `TARGET_LAG = DOWNSTREAM` for intermediate tables (refresh when consumed).

### Caveats
- Dynamic tables cannot call external functions or UDFs with side effects.
- Dynamic tables cannot reference streams directly — use a task to consume the stream into a staging table, then the DT reads from there.
- AI_PARSE_DOCUMENT and AI_COMPLETE cannot be called inside a DT definition (serverless functions with non-deterministic output). Use a task+stream for the AI extraction step, then the DT reads the extracted output.
- **This means**: RAW → (task+stream) → PARSED → (dynamic table) → HARMONIZED → (dynamic table) → GATE_STATE → (dynamic table) → REVIEW_QUEUE. The AI steps are task-driven; the deterministic steps are DT-driven.

---

## 3. Semantic Views for governed analytics

### Why they matter for this hackathon
- Semantic views are Snowflake's answer to "how do I get accurate NL2SQL."
- They are the recommended approach for Cortex Analyst (over stage-hosted YAML).
- They propagate row access policies and masking from underlying tables.
- Verified Query Repository (VQR) attaches human-verified SQL to specific question patterns — this is the "accuracy" story judges look for.

### Recommended semantic view structure for SAARTHI
One semantic view over the curated/consumption layer covering:
- **Entities**: patients, encounters, clinical events, documents, review issues
- **Metrics**: gate pass/fail counts, open issues per patient, days to next visit, time since last assessment
- **Time filters**: encounter_date, event_time, known_as_of
- **Verified queries**: pre-built for the 6 demo questions (Q1-Q6 from plan.md §11)

### What the VQR gives us
When a judge asks "which patients this week lack a final report?" and the Analyst returns the correct SQL because we pre-verified that exact question pattern — that reads as production-grade, not prototype.

---

## 4. Cortex Search chunking strategies for medical documents

### The problem
Medical documents (pathology reports, discharge summaries) have:
- Tables (lab values, synoptic fields) — must stay intact as chunks.
- Narrative sections (clinical history, microscopy) — need semantic chunking.
- Page boundaries that matter (citations must resolve to page numbers).

### Recommended approach
1. **Use AI_PARSE_DOCUMENT with `page_split=TRUE`** — gives per-page text.
2. **Chunk at the page level first** — each page is a chunk in Cortex Search. This preserves page-level citations.
3. **For long pages with multiple sections**: split on markdown headers (AI_PARSE_DOCUMENT LAYOUT mode produces markdown). Each H2/H3 section becomes a sub-chunk, tagged with its page index.
4. **For tables**: keep the table as a single chunk even if it spans multiple lines. AI_PARSE_DOCUMENT LAYOUT mode renders tables as markdown tables — don't split mid-table.
5. **Metadata columns on the search corpus table**:
   - `patient_id` (ATTRIBUTE — for scope filtering)
   - `doc_id` (ATTRIBUTE — for provenance)
   - `page_index` (ATTRIBUTE — for citation)
   - `doc_scope` (ATTRIBUTE — 'patient' or 'reference', for R6 corpus separation)
   - `doc_version` (ATTRIBUTE — for supersession tracking)
   - `text` (SEARCH column — the actual content)

### Two separate Cortex Search services (R6)
- **Patient-scope service**: indexed on documents where `doc_scope = 'patient'`. Attribute filter on `patient_id` injected server-side.
- **Reference-scope service**: indexed on documents where `doc_scope = 'reference'`. No patient_id filter (these are public documents). Filter on `jurisdiction` and `effective_date`.

---

## 5. Cortex Agent tool design

### What Snowflake recommends
- Agent tools should be SQL functions or Cortex Search/Analyst references.
- Keep tools narrow and well-named — the agent selects tools based on the tool description.
- Don't give the agent a "do anything" tool. Give it specific, scoped tools.

### For SAARTHI: 6 tools (matching plan.md §6)
1. `get_patient_facts` — SQL function, returns structured clinical data for a patient
2. `get_readiness` — SQL function, returns gate states with rule versions and evidence IDs
3. `search_patient_documents` — Cortex Search (patient-scope service), scope injected
4. `search_reference_documents` — Cortex Search (reference-scope service), no patient data
5. `cohort_query` — Cortex Analyst over semantic view
6. `create_review_task` — SQL function with idempotency key, requires explicit action

### The router-first pattern
Even without the agent, these 6 tools can be called directly by a deterministic Python router in Streamlit. The router classifies the question → selects the tool → calls it → formats the response. The agent layer wraps the same tools with natural language understanding.

---

## 6. Snowflake Git integration for reproducibility

### The pattern sf-hcls-solutions uses
- Repository connected via `CREATE GIT REPOSITORY`.
- `EXECUTE IMMEDIATE FROM @repo/branches/main/setup.sql` — one command deploys everything.
- Teardown script for clean removal.

### For SAARTHI
```sql
CREATE GIT REPOSITORY saarthi_repo
  API_INTEGRATION = github_api_integration
  GIT_CREDENTIALS = github_secret
  ORIGIN = 'https://github.com/<org>/patient-360.git';

-- Deploy:
EXECUTE IMMEDIATE FROM @saarthi_repo/branches/main/sql/setup.sql;

-- Teardown:
EXECUTE IMMEDIATE FROM @saarthi_repo/branches/main/sql/teardown.sql;
```

This means a judge can deploy the entire system with one SQL command. Matches the sf-hcls-solutions convention.

---

## 7. Features that signal "production-ready" to Snowflake judges

| Feature | Signal | Implementation cost |
|---|---|---|
| Dynamic tables with target lag | "This is a live pipeline, not a batch job" | Medium — design the DAG carefully |
| Semantic view with VQR | "NL2SQL is governed and accurate" | Medium — need verified queries |
| Row access policies (Enterprise) | "Patient data is protected at the platform level" | Low — one policy, applied to tables |
| Object tags (PHI, PII) | "Data is classified" | Low — one-time tagging |
| Cortex Guard on generation | "Model safety is handled" | Trivial — one flag |
| Git integration + one-script deploy | "Reproducible and version-controlled" | Low |
| Streams + Tasks for ingestion | "New data triggers processing automatically" | Medium |
| Resource monitor | "Cost is controlled" | Trivial |
| Data Metric Functions | "Data quality is monitored natively" | Medium (Enterprise only) |

---

## Sources

Snowflake-Labs/sf-hcls-solutions (GitHub) · docs.snowflake.com: Dynamic Tables, Semantic Views, Cortex Search, Cortex Agents, Git Integration · Snowflake healthcare marketing materials · Snowflake Summit 2025/2026 healthcare sessions.
