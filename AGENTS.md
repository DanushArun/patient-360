# AGENTS.md — Saarthi project rules

**Binding on any agent working in this repository. Read before acting.**

---

## 1. GIT — COMMIT ALLOWED, NOTHING ELSE DESTRUCTIVE

**Updated 21 Sept 2026 by Danush: given the volume of build work in the final push, `git commit` is allowed** — commit working, reviewed progress with clear imperative messages, one logical change per commit, same discipline as if Danush wrote it himself.

**Still never run `git push`, `git merge`, `git rebase`, `git reset`, or `git tag` without being explicitly asked in that exact moment.** Those touch shared/remote state or rewrite history; commits to the local working tree do not.

**What you may always do:**
- `git status`, `git diff`, `git log`, `git show`, `git ls-files` — read-only inspection
- `git add` / `git rm --cached` **only if explicitly asked to stage something**

**What to do instead of committing:** finish the work, leave it in the working tree, and tell him what changed and why it's worth committing. He decides.

If you believe something urgently needs committing, say so in one sentence and stop. Do not do it.

---

## 2. Architecture rules — non-negotiable, enforced in code

These are the product. Violating one is a defect, not a design choice.
Full detail: `docs/architecture/SPEC.md`.

| Rule | Statement |
|---|---|
| **R1** | The LLM never decides. It extracts typed assertions, interprets questions into bounded tool calls, ranks passages, and phrases answers from supplied facts. Every status, number, date, threshold comparison and gate outcome comes from SQL against a versioned rule. |
| **R2** | Three clocks: `event_time`, `source_recorded_at`, `ingested_at`. Every answer carries `known_as_of`. |
| **R3** | Missingness is a type, never a NULL: `present · explicitly_negative · pending · not_received · conflicting · unreadable · superseded`. "Not received" is never "negative". |
| **R4** | Identity is ABHA-anchored and federated. Never join on name. Ambiguous matches quarantine and contribute **no** evidence. |
| **R5** | Scope is enforced server-side before retrieval, in three layers. See §3. |
| **R6** | Two document corpora, never mixed in one ranked list. Physically separate Cortex Search services. |
| **R7** | Extraction is never trusted on a single pass for safety-critical fields. Two passes, two different model families. Disagreement → `conflicting` → the gate returns `not_evaluated`. A value is never asserted from one unverified read. |

---

## 3. Verified platform facts — do not contradict these

Each was established empirically. Query IDs in `evidence/coco/verification-query-ids.md`.

1. **Row access policies MUST key on `CURRENT_USER()`, never `CURRENT_ROLE()`.**
   Inside an `EXECUTE AS OWNER` procedure, `CURRENT_ROLE()` becomes the *owner's* role while `CURRENT_USER()` stays the caller. A role-keyed policy returns every patient — a total bypass invisible in single-user testing.

2. **The application session MUST run `USE SECONDARY ROLES NONE`** (or authenticate as a dedicated service user granted only the app role).
   Otherwise a secondary `ACCOUNTADMIN` satisfies privilege checks through the back door and "the app role has no `USAGE`" becomes a false statement.

3. **Cortex Search ignores row access policies.** It runs with owner's rights. Never rely on RAP to scope search results.

4. **A Cortex Search service cannot be created over a RAP-protected table.** Change tracking fails on correlated subqueries, and the standard mapping-table RAP is one. Therefore: `DOC_CHUNK` is un-RAP'd (index, returns IDs); `DOC_PAGE` is RAP-protected (content).

5. **The agent must never receive a raw `cortex_search` or `cortex_analyst_text_to_sql` tool over patient data.** Tested: it derives `patient_id` from the *question text* and injects the filter itself. Give it only `generic` tools calling owner's-rights procedures, and **omit `patient_id` from every tool input schema** — unreachable by construction, not by instruction.

6. **`AI_FILTER` text form takes ONE argument.** The two-argument form is for images only. Use `AI_FILTER(PROMPT('… {0}', col))` or `AI_FILTER(CONCAT('…', col))`.

7. **Stages used by AI functions must be `ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE')`.** AI functions cannot read `SNOWFLAKE_FULL`, user stages, or table stages.

8. **Working models on this account, as at 17 Sept:** `llama3.1-70b`, `llama3.3-70b`, `llama3.1-8b`. Rejected as legacy: `claude-4-sonnet`, `mistral-large2`. Agent `orchestration: auto` resolved to `claude-opus-4-8`.

   ⚠️ **Partly stale as at 20 Sept. Re-probe before relying on it** — `backend/sql/probes/model_availability.sql`.
   - **`llama3.1-70b` is now marked `[legacy]`, end-of-life pending.** R7 pass B has moved to **`claude-haiku-4-5`** — and the more important reason is that `llama3.1-70b` was **never a different family from `llama3.3-70b`**, so the cross-family independence R7 rests on did not exist. Fallbacks: `mistral-large3`, `qwen3-32b`. **Never a second Llama.**
   - **`orchestration: auto` is banned.** It re-selects upward whenever a stronger model reaches the account, silently changing cost and invalidating measured accuracy. Pin it.
   - `GCP_ME_CENTRAL2` appears in **no** Snowflake regional availability table. Every model arrives via cross-region inference, so the published roster is an upper bound, never a guarantee for this account.
   - Use **`AI_COMPLETE`**; `SNOWFLAKE.CORTEX.COMPLETE` is superseded. `temperature: 0` on both extraction passes.
   - Full reasoning: `AI-INTEGRATION-ARCHITECTURE.md` §1.1–§1.3 and §12.

9. **AI functions cannot run inside Dynamic Tables.** AI steps go in Tasks; deterministic steps go in Dynamic Tables.

10. **Fail closed.** If `AI_FILTER` errors, strip the claim. If extraction pass B fails, do not assert the value. Never pass-by-default.

---

## 4. Honesty rules

The submission is judged partly on Solution Completeness, and judges spend **18 days alone with this repository** (5–22 Oct) before any live demo.

- **No claim in the README or deck that is not demonstrable from the repo.** `IMPLEMENTATION-STATUS.md` marks every component `built | partial | designed-only`.
- **Report absolute counts alongside rates.** Cold starts reported separately.
- **Synthetic data only in the system.** The 19 real medical reports informed *format research only* — consent held (the patient's son is on the team), credited with dignity, never used as system data or as sympathy leverage.
- **Engineering gates on synthetic tests are not clinical validation.** Say so.
- **`QUERY_HISTORY` for live evidence; `ACCESS_HISTORY` for the written pack** (up to 180 min lag). Label which is which. Never present stale data as live.
- **Competitor comparisons cite file and line** from their public source, never inference from gaps in their README.
- **Record failures.** Failure-and-fix pairs are the most credible lifecycle evidence available. Do not curate them out.

---

## 5. Class A / Class B — a legal boundary, not a preference

NMC Telemedicine Practice Guidelines 2020 prohibit AI platforms from clinical counselling or prescribing. The registered practitioner remains solely accountable.

- **Class A** — clinical judgment ("should she proceed?", "is this safe?", prognosis, dosing). **Always refused, every role.** Offer an `EVIDENCE_PACKET` addressed to the named treating practitioner.
- **Class B** — record and coverage state ("what do we have?", "what's missing?", "what contradicts what?", "is this authorised?"). Answered deterministically, with citations.

Default to Class A when ambiguous.

Never output a confidence percentage. Report the observed evidence state instead — *"final report not received"*, *"two sources disagree"*, *"3 claims verified against 5 sources"*.

---

## 6. Scope discipline

18 days, 3 people, a confirmed rubric of Relevance 30 / **Technical Execution 40** / Completeness 30.

- **Shipped beats designed.** The category is *Execution*.
- **Do not add tables, rules, or features not in `SPEC.md`.** Designing more than we build is actively negative on Completeness.
- **Hard gate at Day 5:** if one patient does not flow document → parse → two-pass verify → rule → cited answer on screen, cut scope immediately — not at Day 12.
- **Refuse Cortex ML and any trained predictive model.** The brief says *"never opaque predictions."* Risk stratification comes from versioned SQL rules.

---

## 7. Working style

- Be direct. Lead with the technical conclusion. No reflexive agreement.
- State verified facts, remaining risks, and next actions separately.
- If something can be tested instead of assumed, test it.
- If a claim cannot be guaranteed, say exactly why and what verification is required.
