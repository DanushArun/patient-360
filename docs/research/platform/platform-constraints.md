# Snowflake platform constraints — verified findings

**Researched 2026-09-16 against docs.snowflake.com. Status: three threads complete, architecture-changing.**

> **Read this before writing any SQL.** Two findings here invalidate parts of the previously drafted architecture. Nothing in this file is inference unless explicitly marked — quotes are from official documentation.

---

## FINDING 1 — CRITICAL: Cortex Search does **not** respect row access policies

This is the single most important finding of the research phase. It invalidates any design where R5 (server-side scope enforcement) is implemented by putting a row access policy on the table a Cortex Search service indexes.

Snowflake's own documentation, [Query a Cortex Search Service](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-search/query-cortex-search-service), states verbatim:

> *"Cortex Search Services perform searches with owner's rights... any role with sufficient privileges to query a Cortex Search Service may query any of the data the service has indexed, regardless of that role's privileges on the underlying objects... even if the querying user's role cannot read those rows in the source table."*

The docs explicitly call out row-level policies. To query a service a user needs only `USAGE` on the service plus its database/schema. Snowflake adds: *"Use caution when granting a role with USAGE privileges on a Cortex Search Service to another Snowflake user."*

**Consequences:**

1. A row access policy on the base table **does not filter search results**. A RAP-only architecture for Cortex Search is theatre — the exact failure we are attacking competitors for.
2. The only documented per-query scoping mechanism is **attribute filters** (`@eq`, `@contains`, `@gte/@lte`, `@primarykey`, composed with `@and/@or/@not`) on columns declared as `ATTRIBUTES` at `CREATE CORTEX SEARCH SERVICE`. These are **request parameters**. There is no documented server-side mandatory filter and no default filter on a service.
3. **Therefore: if the end user's own credentials can reach the search service, they can omit or edit the filter.** This is the whole ballgame.

### The corrected architecture

Snowflake's own guide, [Getting Started with Access Controls for RAGs](https://www.snowflake.com/en/developers/guides/getting-started-with-access-controls-for-cortex-search/), resolves it this way: run the search **in a trusted backend using the owner's session**, derive the caller's identity server-side from `CURRENT_ROLE()` / the ingress user token, and inject the filter so *"it is not exposed to the visiting user."* **The end user never holds a credential that can query the service directly.**

For agents specifically, [Multi-tenancy for Cortex Agents](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-multi-tenancy) documents passing tenant values in the `agent:run` `variables` block with `is_immutable_session_attribute: true` — *"cannot be modified by generated SQL, code execution, or tool invocation"* — read back via `SYS_CONTEXT('SNOWFLAKE$SESSION_ATTRIBUTES', ...)` inside a row access policy. Snowflake calls this a **shared responsibility model**.

**So R5 becomes a three-layer defence, not a policy:**

| Layer | Mechanism | Catches |
|---|---|---|
| 1. No direct access | The app role has **no `USAGE` on the search services at all**. Retrieval is only reachable through an owner's-rights stored procedure. | User cannot hand-craft a search request |
| 2. Server-injected filter | The procedure derives patient/tenant scope from the session and injects the attribute filter itself. The question never supplies it. | Prompt-supplied or chat-carryover scope tampering |
| 3. **Content re-fetch through governed tables** | Search returns **chunk IDs only**. The procedure re-fetches the actual text from RAP-protected base tables under the caller's identity. | A leak at layer 1 or 2 still yields nothing readable |

Layer 3 is the important one and it is what makes the claim honest: **even if Cortex Search returns a chunk ID it shouldn't have, the content behind that ID is served through a governed table and the caller gets nothing.** That is a real guarantee we can demo, and it is stronger than anything in the competitive field.

**MUST EMPIRICALLY TEST (docs do not say):** whether an immutable session attribute actually constrains the **Cortex Search tool inside an agent**, or only generated SQL. Test with two patients and one service, attempting cross-retrieval with and without the filter. Do not assume either way.

**Alternative worth costing:** per-tenant search services with RBAC on `USAGE`. That is genuine enforcement rather than shared-responsibility — but it is inference, not documented guidance, and it does not scale past a handful of tenants.

### Cortex Analyst is the opposite — genuinely governed

Analyst generates SQL that executes in **the caller's** session, so RBAC, row access policies and masking **do** apply. Per [semantic view best practices](https://docs.snowflake.com/en/user-guide/views-semantic/best-practices-dev): policies *"can't be set directly on semantic view attributes, but if they are set on underlying tables and columns, they propagate to semantic views and are enforced."*

Two caveats: semantic **views** themselves use owner's rights for object access, and **sample values stored as semantic metadata are not masked** — a real leak vector we must check. Aggregation/projection policy behaviour on semantic views is **not confirmed in the docs — treat as untested.**

---

## FINDING 2 — CRITICAL: every governance feature we planned is Enterprise Edition

| Feature | Min. edition | Status | Notes |
|---|---|---|---|
| Row access policies | **Enterprise** | GA | |
| Masking policies / dynamic data masking | **Enterprise** | GA | |
| Object tagging (create/set) | Standard | GA | Tagging itself is fine on Standard |
| Tag propagation + tag-based masking | **Enterprise** | GA | |
| Aggregation policies | **Enterprise** | GA | |
| Projection policies | **Enterprise** | GA | |
| `ACCOUNT_USAGE.ACCESS_HISTORY` | **Enterprise** | GA | **Latency up to 180 minutes**; 365-day retention |
| Data Metric Functions | **Enterprise** | GA | Automatic background checks still flagged preview on one page |
| Time Travel | Standard: **max 1 day**; Enterprise: 0–90 days | GA | Transient/temp capped at 1 day on all editions |
| Cortex Guard | **Enterprise** | GA | Requires cross-region inference; commercial accounts only |

**On Standard Edition you get none of them.** Not degraded versions — they do not exist.

### Two consequences we have to absorb

**(a) `ACCESS_HISTORY` has up to 180 minutes of latency.** This kills the demo beat where a judge presses a button and sees Snowflake's audit log prove zero leakage *live*. It cannot be live. Options: use `QUERY_HISTORY` (all editions, near-real-time) for the live beat and `ACCESS_HISTORY` for the written evidence pack, and **say which is which**. Presenting a 3-hour-stale view as live would be exactly the dishonesty we're attacking competitors for.

**(b) Standard-edition fallback** if the hackathon account isn't Enterprise: secure views with `CURRENT_ROLE()`-conditional predicates hand-rolled in the view definition as a RAP substitute, `QUERY_HISTORY` instead of `ACCESS_HISTORY`, object tagging without enforcement, 1-day Time Travel (our own three clocks carry the temporal story regardless — **this is why R2 was designed independent of Time Travel, and that now looks like a very good decision**).

**UNKNOWN — must confirm in writing:** what edition hackathon-provided accounts ship with. Not documented anywhere. **Ask the organisers directly.** Also: trial edition is chosen at signup and appears not to be self-serve changeable afterwards.

---

## FINDING 3 — Runtime and cost constraints

**Cortex Agents from Streamlit-in-Snowflake.** Docs: *"Cortex Agents APIs aren't supported in Streamlit in Snowflake with warehouse runtime — use container runtime instead."* Container runtime went **GA 09 Mar 2026**, all commercial regions. New accounts get `SYSTEM_COMPUTE_POOL_CPU` via `DEFAULT_STREAMLIT_COMPUTE_POOL`, PUBLIC has USAGE, one idle node free, auto-suspend 3 days. BCR 2026_06 makes container runtime the default for new Streamlits.

**The escape hatch that changes our fork:** `SNOWFLAKE.CORTEX.AGENT_RUN()` is a **SQL function** returning JSON — callable from any SQL session, so a warehouse-runtime app can use it. Caveat: no token streaming (`stream:true` unsupported). The REST path needs JWT/OAuth/PAT and outbound HTTP, which is not viable on warehouse runtime.
→ **This materially de-risks the router-first decision.** Even without container runtime we can reach an agent through SQL.

**SPCS on trial accounts — unresolved conflict.** The SPCS tutorial prerequisites say *"trial accounts are not supported"*; the trial-account feature page does not list compute pools as excluded. Docs contradict each other. **Test `CREATE STREAMLIT … COMPUTE_POOL` on the real account on day one.**

**AI_PARSE_DOCUMENT.** GA. PDF/PPTX/DOCX/JPEG/PNG/TIFF/HTML/TXT. Limits: **100 MB, 2,000 pages** (raised 30 Apr 2026), 10,000×10,000 px. LAYOUT → markdown with tables; `page_split=TRUE` → `{"pages":[…],"metadata":{"pageCount":N}}` and is **PDF/PPTX/DOCX only**. **Cost: 1 credit per page.** Requires `SNOWFLAKE.CORTEX_USER`.

**Cortex Search costs.** Embedding tokens + warehouse compute for refresh + **an always-on serving charge per GB/month of uncompressed index even at zero queries** + storage. `AUTO_SUSPEND` on inactivity exists but is **Preview**. Refresh follows dynamic-table semantics (`TARGET_LAG`, incremental when a PK is defined). Limits: <400M rows, 20 QPS/service, 140 QPS/account, **no cloning**. No documented cap on services per account (relevant to the per-tenant-service option above).

**India region availability — day-one blocker.** In **AWS ap-south-1 (Mumbai)** and **Azure Central India**, the regional availability table lists essentially only embedding models (`arctic-embed-m`, `multilingual-e5-large`) natively. **No native `AI_COMPLETE`.** Cortex Agents explicitly rely on cross-region inference.
→ **`ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'AWS_APJ'` (or `ANY_REGION`) on day one, as ACCOUNTADMIN, or nothing works.** Default is `DISABLED`.

**Cortex Analyst.** GA. **Native `SEMANTIC VIEW` objects are now the recommended approach**; stage-hosted YAML is back-compat only. Verified Query Repository = (question, verified SQL) pairs attached to the semantic view; "optimize with verified queries" is **Preview** (Dec 2025). Billed per message.

**Git integration.** GA. `API INTEGRATION` + `SECRET` → `CREATE GIT REPOSITORY`; supports GitHub; enables `EXECUTE IMMEDIATE FROM @repo/...` and deploying Streamlit from the repo. Uses its own network path, not an external access integration — so likely unaffected by any trial EAI restriction, **but trial support not explicitly confirmed.**

### Cost blockers on an unpaid trial

- **Cortex AI functions capped at ~10 credits/day on unpaid trials.** At 1 credit/page for `AI_PARSE_DOCUMENT`, that is **ten pages per day.** This alone makes an unpaid trial unusable for our document volume.
- Trial accounts reportedly ban **external network access** entirely.
- Recommendation: use a Snowflake-issued hackathon account, or add a card to convert to paid (retains remaining free balance). **Confirm which before 17 Sept.**

---

## Day-one checklist produced by this research

Run these before any build work. In order.

```sql
-- 1. What edition are we actually on? Decides the entire governance story.
SELECT CURRENT_VERSION();
SHOW ORGANIZATION ACCOUNTS;          -- or Snowsight → Admin → Accounts

-- 2. Cross-region inference. Without this, no AI_COMPLETE in an India region.
ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'ANY_REGION';
SELECT SNOWFLAKE.CORTEX.COMPLETE('claude-4-sonnet', 'reply OK');

-- 3. Can we create a container-runtime Streamlit at all?
SHOW COMPUTE POOLS;

-- 4. Is the agent reachable from plain SQL? (the router-first escape hatch)
SELECT SNOWFLAKE.CORTEX.AGENT_RUN(...);

-- 5. Do we have governance primitives?
CREATE ROW ACCESS POLICY test_rap AS (x VARCHAR) RETURNS BOOLEAN -> TRUE;

-- 6. Credit headroom — are we on an unpaid trial with a 10 credit/day cap?
SELECT * FROM SNOWFLAKE.ACCOUNT_USAGE.METERING_DAILY_HISTORY ORDER BY USAGE_DATE DESC LIMIT 7;
```

**Then, empirically, the test the docs refuse to answer:** two patients, one Cortex Search service, an agent with an immutable session attribute. Attempt cross-patient retrieval with the filter present and absent. Record the result. **That single experiment decides how R5 is built.**

---

## Open threads

- [ ] Hackathon account edition — ask organisers in writing
- [ ] SPCS-on-trial contradiction — resolve empirically
- [ ] Immutable session attribute vs Cortex Search tool — resolve empirically
- [ ] Aggregation/projection policies on semantic views — undocumented, test
- [ ] Semantic view sample-value metadata leak — confirm whether masked
