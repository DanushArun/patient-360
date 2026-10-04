# SPEC.md Review — 21 Issues Found

**Reviewed 2026-09-17. Every issue traced to a specific line in SPEC.md and cross-checked against research files and runtime gate results.**

---

## CRITICAL — Would cause build failure or lose the competition (7)

### C1. CURRENT_USER() returns the APP OWNER in container runtime, not the end user

**Where**: §2.2 Tool 1 (get_patient_facts), Appendix A (ROLE_PATIENT_MAP RAP)

The entire R5 scope injection mechanism relies on:
```
CURRENT_USER() → ROLE_PATIENT_MAP → patient_id filter
```

But `platform-constraints.md` §FINDING 3 and `streamlit-container-runtime.md` both state: Streamlit container runtime runs as the **owner role**. In an owner's-rights stored procedure called from a container-runtime Streamlit app, `CURRENT_USER()` returns the **Streamlit owner**, not the logged-in person.

**This means**: Every tool reads the owner's patient list, not the end user's. The scope injection is broken. The competitors we criticised for cosmetic auth may have the same problem (unverified) — and our spec has the same bug.

**Fix options**:
1. Use Cortex Agent's `is_immutable_session_attribute: true` to pass user identity. Read back via `SYS_CONTEXT('SNOWFLAKE$SESSION_ATTRIBUTES', 'user_id')` in RAP and procedures. This is Snowflake's documented multi-tenancy pattern.
2. Pass the authenticated user via Streamlit's `st.experimental_user` (returns email in container runtime with OAuth). Inject it into the procedure call as a parameter — but then the question CAN supply the identity. Need a mechanism to make this trustworthy.
3. Use session variables set at login: `ALTER SESSION SET user_id = :authenticated_user` then read via `CURRENT_SESSION()` or `SYS_CONTEXT`. But session variables are modifiable.

Option 1 (immutable session attribute) is the only one that matches R5's "cannot be overridden by the question." But we noted in `platform-constraints.md` that this needs empirical testing. **This must be resolved before a single line of scope-dependent code is written.**

**Severity**: If this isn't fixed, every tool, every RAP, and every demo of "scope can't be bypassed" is theater. This is the exact accusation we're making against CareCompass.

---

### C2. DT_READINESS_STATE contradicts the rule engine design

**Where**: §10.1 vs §1.4

§1.4 says the rule engine is a **stored procedure** because it needs `known_as_of` as a parameter. DTs have no parameters.

§10.1 says DT_READINESS_STATE is a "materialization of the rule engine for the current time."

These contradict. A DT cannot call a stored procedure. So DT_READINESS_STATE must **reimplement** all 13 rules in pure SQL inside the DT definition. That means:
- Two copies of every rule (procedure + DT) that must stay in sync.
- Any rule change must be made in two places.
- The DT version can only evaluate at "current time" (no known_as_of), making it a fundamentally different computation.

**Fix**: Either:
1. **Drop DT_READINESS_STATE.** The evaluate_gates procedure IS the rule engine. The review queue screen calls it with `known_as_of = CURRENT_TIMESTAMP()` for each patient. This is simpler, single-source, but means the queue isn't pre-materialized (slower page load for 100 patients).
2. **Make DT_READINESS_STATE a simplified version** that only checks the latest evidence (no known_as_of). The procedure handles historical queries. Document explicitly that these are two different computations — the DT is an optimization, not the truth.
3. **Use a Task on a schedule** instead of a DT — the Task calls the procedure for each patient with `known_as_of = CURRENT_TIMESTAMP()` and writes results to a regular table. Refreshes every minute. Same effect as a DT but can call the procedure.

Option 3 is cleanest. Be honest about the design choice.

---

### C3. PATIENT table is missing weight_kg — CrCl calculation is impossible

**Where**: §1.3 (CLIN-CRCL-001 rule), §10.1 (DT_HARMONIZED_EVENTS Cockcroft-Gault)

Cockcroft-Gault: `CrCl = ((140 - age) * weight_kg * [0.85 if female]) / (72 * creatinine)`

The PATIENT table (§ data model, 002_core_tables.sql) has: name, dob, gender, district, state, primary_language. **No weight_kg.** CrCl can't be calculated.

**Fix**: Add `weight_kg FLOAT` to PATIENT. It may also need `height_cm FLOAT` for BSA-based dosing (though that's out of scope for readiness checks). Weight comes from nursing assessment at each visit — it should arguably be on ENCOUNTER or CLINICAL_EVENT (event_type = 'vitals'), not PATIENT (weight changes between cycles).

**Recommendation**: Add a vitals event type to CLINICAL_EVENT: `event_type = 'vitals', code = 'WEIGHT', value_num = 65.0, unit = 'kg'`. The Cockcroft-Gault calculation joins the most recent weight vitals event. This is clinically correct (weight IS per-encounter, not static).

---

### C4. No Cortex Agent specification

**Where**: Missing entirely from SPEC.md

The 6 tools are specified but the agent that wraps them is not. Missing:
1. `CREATE CORTEX AGENT` DDL (or the SQL function call pattern)
2. **System prompt** — the single most important piece of text in the system. It defines:
   - How the agent selects tools
   - How it phrases answers (citation format, limitation disclosures)
   - What it refuses (Class A questions)
   - How it structures output for the validator to parse
3. Tool descriptions — the agent chooses tools based on their descriptions, not their SQL signatures
4. Whether we're using AGENT_RUN() SQL function (works from warehouse runtime) or the REST API (needs container runtime)
5. Token/context limits — how many tool results can fit in context?
6. Retry behavior — what if a tool call fails?

Without this, a builder doesn't know how to wire the agent to the tools.

---

### C5. No answer output schema — the validator can't parse what it can't define

**Where**: §3 (Answer Validator) assumes structured output but never specifies the format

The validator needs to:
- Extract individual claims from the answer
- Find the evidence_id attached to each claim
- Determine claim type (numeric, date, status)
- Parse the claim's asserted value

This requires the LLM to produce answers in a defined schema. What schema?

**Fix**: Specify the answer format:
```json
{
  "classification": "CLASS_B",
  "claims": [
    {
      "text": "ANC is 2100/µL, within the safe range",
      "evidence_ids": ["CE-LAB-441"],
      "claim_type": "numeric",
      "asserted_value": 2100,
      "asserted_unit": "cells/uL"
    }
  ],
  "limitations": [],
  "overall_status": "supported",
  "known_as_of": "2026-09-18T09:00:00"
}
```

This schema must be part of the agent system prompt AND the validator input contract. They are coupled.

---

### C6. Missing tables: FACILITY_REGISTRY, SCHEME_REGISTRY, TREATMENT_PLAN

**Where**: Referenced in revised-architecture/04-data-model.drawio and DT specs but absent from SPEC.md

The drawio data model shows 18 tables. The SPEC references:
- DT_SCHEME_ELIGIBILITY "matches against SCHEME_REGISTRY" — no SCHEME_REGISTRY spec
- DT_TREATMENT_PLAN "derived from CLINICAL_EVENT" — but real-patient-dipali.md shows 4 plan changes; a dedicated TREATMENT_PLAN table was designed for this
- FACILITY_REGISTRY — maps spoke/hub/lab facilities, needed for multi-hospital identity story

These are not optional. The scheme eligibility feature can't work without SCHEME_REGISTRY. The treatment plan versioning story — which comes directly from Dipali's real reports — can't be told without TREATMENT_PLAN.

---

### C7. DOC_PAGE → DOC_CHUNK transformation unspecified

**Where**: §4 (pipeline outputs DOC_PAGE) vs §6 (search service reads DOC_CHUNK)

The pipeline inserts into DOC_PAGE. The Cortex Search service selects from DOC_CHUNK. There is no specification for how DOC_PAGE becomes DOC_CHUNK. This is the chunking logic — arguably the most important part of the retrieval quality story.

**Fix**: Specify:
- Is DOC_CHUNK a Dynamic Table over DOC_PAGE?
- Or is chunking done in the extract_assertions Task?
- What's the exact chunking logic (page-level primary, split on headers if >1000 tokens)?
- How are tokens counted? (AI_COUNT_TOKENS function or character-based approximation?)

---

## HIGH — Would cause a judge to see gaps (7)

### H1. No Streamlit screen specifications

6 screens are mapped in 05-screens-workflow.drawio but the SPEC has no UI spec. A builder doesn't know: which Streamlit components, what layout, how the known_as_of slider works, how evidence pane renders citations, what the queue sort order is.

### H2. No Judge Console specification

Plan.md §14 lists 13 verification tests. The Judge Console is a screen where judges run live security probes. No specification for: what probes exist, what buttons they press, what SQL runs behind each probe, what "pass/fail" looks like.

### H3. No bring-list derivation logic

The family view's bring-list is the primary deliverable for caretakers. How is "bring the FISH report" derived from DOC-HER2-001 gate failure? What's the mapping from rule_id → bring-list item text? How is TRANSLATE called (per-item or batch)?

### H4. RAP syntax error in Appendix A

```sql
AND patient_id = patient_scope.patient_id
```
RAP body cannot reference the policy name. The parameter name IS the column reference. Should be:
```sql
AND ROLE_PATIENT_MAP.patient_id = patient_id
```
Or use a different parameter name to avoid ambiguity.

### H5. No role creation or GRANT specification

SAARTHI_COORDINATOR, SAARTHI_ONCOLOGIST, SAARTHI_FAMILY, SAARTHI_APP_ROLE are referenced throughout but never created. No GRANT statements. The entire RBAC layer is implied, not specified.

### H6. No Dynamic Table DDL

Five DTs are described in prose. No CREATE DYNAMIC TABLE statements. No column lists, no join logic, no WHERE clauses.

### H7. Semantic view section is the weakest in the spec

Entities and metrics are listed. No CREATE SEMANTIC VIEW DDL. No dimension/measure definitions. No join paths. The 6 VQR queries are described in English, not SQL. This section is a design sketch, not a specification.

---

## MEDIUM — Missing polish or depth (7)

### M1. No latency budget

Plan.md says "warm p95 answer latency 15s." Back-of-envelope: search (2s) + re-fetch (1s) + gate evaluation (2s) + AI_FILTER per claim ×3 (6s) + AI_COMPLETE for phrasing (4s) = 15s. This is tight. No analysis of what gets cut if we're over budget.

### M2. No error handling / fallback specification

What happens when AI_PARSE_DOCUMENT fails on a corrupt PDF? When AI_FILTER times out? When the search service returns 0 results? When the LLM produces malformed JSON? Every failure mode needs a defined behavior.

### M3. No Data Metric Functions (DMFs)

`snowflake-implementation-patterns.md` §7 lists DMFs as a "production-ready" signal. Enterprise Edition confirmed. DMFs on key tables (row count anomalies on CLINICAL_EVENT, NULL rate on ASSERTION.value) are low-cost, high-signal features judges notice.

### M4. No "what changed" mechanism specified

Q3 asks "What changed since 09:00?" This requires diffing two ANSWER_RUN records (or two gate evaluation results) at different known_as_of values. The diff logic — what fields to compare, how to present additions/removals/changes — isn't specified.

### M5. No supersession logic detail

When DOC-004 (FISH) arrives, ASS-003 (FISH pending) must be marked as superseded. The reconcile_evidence Task mentions this but: how is the match made? By subject+predicate+accession_id? What if the accession_id differs between the pending assertion and the resolving document?

### M6. Generic extraction prompt won't work well for all document types

A pathology report contains IHC scores, FISH ratios, Nottingham grade. A lab report contains a CBC panel. A discharge summary has a medication list. One prompt template won't extract all of these accurately. Need document-type-specific prompts or a two-stage approach (classify document type → use type-specific prompt).

### M7. No specification for how the generator produces PDF documents

documents.py is mentioned. What library renders the PDFs? (reportlab? fpdf2? HTML→PDF?) What makes them look like real Indian hospital reports (letterhead, table formats, handwritten annotations for realism)? If the synthetic PDFs look nothing like real reports, AI_PARSE_DOCUMENT might work perfectly on them but the demo doesn't prove anything about real-world viability.

---

## Summary

| Severity | Count | Build impact |
|---|---|---|
| CRITICAL | 7 | Would cause build failures, demo failures, or directly lose the competition |
| HIGH | 7 | Judge would see visible gaps in the system |
| MEDIUM | 7 | Missing depth or polish that separates "good" from "levels above" |

**The single most dangerous issue is C1** (CURRENT_USER in container runtime). If this isn't resolved, the entire security story — which is our primary competitive differentiator — is exactly as cosmetic as CareCompass's st.radio picker. We'd be attacking competitors for a flaw we have ourselves.

**The most embarrassing issue is C3** (missing weight_kg). It means CLIN-CRCL-001 can't be evaluated. A judge asking "how does the CrCl rule work?" gets a dead end.

**The most impactful fix for winning is C4** (Cortex Agent spec). The agent system prompt is the most important piece of text in the entire system. It defines the personality, the citation format, the refusal behavior. Without it, every builder is guessing.
