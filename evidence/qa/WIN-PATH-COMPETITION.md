# SAARTHI - Win-path competitive research

Date: 2026-10-04 (submission deadline day, 11:59 PM IST, T&C s1.1; entry frozen after, s4.1: `planning/research/winning-review-2026-09-23/competition-and-plans.md:46-58`). Read-only research. No source edited, no git writes, no credential files read, no SQL run.

Method: local files read (listed below); web via TinyFish search/fetch and `gh` against public repos on 4 Oct 2026. Line numbers for external READMEs are from the README as fetched on 4 Oct 2026 (`gh api repos/<r>/readme`), so they may drift. Anything not fetched is labelled UNVERIFIED.

Local sources: `planning/research/winning-review-2026-09-23/competition-and-plans.md`, `planning/revised-architecture/FINAL-VALIDATION.md` (lines 124-160), `planning/research/clinical/ps04-competitive-landscape.md`, `evidence/qa/JUDGE-EVALUATION.md`, `README.md`, `IMPLEMENTATION-STATUS.md`, `evidence/coco/verification-query-ids.md`.

## 0. Hard limits of this research (read first)

- **No winning healthcare Snowflake hackathon entry could be found.** The PS-04 evaluation window is 5-22 Oct (`competition-and-plans.md:40`); this edition has no winners yet.
- The only completed CoCo CLI hackathon found is the **APJ edition**. Results post (fetched): Winner **Cocomo**, 1st runner-up **Emoldinounited**, 2nd runner-up **The Token Burners**, consolation Echo, Impedance, Solifan, Sergio Lee, Simon Surya Keban, dated 22 Sep 2026 (https://www.instagram.com/p/DdlOvTHiM6q/ ; https://www.facebook.com/hack2skill/posts/from-what-if-to-we-built-it-an-idea-became-a-prototypethe-prototype-became-a-wor/1119512420578263/). A commenter says "Top 13 Finalist Pitching" (same Facebook page). **I found no repo, README or judge commentary for any APJ winner.** What winners "look like" is therefore UNVERIFIED; the patterns below come from same-hackathon GCC entries and the stated rubric, not from confirmed winners.
- The APJ rubric is the same 30/40/30 (https://hack2skill.com/event/cococlihack, "Evaluation Rubric"). Stated focus: "end-to-end execution", "deployable systems" ("Program overview"). That is the only published statement of what judges value.
- The older Snowflake "RAG 'n' ROLL" Devpost hackathon published criteria (Technological Implementation incl. "Is the quality of search results tested?", Design, Impact, Idea) and a TruLens bonus for showing measured experiments (https://snowflake-mistral-rag.devpost.com/ , "Judging Criteria", "Bonus Prize"). Its winners page did not load in my fetch; gallery shows 108 entries and no healthcare winner is identifiable. Dated 2024-25; weak evidence for this rubric.

## 1. Reference projects (9)

| # | Project | URL | Relevance | What it demonstrates |
|---|---|---|---|---|
| 1 | **KASAUTI** (GCC edition, Track 1 banking/regtech) | https://github.com/apoorvgpt9/kasauti | Same hackathon, same GCC cohort, pushed 3 Oct 2026 (gh). **Best model of the evidence-heavy submission SAARTHI should be compared against.** | README `:12` links demo video, deck PDF, 6-step evaluator walkthrough, EVALUATION.md, decisions log, CoCo evidence. `:18` "try it in 15 minutes" for evaluators with a login. "Invariants 269/269 pass" (`docs/EVALUATION.md` s1) with INVARIANT and MEASUREMENT separated, E6 reported as **0/3 then 1/3**. 4 project skills (`:92`) chained. Guard hook with 86 tests + CI (`:98`, `:175`). `INCIDENT-001` failure-and-fix (`:105`). Mutation tests prove the answer key catches wrong controls (`docs/EVALUATION.md` E1 table). 17 CoCo plan files in `.cortex/plans/`, per-session summaries in `evidence/s00..s11_summary.md`, `audit_verify_*.md` reports with query IDs. |
| 2 | **Verity** (GCC, PS-04 prior-auth) | https://github.com/Favas111/verity-pa-copilot | Same problem statement. Local note already tracks it (`ps04-competitive-landscape.md:41`). | `README.md:26` "The system cannot deny care" structural property in `sql/05_rollup.sql`. Single-screenshot demo section with a 3-member table mapping each member to a proof point. `:99` named design decisions (search then `AI_FILTER` polarity). `:202` records a **discarded** CoCo run (answer key leaked) next to the valid blind run (21/21 structure, 0/21 label overlap). `:218` "Measured results": 43 s, 315/315 cited nodes, 245,291 rows, ~$7. `docs/demo-script.md` is a timed 3-minute script with cold-start warm-up note. `ENGINEERING_NOTES.md` lists every gotcha. |
| 3 | **ATLAS** (GCC, PS-04 trial eligibility) | https://github.com/casafurix/bodhix-snowflake-cococli-hackathon | Same PS; live public URL per local note (`ps04-competitive-landscape.md:63`). Public live status is UNVERIFIED by me today. | gh tree: 3 `.cortex/skills/*/SKILL.md` (coordinator-action-orchestrator, patient-screening, protocol-intelligence), `.github/workflows/ci.yml`, `backend/tests/` 6 files, `cloudflare/worker.mjs` + test, `Dockerfile`. |
| 4 | **CareCompass** (GCC, PS-04) | https://github.com/rahulsahay123/carecompass-app | Same PS. | README leads with one vivid failure story: Metformin continued with eGFR <30 across 3 specialties (`README.md` "The Problem"), banner/badges/team table, "Synthetic Data Engineering & Validation" (`:152`) with stats images, "Quick Start" (`:316`), "Skills" (`:383`). Local review confirms access control is a UI picker (`ps04-competitive-landscape.md:114`, from `streamlit/login.py`; not re-verified today). |
| 5 | **SynapseCortex-AI** (GCC, PS-04) | https://github.com/nishnarudkar (repo path per local note; **not re-fetched today, UNVERIFIED**) | Same PS. | Local note: rigid `[Doc: file, Page: n]` citation contract and exact "Insufficient evidence" fallback (`ps04-competitive-landscape.md:88`). |
| 6 | **Snowflake-Labs/sf-hcls-solutions** (official baseline) | https://github.com/Snowflake-Labs/sf-hcls-solutions | The quality floor Snowflake itself publishes for HCLS. | Fetched README: Clinical Quality and Patient Safety Agent (Snowflake Intelligence, Cortex Agent, Analyst, Search over PubMed, semantic model); standard layout `manifest.json`, `README.md`, **`NEXT_ACTIONS.md` (post-install verification steps and example queries)**, `scripts/` with setup **and teardown**, Apache-2.0. |
| 7 | **StanfordBDHG/LLMonFHIR** (open source) | https://github.com/StanfordBDHG/LLMonFHIR | Open-source "LLM over FHIR records", 158 stars (gh). | README (fetched): CI badge, codecov badge, **Zenodo DOI badge**, screenshots table, explicit "Study Overview" and "Disclaimer" (experimental, informational). MIT. Shows how a credible open-source health-LLM repo signals research seriousness. |
| 8 | **FinOps-Guardian** (CoCo hackathon, other track) | https://github.com/TanvirIslam-BD/FinOps-Guardian | Shows the median CoCo entry. | Topic page (fetched): classifies severity, auto-resolves low-risk, routes high-risk for human approval, "full audit trail". 1 star. A governed-action-with-audit pitch is common at this level. |
| 9 | **Cortex Code skills / AI Kit** (official) | https://github.com/Snowflake-Labs/cortex-code-skills , https://github.com/Snowflake-Labs/snowflake-ai-kit | What "reusable skill" means to Snowflake, the stated headline bonus (`competition-and-plans.md:80`). | Skills with envelope-based permission policy (`snowflake-ai-kit` description, topic page). |

Open-source patient-360 / clinical-RAG: the earlier local review already covers OpenMRS, Bahmni, OpenEMR (`planning/research/open-source-hospital-workflow-code-review-2026-09-24.md:146-160`). My searches for "FHIR copilot RAG citations" returned FHIR-Former (https://github.com/UMEssen/fhir-former, predictive framing, which conflicts with AGENTS.md s6) and LLMonFHIR; I did not find an open-source project with missingness types, bitemporal answers or scope enforcement. That absence is a search result, not proof.

## 2. Patterns the strongest comparable entries share

Evidence in each row is KASAUTI (K), Verity (V), ATLAS (A), CareCompass (C) from files cited above.

1. **A one-sentence principle, then a numbered evaluator path.** K: "SQL decides, AI drafts, a human signs" (`README:14`) and a 6-step, 15-minute walkthrough (`:18`, `docs/submission/walkthrough.md`). V: 3 named demo members, each proving a different path (`README:~40`). SAARTHI's README leads with architecture rules and has no numbered "try this" path (`README.md` rules table, then quickstart; `JUDGE-EVALUATION.md` gap #2).
2. **Hosted/in-account runnable UI.** K: Streamlit in Snowflake on the evaluator's own login (`:18`). V: Streamlit console + `cortex agents run` one-liner. A: live URL. SAARTHI: Next.js on `127.0.0.1` only (`README.md` status paragraph).
3. **Measured results with absolute counts and honest bad numbers.** K: invariants 269/269, E6 0/3 then 1/3. V: 43 s, 315/315 cited, ~$7. SAARTHI: `backend/eval/results/` is empty; 80 questions unscored (`JUDGE-EVALUATION.md` Technical Execution "against").
4. **Demo video + deck linked from the README top.** K `:12`, V `docs/verity-prototype.pptx` + `docs/demo-script.md`. SAARTHI: deck and video "produced by the team" (`README.md` evidence table).
5. **CoCo evidence per lifecycle phase, with transcripts and plans.** K: table at `:~60-75`: 17 `.cortex/plans`, per-session summaries, `audit_verify` reports. V: `docs/coco-runbook.md`, `docs/coco-transcripts/`. SAARTHI has the four YAMLs (planning 381 lines, development 144, execution 221, testing 437 per `JUDGE-EVALUATION.md`) and 4 plan files in `.cortex/plans/`, but no per-session transcripts.
6. **Skills that are actually installed and chained.** K: 4 skills, `cortex skill publish`, chained (`:92`). A: 3 SKILL.md. SAARTHI: 4 SKILL.md, "authored, not uploaded", `reuse-tests/` empty (`README.md` Built/Partial/Designed table; `JUDGE-EVALUATION.md` Completeness).
7. **Recorded own-failure story.** K: INCIDENT-001 (`:105`). V: discarded run1 (`:202`). SAARTHI has this too (QA rounds, `execution.yaml`) and it is a strength (`JUDGE-EVALUATION.md` "Failures recorded").
8. **CI badge / test count visible.** K: GitHub Actions on every push (`:175`). A: `ci.yml`. SAARTHI: no `.github/` directory (checked: `ls .github` fails).
9. **Reproduction path with teardown / post-install verification.** sf-hcls-solutions `NEXT_ACTIONS.md` + teardown scripts. SAARTHI: bundle "never run on a clean account" (`README.md` Quickstart B).
10. **Failure-mode honesty about where the guarantee stops.** K `:107` "Known limitation" on identity inside Streamlit, with the after-the-fact check named. This is the same genre as AGENTS.md s4.

## 3. What SAARTHI lacks relative to them (ordered by cost to a judge)

All checked locally 4 Oct unless cited.

1. No hosted or in-account UI a judge can open (README status paragraph). Largest gap versus K, V, A.
2. No eval results: `backend/eval/results` empty (`ls`, 4 Oct). K and V headline measured numbers.
3. No demo video or deck in repo (`README.md` evidence table; `docs/DECK-OUTLINE.md` is an outline).
4. README has no numbered evaluator path in its first screen; leads with the 7-rule table.
5. No CI workflow.
6. Skills authored but not uploaded; no `skills:` block (`JUDGE-EVALUATION.md`).
7. Unresolved security question on the headline claim: finding N4-03, RAP subquery may bind `doc_id` to the inner table, no recorded cross-patient negative on `DOC_PAGE` (`JUDGE-EVALUATION.md`, Technical Execution). K measures its equivalent (E8 24/24, tamper drills).
8. Answer validator not in the answer path; semantic view has zero verified queries (`JUDGE-EVALUATION.md`).
9. R7 disagreement path never exercised live: "both readers agreed on every field" (`JUDGE-EVALUATION.md` R7 row). This is the proof of the headline differentiator and it has no live demonstration.
10. Evidence split across two accounts (JN89282, OS69400) (`JUDGE-EVALUATION.md`).

## 4. What SAARTHI uniquely has: headline ranking

Differentiation is judged against the field I could read (K, V, A, C, Synapse). Competitor statements for A, C, Synapse come from the local review, which says it cannot be re-verified from the repo (`ps04-competitive-landscape.md:3-7`); treat "no one else has it" as "not found in code reviewed".

| Rank | Asset | Why it should lead | Evidence it exists | Caveat |
|---|---|---|---|---|
| 1 | **Row-access-policy / platform findings with query IDs** (CURRENT_ROLE vs CURRENT_USER in owner's-rights; Cortex Search ignores RAP; agent derives patient_id from question text) | Reproducible, falsifiable, and useful to every other team. K reports an adjacent finding (`CURRENT_USER()` is NULL inside Streamlit, `README:107`) so judges already value this genre. Strongest on "Technical Execution 40". | `evidence/coco/verification-query-ids.md`; RAP body `backend/sql/governance/01_policies.sql:46-72` (per `JUDGE-EVALUATION.md`) | N4-03 unresolved on the current build; findings were tested on account FV11738 on 17 Sep. Label date and account. |
| 2 | **Failure-and-fix evidence trail** | K and V both use it as credibility; SAARTHI has more of it (4 QA, 5 fix, 4 deploy rounds). | `evidence/qa/*`, `evidence/coco/execution.yaml`, `testing_validation.yaml` | Needs a one-page index so a judge finds the best three pairs in 60 seconds. |
| 3 | **Two-pass cross-family extraction, fail-closed** (R7) | Unique in the reviewed set (`ps04-competitive-landscape.md:132-138`). Live: 68 assertions verified, one page failed closed (`README.md` Built row). | `backend/sql/procedures/extract_one_document.sql` | Disagreement path not exercised live; do not claim cross-family disagreement was observed. |
| 4 | **Class A/B legal boundary** (NMC 2020) | Resonates with the "Real-World Relevance 30" criterion and with Verity's equivalent "cannot deny care" framing (V `:26`). Enforced in three places (`README.md` Class A/B). | `backend/sql/procedures/classify_question.sql`, `web/lib/question-routing.mjs` | Coverage "not yet measured" (`README.md`). |
| 5 | **Missingness as 7 types + "not received is never negative"** | Concrete, demo-legible; Verity has 3 states (`ps04-competitive-landscape.md:47`). | `06_get_timeline.sql:117-126` etc. (per `JUDGE-EVALUATION.md`) | Runtime unproven per N3-01. |
| 6 | **Deterministic gates + 16 rules / 80 fixtures** | Table stakes in this field (R1 is checked on every competitor, `FINAL-VALIDATION.md:130`). Not a differentiator, a floor. | `evaluate_gates.sql`, `data/fixtures/rules/rule_fixtures.yaml` | 28 live tests on an earlier account only. |
| 7 | **Three clocks / `known_as_of`** | Unique in reviewed set but visible only if the correction-replay demo runs. | `web/lib/answer-contract.test.mjs` | Time-travel replay needs live. |
| 8 | **ABHA-anchored identity** | Lowest as a headline: the deep case has no ABHA by design (`JUDGE-EVALUATION.md` R4 row) and the Indian-context relevance, not the mechanism, is what a judge sees. Keep as supporting. | `bind_patient.sql` | Do not claim federated ABDM (`competition-and-plans.md:139-142`). |

Recommended headline order for any remaining text: (1) "scope leaks that Snowflake documentation does not warn about, with query IDs", (2) "one value never asserted from one read", (3) "refuses clinical judgment by law, not by prompt", (4) the failure-and-fix trail.

## 5. "Steal this" list (doable today, deadline 11:59 PM IST)

Fit column: **OK** = no SPEC.md change (docs/packaging of existing artefacts). **SPEC?** = would add a feature; AGENTS.md s6 forbids unless in SPEC.md.

| # | Steal | From | Effort | Fit | Notes |
|---|---|---|---|---|---|
| 1 | **"Evaluate in 15 minutes" box at top of README**: a 5-6 step numbered path ending with an expected-output line per step, marking each step offline vs needs-account. Mirror K's walkthrough format. | K `README:18`, `walkthrough.md` | 45-60 min | OK | Highest return per `JUDGE-EVALUATION.md` gap #2. Only claim steps you can run offline today (pytest, `check_gate.py`, bundle check, `/design-preview/PAT-DC-07`). |
| 2 | **One-sentence principle under the title**, replacing the long "What it does" lead. E.g. "SQL decides, AI extracts and phrases, the practitioner stays accountable." | K `:14` | 10 min | OK | Also fixes README line-7 readiness framing flagged in `JUDGE-EVALUATION.md`. |
| 3 | **"Measured results" table with absolute counts**: 375 py / 257 web / 40 e2e passed (already in README), 16 rules / 80 fixtures, 68 assertions verified / 1 failed closed, 66/66 numeric values linked. Label each as live/offline/account. | V `:218`, K E-table | 30 min | OK | Only numbers already recorded. Add "Eval: 80 questions, 0 scored" explicitly; K shows 0/3 and survives. |
| 4 | **Failure-and-fix index** (10 rows: failure, evidence file:line, fix, verifying query ID or test). Pick from `evidence/qa/*`, `execution.yaml`. | K INCIDENT-001, V `:202` | 45 min | OK | AGENTS.md s4 requires failures be recorded. Put the N4-03 open item in the list as **open**, not hidden. |
| 5 | **Demo script with cold-start warm-up and a safe version**, timed to 3 minutes, based on the six-minute table in `competition-and-plans.md:281-290`. | V `docs/demo-script.md` | 30 min | OK | Honours organiser note that recording needs approval (`competition-and-plans.md:55`). |
| 6 | **Three named demo patients, each proving a different path** (one clean, one `conflicting`/`not_received`, one Class A refusal) in the README. | V `:~40` | 20 min | OK | Use existing synthetic patients; do not add data. |
| 7 | **One-page "Platform findings" doc** lifting the 3-4 headline findings out of `verification-query-ids.md` with date, account, region, and the exact `QUERY_HISTORY` lookup. | K `:107` genre | 30 min | OK | Note the 17 Sep date and FV11738 and that N4-03 is untested on current build. |
| 8 | **`NEXT_ACTIONS.md`-style post-deploy verification list** next to `backend/sql/deploy/README.md` (what to SELECT after each step, expected rows). | sf-hcls-solutions | 30 min | OK | Bundle already has VERIFY blocks; this is a summary. |
| 9 | **CI workflow** running the offline pytest and `check_gate.py`, badge in README. | K `:175`, A `ci.yml` | 20 min | OK, but **risk**: a failing or unrun badge is negative. Only add if it can be run once green; also a new file after review may sit awkwardly with a frozen entry. | The repo has no `.github/`. |
| 10 | **Zenodo-style citation / disclaimer block** ("research prototype, synthetic data, not clinical validation") | LLMonFHIR README | 10 min | OK | Aligns with AGENTS.md s4. DOI itself not needed. |
| 11 | **Mutation-test the answer key** (deliberately broken rule variants must fail fixtures), reported as a count. | K E1 table | 2-3 h | OK in principle (tests of existing rules) but not feasible safely today without deploy; **skip** unless offline fixture runner supports it. | Mention as future work only. |
| 12 | **Score the 80 questions** | K E7, V measured results | Needs live account + hours | Needs deploy, not offline | `JUDGE-EVALUATION.md` marks as [DEPLOY]. Do not start unless account is ready; report 0 scored honestly otherwise. |
| 13 | **Upload skills / `skills:` block / `cortex skill publish`** | K `:92` | 1-2 h + deploy | Headline bonus per organiser, but **status ledger says designed-only**; SPEC? no (skills are in SPEC), deploy yes. | Only if a deploy is possible today; otherwise leave as "designed-only". |
| 14 | **Judge Console UI** | SPEC screen 6 | >4 h | In SPEC, but `README.md` says no UI. **Do not build today**; keep probes as SQL, list honestly. |
| 15 | **Outbound MCP action / notifications** | K `s13b` | >4 h | In SPEC but not built; **skip**. |
| 16 | **Cut: any README claim that is not demonstrable.** Fix claims C-1..C-9 in `JUDGE-EVALUATION.md` (note: I did not re-read that list in full). | AGENTS.md s4 | 20 min | OK | Honesty is itself a judging asset; K's README states limitations. |

## 6. Top 10 insights

1. **There is no verified "winner template" for this hackathon.** The only completed edition (APJ) published names only: Cocomo / Emoldinounited / The Token Burners (Instagram post above); no repos found. Do not claim to know what won.
2. **The closest comparable, KASAUTI (https://github.com/apoorvgpt9/kasauti), is the benchmark SAARTHI will be read against.** It ships video, deck, 15-minute evaluator path, a hosted app, 269 invariants, CI, 4 installed skills, 17 CoCo plan files and transcripts (README `:12`, `:18`, `:92`, `:175`).
3. **SAARTHI's reasoning matches KASAUTI's and is often deeper on Snowflake platform findings**, but its packaging is far behind: no hosted UI, no results, no CI, no video, no walkthrough (`JUDGE-EVALUATION.md` Completeness).
4. **Judges are told Technical Execution is 40%, but the published phrase is "end-to-end execution" and "deployable systems"** (https://hack2skill.com/event/cococlihack). A repo that runs on a stranger's account scores on this; a local `127.0.0.1` dashboard does not (`README.md` status).
5. **Honest bad numbers do not hurt in this field; they are the norm among serious entries.** KASAUTI reports E6 0/3 then 1/3 (`docs/EVALUATION.md` s1); Verity publishes a discarded run (`README:202`). SAARTHI should publish "eval: 80 written, 0 scored" the same way.
6. **Headline with the query-ID platform findings first**, not the seven rules. The rules are a checklist every competitor claims in part (R1 holds for all, `FINAL-VALIDATION.md:130`); the three RAP / Cortex Search / agent-filter findings are reproducible and unique. Date them (17 Sep, FV11738) and flag N4-03.
7. **R7's disagreement path has never been seen live** ("both readers agreed on every field", `JUDGE-EVALUATION.md`). Do not headline "cross-family disagreement detected" without that; headline "one page failed closed (`pass_b_invalid`)", which is true.
8. **Do not build features today.** SPEC items still undeployed (Judge Console, outbound MCP, skills upload, eval run) cannot be proven before the freeze and each adds claims that fail s4. The best-value work is docs that make existing artefacts findable: README judge path, results table, failure index, demo script, platform findings page (items 1-8 above, about 4-5 hours total).
9. **A new CI file and a "clean account" claim are risky today.** The bundle has never run on a clean account (`README.md` Quickstart B). Add a CI badge only if it is green; make no clean-account claim.
10. **Competitor comparisons must stay modest.** FINAL-VALIDATION's R-by-R table (`:130-142`) is a researcher's reading of ~4 repos with no line numbers (`ps04-competitive-landscape.md:3-7`; `competition-and-plans.md:173-185`). KASAUTI, which is not in that table, already implements human-approval enforcement bound to `CURRENT_USER()` and an after-the-fact `QUERY_HISTORY` check (`README:102`, `:107`). "No competitor does X" is now factually unsafe; use "we did not find X".

## 7. Unverified / not done

- APJ winners (Cocomo etc.): no repo found; contents unknown.
- ATLAS live URL status, SynapseCortex repo path, and CareCompass `login.py` claims: taken from the local note, not re-fetched today.
- KASAUTI hosted app and video: linked in README, not opened; test counts are the repo's own statements.
- I did not read all of `JUDGE-EVALUATION.md` (claims C-1..C-9, later sections) or `FINAL-VALIDATION.md` beyond lines 100-175.
