# SAARTHI — The Winning Plan

**Written 17 Sept 2026. Supersedes `plan.md` §12 (schedule) and §15 (immediate actions).**
**Grounded in: the verbatim brief, the confirmed rubric, the explainer session, 50 review findings, and empirically verified platform behaviour.**

---

## 0. The facts this plan is built on

| Fact | Source | Status |
|---|---|---|
| Rubric: Relevance **30%** · Technical Execution **40%** · Completeness **30%** | Event page screenshot | Confirmed |
| Submission deadline **4 Oct 2026** | Event page | Confirmed |
| **Async evaluation 5–22 Oct** — judges alone with the repo for 18 days | Event page | Confirmed |
| Live demo **27–30 Oct** (only if shortlisted) | Event page | Confirmed |
| Team: **3 people**, ~$400 credit each (**$1,200 total**) | Danush | Confirmed |
| Registration complete; eligibility confirmed | Danush | Confirmed |
| Consent for the real reports — teammate is the patient's son | Danush | Confirmed |
| Account: **Enterprise**, cross-region enabled, all 11 AI functions, SPCS live | Runtime gate | Verified |
| `AGENT_RUN(VARCHAR)` exists — SQL path, no container-runtime hard dependency | `SHOW FUNCTIONS` | Verified |
| **RAP keyed on `CURRENT_USER()` survives owner's-rights elevation; `CURRENT_ROLE()` does not** | Empirical test, QID `01c71d97-...cdce` | **Verified — architecture-deciding** |
| Working models: `llama3.1-70b`, `llama3.3-70b`, `llama3.1-8b` | Runtime gate | Verified **17 Sept — now partly stale.** `llama3.1-70b` is marked `[legacy]`; R7 pass B moved to `claude-haiku-4-5`. Re-probe: `backend/sql/probes/model_availability.sql` |

**18 calendar days. Target completion 1 Oct. 2–4 Oct is contingency only.**

---

## 1. The thesis, in one paragraph

Indian cancer patients don't fail because of medicine. They fail because the *record* fails — 74% cross two or more facilities, 82.6% hit a delay, 14% of chemo cycles are missed with a median 13.75-day delay, and 8% of insurance claims are repudiated (₹30,000 cr/yr), 60–70% for reasons knowable *before* admission. SAARTHI answers one question every 21 days for every patient on the list — **"is this patient ready for the next step of care, and exactly what is missing?"** — as transparent risk stratification over care gaps, with every claim citing the row or page it came from, and with the model structurally unable to produce a clinical judgement.

**Positioning:** a **centralised evidence index over federated source data.** Assertions, pointers, gate state and consent state are held centrally; clinical content is fetched under a valid consent and cached only for that consent's lifetime. This is what ABDM actually is, and it makes consent load-bearing rather than decorative.

---

## 2. The five things that win this, ranked by score per hour

Everything else is support. If the schedule collapses, these survive.

| # | Item | Rubric impact | Why it wins |
|---|---|---|---|
| **1** | **Two-pass extraction verification** | Technical 40% + Relevance 30% | Today, if AI misreads a lab value as 1200 when the page says 2100, all five validator checks pass and the answer is beautifully cited and clinically wrong. Reading safety-critical fields twice and refusing to assert on disagreement fixes the most dangerous bug in the design. **No competitor does this.** |
| **2** | **Consent enforced at query time** | Relevance 30% + Technical 40% | Legally mandatory in India, structurally correct per ABDM, **no competitor has it**, and it demos in 30 seconds: revoke consent → same question returns nothing. |
| **3** | **Real identity + `CURRENT_USER()`-keyed RAP** | Technical 40% | Now *proven* to work. Every competitor's access control is cosmetic — CareCompass's is a `st.radio` picker, SynapseCortex has confirmed zero RLS. This is the claim we can defend live. |
| **4** | **4 skills + one orchestrating Task** | Both named bonuses | The brief calls reusable skills "the headline bonus"; the explainer says build one skill per process and orchestrate with a Task. One change, two bonus categories. |
| **5** | **Working vertical slice, deployed** | Completeness 30% | Two competitors already have live URLs. "Technical **Execution**" — shipped beats designed. Until one patient flows document → parsed → rule → cited answer on screen, everything above is a document. |

---

## 3. Scope — locked

### Built and demoed
- **6 specialties, 16 rules** (13 exist and already span oncology/cardiology/nephrology/hepatology — they were mislabelled; +3 new for endocrine and general surgery). Oncology is the depth case.
- **5 gates** → clinical, **safety** (was "surveillance"), documentation, coverage, identity. 4-valued outcomes: `pass · fail · not_evaluated · conflicting`.
- **Risk stratification** and **care gap** vocabulary adopted — the brief's and the explainer's own words — with explicit scope disclosure: *stratifies documentation, coverage and safety-surveillance risk; does not model clinical deterioration or prognosis.*
- **34 tables built** of 41 designed. `HOUSEHOLD`/`HOUSEHOLD_MEMBER` removed — family-floater coverage is out of scope, stated. New critical ones: `PATIENT_BINDING` (see `COPILOT-SPEC.md` §0), `CONSENT`, `ORGANIZATION`, `FACILITY`, `PRACTITIONER`, `CARE_TEAM` (replaces `ROLE_PATIENT_MAP`), `REFERRAL`, `CLINICAL_ONTOLOGY`, `UNIT_REGISTRY`, `SECURITY_EVENT`, `EVIDENCE_PACKET`.
- **Three ingestion paths**: structured (tables), **semi-structured (FHIR JSON → `VARIANT` → flatten)**, unstructured (PDF/image → `AI_PARSE_DOCUMENT`). The brief and explainer both name all three.
- **Dual Cortex Search** — patient corpus and reference corpus, physically separate services.
- **Answer validator, 6 checks**: existence · scope · version · polarity (`AI_FILTER`) · type match · **assertion trustworthiness** (new).
- **Semantic view + verified queries** — the explainer calls VQR *"very very crucial"*.
- **4 CoCo skills** + orchestrating Task: `clinical-question-routing`, `evidence-retrieval`, `risk-stratification`, `evidence-reconciliation`.
- **MCP connector** — one action (documentation blocker → tracked ticket), idempotent.
- **Notifications** — email/Slack on unresolved blockers approaching a cycle date.
- **Judge Console** — live security probes for Stage 2.
- **Family view** — bring-list with `TRANSLATE`, derived from `REFERRAL` expected-vs-received.

### Designed and documented only — stated plainly
Cortex Search sharding beyond 400M chunks · population-scale event-driven gate recomputation · full federation with live ABDM · handwritten document extraction · `DERIVED_ARTIFACT` retention purge · facility onboarding flow.

### Explicitly refused, with reasons
**Cortex ML / any trained predictive model** — the brief says "never opaque predictions"; deterministic rules deliver risk stratification without one. **Clinical recommendations** — Class A, unlawful for an AI platform under NMC TPG 2020. **Handwriting** — real and important, not solvable reliably in 18 days; we say so.

---

## 4. Tracks — 3 people, parallel

| Owner | Track | Owns |
|---|---|---|
| **A** | Data & platform | Generator (ledger + corruptions + FHIR bundles), DDL, governance (RAP/masking/tags/CARE_TEAM/CONSENT), pipeline (streams/tasks/DTs), semantic view + VQR, deployment script, Git integration |
| **B** | Evidence & intelligence | `AI_PARSE_DOCUMENT` pipeline, **two-pass extraction verification**, ontology + unit registry, reconciliation + discordance, 8 tools, validator, agent + 4 skills + orchestrating Task, eval harness |
| **C** | Product & proof | Streamlit (6 screens, Ask+Evidence as centrepiece), Judge Console, family view, MCP connector, notifications, README, `IMPLEMENTATION-STATUS.md`, demo video, CoCo evidence manifest |

**Cross-review is mandatory:** A reviews B's SQL correctness; B reviews C's privacy boundaries; C reviews A's cold-start reproducibility.

---

## 5. Schedule — 18 days

### Day 1 (17 Sept) — close the last unknowns, bank the trail
- [ ] **Commit everything now.** All reviews, the verbatim brief, the transcript, revised-architecture. The git timestamp trail proving planning preceded development is the cheapest lifecycle evidence and we're currently losing it.
- [ ] Create `evidence/coco/planning.yaml` — retro-log this session and prior ones (purpose, date, outputs, key finding). **Planning-phase evidence is being generated right now.**
- [ ] Three remaining tests: `CREATE CORTEX SEARCH SERVICE` · `AI_PARSE_DOCUMENT` cost on one synthetic page · `CREATE STREAMLIT … COMPUTE_POOL` + what `CURRENT_USER()` returns inside it.
- [ ] Download the reference corpus PDFs into `data/reference/` — **this does not exist yet and R6 has no real documents without it.**
- [ ] Freeze the data contract and the answer JSON schema (the validator cannot be written without it).

### Days 2–5 — vertical slice, deployed
One patient, end to end, on a screen: synthetic PDF → stage → parse → **two-pass verify** → assertion → ontology-normalised → one rule → cited answer with clickable evidence, under a real `CARE_TEAM` + `CONSENT` scope check.
**Gate: if this doesn't work by end of Day 5, cut scope immediately — not later.**

### Days 6–10 — scale and the differentiators
100 patients with comorbidities + 12 named corruptions · all 16 rules + fixture tests (80 assertions) · both search services · full validator · consent revocation working · FHIR JSON path · semantic view + VQR · review queue.

### Days 11–14 — proof and bonuses
80-question eval (40 dev / 40 held out, truth key inaccessible to the app role) · baseline RAG comparison · Judge Console probes · 4 skills + orchestrating Task · MCP connector · notifications · family view.

### Days 15–17 (target completion 1 Oct)
Clean-account deploy rehearsal · README a stranger can follow · `IMPLEMENTATION-STATUS.md` · demo video · **cold-start test by the person who didn't build it** · CoCo evidence manifest complete across all 4 phases.

### 2–4 Oct — contingency only. Submit early.

---

## 6. Stage 1 vs Stage 2 — they need different things

**Stage 1 (5–22 Oct): judges alone with the repo for 18 days.** No narrator. This is what gets us into Stage 2, and it rewards reproducibility over showmanship.
Non-negotiables: one-script deploy on a clean account · README a stranger can follow · re-runnable test results · **`IMPLEMENTATION-STATUS.md` marking every component `built | partial | designed-only`** · CoCo evidence across all four phases.

`IMPLEMENTATION-STATUS.md` is **critical, not optional.** A judge with 18 days will find every gap. Our own accurate list is far better than their discovery that we overclaimed — and it is precisely the failure we document in competitors.

**Stage 2 (27–30 Oct): live demo.** Judge Console, consent revocation, cross-scope block, the cross-department scenario, the correction replay.

---

## 7. The demo — cross-department, from a real journey

Fixed clock. **"She had an appendectomy three weeks ago. Is she ready to resume chemotherapy?"**

Answering it requires four departments at once: general surgery (post-op clearance documented?), oncology (ANC recovered?), cardiology (is the LVEF assessment still inside 90 days, or did the interruption push it stale?), coverage (did the authorisation expire during the gap?).

Then, in order:
1. **Two blockers, one advisory, one conflict** — each citing a row or a page.
2. **Late addendum ingested live** → answer changes; old cutoff returns the old answer; v1 marked superseded.
3. **Consent revoked** → same question, same user, returns nothing.
4. **Cross-scope attempt** → blocked by `CURRENT_USER()`-keyed RAP, shown in `QUERY_HISTORY`.
5. **Low-quality image** → two-pass extraction disagrees → system refuses to assert the value and says why.
6. **Class A question** ("should she take the treatment?") → refused in every role, evidence packet offered to the named treating practitioner.
7. **Regulatory** → answered from the real PM-JAY manual, page and clause.

Beat 5 is the one nobody else can show. Beat 3 is the one nobody else has.

---

## 8. Honesty rules — non-negotiable

1. No claim in the README that isn't demonstrable from the repo.
2. Every metric reports absolute counts, not just rates; cold starts separately.
3. Synthetic data only in the system. The real reports informed **format research only** — stated plainly, with consent noted, handled with dignity. The motivation is genuine and needs no embellishment.
4. Engineering gates on synthetic tests are **not** clinical validation. The deck says so.
5. `QUERY_HISTORY` for live evidence; `ACCESS_HISTORY` (up to 180 min lag) for the written pack — and we say which is which.
6. Where a competitor comparison appears, it cites their source file and line.

---

## 9. Go / no-go before any polish

No-go if: the answer is hard-coded · evidence links are decorative · the agent can cross patient scope · the late-update path is simulated rather than real · consent revocation doesn't actually block · CoCo evidence exists only for code generation.

---

## 10. Immediate next actions

1. **Commit everything** — bank the planning trail.
2. Run the three remaining platform tests.
3. Download the reference corpus into `data/reference/`.
4. Freeze the answer JSON schema + data contract.
5. Rewrite `SPEC.md` against all 50 findings + the explainer changes, sized to this plan.
6. Start the vertical slice.
