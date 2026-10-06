# SAARTHI: submission day plan. Purpose-built for the people who run an Indian chemo day care

## Context
**Deadline.** Final submission closes **today, 6 Oct 2026, 18:00 IST**. It consists of the repo, a hosted Vercel URL that judges use alone for 18 days, and a live demo video (Danush records it; I write the script and rehearse it).

**Target.** 100/100 on the rubric (Relevance 30 / Technical 40 / Completeness 30). Judges score strictly against the problem statement. A wrapper that "chats with PDFs" loses to a system built around how a hospital actually works. So every piece of work below is tied to:
1. a named person in the hospital,
2. the benefit that person gets over today's paper-and-WhatsApp workflow, and
3. a line in the brief.

**Account.** The new Snowflake account is XG46956 (AWS Tokyo, with claude-opus-5, claude-haiku-4-5, llama3.3-70b, mistral-large3 and qwen3-32b live). Its clean install **failed** at `backend/sql/tasks/refresh_readiness.sql`: 1,206 steps PASS, then "Stored procedure child job is cancelled upon parent jobs termination" (`evidence/qa/clean-install-live.json`). Unblocking it is step 1.

**Decisions made today:**
- Everything stays **inside Snowflake**, with no Slack, Jira or Drive.
- I run **3 subagents in git worktrees** and review every diff.
- Live execution and testing go through **`cortex exec`**, so each live step has a Cortex Code (CoCo) session ID.

## 1. Who it serves and what changes for them
Research base:
- `planning/research/patient-reality/patient-journey-meera.md`: about 100 documents per patient per year, 2 facilities, 2 MRNs, failures F1–F12.
- `planning/research/clinical/abdm-architecture.md` §4: patients carry a plastic folder or phone photos; ABHA is rarely queried.
- `health-system-workflow-landscape-2026-09-24.md`: work first, record second, evidence always reachable.

| Person | Today (Indian day care) | What goes wrong | SAARTHI benefit | Proof on screen |
|---|---|---|---|---|
| **Day-care coordinator / nurse** | Calls families the day before. Checks the paper folder at the counter on cycle day. | Missing CBC or FISH, or expired pre-authorisation, found **at the counter**. The family has travelled up to 1,000 km, the chair sits idle, and 14% of cycles are missed (journey F3, F7, F12). | A 7-day census showing each patient's blocking item. The bring-list goes out days ahead in the family's language. A WhatsApp photo of an outside lab report is added in seconds and the readiness checks update. | Census → patient → **Add document** → checks update |
| **Treating oncologist** | Flips through 30–100 papers across two MRNs. Reconciles HER2 IHC 2+ against FISH. Hunts for the latest addendum. | A superseded report is read as current. An equivocal result is read as final. A unit trap ("1.9 lakh"). | A one-screen orientation where every value is cited to its page with three clocks. Conflicts and superseded reports are shown, never silently resolved. A clinical question is refused with an evidence packet addressed to them. | Labs card → source page. Class A refusal → packet |
| **PM-JAY / insurance desk** | Re-keys the TMS portal. The letter says Approved while the table says Pending. Validity is 30 days. | Treatment refused because authorisation expired. Wrong package. Family-floater balance misread. | A coverage check where letter-vs-table drift is a Conflict, expiry is shown ahead of the visit, and the family balance is "unknown, never estimated". | DC-07 conflict + cutoff replay. Expired-auth case |
| **Pharmacist / chemo nurse (safety)** | Checks LVEF date, creatinine clearance and bilirubin limits per drug by hand. | Trastuzumab given with an echo over 90 days old. Dose given with renal limits unknown. | **Safety checks** labelled as such: LVEF surveillance, per-drug creatinine clearance and liver limits, reported as record state. | DC-02 LVEF overdue. Safety question answered as Class B |
| **Medical records / compliance (DPDP, NMC)** | Paper consent. No log of who saw what. | Cross-patient exposure. Consent withdrawn but still used. | Consent checked at query time, patient scope keyed on `CURRENT_USER()`, every answer saved with sources, AI never gives clinical advice. | Consent withdrawal → same question returns nothing. Judge Console |

## 2. How documents actually arrive, and how SAARTHI takes each one in
`DOCUMENT.ingestion_method` already models the channels: `fhir_bundle | hl7 | digital_emr | physical_folder | whatsapp_photo | downloaded_pdf` (`backend/sql/tables/30_documents.sql:24`). What's missing is a way for a person to put a document in. Today documents only enter through scripts, and closing that gap is the centrepiece of this plan.

| Journey stage | Documents generated | How they reach the hub today | SAARTHI intake path | Feeds check |
|---|---|---|---|---|
| Spoke diagnosis | OPD note, mammogram/USG, biopsy, histopathology, IHC ("FISH to follow") | Paper originals in the folder; phone photos | Coordinator **Add document**: photo or scan with channel `physical_folder` / `whatsapp_photo`, plus source facility | DOC-PATH-001, DOC-HER2-001 |
| Hub workup | FISH, staging CT, echo, baseline CBC, MDT plan | Hub HIS / lab system | `digital_emr` / `hl7` / `fhir_bundle` through the existing stage → `TASK_FLATTEN_FHIR` | SURV-LVEF, CLIN-* |
| Pre-authorisation | TMS request, approval letter (30-day validity) | Portal printout | `downloaded_pdf` letter → claim extraction | COV-AUTH-001 |
| Between cycles (**"the gap"**) | Outside-lab CBC/LFT/RFT at the spoke town | **WhatsApp photo** from the family | Add document (channel `whatsapp_photo`); units normalised with `UNIT_REGISTRY` | CLIN-ANC/PLT/CRCL/BILI |
| Cycle day | Chemo order, nursing record, discharge note | HIS / paper | `digital_emr`; discharge prompt exists | timeline |
| Surveillance | Repeat echo every ~9 weeks | Printed report | Add document | SURV-LVEF-001/002 |
| Corrections | Addendum or amended report | New printout | Supersedes chain (`supersedes_doc_id`); the older report is shown as superseded | DOC-*, timeline |

**Intake rules (all already in the architecture):**
- Same file uploaded twice → `duplicate`, no new assertions.
- Name on the page differs from the patient record ("Mira" vs "Meera") → identity **quarantined** and contributes no evidence (R4).
- Unreadable photo → `unreadable`, never guessed.
- The two models disagree → `conflicting` → gate `not_evaluated` (R7).

## 3. Where AI is used, and where evidence decides (the R1 split)
| Job | Done by | Why it's safe |
|---|---|---|
| Read a scanned page or phone photo | `AI_PARSE_DOCUMENT` | OCR and layout only |
| Extract typed values | **Two different model families** at temperature 0. Pair chosen live today from claude-opus-5 / claude-haiku-4-5 / llama3.3-70b / mistral-large3 on gold documents, then frozen | Disagreement means the value isn't asserted (R7) |
| Map Indian synonyms and units | Ontology (`CLINICAL_ONTOLOGY`, `UNIT_REGISTRY`) | Deterministic tables |
| Understand the question | Pattern rules first, then `AI_CLASSIFY` | Class A is always refused; when unsure, refuse |
| Choose tools and phrase the answer | Cortex Agent pinned to **claude-opus-5**, using generic tools with no `patient_id` input | Phrases only supplied facts. The validator strips unsupported claims |
| Find guideline or scheme passages | Cortex Search on the **reference** corpus, kept separate from the patient corpus (R6) | Cited page, never mixed with patient pages |
| Gate outcomes, numbers, dates, thresholds, risk tier | **SQL rules, versioned** | Never AI (R1) |

## 4. The brief, line by line: what we have, the gap, and today's action
| Brief line | Status now | Today's action (workstream) |
|---|---|---|
| Unify siloed EHR + claims + documents into a patient 360 | Structured, FHIR, coverage/authorisation and document data are unified; 12 patients | Intake surface (**A**). 100-patient cohort is optional (**C**, cut first) |
| Clinical, **safety** or **regulatory** questions with cited evidence | Clinical: Class A refused, Class B answered. **Safety: refused because "safe" is a Class A keyword. Regulatory: reference scope returns 409** | Safety question family as Class B record state. Reference scope live with cited pages, adding NMC Telemedicine 2020 and DPDP 2023 PDFs (**B**) |
| Structured + clinical, regulatory, legal documents | 7 reference PDFs (NCG, ICMR, PM-JAY HBP 2.2, FDA label) loaded once; search suspended | Corpus reloaded and resumed, regulatory and legal docs added (**B**) |
| **Risk stratification**, never opaque | Deterministic tiering in `DT_REVIEW_QUEUE`, never named | Name it "Care readiness risk stratification (documentation, coverage, safety surveillance; not prognosis)", with each tier opening to its rule and version (**D**) |
| Q&A with clear source evidence | Copilot record cards (live 6 Oct). Validator not in `ASK_SAARTHI` | Validator wired into the agent answer path. AI answers use claude-opus-5 (**B**) |
| Synthetic data | Yes. Missing seeded states: explicitly_negative, quarantined identity, consent withdrawn | Seed those 3 states (**C**) |
| CoCo: planning, development, execution, testing | Evidence stops at 22 Sept. `.cortex/` is gitignored | All live steps today through `cortex exec`. Commit `.cortex/plans`. Session IDs in `evidence/coco/` (**D**) |
| Pipelines: dynamic tables, tasks, streams, incremental | 4 DTs, 7 tasks (suspended), 1 stream (never fired) | Resume tasks. **Add document → stream fires → parse → extract → reconcile → refresh** shown live, replayed with no duplicates (**A**) |
| Semantic view, verified queries, ontology, validated against NL questions | View + 7 VQRs; ontology has no code bindings | Populate LOINC/ICD-10 bindings. Validate the VQRs with `cortex analyst` NL questions (**C**) |
| Streamlit app generation | Next.js app. `frontend/streamlit_app.py` still tracked despite "removed" | **Judge Console as Streamlit-in-Snowflake, generated with CoCo**, over the 8 judge probes. This covers Streamlit, a Snowflake-native surface and the Judge Console at once (**C**) |
| MCP: read and **act** | Inbound MCP only, live on old account | Snowflake-managed MCP server with `ask_saarthi` (read) and `create_review_task` (act), connected to CoCo via `cortex mcp`. Escalation emails the coordinator with Snowflake `SYSTEM$SEND_EMAIL` (**B**) |
| Reusable skills ("headline bonus") | 4 SKILL.md authored, never uploaded or invoked | Upload, invoke from the agent, and run the reuse proof live (**C**) |
| Across surfaces (CLI, Desktop, Snowsight Cloud Agents) | None recorded | The same agent answering in Snowsight and in CoCo CLI, captured (**D**) |
| Guardrails and graceful fallback | Strong offline; R7 disagreement never live | Live disagreement, live isolation (10 sessions), consent withdrawal mid-request (**B, C**) |
| Document processing | Lab, pathology and claim letter only | Add **echo** and **discharge** documents; prompts exist (**A**) |

**Correctness bugs to fix (found in the audit):**
- `COV-LIMIT-001` returns `pass` for family-floater coverage. It must return `not_evaluated` with "family balance unknown" (`backend/sql/procedures/evaluate_gates.sql:389`).
- PAT-DEEP-0001's PM-JAY coverage row has `is_family_floater = FALSE` (`load_synthetic.sql:152`).
- Safety rules show as "Other checks" (`web/components/workspace-patient-overview.tsx:51`).

## 5. Workstreams (parallel; each in its own worktree; I review and merge)

**First action on approval:** write this plan verbatim to `/Users/danusharun/Documents/patient-360/plan.md` at the repo root. It's a new file; `planning/plan.md` is untouched. Keep it updated as blocks complete.

**W0 (me, now) — unblock the install**
- Bound `refresh_readiness_proc` to encounters in the next 14 days, plus an optional patient argument. The installer calls it per patient so no single call outlives its parent.
- Fix the same 120 s timeout.
- Rebuild the bundle, hand the fix to session `patient-360-01`, and get a green receipt.
- Then commit the 4 pending commits.

**A — intake and the live pipeline** (subagent, `web/` + `backend/sql/procedures` + `tasks`)
- **Add document** sheet in the patient workspace:
  - inputs: file (PDF/JPG/PNG), document type, source facility, arrival channel, document date
  - route `web/app/api/patient/[id]/document/route.ts` stages the file under the bound patient's path (`@PATIENT_DOCS`, SNOWFLAKE_SSE), using the existing governed lease in `web/lib/patient.ts`
  - new owner's-rights procedure `INGEST_BOUND_DOCUMENT` records the channel and refuses any path outside the bound patient
- Progress driven by real stages: Received → Read → Read twice (2 models) → Checked against record → Checks updated. Then "What changed": the gate before and after, with citations.
- Pipeline: stream `DOC_STREAM` → `TASK_PARSE_DOCUMENTS` → extract → reconcile → `REFRESH_BOUND_READINESS`, with a synchronous fallback through the existing procedures for the demo.
- Renderers for an echo report and a discharge summary (`data/generator/documents.py` pattern).
- Demo documents to render:
  - DC-08 outside-lab CBC as a phone photo: `not_received` becomes present
  - DC-02 new echo: LVEF overdue becomes ready
  - a "Mira Devi" CBC: quarantined
  - a duplicate upload
  - a deliberately ambiguous photo: conflicting → `not_evaluated`
- Tests: unit, E2E fixture, and a Python contract for the procedure scope.

**B — the AI path live** (subagent, `backend/sql/procedures`, `agent`, `search`, `prompts`)
- Model bake-off on 10 gold documents: llama3.3-70b / mistral-large3 for pass A, against claude-opus-5 / claude-haiku-4-5 for pass B, never two from one family. Freeze the best pair. Update `extract_one_document.sql`, `extract_assertions.sql`, `prompts/pass_b_verify.md` and the CHANGELOG.
- Agent pinned to claude-opus-5. `VALIDATE_ANSWER` goes in the `ASK_SAARTHI` path and the MCP path.
- Live `AI_CLASSIFY`. Deploy the widened `classify_question.sql`. Add a **safety question family** as Class B record state ("Is cardiac surveillance current?", "Is creatinine clearance on record for this drug?"). "Is it safe to give?" stays Class A.
- Reference scope:
  - resume `REFERENCE_DOC_SEARCH`
  - add the NMC Telemedicine Guidelines 2020 and DPDP Act 2023 PDFs (public government texts)
  - remove the 409 in `web/app/api/ask/route.ts`
  - regulatory questions get answers with page citations ("What does PM-JAY package … cover?", "Is consent required to share records?")
- Snowflake-managed MCP server with read and act tools; `cortex mcp add`; email escalation via a Snowflake notification integration.

**C — measure and harden** (subagent, `backend/eval`, `backend/tests`, `semantic`, `skills`, `data`)
- Fix the held-out eval: re-point reference questions at the loaded corpus and add the safety family. Run all 48 end to end and report absolute counts:
  - correct
  - citations valid
  - missing/conflict recall
  - Class A leakage (target 0)
  - p50/p95 with cold starts separate
- 10-session isolation with canary values, and consent withdrawal mid-request.
- Seed explicitly_negative, quarantined identity and withdrawn consent. Fix `COV-LIMIT-001` and the DEEP floater flag.
- Ontology LOINC/ICD-10 bindings. VQR NL validation via `cortex analyst`.
- Skills: upload via `cortex skill`, invoke natively, run the reuse proof live.
- Streamlit Judge Console generated through CoCo.

**D (me) — integration and truth**
- Risk-stratification wording and the safety label in the UI.
- Vercel production on the live new account, using a restricted judge service user (app role only, `USE SECONDARY ROLES NONE`). Danush sets the env vars with `!` commands. `/api/health` must return 200.
- Snowsight Cloud Agent capture.
- CoCo evidence: commit `.cortex/plans`, record session IDs, fix the misleading session title in the CSV.
- Truth pass of README, `JUDGE-WALKTHROUGH.md`, `IMPLEMENTATION-STATUS.md`, a new dated `RELEASE-GATES`, and the deck engineering slide. Every number comes from today's receipts.
- Remove stale contradictions: the "no public URL" line, test counts, the `streamlit_app.py` claim, MCP-QUICKSTART.
- Tracker republished after each block.

## 6. Timeline (IST)
| Time | Milestone |
|---|---|
| 10:45 | W0 green install. Commits. Subagents A/B/C launched |
| 13:00 | A: intake loop working on the live account. B: models frozen, corpus re-extracted, AI answers + reference scope live. C: eval + isolation running |
| 14:30 | All merged. Full regression. Vercel live |
| **15:00** | **Code freeze.** Truth pass and screenshots |
| 15:30–17:00 | Video: Danush records from my script. Every beat rehearsed first with Playwright on the frozen build |
| 17:00–17:45 | Final commit. Danush pushes and submits. 15 min buffer |

## 7. Video: 3 minutes, one coordinator's morning (all live)
1. Census for the next 7 days, with the risk tier and each patient's blocking item.
2. DC-08: family's WhatsApp CBC photo → **Add document** → read twice → checks update.
3. DC-07: letter vs table conflict, cutoff replay.
4. Oncologist question → Class A refused → packet to the named practitioner.
5. Safety question answered as record state.
6. Regulatory question with a page citation.
7. Ambiguous photo → models disagree → not evaluated.
8. "Mira Devi" → quarantined.
9. Consent withdrawn → nothing returned.
10. Judge Console plus measured counts (absolute numbers).

## 8. Cut order (only if a block overruns)
100-patient cohort → Snowsight/CLI surface capture → email escalation → skills native invocation (record the exact platform error instead) → Streamlit Judge Console (fall back to SQL probes) → discharge renderer.

**Never cut:**
- the intake loop
- R7 live with disagreement
- safety and regulatory answers
- held-out eval
- isolation
- the Vercel live URL
- the truth pass
- the video

## Verification
- `cd web && npm test && npm run typecheck && npm run build && npm run test:e2e`, plus the Python suite: all green at freeze.
- Live receipts in `evidence/qa/` with query IDs and CoCo session IDs in `evidence/coco/`.
- Every claim in the README, deck and video maps to a receipt or a test.
- The public Vercel URL walked cold in a fresh browser along `JUDGE-WALKTHROUGH.md`.
- Class A leakage: 0 of N.
- Engineering gates on synthetic data are stated as not clinical validation (AGENTS.md §4).
