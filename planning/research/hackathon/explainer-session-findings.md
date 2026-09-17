# Explainer Session — Findings & Architecture Impact

**Source: `ps-explainer-transcript.md` — "Problem Statement Explainer (Intro) Session", Hack2skill, 46:13. The HCLS/PS-04 walkthrough runs 21:00–22:30; cross-cutting guidance at 19:30–20:30 and 23:00–23:30.**

This is the closest thing available to judge intent, spoken by the Snowflake presenter. It **confirms most of our architecture and contradicts two of our decisions.**

---

## VERBATIM — the PS-04 walkthrough

> **[21:00]** "…looking into a similar use case on HCLS… we're talking about **payers and providers**… this is a co-pilot that you can build on semantic **synthetic** data sets on like an **EHR and FHIR dataset**, and then you can ask it to fetch those records from your **prescriptions** of the world and **unstructured** data on top and summarize. Snowflake itself is smart enough to understand those cryptic **HCP codes** and convert them into even initially a **JSON** and then into Snowflake tables itself."

> **[21:30]** "…you can store it there or keep it JSON whatever format, and you can ask it to parse it. So once you parse it, you can build an entire **patient 360** on top with entire **risk stratification metrics**, **care gap indicators**, some **gap analysis**… and create like a **cited evidence agent** on top that answers back to the actual guy **on the rounds** itself. You can orchestrate with the **skills** — create…"

> **[22:00]** "…**separate skills for one of the processes** like **clinical questions**, **the evidence retrieval**, and **the risk score**, and accordingly on these processes create a **Streamlit tab** on top. You can similarly do the React… the first part is building the **synthetic data**, parse it in search format — I've covered **structured**, I've covered **unstructured**, I've covered **semi-structured**, all of these parts. Create those views on top — **semantic views**. Create the **agent** as a second step. **Orchestration is very much needed**…"

> **[23:00]** "…you have to build the semantic data on top and add some **verified queries** — it's very much needed even in the other problem statements… **verified queries is a very very crucial part of semantic views** that adds more confidence and better results accuracies… then build the agent on top and orchestrate with a **multi-agent orchestration**… build an **analyst app** on top."

> **[23:30]** "…you can use **CoCo CoWork** alongside it, which will be another good example of adding more Snowflake features and then **more brownie points**."

> **[20:30]** "…connect your existing systems like a **Jira or a ServiceNow** to send those notifications by an **MCP**. The last part connecting to it might need an enterprise-grade one. **If you have it, well and good. If you don't have it you can skip it for now. It's best to have it.**"

> **[20:00]** "…each of the detected can be **one skill**, the work order drafted is the other skill, and then maintenance. So you have to ask CoCo 'these are my [processes], build those three skills' and then you can ask to build a **task** on top which **orchestrates between the three of them**, accordingly **notify the final user**. You can tap into your **emails**… or integrate with **Slack**."

> **[19:30]** "…create a **dynamic table** on top which will feed it into a CI/CD mode like a **CDC technique** which streams the data. You can use **Cortex ML**… full ML orchestration pipeline, EDA to validation, model training, eventual inferencing."

> **[17:00]** "If you create a Streamlit you can deploy it in Streamlit in Snowflake. If you create with React you can ask it to deploy to a **SPCS runtime** — you can actually do it **without a Docker**."

> **[04:30]** "…only if you're sitting at a **GCC organization based out of India** are you eligible… you can form a team up until **four members max**."

---

## CONTRADICTS our plan — 2 items

### X1. "Separate skills per process" — we planned ONE skill, they expect SEVERAL

**Their words:** *"create separate skills for one of the processes like clinical questions, the evidence retrieval, and the risk score."* At [20:00] the same pattern is spelled out for another domain: three skills, then *"a task on top which orchestrates between the three of them."*

**Our plan (`plan.md` §10):** a single reusable skill, `evidence-reconciliation`.

The brief calls documented reusable skills **"the headline bonus."** The explainer says build one skill **per process** and orchestrate them with a Task. We planned one skill and rated multi-agent orchestration MEDIUM.

**Change: ship 4 skills, not 1.** Natural decomposition, matching their three named processes plus ours:

| Skill | Process | Maps to |
|---|---|---|
| `clinical-question-routing` | "clinical questions" | Class A/B classifier (§5) |
| `evidence-retrieval` | "the evidence retrieval" | dual-corpus search + re-fetch (§2 tools 3–4) |
| `risk-stratification` | "the risk score" | rule engine + 5 gates (§1) |
| `evidence-reconciliation` | ours — assertion/conflict reconciliation | §4 reconcile step |

Then **one Task orchestrating them** — which is simultaneously the *multi-agent orchestration* bonus the explainer calls "very much needed." One change satisfies two named bonus categories.

**Cost: low.** The logic already exists in the design; this is packaging it as four documented skills instead of one. **Priority: HIGH.**

### X2. Semi-structured JSON is a named category we don't explicitly cover

**Their words:** *"converting them into even initially a JSON and then into Snowflake tables"* … *"I've covered structured, I've covered unstructured, I've covered **semi-structured**, all of these parts."*

Our architecture covers structured tables + unstructured documents. **Semi-structured JSON is not an explicit path** — and it is called out as a distinct category twice.

This is nearly free for us: **FHIR bundles are JSON.** Ingesting a FHIR bundle into a `VARIANT` column and flattening with `LATERAL FLATTEN` gives us the semi-structured path *and* closes **F4** (no ingestion layer) *and* uses the FHIR mapping already sitting in `research/clinical/abdm-architecture.md` §3.

**Change:** add a FHIR-JSON ingestion path — `RAW_FHIR_BUNDLE(bundle_id, payload VARIANT, source_system, ingested_at)` → flatten → CORE tables. **Priority: HIGH. Closes two gaps at once.**

---

## CONFIRMS our decisions — the reviews were right

| Their guidance | Our design | Status |
|---|---|---|
| "**risk stratification** metrics" | `G1` — we had *avoided* the term; now double-confirmed as expected | **Adopt the vocabulary** |
| "**care gap** indicators" | Our 5 readiness gates *are* care-gap indicators | **Adopt "care gap" vocabulary** |
| "**cited evidence agent**" | Core thesis — per-claim evidence IDs + validator | ✓ |
| "**verified queries**… very very crucial" | VQR planned (§7) but section was our weakest | **Elevate — flesh out §7** |
| "**orchestration is very much needed**" | Was MEDIUM priority | **Elevate — see X1** |
| "**notify the final user**… emails… **Slack**" | `S5` — we had no notification layer | **Confirmed real gap** |
| "**Jira or ServiceNow**… by an MCP" | `G4` — we had cut MCP | **Confirmed; note the caveat below** |
| "**dynamic table**… CDC… streams" | 5 DTs + Streams + Tasks | ✓ Exact match |
| "**semantic views**" | Planned | ✓ |
| "**synthetic** data sets" | Seeded generator | ✓ |
| "**EHR and FHIR** dataset" | `F4` — no ingestion layer | **Confirmed real gap** |
| "answers… **on the rounds**" | Patient 360 screen = the rounds view | Name it explicitly |
| Streamlit-in-Snowflake **or** React+SPCS "without a Docker" | Streamlit chosen | ✓ Cheaper path validated |

### MCP — the caveat matters

*"The last part connecting to it might need an enterprise-grade one. If you have it, well and good. If you don't have it you can skip it for now. It's best to have it."*

So MCP is **"best to have," explicitly skippable** if the account can't support it. Our account **is** Enterprise Edition (runtime gate confirmed), so we have no excuse. But it is correctly a lower tier than skills/orchestration. **G4 confirmed as committed scope, ranked below X1.**

### Cortex ML — deliberately NOT adopting

The presenter offers Cortex ML (*"model training, eventual inferencing"*) as an option for other domains. **We must not take it.** The brief says *"never opaque predictions"* and our R1 forbids the model producing a status. Deterministic rule-based risk stratification satisfies "risk stratification" without a trained model. Recording this as a conscious rejection, not an oversight.

### CoCo CoWork — worth a look

*"another good example of adding more Snowflake features and more brownie points."* Not previously considered. Low effort if it is simply surfacing our agent in CoWork. Ties to the brief's **"working across surfaces"** bonus (`G6`). **Priority: MEDIUM, investigate cost.**

---

## Eligibility — needs confirming

*"only if you're sitting at a **GCC organization based out of India** are you eligible"* · *"team up until **four members max**"*

Two facts to verify against our situation: GCC-organisation eligibility, and team size ≤ 4. Our schedule assumes 3 people.

---

## Net changes to scope

| # | Change | Driver | Priority | Cost |
|---|---|---|---|---|
| X1 | **4 skills + orchestrating Task** (was 1 skill) | "separate skills per process" + "headline bonus" + "orchestration very much needed" | **HIGH** | low — repackaging |
| X2 | **FHIR-JSON semi-structured path** | "semi-structured" named; also closes F4 | **HIGH** | ~3 h |
| — | Adopt "**risk stratification**" + "**care gap**" vocabulary | Their exact words | HIGH | wording |
| — | Flesh out **verified queries** (§7) | "very very crucial" | HIGH | ~2 h |
| — | **Notification** layer (email/Slack) | "notify the final user" | MEDIUM | ~2 h |
| — | **MCP** connector (Jira/ServiceNow) | "best to have" | MEDIUM | ~3 h |
| — | Investigate **CoCo CoWork** | "brownie points" | MEDIUM | TBD |
| — | **Reject Cortex ML** | conflicts with "never opaque predictions" | — | — |

**The transcript validates the three reviews rather than overturning them.** Every gap it reveals — FHIR ingestion, notifications, MCP, verified-query depth — was already flagged in `SCALE-REVIEW.md` or `PROBLEM-STATEMENT-verbatim.md`. The genuinely new finding is **X1: multiple skills orchestrated by a Task**, which is both the headline bonus and the orchestration bonus in a single move.
