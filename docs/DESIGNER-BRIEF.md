# SAARTHI -- Designer Brief

**For the product designer. No backend or frontend knowledge assumed.**

---

## What is this product?

SAARTHI helps hospital staff prepare cancer patients for chemotherapy. Before treatment, a coordinator must check ~16 things: blood values are safe, insurance is approved, documents exist, identity is verified. Today this is manual and error-prone. SAARTHI automates the checks and shows the results on a dashboard.

**Three types of users:**
1. **Coordinator** -- the main user. Manages the day's patient list, resolves blockers, files tasks, prepares families.
2. **Oncologist** -- reviews the patient chart on rounds. Needs a 2-minute orientation.
3. **Navigator** -- helps families prepare. Needs a checklist in the family's language.

**One absolute rule:** The system never tells anyone what to do clinically. It says what the record shows, what is missing, and what disagrees. "Should we proceed?" is always refused. The treating doctor decides.

---

## What the dashboard looks like today

The dashboard has 2 pages and works against live data in Snowflake.

### Page 1: Home -- Day-Care Census (`/`)

```
+---------------------------------------------------------------+
|  SAARTHI                    [Select patient v]  Practitioner   |
|  Care readiness                                 Dr. Test       |
|  no patient selected                                           |
+---------------------------------------------------------------+
|                                                | Also under    |
|  Tomorrow . Mon, 28 Sep                        | your care     |
|  ----                                          |               |
|  5 Blocked  1 Conflict  2 Waiting  1 Advisory  | Meera Iyer    |
|  3 Ready                                       | Anjali Nair   |
|  ----                                          |               |
|  Fatima Begum                                  |               |
|  Murshidabad, West Bengal . Bengali             |               |
|  Carboplatin+Paclitaxel . cycle 3              |               |
|  [X Blocked] CLIN-PLT-001  PLT 82000 < 100000 |               |
|                                     [Open]     |               |
|  ----                                          |               |
|  Gopal Das                                     |               |
|  Kolkata, West Bengal . Bengali                 |               |
|  Trastuzumab . cycle 3                         |               |
|  [! Conflict] COV-AUTH-001  auth letter differs |               |
|                                     [Open]     |               |
|  ----                                          |               |
|  ... (more patients, sorted by severity)       |               |
+---------------------------------------------------------------+
```

**What works:**
- Patients grouped by day (Today, Tomorrow, etc.)
- Five tally counters per day: Blocked, Conflict, Waiting, Advisory, Ready
- Each row shows: name, place, language, regimen/cycle, status chip, headline blocker, "Open" button
- Sorted by severity (blocked first, ready last)
- Patient picker dropdown shows ALL accessible patients (not just today's list)
- "Also under your care" sidebar shows patients without upcoming visits

**What's missing:**
- Practitioner name is hardcoded ("Dr. Test Oncologist"), not from the session
- No search/filter within the census
- No indication of how many total patients vs. how many visible
- No refresh button or auto-refresh indicator

---

### Page 2: Patient View (`/patient/[id]`)

This page has three tabs and a persistent right panel.

```
+---------------------------------------------------------------+
|  Fatima Begum                    [Fatima Begum v]  Practitioner|
|  Patient PAT-DC-04  Consent C-0004              Dr. Test      |
+---------------------------------------------------------------+
|  Readiness checks . as of 2026-09-27 16:30                    |
|  +----------+ +----------+ +----------+ +----------+          |
|  | identity | | coverage | | docs     | | clinical |          |
|  | V pass   | | V pass   | | V pass   | | X fail   |          |
|  | ID-LINK  | | COV-AUTH | | DOC-PATH | | CLIN-PLT |          |
|  +----------+ +----------+ +----------+ +----------+          |
|  (... more gate tiles in rows of 4)                           |
+---------------------------------------------------------------+
| LEFT COLUMN                    | RIGHT COLUMN (Evidence)       |
|                                |                               |
| [Ask the record] [Timeline]   | Evidence . CLIN-PLT-001       |
| [Family checklist]             |                               |
|                                | clinical . fail               |
| (content depends on tab)       | CLIN-PLT-001 v1 . blocker    |
|                                | PLT is 82000, below 100000   |
|                                | Source evidence: EVD-1234     |
|                                | Known as of 2026-09-27 16:30 |
|                                |                               |
|                                | [Request document]            |
|                                | [Escalate to treating doctor] |
|                                |                               |
|                                | Review history                |
|                                | Task abc123 . escalate . open |
+---------------------------------------------------------------+
| [Ask about this patient's record...]               [Send ->]  |
+---------------------------------------------------------------+
```

#### Tab 1: Ask the Record (Chat)
- User types a question about the patient
- System answers with citations from the record
- Shows: answer text, timestamp, cited rules, tool calls with query IDs
- Suggested follow-up questions appear below
- Clinical questions ("should we proceed?") are refused

#### Tab 2: Record Timeline
- Every clinical event in reverse chronological order
- Each event shows three timestamps: when it happened, when it was recorded, when the system received it
- Derived values (calculated from raw data) are labelled

#### Tab 3: Family Checklist
- Items derived from non-passing checks (not AI-generated)
- 5 languages: English, Hindi, Tamil, Bengali, Marathi
- Generates a copyable WhatsApp message for the family
- Shows which rule generated each checklist item
- If everything passes, shows "all clear"

#### Right Panel: Evidence
- Click any check tile to see full details
- For failing/conflicting/missing checks: two action buttons
  - "Request document" -- files a task to obtain missing evidence
  - "Escalate to treating doctor" -- flags for clinical review
- Task history shown below
- For chat answers: shows which tools were called, with query IDs

**What works:**
- All 16 check tiles render with correct status
- Chat calls the live AI agent and returns cited answers
- Review tasks are filed to the database (idempotent -- duplicate clicks return the same task)
- Checklist works in all 5 languages
- Errors are persisted as conversation history (survive page refresh)

**What's missing:**
- No document viewer (can't click through to the actual lab report PDF)
- No standalone review queue (tasks can be created but there's no queue page to manage them)
- No facility timeline or discordance flags in the main view
- No visible integration health (when did each data source last sync?)
- No longitudinal chart section

---

## What we need designed (not built yet)

### Screen 3: Review Queue (for coordinators)

**Purpose:** See all open issues across patients, sorted by urgency, and take action.

**What it should show:**
- List of all open review tasks, grouped by urgency
- Each task: patient name, rule that triggered it, action type (request doc / escalate), who filed it, when, current status
- Ability to: assign to someone, mark as acknowledged, mark as resolved
- Unowned tasks highlighted (the "Stage-9 gap" -- things filed but nobody picked up)
- Filter by: patient, rule category, status, assignee

**Data available from backend:** `REVIEW_TASK` table has: task_id, patient_id, rule_id, action, reason, status (open/acknowledged/resolved), filed_by, filed_at, assigned_to, resolved_at, idempotency_key.

---

### Screen 4: Navigator View (for family navigators)

**Purpose:** A standalone, simplified screen for the navigator who calls the family before the visit. Not the tab inside the patient view -- a separate page they can use without seeing clinical details.

**What it should show:**
- Patient name and visit date
- The preparation checklist in the family's language (already generated by the system)
- Eligible government insurance schemes (PM-JAY, TN-CMHIS, MH-MJPJAY) with coverage limits
- A clear "your treating team decides" notice
- Copy-to-clipboard or share-via-WhatsApp for the message
- Which items a human navigator has reviewed vs. which are unreviewed drafts

**Data available:** Checklist items derived from gates, translated text in 5 languages (JSON), scheme eligibility from `SCHEME_REGISTRY`.

**Important:** This screen must state that translations are drafted for review. The navigator must check them before first use with the family.

---

### Screen 5: Judge Console (for hackathon evaluators)

**Purpose:** Let judges verify security, correctness, and architecture claims by running live probes.

**What it should show:**
- 8 buttons, each running a specific test and showing the SQL + result:
  1. Cross-scope attempt blocked (try to access another patient's data)
  2. Search without filter returns another patient's text (the competitor failure mode)
  3. Consent revoked, nothing returned
  4. Injected instruction treated as content (prompt injection test)
  5. Fabricated claim stripped by answer validator
  6. Low-quality image, two-pass disagrees, refuses to assert
  7. Time-travel replay: two timestamps, two correct answers
  8. Baseline RAG accuracy delta
- Each probe shows: what it tests, the SQL that ran, the query ID, pass/fail result
- A summary dashboard at the top: X of 8 probes passing

**Data available:** All probes are SQL queries against the live database. The backend procedures already exist.

---

### Screen 6: Review + History (for coordinators)

**Purpose:** See the full lifecycle of a review issue -- from initial detection through task creation, assignment, resolution, and the audit trail.

**What it should show:**
- Per-patient or per-rule view of all review history
- Task lifecycle: open -> acknowledged -> resolved
- Version chain of the readiness state (how did the rule outcome change over time?)
- Answer history (previous questions asked about this patient, with their citations)
- Ability to close a task with evidence of resolution

**Data available:** `REVIEW_TASK`, `READINESS_STATE` (versioned), `ANSWER_RUN` (conversation history with tool calls).

---

## Design Principles Already Established

These are documented in `DESIGN-SYSTEM.md` and must be followed:

1. **Status is glyph + word + border style, never colour alone.** 4-8% of Indian males are red-green deficient. All four outcomes (pass/fail/conflicting/not_evaluated) are distinguishable in greyscale.

2. **Gate failures are quiet and specific, not alert banners.** Research shows ~90% override rate for interruptive alerts in clinical systems.

3. **`not_evaluated` is neutral and dashed, never styled as failure.** A missing lab does not mean a bad result -- it means we don't know.

4. **Evidence panel is persistent, never a modal.** Verifying a citation requires seeing claim and source simultaneously.

5. **Tabular numerals on every value and timestamp.** Digits must align for comparison.

6. **Source pages render as `pre` (preformatted), not wrapped.** Lab reports are columnar; wrapping breaks the alignment.

7. **Inter font, not SF Pro.** SF Pro is not licensed for web redistribution.

8. **The system never outputs a confidence percentage.** It reports the observed evidence state: "final report not received", "two sources disagree", "3 claims verified against 5 sources".

---

## Status Vocabulary (the four outcomes)

| Outcome | Glyph | Meaning | Border | When it appears |
|---|---|---|---|---|
| **pass** | V | Requirement met | solid green | Lab value meets threshold, document exists, identity linked |
| **fail** | X | Requirement not met | solid red | Lab below threshold, document missing, authorization expired |
| **not_evaluated** | -- | Insufficient evidence | dashed grey | Lab not done, document unreadable, data too old |
| **conflicting** | ! | Sources disagree | solid amber | Authorization letter says one thing, database says another |

---

## Files for Reference

- `docs/COMPLETENESS-MAP.md` -- Detailed audit of what exists vs. what's missing (286 lines)
- `IMPLEMENTATION-STATUS.md` -- Honest per-component status with build/partial/designed-only labels
- `planning/research/design/DESIGN-SYSTEM.md` -- Full design system specification
- `planning/research/design/screens/` -- Screenshots of the running app
- `web/components/sa.tsx` -- The current design system components (colour tokens, chips, layout)
- `web/app/saarthi.css` -- Full stylesheet with commented design decisions
