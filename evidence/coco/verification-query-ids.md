# Platform Verification — Query IDs

**Every claim below is resolvable independently:**

```sql
SELECT QUERY_TEXT, START_TIME, EXECUTION_STATUS, ERROR_MESSAGE
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE QUERY_ID = '<query_id>';
```

Account `FV11738` · region `GCP_ME_CENTRAL2` · Enterprise Edition · tested 2026-09-17.

Note: `ACCOUNT_USAGE.QUERY_HISTORY` has up to 45 minutes of latency. For immediate verification use `INFORMATION_SCHEMA.QUERY_HISTORY`. Where we present leakage evidence live in a demo we use `QUERY_HISTORY`; the written pack uses `ACCESS_HISTORY`, which lags up to 180 minutes. We label which is which rather than presenting stale data as live.

---

## Environment

| Query ID | What it established |
|---|---|
| `01c71d4d-0003-6737-0001-fd06000561ee` | Snowflake 10.32.102 · account FV11738 · GCP_ME_CENTRAL2 · user DANUSH · ACCOUNTADMIN |
| `01c71d4d-0003-66ce-0001-fd06000516e2` | `ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'ANY_REGION'` — required; the region has no native AI_COMPLETE |
| `01c71d4d-0003-6737-0001-fd0600056216` | Compute pools exist: `SYSTEM_COMPUTE_POOL_CPU` active, GPU pool suspended → SPCS available |
| `01c71d4f-0003-66ce-0001-fd060005175e` | All 11 AI functions authorized via `EXPLAIN_PRIVILEGES` |
| `01c71d90-0003-6876-0001-fd060005cbfe` | Free trial balance $386.10 of $399.02 |
| `01c71d90-0003-6876-0001-fd060005cc02` | Spend breakdown — `SNOWFLAKE_COCO_CLI` 42.9 of 49.8 credits; `AI_FUNCTIONS` ≈ 0 |

Enterprise Edition confirmed by successful creation of a row access policy and a masking policy — both Enterprise-only features.

---

## R5 security model — the four tests that decided the architecture

### 1. Row access policies filter strictly, including for ACCOUNTADMIN
`01c71d96-0003-6876-0001-fd060005cd46`

Policy keyed on `CURRENT_USER()`. `DANUSH` mapped to `PAT-0001` only. Two rows in the table; **one row returned.** `PAT-0002` invisible to ACCOUNTADMIN.

### 2. ⭐ `CURRENT_USER()` survives owner's-rights elevation — `CURRENT_ROLE()` does not
`01c71d97-0003-6876-0001-fd060005cdce`

Procedure owned by `R5_OWNER_ROLE`, `EXECUTE AS OWNER`, called by `ACCOUNTADMIN`:

| Function | Value inside procedure |
|---|---|
| `CURRENT_ROLE()` | `R5_OWNER_ROLE` — switched to owner |
| `CURRENT_USER()` | `DANUSH` — remained the caller |
| RAP result | 1 row, correct patient |

**Every row access policy must key on `CURRENT_USER()`, never `CURRENT_ROLE()`.** A role-keyed policy sees the owner's privileged role inside any owner's-rights procedure and returns every patient — a total bypass that does not appear in single-user testing.

`platform-constraints.md` recorded this as *"MUST EMPIRICALLY TEST — docs do not say."* Now answered.

### 3. Cortex Search ignores scoping — the vulnerability, reproduced
`01c71d9e-0003-6876-0001-fd060005cf36`

Caller mapped only to `PAT-0001`. RAP correctly restricts the governed table to one row. The search service returned **both patients**:

```
CHK-1  PAT-0001  "Patient 0001 pathology report: HER2 IHC 2+, FISH pending"
CHK-2  PAT-0002  "Patient 0002 pathology report: HER2 IHC 3+, FISH not required"   ← should be invisible
```

This is the hole present in every competitor we surveyed. It is now a reproducible Judge Console probe.

Filter applied → `01c71d9e-0003-6876-0001-fd060005cf4a` → 1 row, correct patient. Layer 2 works.

### 4. ⚠️ Secondary roles defeat Layer 1 — a claim we had to correct
`01c71d9f-0003-6876-0001-fd060005cf66` — query **succeeded** as `R5_OWNER_ROLE`, which was never granted `USAGE` on the service.
`01c71da0-0003-6876-0001-fd060005cf96` — cause: `CURRENT_SECONDARY_ROLES()` = `{"roles":"ORGADMIN,ACCOUNTADMIN","value":"ALL"}`

With `USE SECONDARY ROLES NONE`, correctly denied:
```
390404: Cortex Search Service ... does not exist or access is not authorized
        for the current role. If you are using JWT authentication, the role
        will be the "DEFAULT_ROLE" of the current user.
```

**Two mandatory consequences:** the application session must run `USE SECONDARY ROLES NONE`, or authenticate as a dedicated service user granted only the app role. Without one, "the app role has no USAGE" is a false statement.

The trailing JWT / `DEFAULT_ROLE` note is directly relevant to how Streamlit authenticates and is an open Day-1 check.

---

## Platform constraints discovered

### Cortex Search cannot be built over a RAP-protected table
Failed: `CREATE CORTEX SEARCH SERVICE ... AS (SELECT ... FROM <RAP-protected table>)`
```
Change tracking is not supported on queries with correlated subquery expressions.
```
The standard mapping-table RAP (`EXISTS (SELECT 1 FROM CARE_TEAM ...)`) is a correlated subquery. **The platform forces the index/content split** we had chosen for security reasons: `DOC_CHUNK` un-RAP'd as the index, `DOC_PAGE` RAP-protected as the content store.

Succeeded once the source had no RAP → `01c71d9c-0003-6aeb-0001-fd060005bed2`

### `AGENT_RUN` exists as a SQL function
`01c71d95-0003-6aeb-0001-fd060005bd3e`

`AGENT_RUN(VARCHAR)` · `AGENT_RUN(VARCHAR, BOOLEAN)` · `DATA_AGENT_RUN(VARCHAR, VARCHAR)` · `DATA_AGENT_RUN(VARCHAR, VARCHAR, BOOLEAN)` · `AGENT_PREVIEW(VARCHAR)`

Container runtime is therefore an optimisation, not a prerequisite. A warehouse-runtime app can reach an agent through SQL.

### `AI_FILTER` text form takes one argument
`01c71da1-0003-6aeb-0001-fd060006e02e`

Four earlier attempts failed with `argument RETURN_ERROR_DETAILS ... needs to be constant` because a second string argument bound to a boolean flag. The two-argument form is for image inputs only.

Both correct forms verified discriminating correctly:

| chunk | content | `AI_FILTER(CONCAT('…reports HER2 IHC 2+…', text))` | `AI_FILTER(PROMPT('…FISH pending?… {0}', text))` |
|---|---|---|---|
| CHK-1 | IHC 2+, FISH pending | TRUE | TRUE |
| CHK-2 | IHC 3+, FISH not required | FALSE | FALSE |

Validator check 4 is implementable today.

### Stages for AI functions require `SNOWFLAKE_SSE`
`01c71da2-0003-6aeb-0001-fd060006e076` — AI functions cannot read files from `SNOWFLAKE_FULL` encrypted stages, user stages, table stages, or stages with double-quoted names.

### Cortex Guard and Cortex TRANSLATE
Guard verified on `llama3.1-8b` with `guardrails: true` → `01c71d4d-0003-6737-0001-fd060005622e`
TRANSLATE en→hi verified → `01c71d4e-0003-66ce-0001-fd060005172a`

Working models: `llama3.1-70b`, `llama3.3-70b`, `llama3.1-8b`. Rejected as legacy on this account: `claude-4-sonnet`, `mistral-large2`.

---

## Cortex Agent — created, run, and found to leak scope

Created → `01c72003-0003-6aeb-0001-fd06000c0946`
Run via `DATA_AGENT_RUN` → `01c72003-0003-6876-0001-fd06000bce42`

The agent answered correctly and cited its source. But inspect the tool call it generated:

```json
"input": {
  "query": "HER2 IHC score FISH status",
  "filter": "{\"@eq\": {\"patient_id\": \"PAT-0001\"}}"
}
```

**The agent derived the patient scope from the question text and injected the filter itself.** Ask about another patient and it will filter for, and return, that patient. Chat history or text embedded in a document could steer it equally.

**Consequence — the top design rule of the AI layer:** the agent is never given a raw `cortex_search` or `cortex_analyst_text_to_sql` tool over patient data. It receives only `generic` tools calling owner's-rights procedures, and **the tool input schemas omit `patient_id` entirely.** Scope is unreachable by construction rather than by instruction.

Combined with the search-service finding and the secondary-roles finding, this is the third independently verified way the naive design leaks.

### Two useful discoveries from the same response

`orchestration: auto` resolved to **`claude-opus-4-8`** with a 1,000,000-token context window — stronger than any model available to direct `AI_COMPLETE` on this account. Token usage: 50,050 input of which **31,718 were cache reads**, 429 output.

The response carries **native citation annotations** with a character offset into the answer text (`annotations[].index = 84`) and a **`thinking` trace**. Both are used in the UI; neither replaces the validator, because the agent's citation is a claim about itself.

---

## Test objects retained

Left in place in `SAARTHI.GOVERNANCE` as the seed of the real implementation and as demonstrable evidence:

| Object | Proves |
|---|---|
| `ROLE_PATIENT_MAP` | precursor to `CARE_TEAM`; the table the RAP reads |
| `R5_TEST_EVIDENCE` | RAP-protected content store — tests 1 and 2 |
| `R5_TEST_CHUNK` | un-RAP'd search source — the index/content split |
| `R5_TEST_SEARCH` | Cortex Search service — tests 3 and 4 |
| `probe_owner_rights`, `probe_diff_owner` | context-function behaviour under owner's rights |
| `R5_OWNER_ROLE` | separate owner role forcing caller ≠ owner |
| `TEST_AGENT` | agent wiring and the self-scoping finding |

`data/synthetic_docs/lab_cbc_meera_20260908.pdf` — synthetic CBC and biochemistry report encoding the real formatting traps: `GM%`, `/CUMM`, `1,50,000 - 4,50,000` comma notation, `L`/`H` flags, neutrophils as differential percentage with no absolute ANC, `mg%` creatinine.

---

## Resolved 21 Sept — U1, model availability, live pipeline

| Query ID | What it established |
|---|---|
| `01c73918-0003-7ddc-0001-fd06002fbaf6` | `AI_COMPLETE('llama3.3-70b', ...)` reachable — R7 pass A |
| `01c73919-0003-7ddc-0001-fd06002fbafe` | `AI_COMPLETE('claude-haiku-4-5', ...)` reachable — R7 pass B, different vendor/architecture from pass A |
| (see `parse_documents.sql` run, 21 Sept) | `AI_PARSE_DOCUMENT` on `PAT-DEEP-0001/EVT-CBC-01` — U1 resolved. Extracted "2,60,604 /CUMM" verbatim, Indian comma-grouping intact, confirming the client-side `PUT` blocker from 17 Sept no longer applies on this machine. 4/4 staged PDFs parsed correctly in one backfill run. |
| (see `evaluate_gates` run, 21 Sept) | `evaluate_gates('PAT-DEEP-0001','EVT-CHEMO-03')` → `CLIN-ANC-001: pass, "ANC is 2100, meets threshold 1500"`, evidence `EVT-CHEMO-03-ANC-DERIVED`, derivation string attached — R1 and the Day-4 ANC acceptance test both proven live, not designed. |
| (see `bind_patient` run, 21 Sept) | Authorized bind → `binding_id` returned. Bind to a nonexistent patient → identical `no_patient_access` as an unauthorized-but-real patient would get. Zero information leakage, confirmed by direct comparison of both responses. |

## Still unverified

| Test | Blocker | Fallback |
|---|---|---|
| `CURRENT_USER()` inside deployed Streamlit container runtime | needs a deployed app | if it returns the owner, use a dedicated service user |
| `CREATE STREAMLIT … COMPUTE_POOL` on a trial account | needs the app | warehouse runtime plus `AGENT_RUN`, already proven |
| R7 two-pass disagreement on the ambiguous CBC | extraction task not yet built | in progress |
