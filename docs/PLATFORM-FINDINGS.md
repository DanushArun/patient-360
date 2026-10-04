# Platform findings: where the obvious Snowflake design leaks

Seven findings about Snowflake behaviour that decided SAARTHI's security and AI design. Each one was established by a
query that can be looked up by ID. They are the part of this repository most useful to another team, whether or not
SAARTHI is judged well.

**Read this first: what these are and are not.**

- **Established on account `FV11738`** (Enterprise Edition, region `GCP_ME_CENTRAL2`, Snowflake 10.32.102), **on
  17 September 2026**. Source: [`evidence/coco/verification-query-ids.md`](../evidence/coco/verification-query-ids.md).
  That account is not the current build account (`OS69400`, 1-4 October). Snowflake behaviour can change between
  releases; these are dated observations, not permanent guarantees.
- **Live evidence, reported, not re-runnable offline.** A judge can look each ID up with
  `SELECT QUERY_TEXT, START_TIME, EXECUTION_STATUS, ERROR_MESSAGE FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY WHERE QUERY_ID = '<id>'`,
  but only on that account, and `ACCOUNT_USAGE` lags up to 45 minutes. `QUERY_HISTORY` is used for live evidence;
  `ACCESS_HISTORY` (up to 180 minutes lag) for the written pack.
- **Not re-tested on the current build.** Findings 1-3 are enforced in source (`CURRENT_USER()`, no `patient_id` in
  tool schemas, `USE SECONDARY ROLES NONE` in every bundle file). Whether the **current** row access policy on
  `DOC_PAGE` actually isolates patients is open: see N4-03 at the bottom.
- We did not find these behaviours described in the competitor repositories we looked at. That is a search result,
  not proof that no one else knows them.

## The findings

| # | Finding | Why the obvious design fails | Query ID(s) (account FV11738, 2026-09-17) | Consequence in this repo |
|---|---|---|---|---|
| 1 | **A row access policy must key on `CURRENT_USER()`, never `CURRENT_ROLE()`.** Inside an `EXECUTE AS OWNER` procedure `CURRENT_ROLE()` becomes the owner's role; `CURRENT_USER()` stays the caller. | A role-keyed policy sees the owner's privileged role inside any owner's-rights procedure and returns every patient. It passes single-user testing. | `01c71d97-0003-6876-0001-fd060005cdce` (procedure owned by `R5_OWNER_ROLE`, called by ACCOUNTADMIN: role `R5_OWNER_ROLE`, user `DANUSH`, one correct row). Strictness baseline: `01c71d96-0003-6876-0001-fd060005cd46` (two rows, one returned, even for ACCOUNTADMIN). | Policy body in [`backend/sql/governance/01_policies.sql`](../backend/sql/governance/01_policies.sql) uses `CURRENT_USER()` only. A role-keyed first version was recorded as a failure ([index](FAILURE-AND-FIX-INDEX.md), row F-04). |
| 2 | **Secondary roles defeat a "role has no `USAGE`" control.** | A query succeeded as a role never granted `USAGE` on the search service, because the session's secondary roles were `ORGADMIN,ACCOUNTADMIN`. | Succeeded (should not have): `01c71d9f-0003-6876-0001-fd060005cf66`. Cause: `01c71da0-0003-6876-0001-fd060005cf96`. With `USE SECONDARY ROLES NONE`, denied with `390404`. | Every deploy-bundle file starts with `USE SECONDARY ROLES NONE`; the web session is pinned to `SAARTHI_APP` and verified at connect ([`web/lib/snowflake.ts`](../web/lib/snowflake.ts)). A claim in our own design was disproved here. |
| 3 | **Cortex Search ignores row access policies** (it runs with owner's rights). | The governed table returned one row; the search service over it returned both patients, including text for the patient the caller could not see. | `01c71d9e-0003-6876-0001-fd060005cf36` (both patients returned); with an attribute filter: `01c71d9e-0003-6876-0001-fd060005cf4a` (one row). | The search index (`DOC_CHUNK`) is un-RAP'd and returns IDs only; content is read from the RAP-protected `DOC_PAGE` through owner's-rights procedures. |
| 4 | **A Cortex Search service cannot be created over a RAP-protected table.** | The standard mapping-table policy contains a correlated subquery; change tracking rejects it: "Change tracking is not supported on queries with correlated subquery expressions". | Succeeded once the source had no policy: `01c71d9c-0003-6aeb-0001-fd060005bed2`. (The failed `CREATE` has no ID recorded in the evidence file.) | The platform forces the index/content split (`DOC_CHUNK` index, `DOC_PAGE` content). |
| 5 | **A Cortex Agent derives `patient_id` from the question text and injects the filter itself.** | Given a raw `cortex_search` tool, the agent produced `"filter": {"@eq": {"patient_id": "PAT-0001"}}` from the question. Ask about another patient and it would filter for that patient; text inside a document could steer it equally. | Agent created `01c72003-0003-6aeb-0001-fd06000c0946`; run via `DATA_AGENT_RUN` `01c72003-0003-6876-0001-fd06000bce42`. | The agent gets only generic tools calling owner's-rights procedures, and **no tool input schema contains `patient_id`**: scope is unreachable by construction. Checked by static grep in QA ([QA-ROUND-1](../evidence/qa/QA-ROUND-1.md), F-07). |
| 6 | **`AI_FILTER` text form takes ONE argument.** The two-argument form is for images only. | Four attempts failed with `argument RETURN_ERROR_DETAILS ... needs to be constant` because the second string bound to a boolean flag. | Correct forms verified: `01c71da1-0003-6aeb-0001-fd060006e02e` (`CONCAT` and `PROMPT` forms both discriminate the two test chunks correctly). | Validator check 4 uses `AI_FILTER(PROMPT(...))` / `CONCAT`. Note the validator is **not in the answer path** ([IMPLEMENTATION-STATUS](../IMPLEMENTATION-STATUS.md)). |
| 7 | **Stages read by AI functions must be `ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE')`**; AI functions also cannot read `SNOWFLAKE_FULL` stages, user stages, table stages or stages with double-quoted names. | Default stage encryption makes the AI function fail to read the file. | `01c71da2-0003-6aeb-0001-fd060006e076`. | Document stages are created `SNOWFLAKE_SSE`. |
| 8 | **AI functions cannot run inside Dynamic Tables.** | Stated as a verified platform fact in `AGENTS.md` section 3, item 9. **No query ID for this one is recorded in `verification-query-ids.md`**; treat it as documented by the team but not independently resolvable from that file. | none recorded | AI steps live in Tasks; deterministic steps in 4 Dynamic Tables. |

Also recorded in the same file (not security findings): `AGENT_RUN`/`DATA_AGENT_RUN` exist as SQL functions
(`01c71d95-0003-6aeb-0001-fd060005bd3e`), so a warehouse-runtime app can reach an agent; `orchestration: auto`
resolved to a model (`claude-opus-4-8`) stronger than anything available to direct `AI_COMPLETE` on that account, which is why it is now
banned in favour of pinned models.

## Later model facts (dated, partly stale)

Model availability changed between 17 and 21 September: `llama3.1-70b` became legacy and was in any case never a
different family from `llama3.3-70b`, so R7 pass B moved to `claude-haiku-4-5`. Reachability of both pinned models was
recorded on 21 September: `01c73918-0003-7ddc-0001-fd06002fbaf6` (`llama3.3-70b`) and
`01c73919-0003-7ddc-0001-fd06002fbafe` (`claude-haiku-4-5`). The 21 September account is the later one in
the evidence file and is not named there. Re-probe before relying on any of it (`backend/sql/probes/model_availability.sql`).

## OPEN: N4-03, the policy name-binding hazard (not proven live)

| | |
|---|---|
| What | An independent review (QA Round 4, finding N4-03) read the `DOC_PAGE` row access policy and found that an unqualified argument named `doc_id`, used inside a subquery over a table that also has a `doc_id` column, can bind to the inner column (`d.doc_id = d.doc_id`, always true). If so, the policy would return every `DOC_PAGE` row once any qualifying care-team link or reference document exists. |
| Status | **Fixed in source, not proven live.** The policy argument is renamed `p_doc_id` and both comparisons are qualified (`backend/sql/governance/01_policies.sql`; deploy step 07 in [`backend/sql/deploy/07_governance_row_access.sql`](../backend/sql/deploy/07_governance_row_access.sql)). Step 07 inserts a synthetic canary document (`DOC-RAP-CANARY-01`, patient with no care team) and **raises an error if the canary page is visible**; step 09 repeats the check. |
| Offline evidence | Contract tests `test_n4_03_*` and `test_policy_body_has_no_unqualified_argument_name_collision` in [`backend/tests/test_round4_fix_contracts.py`](../backend/tests/test_round4_fix_contracts.py) pass. These check the source text, not Snowflake behaviour. |
| Missing | No recorded run of the canary negative test on any account. No recorded cross-patient negative test on `DOC_PAGE` for the policy as it stood before the fix either, so **we do not know whether the previously deployed policy was exposed**. The earlier live check that "a PAT-DC-04-bound search for another patient's specimen returned only PAT-DC-04 pages" (3 October, OS69400, `IMPLEMENTATION-STATUS.md`) went through the procedure layer, not a direct `DOC_PAGE` read, so it does not close this. |
| To close | Run [`backend/sql/deploy/`](../backend/sql/deploy/README.md) steps 00 to 07 and 09 on a clean account, as ACCOUNTADMIN, and record the canary query ID here and in `evidence/coco/verification-query-ids.md`. If the canary is visible, that is a defect in the headline security claim and goes in the failure index. |

Findings 1 to 3 describe the platform, and N4-03 describes a defect that could have been ours. They are listed together
on purpose: the first shows what we learned from testing, the second shows what we have not yet tested.
