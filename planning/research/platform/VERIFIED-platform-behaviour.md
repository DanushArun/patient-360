# Verified Platform Behaviour — Empirical Findings

**Tested 17 Sept 2026 against the HACKATHON account (FV11738, GCP_ME_CENTRAL2, Enterprise Edition).**
**Every finding below has a query ID. Nothing here is inference. This supersedes assumptions in `platform-constraints.md` where they conflict.**

---

## F1. `AGENT_RUN` exists as a SQL function — container runtime is not a hard dependency

`SHOW FUNCTIONS LIKE '%AGENT%' IN SCHEMA SNOWFLAKE.CORTEX` → QID `01c71d95-...bd3e`

| Function | Signature |
|---|---|
| `AGENT_RUN` | `(VARCHAR) RETURN VARCHAR` |
| `AGENT_RUN` | `(VARCHAR, BOOLEAN) RETURN VARCHAR` |
| `DATA_AGENT_RUN` | `(VARCHAR, VARCHAR) RETURN VARCHAR` |
| `DATA_AGENT_RUN` | `(VARCHAR, VARCHAR, BOOLEAN) RETURN VARCHAR` |
| `AGENT_PREVIEW` | `(VARCHAR) RETURN VARCHAR` |

**Impact:** the router-first design is de-risked. A warehouse-runtime Streamlit can reach an agent through SQL. Container runtime becomes an optimisation, not a prerequisite.

---

## F2. Row access policies filter strictly — including for ACCOUNTADMIN

Policy keyed on `CURRENT_USER()` against a mapping table. `DANUSH` mapped to `PAT-0001` only.

`SELECT ... FROM R5_TEST_EVIDENCE` as `ACCOUNTADMIN` → **1 row** (`EV-1` / `PAT-0001`). QID `01c71d96-...cd46`

`PAT-0002`'s row was invisible to ACCOUNTADMIN. RAP is real enforcement here, not advisory.

---

## F3. ⭐ `CURRENT_USER()` survives owner's-rights elevation; `CURRENT_ROLE()` does not

**This is the single most important finding. It decides how R5 is built.**

Procedure owned by `R5_OWNER_ROLE`, declared `EXECUTE AS OWNER`, called by `ACCOUNTADMIN`. QID `01c71d97-...cdce`

| Context function | Value inside the procedure | Behaviour |
|---|---|---|
| `CURRENT_ROLE()` | `R5_OWNER_ROLE` | **switched to the owner** |
| `CURRENT_USER()` | `DANUSH` | **remained the caller** |
| RAP outcome | 1 row (`PAT-0001`) | **still filtered correctly** |

**Consequences:**

1. **RAP must key on `CURRENT_USER()`, never `CURRENT_ROLE()`.** A role-keyed policy would see the *owner's* privileged role inside any owner's-rights procedure and return every patient — a total bypass that would not show up in single-user testing.
2. **Layer 3 of R5 is therefore sound.** Search returns chunk IDs → an owner's-rights procedure re-fetches content → RAP still filters by the real end user. Even a leaked chunk ID yields nothing readable.
3. This is precisely the question `platform-constraints.md` recorded as *"MUST EMPIRICALLY TEST — docs do not say."* Answered.

---

## F4. Cortex Search cannot be created over a table carrying a correlated-subquery RAP

```
CREATE CORTEX SEARCH SERVICE ... AS (SELECT ... FROM <RAP-protected table>)
→ SQL compilation error: Change tracking is not supported on queries
  with correlated subquery expressions.
```

The standard RAP shape — `EXISTS (SELECT 1 FROM CARE_TEAM WHERE ...)` — is a correlated subquery, so change tracking cannot be enabled and the service cannot be built.

**Impact:** the platform *forces* the index/content split our architecture already specified. It is not a design preference, it is a constraint:

| Object | RAP? | Role |
|---|---|---|
| `DOC_CHUNK` | **No RAP** | search index; returns IDs and metadata |
| `DOC_PAGE` | **RAP-protected** | governed content store; the actual text |

Succeeded once the source table had no RAP → QID `01c71d9c-...bed2`

---

## F5. Cortex Search ignores scoping entirely — the vulnerability, demonstrated

Service built over two patients' chunks. Caller `DANUSH` is mapped to `PAT-0001` only, and RAP correctly restricts the governed table to one row.

Unfiltered `SEARCH_PREVIEW` → **returned both patients' pathology text**, including `PAT-0002`. QID `01c71d9e-...cf36`

```
CHK-1  PAT-0001  "Patient 0001 pathology report: HER2 IHC 2+, FISH pending"
CHK-2  PAT-0002  "Patient 0002 pathology report: HER2 IHC 3+, FISH not required"   ← should be invisible
```

`platform-constraints.md` FINDING 1 confirmed empirically. **This is the exact hole every surveyed competitor has open**, and it is now a reproducible Judge Console probe: *"here is what happens without the defence."*

---

## F6. Attribute filters work — the server-injected scope mechanism

Same service, same caller, with `"filter": {"@eq": {"patient_id": "PAT-0001"}}` → **1 row, correct patient.** QID `01c71d9e-...cf4a`

This is Layer 2: the stored procedure injects the filter from the session-derived identity; the question never supplies it.

---

## F7. ⚠️ Secondary roles defeat Layer 1 unless explicitly disabled

Layer 1 is *"the app role has no `USAGE` on the search service."* Tested by querying as `R5_OWNER_ROLE`, which was never granted `USAGE` on the service.

**It succeeded and returned both patients.** QID `01c71d9f-...cf66`

Cause: `CURRENT_SECONDARY_ROLES()` → `{"roles":"ORGADMIN,ACCOUNTADMIN","value":"ALL"}` — QID `01c71da0-...cf96`. ACCOUNTADMIN was active as a *secondary* role and satisfied the privilege check through the back door.

With `USE SECONDARY ROLES NONE`, the same query is correctly denied:
```
390404: Cortex Search Service SAARTHI.GOVERNANCE.R5_TEST_SEARCH does not exist
        or access is not authorized for the current role.
        If you are using JWT authentication, the role will be the "DEFAULT_ROLE" of the current user.
```

**Consequences — both mandatory:**
1. The application session must run `USE SECONDARY ROLES NONE`, **or**
2. The app must authenticate as a **dedicated service user** granted only the app role.

Without one of these, "the app role has no USAGE" is a false statement. The trailing note about JWT and `DEFAULT_ROLE` is directly relevant to how Streamlit authenticates and must be checked when the app is deployed.

---

## F8. `AI_FILTER` text form takes ONE argument — the two-argument form is for images only

Authoritative syntax (docs.snowflake.com/en/sql-reference/functions/ai_filter):
```
AI_FILTER( <input> [, <return_error_details> ] )                      -- text
AI_FILTER( <predicate>, <input> [, <return_error_details> ] )         -- IMAGE only
AI_FILTER( PROMPT('<template>', <col_1>, …) [, <return_error_details> ] )
```

Four earlier attempts failed with `argument RETURN_ERROR_DETAILS ... needs to be constant` because a second *string* argument was being bound to the boolean flag.

Both correct forms verified, and both discriminate correctly — QID `01c71da1-...e02e`:

| chunk | content | `AI_FILTER(CONCAT('…reports HER2 IHC 2+…', text))` | `AI_FILTER(PROMPT('…FISH pending?… {0}', text))` |
|---|---|---|---|
| CHK-1 | IHC 2+, FISH pending | **TRUE** | **TRUE** |
| CHK-2 | IHC 3+, FISH not required | **FALSE** | **FALSE** |

**Impact:** the validator's polarity check (Check 4) is proven working. Use `PROMPT()` for multi-column templating.

Also from the docs, worth carrying into implementation:
- Requires the `SNOWFLAKE.CORTEX_USER` database role.
- Built-in optimisation gives 2–10× speed and up to 60% fewer tokens on qualifying queries — relevant to the latency budget (M1) and to batching.
- **Inputs must not contain NULL.** Phrase predicates as questions with explicit context.
- TEXT is broadly available including cross-region; **IMAGE filtering is limited to four AWS regions** — so image-based `AI_FILTER` is not available to us. Text only.

---

## F9. Stages for AI functions must use `SNOWFLAKE_SSE`, not `SNOWFLAKE_FULL`

Per docs, Snowflake AI functions cannot read FILEs from internal stages with `TYPE = 'SNOWFLAKE_FULL'`, from user or table stages, or from stages with double-quoted names.

Stage created accordingly → QID `01c71da2-...e076`:
```sql
CREATE STAGE SAARTHI.STAGES.PATIENT_DOCS
  DIRECTORY = (ENABLE = TRUE)
  ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE');
```

---

## F10. Credit and budget reality

| Metric | Value |
|---|---|
| Free trial balance remaining (16 Sept) | **$386.10** of $399.02 |
| Consumed 16 Sept | **$12.92** |
| Dominant consumer | **`SNOWFLAKE_COCO_CLI` — 42.9 of 49.8 credits** |
| `AI_FUNCTIONS` consumed to date | 0.0001 credits (negligible) |
| `SNOWPARK_CONTAINER_SERVICES` | 0.234 credits — **SPCS works on this trial** |

Not a 10-credit/day capped trial. Team total across three accounts ≈ **$1,200**, which makes two-pass extraction verification affordable.
QIDs `01c71d90-...cc02`, `01c71d90-...cbfe`

---

## Still unproven — 3 items, none architecture-blocking

| # | Test | Why blocked / deferred | Impact if it fails |
|---|---|---|---|
| U1 | `AI_PARSE_DOCUMENT` on a real PDF: cost per page + survival of Indian formatting traps | `PUT` is client-side; `snow` CLI cannot connect (stale OAuth token in `connections.toml`; CoCo holds its own refreshed token) | Cost only. Function is confirmed authorized; two-pass verification handles quality regardless |
| U2 | Streamlit container runtime: what `CURRENT_USER()` returns inside a deployed app | Needs a deployed Streamlit | Determines whether F7's fix is "secondary roles none" or "dedicated service user" |
| U3 | `CREATE STREAMLIT … COMPUTE_POOL` on a trial account | Needs the app | Fallback is warehouse runtime + `AGENT_RUN` (F1), already proven available |

**To unblock U1**, one command from a terminal where the connection is live:
```bash
snow stage copy data/synthetic_docs/lab_cbc_meera_20260908.pdf \
  @SAARTHI.STAGES.PATIENT_DOCS --overwrite
```
Then parsing can be driven entirely from SQL.

---

## Test artefacts left in place

In `SAARTHI.GOVERNANCE`, deliberately retained as the seed of the real implementation and as judge-demonstrable evidence:

| Object | Purpose |
|---|---|
| `ROLE_PATIENT_MAP` | precursor to `CARE_TEAM`; the mapping RAP reads |
| `R5_TEST_EVIDENCE` | RAP-protected governed content (proves F2, F3) |
| `R5_TEST_CHUNK` | un-RAP'd search index source (proves F4) |
| `R5_TEST_SEARCH` | Cortex Search service (proves F5, F6, F7) |
| `probe_owner_rights`, `probe_diff_owner` | context-function probes (prove F3) |
| `R5_OWNER_ROLE` | separate owner role used to force caller ≠ owner |

`data/synthetic_docs/lab_cbc_meera_20260908.pdf` — synthetic CBC + biochemistry report encoding the real formatting traps from `real-patient-dipali.md` §5: `GM%`, `/CUMM`, Indian comma notation (`1,50,000 - 4,50,000`), `L`/`H` flags on values, neutrophils as differential `%` with no absolute ANC, and `mg%` for creatinine.

---

## Net effect on the architecture

| Finding | Architectural consequence |
|---|---|
| F3 | RAP keys on `CURRENT_USER()`. Layer 3 confirmed sound. **Closes review issue C1.** |
| F4 | Index/content split is mandatory, not optional. `DOC_CHUNK` un-RAP'd, `DOC_PAGE` RAP'd. |
| F5 | Layer 2 filter injection is load-bearing, and we have a live demo of the failure mode. |
| F7 | **New requirement:** `USE SECONDARY ROLES NONE` or a dedicated service user. Would otherwise have silently voided our headline claim. |
| F8 | Validator Check 4 implementable today, exact syntax known. Text-only. |
| F1 | Warehouse-runtime fallback is real; container runtime is optional. |
| F9 | Stage DDL fixed. |
