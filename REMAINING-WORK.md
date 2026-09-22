# REMAINING-WORK.md — Daksha's tracking view

Personal tracker. **Not** a replacement for `IMPLEMENTATION-STATUS.md` (that stays as Danush wrote it). This file exists only to reconcile STATUS (dated 20 Sept) against the last ~50 commits and give me a clean checklist of what still needs to ship.

**Scope rule (per AGENTS.md §6):** only items already named in `SPEC.md` or `IMPLEMENTATION-STATUS.md`. Zero new tables, rules, features. Anything I noticed that isn't in either doc goes under §5 "Gap for consideration" — flagged for team discussion, **not** silently added.

---

## 0. Deploy progress on my JN89282 account (as of 22 Sept, evening)

Live vertical slice against `EA72552_SNOW` / account `JN89282` / user `DAKSHA`.

| Phase | Status | Details |
|---|---|---|
| Phase 1 — `deploy.sh` base (18 manifest steps) | **done** | Steps 1–11 + 17: account param, warehouse, DB + 7 schemas, roles, stages, 5 table files, 3 governance files, ontology + unit registry, 16 rules, 2 Cortex Search services. `snow connection test EA72552_SNOW` = OK (key-pair auth on DAKSHA). |
| Phase 2 — objects Danush built but manifest still comments | **done** | streams (1), 5 base procedures, 8 tool procedures, `DT_HARMONIZED_EVENTS`, semantic view, 2 AI tasks (created, not run), `SAARTHI_AGENT`, `ASK_SAARTHI` procedure. |
| Phase 3a — identity + governance seed | **done** | `load_synthetic.sql` — 1 org, 4 facilities, 1 department, 2 practitioners (`PRAC-01` mapped to `CURRENT_USER()`), 1 patient (`PAT-DEEP-0001`), care team, consent, 7 `ID_MAP` rows. |
| Phase 3b — Step 12 CSV pipeline (Builder 2's slot) | **done** | Ran the three files Danush already wrote (`load_structured_events.sql`, `load_structured_events_copy.sql`, `transform_structured_events.sql`). PUT 4 CSVs from `data/generated/csv/` into `@%STG_SOURCE_EVENTS/FAC-XX/`, COPY INTO staging (12 rows), transform into `ENCOUNTER` + 6 `CLINICAL_EVENT` rows (1 imaging, 3 lab, 2 pathology). `setup.sql` Step 12 still commented — activation deferred pending idempotency re-run. |
| Phase 3c — end-to-end verification | **done** | `ASK_SAARTHI('What are her readiness gates?')` returns real outcomes: **ANC fail**, **PLT fail** (both on 57-day staleness — R2 working), **LVEF `not_evaluated`** (missing), **HBA1C `not_evaluated`** (missing), **DEXA `not_evaluated`** (threshold shape not implemented — see §5). R7 derivation lineage cited: `EVT-CHEMO-03-ANC-DERIVED`. Total tokens ~48k in / 631 out. |

**What is proven on JN89282 right now:** R1 (SQL rules, not LLM) · R2 (three clocks, freshness window) · R3 (missingness never faked) · R7 (derivation lineage) — all end-to-end.

**Not proven yet:** unstructured document → parse → chunk → search → assert path (needs a PDF ingested through `parse_documents` + `extract_assertions` tasks, credit-heavy, deliberately paused).

---

## 1. Reconciliation — what STATUS calls designed-only but git shows built

`IMPLEMENTATION-STATUS.md` was last updated 20 Sept. Between 20 Sept and 22 Sept, a large amount of work landed. This section is informational — do **not** use it as a claim in the submission until STATUS itself is refreshed.

| STATUS section | STATUS says | Git shows (files + commits) | Actually built? |
|---|---|---|---|
| §Day-1 scaffold — `_preamble.sql` | designed-only, never compiled | `backend/sql/procedures/tools/_preamble.sql` exists, referenced by all 8 tool procs | Coded — verifies on deploy |
| §2 Data model — all 34 tables | designed-only | `backend/sql/tables/{10_governance,20_core,30_documents,40_evidence,50_operational}.sql` | Coded — verifies on deploy |
| §3 Rules — 16, 0 built | designed-only | `backend/sql/data/rules.sql` (210 lines, 16 MERGE statements) | Coded — verifies on deploy |
| §4 Copilot — `bind_patient` | designed-only, Day-1 critical | `backend/sql/procedures/bind_patient.sql` | Coded |
| §4 Copilot — 8 generic tools | designed-only | `backend/sql/procedures/tools/01…08_*.sql` | Coded, each commit says "live-tested" |
| §4 Copilot — Class A/B classifier | designed-only | `backend/sql/procedures/classify_question.sql` (commit `bdd7cf9` "live-tested") | Coded |
| §4 Copilot — Answer validator 6 checks | designed-only | `backend/sql/procedures/validate_answer.sql` (commit `d2e499f` "4 of 6 checks live-tested") | **Partial** — 2 checks still missing |
| §4 Copilot — R7 two-pass extraction | designed-only | `backend/sql/tasks/extract_assertions.sql` (commit `72fbac1` "live-tested") | Coded |
| §5 Application — 6 screens | all designed-only | `frontend/pages/{0_Bind_Patient,1_Ask_and_Evidence,2_Review_Queue,3_Patient_360,4_Review_and_History}.py` + `streamlit_app.py` | **5 of 6 built** — Navigator View and Judge Console still missing |
| §6 Snowflake objects — Agent | 1 built (TEST_AGENT only) | `backend/sql/agent/saarthi_agent.sql` + `ask_saarthi.sql` (commit `1b83811` "SAARTHI_AGENT live and tested end-to-end") | Coded — the product agent, not test scaffolding |
| §6 Snowflake objects — Semantic view | 0 built | `backend/sql/semantic/01_semantic_view.sql` (commit `3ea4bfc`) | Coded |
| §6 Snowflake objects — Cortex Search services | 1 (test only) | `backend/sql/search/01_patient_doc_search.sql` + `02_reference_doc_search.sql` (commit `a59ab95` "both live") | Coded |
| §6 Snowflake objects — Tasks | 0 built | `backend/sql/tasks/{parse_documents,extract_assertions}.sql` — 2 of 7 | **Partial** — 5 tasks still to add |
| §6 Snowflake objects — Dynamic Tables | 0 built | `backend/sql/dynamic_tables/01_harmonized_events.sql` — 1 of 5 | **Partial** — 4 DTs still to add |
| §6 Snowflake objects — Procedures | 0 built | 12 `.sql` files under `backend/sql/procedures/` (STATUS said 11 designed) | Coded — count deviation to reconcile |
| §7 Data — deep case fact ledger | designed-only | commit `0734c34` "seeded deep-case fact ledger, TDD, 12 tests" | Coded |
| §7 Data — corruption scenarios | designed-only | commit `3d6d3dc` "corruption scenario 13, TDD, 10 tests" | **Partial** — at least 1 of 13 |
| §7 Data — synthetic PDFs | 1 of ~20 built | commit `373081e` "synthetic PDF reports, TDD, 5 tests" | **Partial** — count unclear, need to check `data/synthetic_docs/` |
| §7 Data — FHIR R4 bundles | designed-only, field mapping only | commit `83cc9a2` "FHIR R4 bundle builder, TDD, 9 tests" | Coded — builder ships, actual bundles per patient TBD |
| §7 Data — ground-truth eval questions | 80 + 80 designed-only | commits `568a023`, `a6169fd`, `8747652` — 2 questions + 1 doc oracle | **Partial** — 2 of 80+80 |

**Coded ≠ deployed.** Every "coded" row above still needs `setup.sql` to run on a live Snowflake account before it counts as "built" by STATUS's own definition. That deploy is exactly what I'm doing on `JN89282` now.

---

## 2. Still not built — per STATUS section, verbatim scope

Only items still designed-only after §1. No new items added.

### §4 Copilot
- [ ] **Answer validator — 2 of 6 checks** (STATUS: "4 of 6 live-tested") — the 2 outstanding checks per `validate_answer.sql`
- [ ] **Conversation model** — binding + `known_as_of` persist across turns; history clears on patient switch (STATUS §4)

### §5 Application — 2 of 6 screens
- [ ] **Navigator View** (4 languages)
- [ ] **Judge Console** (8 probes)

### §6 Snowflake objects — from the "Designed vs Built" inventory
- [ ] **Roles** — 5 designed, 0 in `04_roles.sql` yet (needs verification of that file's content)
- [ ] **Row access policy** — 1 designed, 0 in `01_policies.sql` yet (needs verification)
- [ ] **Masking policies** — 2 designed, 0 yet
- [ ] **Tasks** — 5 of 7 remaining (2 built: `parse_documents`, `extract_assertions`)
- [ ] **Dynamic Tables** — 4 of 5 remaining (1 built: `harmonized_events`)
- [ ] **MCP server** — 1 designed, 0 built
- [ ] **Skills bodies** — 4 designed (frontmatter only), 0 with real bodies
- [ ] **Eval datasets** — 2 designed, 0 built

### §7 Data
- [ ] **100 synthetic patients** — generator exists (`data/generator/generate_patients.py`), full 100-patient run not confirmed
- [ ] **Deep case from real record** — ledger seeded (§1), but 19 specific facts not yet confirmed all present
- [ ] **13 corruption scenarios** — 1 landed (§1), 12 remaining
- [ ] **Synthetic PDFs** — STATUS says 1 of ~20; git added a batch commit — need to count files in `data/synthetic_docs/`
- [ ] **Reference corpus Tier 1** — `data/reference/` still does not exist per STATUS
- [ ] **80 rule fixtures** — not started per STATUS
- [ ] **80 dev + 80 held-out eval questions** — 2 built (§1), 158 remaining
- [ ] **FHIR bundles per patient** — builder exists, per-patient bundles not confirmed

### §8 CoCo lifecycle evidence
- [ ] **Development phase** — not started per STATUS §8
- [ ] **Execution phase** — not started per STATUS §8
- [ ] **Testing and validation** — partial (10 platform behaviours verified, 4 failure/fix pairs recorded). No target count in STATUS, so "keep recording as it happens."

### §Meta — the STATUS doc itself
- [ ] **Refresh `IMPLEMENTATION-STATUS.md`** to reflect §1 above. Danush wrote it; he decides when it refreshes. Judges spend 5–22 Oct alone with the repo (`AGENTS.md` §4), so a stale STATUS is a defect they will spot.

---

## 3. Verification steps (what "built" means for each remaining item)

For my own tracking — how I confirm each §2 item is really done, not just claimed.

| Item | "Done" means |
|---|---|
| Validator checks 5 & 6 | New branches in `validate_answer.sql`, unit tests pass, `check_gate.py --manifest` still passes |
| Conversation model | Streamlit session persists `bind` + `known_as_of` across reruns; switching patient clears history — one manual test per behaviour |
| Navigator View | `frontend/pages/5_Navigator.py` exists, 4 language fixtures load, renders on `streamlit_app.py` |
| Judge Console | `frontend/pages/6_Judge_Console.py` exists, 8 probes each return a canned expected result |
| Roles / RAP / masking | Corresponding `.sql` files non-empty, deploy step in `setup.sql` uncommented, `SHOW ROLES` and `SHOW POLICIES` on JN89282 match SPEC.md counts |
| Remaining 5 tasks | `.sql` files exist under `backend/sql/tasks/`, each is `CREATE OR REPLACE TASK`, live test recorded in commit message per repo convention |
| Remaining 4 DTs | Files under `backend/sql/dynamic_tables/`, deploy step in manifest, refresh confirmed |
| MCP server | Present in agent config, `saarthi_agent.sql` references it, one round-trip logged |
| 4 skills bodies | `backend/skills/*/SKILL.md` body sections replace the scaffold placeholder text |
| 2 eval datasets | Named in `SPEC.md`, files under `data/eval/`, row counts match spec |
| 100 patients | `SELECT COUNT(*) FROM SAARTHI.CORE.PATIENT` = 100 |
| 13 corruption scenarios | 13 tagged rows in the fact ledger, each producing the expected `conflicting` / `unreadable` / `superseded` outcome |
| Reference corpus Tier 1 | `data/reference/` exists, PDFs listed in a manifest, ingested into `REFERENCE_DOC_SEARCH` |
| 80 rule fixtures | `data/fixtures/rules/` with 80 named test inputs, each with an expected gate outcome |
| 158 remaining eval questions | `data/eval/dev.jsonl` = 80 rows, `data/eval/held_out.jsonl` = 80 rows |
| Per-patient FHIR bundles | One bundle per patient in `data/generated/fhir/`, validator passes |

---

## 4. Order I'll work in (my own preference — subject to team discussion)

Rubric: Technical Execution 40 / Completeness 30 / Relevance 30. Prioritise things that make the vertical slice more demonstrable, not things that make the repo look "bigger."

1. ~~**Deploy SAARTHI to JN89282**~~ **done 22 Sept evening** — Phases 1, 2, 3a, 3b, 3c all complete. See §0.
2. ~~**Verify §1 rows against the live deploy.**~~ **done** — R1, R2, R3, R7 all proven end-to-end. Two live bugs surfaced and logged in §5.
3. **Reference corpus Tier 1** — `search_reference_documents` currently returns empty (its commit message admits this). One real WHO guideline or NCCN doc, tokenised into the reference search service, unblocks a whole class of questions. Next Daksha-safe backend item.
4. **Navigator View + Judge Console** — the 2 missing screens. Judge Console especially, because §8 lifecycle evidence and judge reproducibility both depend on it. Frontend phase.
5. **Validator checks 5 & 6** — small, self-contained, moves §4 from partial to built.
6. **Remaining tasks + dynamic tables** — 5 tasks + 4 DTs. Deploy manifest step-by-step. **Danush's territory — check first.**
7. **Corruption scenarios 2–13** — needed for the `conflicting` / `superseded` demos.
8. **Eval questions to 80 + 80.**
9. **STATUS refresh** — after Danush's next scoped commit lands, not before.

Everything above is inside SPEC.md / IMPLEMENTATION-STATUS.md scope. Nothing new.

---

## 5. Gap for consideration — items I noticed, not adding without team say-so

Per Daksha's instruction: if I think something's missing that isn't in SPEC/STATUS, flag it here for discussion. **Do not build these until the team agrees.**

1. **Local dev environment doc** — the setup steps we're going through right now (venv + `snow` CLI + `connections.toml` per teammate) are not documented in the repo. A new teammate joining today has no README-level guide beyond the deploy playbook PDF (which lives outside the repo). Small addition; low risk. — *decide: add a `docs/local-setup.md` or leave to onboarding conversation.*

2. **Per-teammate account naming convention.** `IY67526`, `EA72552`, `HACKATHON` are per-laptop connection names. If judges ever reproduce the setup they'll need one canonical name. — *decide: pin one alias like `SAARTHI_DEV` in docs and let each teammate map their local connection to it.*

3. **`snow connection test` OAuth-refresh trap** — the CLI's cached OAuth token expires silently and needs a browser round-trip to refresh. Bit me in this session. Worth one sentence in the deploy playbook. — *decide: add to §7 of the playbook or leave.*

4. **`IMPLEMENTATION-STATUS.md` update cadence.** STATUS is 2 days out of date and this delta is likely to keep growing until the freeze on 5 Oct. — *decide: agree a "refresh STATUS whenever the delta > N commits" rule, or nominate one person to keep it current.*

5. **No entry in STATUS §6 for `chunk_documents` procedure**, which git shows exists (`backend/sql/procedures/chunk_documents.sql`). May be intentionally rolled into the "Procedures 11 designed" count, or may be one that landed after STATUS was written. — *decide: reconcile the count.*

6. **`evaluate_gates` doesn't implement DEXA T-score threshold shape.** Discovered live on 22 Sept: `ENDO-DEXA-001` has evidence (`EVT-DEXA`, T-score = -1.6) but the gate returns `not_evaluated` with reason *"evidence exists but this rule's threshold shape is not yet implemented by evaluate_gates"*. The rule row ships in `RULE_CATALOG` but the SQL comparator branch for it is missing in `backend/sql/procedures/evaluate_gates.sql`. Real bug, not a design gap. Danush's territory. — **Decision (22 Sept): flag to Danush, do not fix in this branch.**

7. **`ledger.py` doesn't emit LVEF or HbA1c events.** Two of five readiness rules can therefore never be tested end-to-end from generated data. Extending it requires editing `data/generator/ledger.py`, `projections.py`, `fhir_bundles.py`, and updating the 12 ledger tests + 8/9-test projection/FHIR test suites, plus `STG_SOURCE_EVENTS` columns, `COPY INTO`, `transform_structured_events.sql`, and `DT_HARMONIZED_EVENTS` normalization. Danush's territory (he owns the generator). — **Decision (22 Sept): flag to Danush, do not fix in this branch.**

8. **`setup.sql` Step 12 activation.** Ran the three Step-12 files manually against JN89282 today; they worked. But the `EXECUTE IMMEDIATE FROM './data/load_structured_events*.sql'` and `./data/transform_structured_events.sql` lines in the manifest are still commented, which means a fresh `deploy.sh` on a clean account will not include them. Per Danush's own rule (*"Uncomment a line the moment its file exists AND runs clean on its own"*), those three lines are now eligible to be uncommented. — *decide: do the uncomment on this branch (small edit to `setup.sql`, matches his rule) or leave for him to activate.*

These are observations, not additions. They stay in this section until the team decides otherwise.

---

*Last updated: 22 Sept 2026, evening — added §0 deploy progress, marked §4 items 1–2 done, added §5 items 6–8. Personal tracker only — the authoritative status doc is `IMPLEMENTATION-STATUS.md`.*
