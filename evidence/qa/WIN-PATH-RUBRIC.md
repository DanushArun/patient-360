# SAARTHI win-path rubric (4 Oct 2026, deadline 11:59 PM IST)

Strategist read-only pass. No source edited, no git writes, no credential files read, no SQL run. Status is taken from `IMPLEMENTATION-STATUS.md` (reconciled 4 Oct), `evidence/qa/JUDGE-EVALUATION.md`, `evidence/qa/QA-ROUND-4.md`, `evidence/qa/DEPLOY-ROUND-4.md` and file checks. Live results are *reported*, not re-run. Synthetic engineering checks are not clinical validation (AGENTS s4).

## 0. Verdict first

- **The organiser publishes no sub-weights.** Only 30/40/30 (`planning/PROBLEM-STATEMENT-verbatim.md:57`) and "discretionary" scoring (`competition-and-plans.md` T&C s9). The point splits below are **my decomposition** of the brief's bullets and the explainer's statements, not organiser numbers.
- **What the organiser actually said it rewards** (explainer, auto-captions, weaker than the written brief per `competition-and-plans.md:91-96`):
  - "use as much CoCo CLI, use as much Snowflake native features that adds brownie points" and "full-blown production use cases can be built within the snowflake native" (`ps-explainer-transcript.md:184`);
  - native over LangGraph "will give you more brownie points" (`:148-150`);
  - "verified queries ... very very crucial" for semantic views (`:100`);
  - "probabilistic to most deterministic" via skills + Tasks (`:82`);
  - patient-360 pattern: parse documents, semantic views, cited-evidence agent, one skill per process, Streamlit/React tab (`:92-96`);
  - submission = **public GitHub repo, a deployed link "in a working condition", a prototype template with a publicly accessible demo view link, and an uploaded presentation** (`:122-126`);
  - skill files "reusable... headline bonus" (`PROBLEM-STATEMENT-verbatim.md:39`); MCP named twice (`:35,40`); lifecycle evidence at every phase (`:23-28`).
- **Honest ceiling for today.** A 95+ needs a hosted/working link, a visible video/deck, a measured eval, and a verified security claim. Of these, the repo today has the engineering depth but **fails the submission-package items** (no deck, no video, no deployed link, broken `docs/DECK-OUTLINE.md` link). Realistic result after 8 focused hours is the high 70s to low 80s of my own scale, not 95. The plan below maximises the points reachable; do not market 95.
- **Single biggest points-per-hour item is not code:** it is making the submission form complete (GitHub public + deck + demo video + a link a judge can open). Without them Completeness is capped regardless of engineering.

---

## 1. Checklist: what 95-100 looks like, status, delta, cheapest close

Tags: [OFFLINE] repo-only; [DEPLOY] needs Snowflake; [TEAM] human (video/deck/hosting/form). Effort in hours (h).

### 1A. Real-World Relevance (30) - my split: R1 problem/user 8, R2 brief-literal fit 10, R3 safety/regulatory boundary 7, R4 usability for the stated user 5

| # | 95-100 proof item | Status now (evidence) | Delta | Cheapest action | h | Tag |
|---|---|---|---|---|---|---|
| R1.1 | Quantified, sourced problem + named user in 30 s of README/deck | README lead paragraph names coordinator/family, 1,000+ km (`README.md:6-12`); figures in `WINNING-PLAN.md:30` (74%, 82.6%, 14%, 8% repudiation) sourced to `planning/research/patient-reality/` | Figures not on the judge-facing page with sources; "cancer patient ready" framing was fixed in README but remains in `WINNING-PLAN.md:30,128` (planning doc, ok) | Put 3 sourced figures + one-line user into deck slide 2 and README top. Pull sources from `planning/research/patient-reality/` only if the file cites them; drop any figure you cannot cite | 0.5 | OFFLINE+TEAM |
| R1.2 | Real-patient dignity statement, synthetic-only | `docs/DATASET-LICENCES.md:1-30` and README line 3-4; consent "reported, not documented in repo" | Consent line says not documented | Teammate (patient's son) adds one signed-off sentence to DATASET-LICENCES; no more | 0.2 | TEAM |
| R2.1 | Patient/member 360 spanning structured + FHIR + documents | Workspace route has gate strip, facts, timeline, documents, coverage comparison (`README.md:64-72`); 12 patients, 28 docs (STATUS A) | `COMPLETENESS-MAP` flagged "not end-to-end 360"; FHIR bundles per patient not flowing (`REMAINING-WORK.md` s2) | Do not build more. Show PAT-DEEP-0001 + PAT-DC-07 as the 360 cases; state absolute counts (12 patients, 28 docs) | 0 | - |
| R2.2 | Combines structured with unstructured (explicit brief bullet) | Live: 68 assertions verified, 66/66 numeric values linked to one structured event (STATUS B, 3 Oct) | Circular evidence caveat (C-20) | Keep caveat sentence verbatim in deck; show PAT-DC-07 coverage comparison (table `pending` vs letter `Approved` -> gate `conflicting`) | 0 | - |
| R2.3 | "Risk stratification... never opaque predictions" | 16 versioned SQL rules, 5-gate outcomes; vocabulary adopted per `PROBLEM-STATEMENT-verbatim.md:63-77` | Check UI/README uses the brief's word "risk stratification" with the scope disclosure | Add the disclosure line to README top and deck: "stratifies documentation, coverage and safety-surveillance risk; no prognosis model" | 0.2 | OFFLINE |
| R2.4 | Cited Q&A with clear source evidence | `/api/ask` route exists; document viewer with evidence highlight (`README.md:70`); Ask path = thin `DATA_AGENT_RUN` wrapper | **Answer validator not in answer path** (`JUDGE-EVALUATION.md:56`); agent/MCP only on JN89282 | Cheapest honest close: demo the *deterministic* evidence paths (gate -> source excerpt -> highlighted page) as the cited answer; state validator is partial. Wiring `validate_answer` into ASK is 3-4 h + deploy; only do it if A finishes deploy early | 0 (3-4 optional) | OFFLINE/DEPLOY |
| R3.1 | Class A refusal enforced and demonstrable | Classifier SQL, agent prompt, `web/lib/question-routing.mjs:29` (`overall_status: "refused"`), tests; `docs/CLASSIFIER-TEST-SUITE.md` | No recorded live Class A run on OS69400 (STATUS: "Not tested: a Class A question against the new reference corpus") | One live Class A question in the web UI on camera + record in QUERY_HISTORY | 0.3 | DEPLOY |
| R3.2 | Regulatory question answered from a real reference corpus with page/clause | 7 docs / 692 pages loaded; PM-JAY clauses returned with page indexes as `SAARTHI_APP` (STATUS B 3 Oct); web reference scope **disabled** | Judge cannot see a cited regulatory answer in the UI | Show it via a saved Snowsight query result (screenshot + query ID) of the PM-JAY pre-auth search; do not claim the UI does it | 0.5 | DEPLOY+TEAM |
| R4.1 | A coordinator can use it unaided | Census, worklist, review queue, navigator bring-list (`README.md:64-72`); Playwright 40 pass (stubbed) | Not usable by a judge without own account; single operator | See Completeness C1 (hosted link / video) | - | - |

### 1B. Technical Execution (40) - my split: T1 Snowflake-native depth 12, T2 correctness/determinism/security 12, T3 CoCo lifecycle + ingenuity bonuses 10, T4 testing/eval evidence 6

| # | 95-100 proof item | Status now | Delta | Cheapest action | h | Tag |
|---|---|---|---|---|---|---|
| T1.1 | Native stack used deliberately: AI_PARSE_DOCUMENT, AI_COMPLETE, AI_FILTER, Cortex Search x2, DT, Streams, Tasks, Agent, semantic view | All present (`JUDGE-EVALUATION.md:82-96` matrix); parse + 2-family extract live on OS69400 | Search services **suspended** after 3 Oct; Tasks suspended; agent/semantic view only on JN89282 | One resumed run on camera: resume Search + one task cycle on one new PDF, then suspend (cost note `docs/PROTOTYPE-COST-CONTROLS.md`). Fix etag-vs-`file_hash` dedupe first (see T1.3) | 1.5 | DEPLOY |
| T1.2 | Semantic view **with verified queries** validated vs NL questions (named brief task #3; "very very crucial" `:100`) | Semantic view built, **zero VQRs** (`JUDGE-EVALUATION.md:58`); SPEC s8 lists 6 VQRs (in scope) | Missing, and named twice by the organiser | Author the 6 VQRs from `data/eval/dev.jsonl`; validate 6 NL questions on JN89282/OS69400; record query IDs | 2 | OFFLINE+DEPLOY |
| T1.3 | Automated/scheduled run shown | 7 Tasks created suspended; dedupe bug (`IMPLEMENTATION-STATUS` B 3 Oct) | Not demonstrated | Change dedupe to `file_hash`; resume `TASK_SAARTHI_ORCHESTRATOR` for one cycle on a single new file; capture the task history rows | 1.5 | OFFLINE+DEPLOY |
| T2.1 | RAP on `CURRENT_USER()` proven including DOC_PAGE negative test (security headline R5) | Policy `01_policies.sql:46-72` verified F3 historically; **N4-03 unresolved**: `d.doc_id = doc_id` may bind inner column and return all DOC_PAGE rows (`QA-ROUND-4.md:39`). Round-4 bundle step 07 now has argument renamed `p_doc_id`, canary doc `DOC-RAP-CANARY-01` and a cross-patient negative test (`DEPLOY-ROUND-4.md`, step 07) | **Never run.** One failed negative test = headline claim false | Run bundle 00 -> 07 as ACCOUNTADMIN on the submission account; run 07's canary query + 09_verify; record the query IDs in `evidence/coco/verification-query-ids.md`. If it fails, fix and say so in the failure-and-fix log | 1.5 | DEPLOY |
| T2.2 | R7 disagreement path exercised (`conflicting` -> `not_evaluated`) | Both readers agreed on every field live; only fail-closed on PAT-DC-08 (`pass_b_invalid`) | The differentiator is unproven | One paid run on a page with a seeded conflicting value (corruption 13, `data/generator/corruptions.py`) and capture the gate result. If not achievable today: demo PAT-DC-08 fail-closed and state "disagreement path not exercised live" | 1.5 | DEPLOY |
| T2.3 | Answer guard in path | Partial (see R2.4) | - | State it plainly in deck limitations | 0 | - |
| T3.1 | **Reusable skills = "headline bonus"** with a reuse proof | 4 `SKILL.md` authored; `upload_skills.sql` `[NOT BUILT]` (`setup.sql:268`); `backend/skills/reuse-tests/` empty; Task orchestrates procedures not skills | Strongest bonus signal in the brief is the weakest item | Offline: write `reuse-tests/` for `evidence-reconciliation` against a second tiny schema (one mapping + one correctly refused ambiguity, `PROBLEM-STATEMENT-verbatim.md:137`); build `upload_skills.sql` with COPY pattern in `backend/skills/README.md`; add a `skills:` block only if the agent spec supports it, else say "loaded to stage, invoked in CoCo CLI" | 3 | OFFLINE (+1 DEPLOY) |
| T3.2 | MCP cross-tool **action** | Inbound MCP only, JN89282, query ID `01c74481-0003-92e6-0001-fca600116122`; outbound ticket not built | Brief names outbound action twice but `competition-and-plans.md:88-96` says core first | Do **not** build outbound today. Say inbound-only. If time remains after P0-P2 only | 0 | - |
| T3.3 | CoCo lifecycle: planning, development, execution, testing + failure/fix pairs | 4 YAML manifests (381/144/221/437 lines), `sessions-raw.csv`, 6+9 failure/fix pairs, `evidence/coco/robustness-review-2026-10-04.md` | `evidence/coco/README.md` phase table stale (still says `testing.yaml`, "In progress"); session provenance not reconfirmed (gap 20) | Rewrite the README phase table to the 4 real filenames and "complete"; teammate confirms each session ID against `cortex conversations transcript`. One new CoCo session today for the deploy and the VQR work, logged | 1 | OFFLINE+TEAM |
| T3.4 | Cross-surface (Snowsight Cloud Agent / Slackbot / Desktop) | None | "MEDIUM" in `PROBLEM-STATEMENT-verbatim.md:131-133` | Only if agent is deployed on the submission account: screenshot the agent in Snowsight (AI & ML > Agents). 0.5 h; skip otherwise | 0.5 | DEPLOY |
| T4.1 | Measured eval with absolute counts, cold start separate, baseline | Scorer exists (`backend/eval/harness/score_results.py`, 2 tests); 80 questions unscored; `backend/eval/` otherwise empty | No numbers | Score the **classifier** on the 40 dev questions (deterministic, near-zero cost) + the 28 rule fixtures re-run on the submission account. Publish counts only; no rates without counts | 2 | OFFLINE+DEPLOY |
| T4.2 | Offline tests re-runnable | 375 pytest / 14 skipped, 257 unit, 40 e2e (README, FIX-ROUND-5) | Fine | Re-run once before freeze, paste output into `evidence/qa/` | 0.2 | OFFLINE |

### 1C. Solution Completeness (30) - my split: C1 submission package 12, C2 end-to-end working flow 8, C3 docs honesty/reproducibility 6, C4 edge cases/fallback 4

| # | 95-100 proof item | Status now | Delta | Cheapest action | h | Tag |
|---|---|---|---|---|---|---|
| C1.1 | Public GitHub repo (explainer `:126`: "public repository, not a private one") | Repo exists; large uncommitted tree (`git status`: ~100 modified + untracked `backend/sql/deploy/`, `evidence/qa/`, `docs/DATASET-LICENCES.md`) | **Uncommitted work is not in the repo the judges see** | Danush reviews and commits (AGENTS s1 allows commit) and pushes; confirm repo is public. Confirm `snowflake.log`, `web/snowflake.log`, `.env*` are not tracked: `git ls-files | grep -E 'snowflake.log|\.env'` | 0.5 | TEAM |
| C1.2 | Deployed link "in a working condition" (`:124-126`) | None. App is localhost only; README admits it | Largest Completeness hole | Option A (3 h, recommended): static hosted build of `/design-preview/[id]` (recorded fixture, labelled "recorded snapshot, not live") on any static host + the demo video. Option B (4-6 h, risky): deploy the Next.js app to SPCS per explainer `:136-140`; also needs per-user login (not built) and burns credits. Pick A; B only as stretch | 3 | TEAM (hosting) |
| C1.3 | Pitch deck (T&C s4.5, upload required `:122-124`) | None. `docs/DECK-OUTLINE.md` is **linked in README but the file does not exist** | Missing required artifact + broken link | Build the deck (10 slides, outline in s4 below). Create `docs/DECK-OUTLINE.md` from it or delete the README row | 2.5 | TEAM |
| C1.4 | Demo video / "publicly accessible demo view link" (`:124`) | None | Missing | Screen-record the 3-min script in s4 on the live OS69400 build; upload unlisted; link in README + form. Note T&C s4.5: recording does not replace live finale | 1.5 | TEAM |
| C1.5 | Dataset + licence inventory (T&C s4.3b) | `docs/DATASET-LICENCES.md` exists (4 Oct) with "not verified in repo" rows | Rows need team confirmation | Confirm licences for the 7 reference PDFs (PM-JAY manual, FDA label, ICMR, NCG, AIIMS) at their source URL, fill rows | 0.7 | TEAM |
| C1.6 | Prototype template form fields (challenges, MVP brief) | Not in repo | - | Draft answers from README + deck (can be done by an agent from README) | 0.5 | TEAM |
| C2.1 | One patient flows document -> parse -> two-pass -> rule -> cited answer on screen | Live on OS69400 (3 Oct): PAT-DC-07 letter, PAT-DEEP-0001 CBC | Round-3/4 fixes unverified since last edit | Run deploy bundle (T2.1) then re-verify these two flows in the web UI; record | (in T2.1) | DEPLOY |
| C2.2 | Late addendum changes answer; replay at old cutoff | PAT-DC-07: cutoff before ingestion hides the letter (STATUS B 3 Oct); platelets 260,604 vs amended 245,100 | Never shown in video | Include in the demo (s4 beat 4) | 0 | - |
| C3.1 | README quickstart a stranger can follow | Present (`README.md` Quickstart A/B) | Path B never run clean | Run path A commands once more from a clean clone (agent can do) | 0.5 | OFFLINE |
| C3.2 | STATUS consistent | Reconciled 4 Oct (FIX-ROUND-5) | Check `evidence/coco/README.md` and `REMAINING-WORK.md` (personal tracker, stale, claims "built + live" for JN89282) | Move `REMAINING-WORK.md` to `planning/` or add "historical, 23 Sept" banner; do not delete | 0.2 | OFFLINE |
| C3.3 | Competitor claims cite file:line or are removed (AGENTS s4) | `WINNING-PLAN.md:42-44` still asserts "no competitor does this"; deck outline absent | Violates honesty rule if it reaches the deck | Keep competitors out of the deck. Add banner to `WINNING-PLAN.md` "historical" | 0.2 | OFFLINE |
| C4.1 | Fail-closed edge cases shown | PAT-DC-08 `pass_b_invalid`, `ID-QUAR-001`, `not_received` is never negative | - | Show in video (s4 beats 2, 5) | 0 | - |

---

## 2. Time-boxed plan for today (~8 h, 3 people + Claude agents), ordered by points per hour

Owners: **A** = Snowflake operator (Danush or whoever holds the key for the submission account). **B** = offline Claude agents/one human. **C** = team: video/deck/hosting/form. Freeze buffer: stop all changes by **9:30 PM**, submit by **10:30 PM**, leaving 1.5 h slack before 11:59 PM IST.

| Block | Hours | Owner | Deliverable (exact) | Points rationale |
|---|---|---|---|---|
| P0 | 0 - 0.5 | Danush | Decide **which account is the submission build** (OS69400 current). Check `git ls-files` for log/env files. Review diff and commit in logical commits; push; repo public | Without this, judges see none of the work. Cap lifted on all 3 criteria |
| P1 | 0.5 - 2 | A | Run `backend/sql/deploy/00..09` on OS69400 in order; capture N4-03 canary/negative test result and 09_verify output; append query IDs to `evidence/coco/verification-query-ids.md` | Verifies the R5 headline (T2) and clears round-3/4 `unverified-needs-deploy`. If negative test fails: fix policy, rerun, log as a failure-and-fix pair |
| P1 | 0.5 - 3.5 | C | Deck v1 (10 slides, s4) + `docs/DECK-OUTLINE.md` created from it | Required artifact; Completeness C1.3 |
| P1 | 0.5 - 3.5 | B | (1) Author 6 VQRs from `data/eval/dev.jsonl` into `backend/sql/semantic/` + doc; (2) `backend/skills/reuse-tests/` second-schema test with one mapping + one refused ambiguity; (3) `upload_skills.sql`; (4) dedupe-on-`file_hash` fix in `parse_documents_proc`; each with a pytest SQL-contract test; (5) fix `evidence/coco/README.md` phase table | T1.2, T3.1 (headline bonus), T1.3, T3.3: ~8-10 points of discretionary Technical headroom |
| P2 | 2 - 4 | A | Resume Search; run orchestrator cycle once on one new PDF; run one conflicting-value page through the two passes; run Class A question in the web UI; run VQR validation (6 NL questions); run 28 rule fixtures; suspend again | T1.1, T1.3, T2.2, R3.1, T1.2. Record every query ID. Cost: keep inside `docs/PROTOTYPE-COST-CONTROLS.md` (monitor at 1.57/2.00 used as of 3 Oct, STATUS) |
| P2 | 3.5 - 5 | B | Offline classifier eval on 40 dev questions with absolute counts into `evidence/qa/EVAL-RESULTS-04-OCT.md` (cold start separate); re-run full offline gates (pytest, unit, e2e, `check_gate.py --manifest`, `build_deploy_bundle --check`) and paste results | T4.1, T4.2 |
| P3 | 4 - 5.5 | C | Hosted static link of `/design-preview/PAT-DC-07` (labelled fixture) or equivalent; verify opens in a private window on mobile and desktop | C1.2 |
| P3 | 4 - 6 | C + A | Record 3-minute demo (s3) on live OS69400 after P2 results; upload unlisted | C1.4 |
| P4 | 6 - 7 | B | README top-of-page update: demo video link, hosted link, deck link, measured counts, limitations; fix `WINNING-PLAN.md` / `REMAINING-WORK.md` banners; licence rows confirmed (C) | C3, C1.5 |
| P4 | 6 - 7 | A | Snowsight screenshot of agent + MCP evidence only if agent deployed on OS69400 (T3.4); else skip | Optional bonus |
| P5 | 7 - 8 | Danush | Final commit and push; fill the submission form: repo URL, hosted link, video link, deck upload, template fields; **stop at 9:30 PM**, submit; screenshot confirmation | Entry freezes (T&C s4.1) |

Cut order if time collapses: cut T3.4, then outbound MCP (already cut), then VQR validation, then reuse-tests, then hosted link. Never cut P0, P1 (RAP test), deck, video, form.

---

## 3. 3-minute demo narrative (every rubric line, real IDs, screens that exist)

Operational question first (`competition-and-plans.md:159-171`), clinical refusal as its own beat. Absolute counts on screen. Say "synthetic" in the first sentence.

| Time | Screen / action | Rubric line hit |
|---|---|---|
| 0:00-0:20 | Slide: one family, 1,000+ km, one missing report. Voice: synthetic data; format learned from consented family reports; engineering checks, not clinical validation | Relevance R1; compliance |
| 0:20-0:50 | `/` census (12 synthetic patients) -> open **PAT-DC-04**: gate strip shows `CLIN-PLT-001: fail (PLT is 82000, below threshold 100000)`; click the gate -> source excerpt | R2 risk stratification from versioned SQL, cited, never opaque; 360 |
| 0:50-1:20 | **PAT-DC-07** Coverage comparison: table `pending`, PM-JAY letter `Approved` valid to 2026-11-30, gate `conflicting`; open the document viewer with highlighted span | Structured + unstructured; R3 missingness types; cited evidence |
| 1:20-1:45 | Same patient, set cutoff before ingestion: letter disappears (`known_as_of`). PAT-DEEP-0001: platelets 260,604 linked to the original, not the amended 245,100 | R2 three clocks; correction replay |
| 1:45-2:10 | Pipeline slide + Snowsight: `PAT-DC-08` pathology failed closed (`pass_b_invalid`, no value asserted); if P2 delivered it, the conflicting-value page -> `not_evaluated`. Say "68 assertions, 0 asserted from one unverified read" | R7 two-family extraction (`llama3.3-70b` vs `claude-haiku-4-5`), fail closed; AI functions in Tasks |
| 2:10-2:30 | Ask box: "Should she proceed with chemo?" -> Class A refusal + practitioner packet. Then Snowsight: PM-JAY pre-auth search with page indexes | Safety/regulatory boundary; Class A/B; reference corpus R6 |
| 2:30-2:50 | Snowsight QUERY_HISTORY: DOC_PAGE negative test result (query ID from P1) and judge probe 01/03 | Technical: RAP on `CURRENT_USER()`; label QUERY_HISTORY as live evidence |
| 2:50-3:00 | Counts slide: 375 py / 257 unit / 40 e2e; eval counts; VQRs; skills reuse test; CoCo 4-phase evidence; limitations (localhost, 12 of 100, validator not in path) | Completeness, honesty, CoCo lifecycle |

Rehearse once end to end; keep PAT-DC-07 as backup for any live-data failure; record on pre-warmed warehouse and state cold start separately.

Deck outline (10 slides): 1 problem and user, 2 sourced figures, 3 what it answers (Class A/B), 4 architecture with R1-R7, 5 live flow screenshots (DC-04, DC-07), 6 security proof (query IDs), 7 two-family extraction + fail-closed, 8 CoCo lifecycle + skills + MCP (inbound only), 9 measured counts and limitations, 10 roadmap and what is not claimed.

---

## 4. Risks that cost points and mitigations

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **N4-03**: RAP `doc_id` binds to inner column, returns all DOC_PAGE rows (`QA-ROUND-4.md:39`); R5 is the headline claim | Critical | P1 negative test first. If it fails: qualify the column / use the `p_doc_id` argument already in bundle step 07, retest, log failure-fix. Until verified, deck says "verified on 3 Oct for patient scope; DOC_PAGE negative test: <result>" |
| 2 | Bundle half-deploys and leaves DOC_PAGE with no policy (N4-05) | High | Run steps in order as ACCOUNTADMIN; if 05-07 fails re-run 07 before anything else; steps 08-09 guards raise (`DEPLOY-ROUND-4.md` Rules) |
| 3 | Step 08 run as wrong user: invisible pages, duplicate rows (N4-02) | Medium | Run as the user stored on `PRAC-01`; guard raises `not_prac01` |
| 4 | Demo breaks on stage/video: stale warehouse, suspended Search, statement timeout 120 s | High | Pre-run each demo question once; session limit 900 s used on 3 Oct; keep recorded fallback; fixture preview labelled as fixture |
| 5 | Overclaim: README/deck says validator, skills, MCP action, agent on OS69400, hosted, "100 patients", "no competitor", 95 percent anything | High | Use claim table in `JUDGE-EVALUATION.md` s4 (C-1..C-20; STATUS already corrected most). Say: validator partial, skills authored (loaded only if P3 done), MCP inbound on JN89282, 12 of 100 patients. No confidence percentages (AGENTS s5) |
| 6 | Two accounts, evidence split (JN89282 historical, OS69400 current) | Medium | Label every live number with account and date; do not mix |
| 7 | Hosted link is a fixture and a judge assumes live | Medium | Banner on the hosted page: "recorded snapshot of synthetic data, not live"; README links to the video for the live path |
| 8 | Credential / path leak: `snowflake.log`, `web/snowflake.log`, `docs/TESTING-PLAYBOOK.md` teammate key path, root `apollo-department-register.docx` (`JUDGE-EVALUATION.md:135`) | High | Check `git ls-files`; remove or `.gitignore`; scrub path from the playbook; never open log files; confirm before making repo public |
| 9 | Uncommitted tree vs frozen entry (T&C s4.1: entry cannot change after the deadline) | High | Commit and push by P0 and again at P5; tag nothing (AGENTS s1 forbids `git tag` unless asked) |
| 10 | Credit overrun (prototype monitor 1.57/2.00 at 3 Oct) | Medium | Cap paid calls: one conflicting page, one task cycle, 6 VQR checks, 28 fixtures; suspend Search and Tasks after recording |
| 11 | Broken links (README links `docs/DECK-OUTLINE.md`, absent) | Low | Create or remove before freeze; run a link check on README |
| 12 | Competitor comparisons without file:line (AGENTS s4) | Medium | Keep out of deck; `WINNING-PLAN.md` banner as historical |
| 13 | CoCo provenance: any non-CoCo work labelled CoCo (`competition-and-plans.md:211`) | Medium | Teammate checks each session ID with `cortex conversations transcript`; label Codex/Claude Code work as such |
| 14 | Final-day change breaks the 375-test baseline | Medium | Each P1/P2 offline change ships with a contract test; re-run full gates at P2 end and before commit |

## 5. What I could not verify

- Live state of OS69400 today (Search/Tasks suspended, bundle never applied). No SQL run by me.
- Whether `/design-preview/[id]` exports as static HTML; confirm before promising option A in C1.2.
- Licence status of the 7 reference PDFs (marked "not verified in repo" in `docs/DATASET-LICENCES.md`).
- Per-criterion judge scoring; all point splits above are mine.
