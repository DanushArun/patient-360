# PS-04 Field Report

> **Honesty note added 4 Oct 2026 (FIX-ROUND-5).** This is a historical 16-17 Sept snapshot. Competitor source code is **not
> vendored in this repository**; statements about competitors are a researcher's file-level reading recorded in
> `planning/research/clinical/ps04-competitive-landscape.md` (e.g. `streamlit/login.py`, `sql/00_infrastructure.sql`,
> with no line numbers) and **cannot be re-verified from this repo**. Read "no competitor does X" as "we did not find X in
> the code we reviewed". Superseded in part by `DECISION-household-removal.md`.

Competitive intelligence on the PS-04 hackathon field, researched 2026-09-16, updated same day with a fourth confirmed competitor found via GitHub search (`carecompass-app`, missed in the original manual list). Method: ~30 public GitHub repos surveyed — deep source review for the four confirmed PS-04 threats (Verity, ATLAS, SynapseCortex, CareCompass), lighter passes for adjacent PS-02 entries, the official Snowflake HCLS baseline, and unrelated hackathon submissions scanned only for transferable patterns. Confirmed via the official event page (hack2skill.com/event/cococlihack-gccedition) that this is the "GCC Edition," prototype submission window is **13 Sept – 4 Oct 2026**, and there is no public submissions gallery — so this list can never be guaranteed complete; re-search periodically. This is a snapshot; competitor repos are active and will drift — re-run closer to the 4 Oct deadline if time allows.

**Thesis:** SAARTHI's six architectural rules (`plan.md`) are, rule for rule, more rigorous than any confirmed competitor. The problem is SAARTHI is also the only serious entrant with zero shipped code. Verity has a deployed $7 demo run. ATLAS has a live public URL, CI, and 23 tests. The field is won on the intersection of rigor and evidence, not rigor alone.

## Verdict: who wins right now

Judged on four axes — architectural rigor, demonstrated evidence (shipped/deployed vs. designed), security/compliance discipline, and narrative clarity — none of the five systems surveyed (Verity, ATLAS, SynapseCortex, CareCompass, SAARTHI) is unambiguously best across all four. The honest ranking splits by what "winning" means at this stage:

- **If judged today, on what's actually running: ATLAS wins.** It is the only system with a live public URL, a CI pipeline, and 23 passing tests — a judge can open it in a browser right now. Deployment maturity is the one axis where "designed correctly" cannot substitute for "works," and ATLAS is the only entrant that has closed that gap. Its architecture is the weakest of the four working systems (single mixed Cortex Search corpus, one shared role, no time modeling), but a working weak system beats a well-designed absent one in a live demo.
- **On engineering discipline and polish of what's actually built: Verity wins.** The deterministic SQL rollup with a structurally impossible false-negative path, the two-stage search-then-polarity-check retrieval, and the $7/43-second reproducible run are the tightest, most defensible piece of engineering in the field. It's the system most likely to survive a judge trying to break it live.
- **On feature breadth and narrative: CareCompass and SynapseCortex trade blows.** CareCompass has the sharper single story (cross-specialty contraindication, a real HL7/FHIR pipeline, the most realistic synthetic data of anyone surveyed) but its access control is provably cosmetic — a UI role-picker, confirmed from source, not enforcement. SynapseCortex has the widest clinical-rule surface (FDA + HEDIS + drug-safety) but is built on a dataset with zero row-level security, also confirmed from source.
- **On architecture alone, before a line of code: SAARTHI wins outright.** It is the only design in the field that would pass all six rules simultaneously if built as specified — in particular, it is the only one with any answer at all for R2 (multi-clock time) and the only one with a real answer for R6 (dual, never-mixed corpora). Every one of the four working competitors fails R5, R6, or both, confirmed from their own source code, not assumed from gaps in their READMEs.

**What actually wins the competition** is neither "most rigorous design" nor "most deployed code" in isolation — it's whichever team closes that gap first. SAARTHI's rules are real differentiation only once they're demonstrated; until then, on the judging floor, ATLAS's live URL and Verity's tight execution both currently outrank a plan, however good. The path to actually winning is in the "Where to spend the remaining build window" section below: ship a thin, working, R5/R6-provable slice, because that is the one thing every other serious competitor — without exception — cannot currently show.

## Threat matrix

| Team | Problem statement | Stack | Maturity | Threat | Sharpest gap vs. SAARTHI |
|---|---|---|---|---|---|
| Verity | PS-04 · prior auth | Cortex Search + Analyst + Agent, AI_FILTER, Streamlit-in-Snowflake | Deployed demo | High | Single Cortex Search corpus (R6); payer member-ID linkage, not a national health ID (R4) |
| ATLAS | PS-04 · trial eligibility | React + FastAPI, Cortex Search, SPCS + Cloudflare Worker | Live public URL | High | Mixed corpus in one Cortex Search index (R6); one shared role, no RLS (R5) |
| SynapseCortex AI | PS-04 · patient 360 | AI_PARSE_DOCUMENT, Cortex Search, Streamlit | Demo-ready | High | Confirmed zero row-level security; corpora explicitly not segregated (R5 + R6 both fail) |
| **CareCompass** | PS-04 · patient 360, cross-specialty CDS | HL7/FHIR parsing, 4 Cortex semantic views, Cortex Agent, Streamlit, dbt | Demo-ready, most complete data engineering of the field | High | Confirmed: "role login" is a Streamlit session-state picker, not real Snowflake RBAC — zero real server-side enforcement (R5); no identity anchor beyond sequential patient IDs (R4) |
| ujju2020 | PS-04 · patient 360 | React + Vite, no live backend | Frontend only | Low | No Snowflake connection at all — UI concept only |
| CareProof 360 | PS-04 · care transitions | — (PDF only) | Planning doc | None | No code, 2 commits |
| sf-hcls-solutions | Snowflake official baseline | Cortex Agent + Analyst + Search over 75K patients, PubMed corpus | Production reference | Benchmark | Sets the judge's quality bar — no oncology/360 entry yet, but expects a real corpus + multi-tool agent |
| NEXUS 360 (PS-02) | Insurance 360 | Cortex Agent orchestrating Analyst + Search, 5-page Streamlit | Demo-ready | Adjacent | Numbered 01–10 SQL deploy story is a reusable pattern, not a threat |
| PolicySense AI (PS-02) | Insurance 360 | Dynamic Tables + Streams/Tasks, medallion layers | Demo-ready | Adjacent | Cleanest data-layer pattern seen across the whole field |

## Serious threats, in depth

### Verity — prior-auth evidence copilot
`favas111/verity-pa-copilot` · 5K synthetic members, 245K rows, ~$7 end-to-end run

A criteria tree (21 nodes, ALL_OF/ANY_OF/NONE_OF) resolves each leaf via SQL or two-stage Cortex Search + AI_FILTER adjudication, then folds bottom-up through a deterministic SQL rollup to one of two outcomes: APPROVE or ROUTE_TO_CLINICIAN. No DENY path exists structurally — the system is architecturally incapable of a false negative.

**Strengths**
- LLM only extracts and explains — the rollup is pure SQL arithmetic, matching R1 in spirit
- Three verdict states (MET / NOT_MET / INSUFFICIENT_EVIDENCE), not binary — close to R3's typed-missingness philosophy
- Two-stage retrieval (search candidates → AI_FILTER polarity check) guards against negation errors ("no family history" vs. "family history")
- Time Travel + effective-dated policy versioning for "policy in effect on date of service"

**Gaps**
- One Cortex Search corpus only — no analog to R6's dual, never-mixed corpora
- Identity linkage chains payer member IDs across carriers, not a canonical national ID like ABHA (R4)
- No event-time / record-time / known-as-of distinction (R2) — no modeling of retroactive corrections
- Access control is coarse: 2 roles + PHI-masking, filtering happens at request time, not as a hard pre-retrieval SQL gate

**Moves**
1. Adopt the two-stage search-then-polarity-check pattern for SAARTHI's own evidence citations.
2. Frame ABHA anchoring explicitly against Verity's payer-ID linkage in the pitch — a stronger, more defensible identity story.
3. Open the demo with a cross-corpus contamination test Verity's single-index architecture cannot pass.

### ATLAS — clinical trial eligibility copilot
`casafurix/bodhix-snowflake-cococli-hackathon` · live SPCS + Cloudflare deployment, 33 commits, 23 tests

Deterministic eligibility evaluation (`evaluate_criterion` → typed enum status) feeds a Cortex-generated explanation layer, with an explicit `agent_trace` exposing every pipeline stage per answer. This is the only competitor with a working public URL — the biggest maturity gap in the whole field.

**Strengths**
- Deployed and demoable today: SPCS container, Cloudflare Worker gateway, CI workflow
- 23 test functions across 6 files, actively iterated through mid-August
- Per-answer `agent_trace` — a cheap, high-impact provenance UI competitors and judges can both read at a glance

**Gaps**
- Confirmed: `PROTOCOL_CLAUSE` and `PATIENT_EVIDENCE` rows share one Cortex Search index, distinguished only by a filter attribute — a direct R6 violation
- One shared role for two named users; no row-level security, no per-clinician scoping (R5)
- No multi-clock time tracking (R2); no identity anchor beyond a synthetic patient string (R4)

**Moves**
1. Ship something deployed — even minimal — before the deadline. A live URL beats a more rigorous design on the judging floor.
2. Steal the per-answer trace UI pattern to surface SAARTHI's own R1–R6 enforcement visibly.
3. Demo a scoped-retrieval attempt ATLAS's shared-role model would let through and SAARTHI's pre-retrieval SQL gate blocks.

### SynapseCortex AI — patient 360 + clinical rules
`nishnarudkar/SynapseCortex-AI...` · AI_PARSE_DOCUMENT, FDA contraindication + HEDIS care-gap detection

Broadest clinical-rule surface of the three: risk tiering, HEDIS NQF-0059 care-gap detection, drug-safety flags (Metformin + CKD + low eGFR), all computed in SQL with the LLM confined to phrasing — and confirmed, from source, to have zero row-level security and a Cortex Search index that mixes patient notes with FDA regulatory text in one ranked list.

**Strengths**
- Rigid citation contract — `[Doc: file, Page: n]` per claim, exact "Insufficient evidence" fallback, temperature 0.05
- Deterministic clinical thresholds in SQL, not the LLM — same spirit as R1
- Widest clinical-rule breadth of any competitor (FDA + HEDIS + drug-safety)

**Gaps**
- Confirmed in source: `PATIENT_360_SNAPSHOT` returns the entire dataset to any querier — no facility/role filtering whatsoever
- Confirmed in source: both corpora "feed the same LLM context" in one index; filtering is a hardcoded hero-patient allowlist, not a scoping mechanism
- Bare NULL checks, no missingness taxonomy (R3); name/DOB-based identity, full PII unmasked (R4)

**Moves**
1. Adopt their rigid inline citation format — it's demo-legible proof of R1 with almost no cost to build.
2. Add one narrow, well-typed clinical rule with full R2/R3 rigor to counter "their rules are broader" with "ours are provably correct."
3. Live-demo a blocked out-of-scope query — SynapseCortex's confirmed lack of RLS makes this a clean, provable win.

### CareCompass — cross-specialty clinical decision support
`rahulsahay123/carecompass-app` · team "SnowCares" (3 members) · 450 synthetic patients, 1,791 encounters, 10 source systems (HL7 v2.x, FHIR R4 JSON, IoT vitals, PDF/TXT referrals), Bengaluru-clinic-realistic cohort

The most complete data-engineering effort in the field. A real HL7/FHIR parsing pipeline feeds a RAW → HARMONIZED → CONSUMPTION layered model (dbt-managed), four Cortex semantic views split by specialty (Endocrine, Cardio, Renal, Notes/Full-Panel), a Cortex Agent orchestrator, and markdown-defined CoCo "skills" (e.g. drug-interaction checking) that run as deterministic, versioned SQL playbooks rather than ad hoc prompting. Built via a documented spec-driven process (BRD → SDD → phased CoCo execution) — the most disciplined engineering *process* seen in the whole field, competitor or otherwise.

**Strengths**
- Cross-specialty contraindication detection is the actual product thesis (e.g. Metformin continued despite eGFR <30 because endocrinology, cardiology, and nephrology don't share a view) — a sharp, demo-legible narrative
- Deterministic drug-interaction rules live in a versioned skill file with explicit SQL per rule (ACE+ARB dual blockade, Metformin+severe-CKD, renal dose-adjustment flags) — same spirit as R1
- Synthetic data is deliberately imperfect (missing values, out-of-range values, duplicates) to stress-test the pipeline, and passed a 7-stage validation process before use
- Three named roles (Doctor / Receptionist / Admin) mapped to real Snowflake RBAC role names, with a stated intent to scope views per role

**Gaps**
- Confirmed in source (`streamlit/login.py`): the "login" is a `st.radio` role picker writing to `st.session_state` — cosmetic, not authentication. Its own comment reads *"Simulated role selection for demonstration. In production, roles are enforced via Snowflake RBAC."* — meaning nothing is server-side enforced today (R5)
- Confirmed in source (`sql/00_infrastructure.sql`): `DOCTOR_ROLE` is granted `SELECT` on **all** views in `CONSUMPTION`, current and future — no patient- or specialty-scoped restriction; the `DEMO_VIEWER_ROLE` grants are commented out, i.e. not yet wired even at the coarse role level
- Patient identity is a sequential ID (`P0188`, `P0327`, ...) — no national health-ID equivalent, no anti-fuzzy-matching guarantee (R4)
- No evidence of multi-clock time tracking (R2) or a typed missingness taxonomy beyond "deliberately imperfect" synthetic generation (R3)
- No stated dual-corpus separation — referral letters, notes, and structured data are not described as segregated retrieval corpora (R6)

**Moves**
1. This is the sharpest clinical narrative in the field ("one missing connection, serious consequences") — study its framing even though SAARTHI's oncology angle is different; a single vivid cross-specialty/cross-clock failure story is worth more than broad feature coverage.
2. The gap between CareCompass's *named* RBAC roles and its *actual* enforcement (a UI picker) is the cleanest "beat this" of any competitor surveyed — SAARTHI enforcing scope in real SQL before retrieval, live on stage, directly contradicts a competitor whose access control is provably cosmetic.
3. Borrow the skill-file pattern (a markdown playbook per deterministic clinical check, with explicit SQL per rule) as a template for how SAARTHI's own rule engine could be organized and versioned.

## Rule ledger

SAARTHI's six non-negotiable rules, checked against what each competitor's source actually does — not what their README claims.

| Rule | SAARTHI (planned) | Verity | ATLAS | SynapseCortex | CareCompass |
|---|---|---|---|---|---|
| **R1** — LLM never decides, only phrases SQL facts | ✓ designed | ✓ | ✓ | ✓ | ✓ |
| **R2** — Three clocks: event / record / known-as-of | ✓ designed | ✗ | ✗ | ✗ | ✗ |
| **R3** — Missingness as a typed enum, never bare NULL | ✓ designed | ◐ 3-state verdict | ◐ UNKNOWN enum | ✗ bare NULL | ✗ not typed |
| **R4** — ABHA-anchored identity, no fuzzy matching | ✓ designed | ◐ payer member-ID chain | ✗ synthetic string | ✗ name/DOB, unmasked | ✗ sequential ID |
| **R5** — Server-side scope enforcement before retrieval | ✓ designed | ◐ request-time filter | ✗ one shared role | ✗ confirmed zero RLS | ✗ confirmed cosmetic (UI role picker only) |
| **R6** — Two corpora, never mixed in one ranked list | ✓ designed | — single corpus | ✗ confirmed mixed | ✗ confirmed mixed | — no stated corpus separation |

**Core finding:** not one of the four confirmed competitors implements R2 at all, and none properly implements R5+R6 together. This is real, provable differentiation — but only if SAARTHI ships code to demonstrate it.

## Patterns worth borrowing

Pulled from the official Snowflake baseline, adjacent PS-02 entries, and a fast skim of the other ~20 unrelated hackathon repos.

- **sf-hcls-solutions (official baseline)** — the judge's quality floor: a real multi-table clinical semantic model, Cortex Search grounded in an actual literature corpus (38M+ PubMed articles, not just synthetic notes), a genuine multi-tool Cortex Agent, and a single idempotent setup/teardown script.
- **PolicySense AI (PS-02)** — medallion data layers on Dynamic Tables: raw → curated (AI-enriched) → analytics (semantic views), refreshed by Streams/Tasks instead of batch scripts — reads as "live," not static, in a demo.
- **scopeleak / tsathya98 (unrelated PS)** — structural governance: keep every state-changing action in deterministic SQL, never expose an "approve" tool to the agent's spec at all, and test-enforce its absence. Directly applicable to any future clinical order-entry surface.
- **Chirag-01 (unrelated PS)** — document ingestion: AI_PARSE_DOCUMENT → Bronze/Silver/Gold medallion → a self-healing chunk-repair job. The closest reference architecture in the whole field to SAARTHI's own document pipeline.
- **praman (unrelated PS)** — eval discipline: an isolated EVAL schema hidden from the agent itself (prevents answer-key leakage), with synthetic data reconciled against real published figures via tests.
- **rabin-labs (unrelated PS)** — safety gate: dry-run-before-live execution plus deterministic idempotency keys, so re-running an action never double-fires it.

## Where to spend the remaining build window

Ranked by how much field-position it buys per hour of build time left before the 30 Sept deadline.

1. **Ship a working vertical slice, even a thin one — urgent.** Every serious PS-04 competitor already has running code; two have live URLs. SAARTHI's rigor is currently undemonstrated. One end-to-end path — ingest → SQL fact → cited answer on one screen — outweighs finishing the other three planned screens.
2. **Build the R5/R6 red-team demo now, not at the end.** Every confirmed competitor fails R5 or R6 outright — this is the one differentiator that's provable live, on stage, in seconds. A scripted "blocked cross-scope query" and "corpora stay separate" moment is cheap to build and the highest-leverage demo beat available.
3. **Adopt the rigid inline citation contract.** SynapseCortex's `[Doc: file, Page: n]` format with an exact "Insufficient evidence" fallback is cheap to build and makes R1 visually obvious to a judge skimming fast — steal the format, keep SAARTHI's own enforcement underneath it.
4. **Surface a per-answer provenance trace.** ATLAS's `agent_trace` — which pipeline stage ran, fallback vs. completed — is a UI pattern SAARTHI's design doesn't have yet. It turns the six rules from a design doc into something a judge can watch execute.
5. **Ground Cortex Search in one real document, not only synthetic notes.** The official Snowflake baseline leans on a real 38M-article corpus; Verity parses a real PDF policy. A single real regulatory or clinical-guideline document alongside the synthetic patient notes meets that expectation without derailing scope.
6. **Hold the line on R2 and R4 — don't cut them for time.** Not one confirmed competitor implements multi-clock time tracking, and only Verity has any identity-linkage story at all (and it's weaker than ABHA anchoring). These two rules are pure differentiation with zero field pressure to match — the risk is cutting them under deadline stress, not losing them to a competitor.
