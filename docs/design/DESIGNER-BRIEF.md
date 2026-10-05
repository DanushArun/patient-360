# SAARTHI -- Designer Brief

**For the product designer. No backend or frontend knowledge assumed.**
**Updated: 28 September 2026 -- all 6 screens are now built and working.**

---

## What is this product?

SAARTHI helps hospital staff prepare cancer patients for chemotherapy. Before treatment, a coordinator must check ~16 things: blood values are safe, insurance is approved, documents exist, identity is verified. Today this is manual and error-prone. SAARTHI automates the checks and shows the results on a dashboard.

**Three types of users:**
1. **Coordinator** -- the main user. Manages the day's patient list, resolves blockers, files tasks, prepares families.
2. **Oncologist** -- reviews the patient chart on rounds. Needs a 2-minute orientation.
3. **Navigator** -- helps families prepare. Needs a checklist in the family's language.
4. **Judge** -- hackathon evaluator. Needs to verify security and correctness claims with live probes.

**One absolute rule:** The system never tells anyone what to do clinically. It says what the record shows, what is missing, and what disagrees. "Should we proceed?" is always refused. The treating doctor decides.

---

## The 6 screens -- all built, all working

| # | Screen | URL | Primary user | Purpose |
|---|---|---|---|---|
| 1 | Census Homepage | `/` | Coordinator | Day's patient list with severity triage |
| 2 | Patient View | `/patient/[id]` | Coordinator / Oncologist | Full patient detail with 3 tabs |
| 3 | Navigator View | `/navigator/[id]` | Family Navigator | Standalone family preparation page |
| 4 | Judge Console | `/judge` | Hackathon judges | 8 live SQL probes to verify claims |
| 5 | Ask + Evidence | (Tab inside Patient View) | All | Chat Q&A with citations |
| 6 | Family Checklist | (Tab inside Patient View) | Coordinator / Navigator | Multilingual preparation checklist |

---

## Screen 1: Census Homepage (`/`)

**Who uses it:** The coordinator, at the start of their shift.
**What they need:** See all patients coming in today/this week, sorted by who needs attention first.

### Layout (top to bottom)

**Header bar:**
- Left: App name "SAARTHI", subtitle "Care readiness", text "no patient selected"
- Right: "Judge Console" button (links to `/judge`), "Select patient" dropdown, Practitioner name (from the database, shows the logged-in doctor's name)

**Info bar** (below header):
- Left: "12 visits in next 7 days · 13 patients accessible" (live count)
- Right: "Loaded 14:06:32 · Refresh" (timestamp + clickable refresh link)

**Search box:**
- Filters the census list instantly as you type
- Matches on: patient name, patient ID, place, regimen, or rule ID
- Shows "X of Y" count when filtering
- "Clear filter" link appears when no results match

**Day sections** (one per day with visits):
- Day heading: "Today · Mon, 28 Sep" or "Tomorrow · Tue, 29 Sep"
- Tally bar: five counters showing `Ready | Advisory | Waiting | Conflict | Blocked`
- Patient rows (sorted by severity -- blocked first, ready last):

Each patient row shows:
```
+-----------------------------------------------------------------+
| Suresh Patil                    X Blocked           [Open]      |
| Latur, Maharashtra · Marathi    CLIN-ANC-001                    |
| Cisplatin weekly · cycle 4      ANC is 1160, below threshold    |
|                                 1500                            |
+-----------------------------------------------------------------+
```

The row contains:
- **Name** (bold)
- **Place and language** (grey, below name) -- e.g., "Murshidabad, West Bengal · Bengali"
- **Regimen and cycle** (grey) -- e.g., "Doxorubicin + cyclophosphamide, 3-weekly · cycle 3"
- **Status chip** -- one of: `✓ Pass`, `✕ Blocked`, `⇄ Conflict`, `– Waiting on evidence`, `✓ Ready · advisory`
- **Headline rule** -- the worst failing rule ID in a code chip (e.g., `CLIN-ANC-001`)
- **Headline reason** -- one-line explanation (e.g., "ANC is 1160, below threshold 1500")
- **"+N more"** if multiple issues exist
- **"Open" button** -- links to `/patient/[id]`
- The entire row is clickable (hovers with subtle background)

**Right sidebar: "Also under your care"**
- Lists patients who are accessible but have no upcoming visit in the 7-day window
- If all patients have visits, shows "All accessible patients have upcoming visits"
- Each name is a link to that patient's page

### What the sort order means (important for design)

Patients are sorted **by urgency, not alphabetically**:
1. **Blocked** (solid red border chip) -- patient CANNOT proceed. Lab value failed. Shown first.
2. **Conflict** (double amber border chip) -- two sources disagree. Needs human decision. Second.
3. **Waiting** (dashed grey border chip) -- evidence is missing. Need to obtain it. Third.
4. **Advisory** (solid green border chip, but with notes) -- ready, but a non-blocking flag exists. Fourth.
5. **Ready** (solid green border chip) -- all clear. Last, because they need no attention.

This is deliberate: the coordinator handles the problems first, confirms the clear ones last.

---

## Screen 2: Patient View (`/patient/[id]`)

**Who uses it:** Coordinator or oncologist, when they open a specific patient.
**What they need:** See all 16 checks at a glance, then drill into any one.

### Layout (top to bottom)

**Patient header:**
- Patient name (large), Patient ID, Consent ID
- Three buttons: patient selector (back to census), "Navigator View" (links to `/navigator/[id]`), Practitioner name

**Refresh indicator:**
- "Checking live readiness. Displaying the stored SQL snapshot from [timestamp]." (while loading)
- Disappears when live data arrives
- "Live readiness refresh failed. [Retry]" if it fails

**Gate strip** (the 16 check tiles):
- 4 tiles per row, up to 4 rows
- Each tile shows:
  - Category name (e.g., "clinical", "coverage", "identity")
  - Status chip: `✓ Pass`, `✕ Fail`, `– Not evaluated`, `⇄ Conflicting`
  - Rule ID and version (e.g., `CLIN-PLT-001 v1`)
- Tiles are clickable -- clicking one pins it in the evidence panel (right side)
- Selected tile gets a blue top border and light blue background
- Tiles have hover state (subtle background)

**Two-column layout below the gate strip:**

**Left column -- three tabs:**

Tab 1: **Ask the Record** (chat)
- Chat input pinned at the bottom of the screen (floating, with gradient fade)
- User types a question, presses Enter or clicks Send
- User message appears immediately with a person icon
- "Consulting the record..." loading indicator
- Assistant response appears with a robot icon and subtle grey background tint
- Response includes:
  - Answer text (with bold and code formatting)
  - `known_as_of` timestamp (when the system knew this)
  - Cited gate results as small inline tiles (clickable, pins them in the evidence panel)
  - Suggested follow-up questions (clickable buttons below the answer)
- Conversation persists across page refresh (stored in browser session)
- Errors appear as conversation turns (not banners), so they survive refresh too

Tab 2: **Record Timeline**
- Every clinical event for this patient, newest first
- Each event shows:
  - Concept name and value (e.g., "PLT · 82000")
  - Event ID
  - "Derived value" label if it was calculated, not directly measured
  - Three timestamps:
    - **Event time** -- when it happened (e.g., lab was drawn)
    - **Source recorded** -- when the hospital system recorded it
    - **Ingested** -- when SAARTHI received it
  - These three clocks are a core architecture requirement (Rule R2)

Tab 3: **Family Checklist**
- Language selector dropdown (English, Hindi, Tamil, Bengali, Marathi)
- Numbered checklist items derived from non-passing gates:
  - Each item is a plain-language instruction for the family
  - Each item shows which rule generated it (e.g., `CLIN-PLT-001`)
  - Items change when you switch language
- "All clear" message if every gate passes
- "Message for the family" section -- a preformatted text block ready to copy
- "Copy message" button -- copies to clipboard for WhatsApp
- Disclaimer: "Translations are drafted for review: have a native-speaking navigator check them before first use"

**Right column -- Evidence panel:**
- Shows detail for whatever is selected (gate tile or chat answer)
- When a gate is selected:
  - Category and outcome (e.g., "clinical · fail")
  - Rule ID, version, severity (blocker or advisory)
  - Reason text (e.g., "PLT is 82000, below threshold 100000")
  - Source evidence IDs (or "No source evidence ID was returned")
  - `known_as_of` timestamp
  - Provenance note in italic (if the threshold is practice consensus, not a guideline)
  - Derived formula (if the value was calculated -- e.g., "ANC computed as WBC x neutrophil% / 100")
  - **Action buttons** (only for fail/conflicting/not_evaluated):
    - "Request document" -- files a task to obtain missing evidence
    - "Escalate to treating doctor" -- flags for clinical review
    - Shows "Filing..." then "Task filed" with task ID, or "Task already filed" if duplicate
  - Review task history for this rule
  - "Clear selection" button
- When a chat answer is selected:
  - Tool calls made by the agent (tool name, query ID)
  - Scope verification: "No patient identifier in the tool input" (security check)
  - Reasoning disclosure (collapsible, labelled as "not evidence")

---

## Screen 3: Navigator View (`/navigator/[id]`)

**Who uses it:** The family navigator, before the patient's visit.
**What they need:** A simple preparation list they can share with the family via WhatsApp.
**Key difference from the Patient View checklist tab:** This is a standalone page. No clinical detail, no gate strip, no chat. Just the preparation list and eligible insurance schemes.

### Layout (top to bottom)

**Header:**
- Patient name (large), Patient ID, Visit date, Practitioner
- "Full patient view" and "Census" link buttons

**Language selector:**
- Dropdown: English, Hindi, Tamil, Bengali, Marathi

**Checklist section: "What the family needs to do before [visit date]"**
- Numbered items, each with:
  - Plain-language instruction in the selected language
  - Rule attribution in grey (e.g., `from CLIN-PLT-001`)
- If everything passes: "All clear" message

**Message section: "Message for the family"**
- Preformatted text block with header, numbered items, and footer
- "Copy message" button
- Disclaimer about translations

**Eligible government schemes section:**
- Cards for each eligible scheme, showing:
  - Scheme type (central/state)
  - Scheme name (e.g., "Pradhan Mantri Jan Arogya Yojana")
  - Annual limit (e.g., "₹5,00,000")
  - Eligibility status
- Example: A patient from West Bengal sees PM-JAY (central, ₹5L). A patient from Maharashtra sees both PM-JAY and MH-MJPJAY (state, ₹1.5L).

**Disclaimer at bottom:**
- "Your treating team decides all clinical matters. This checklist helps the family prepare documents and logistics."

---

## Screen 4: Judge Console (`/judge`)

**Who uses it:** Hackathon judges verifying the system's security and correctness claims.
**What they need:** Click a button, see the SQL that ran, see the result, see pass/fail.

### Layout (top to bottom)

**Header:**
- "SAARTHI · Judge Console"
- "← Census" link back to homepage
- Description: "Live security and correctness probes against the production database"

**"Run all 8 probes" button** (dark, primary action)
- Summary counter appears after: "X of 8 passing" (green if all pass, red if any fail)

**Probe grid** (4 columns on desktop, 2 on tablet, 1 on mobile):
- 8 buttons, each showing:
  - "Probe N" label
  - Title (e.g., "Rule catalog completeness")
  - Status: idle → "Running..." → result
  - Pass: green border + light green background + "✓ 16 rows"
  - Fail: red border + light red background + "✕ expected 0 rows"
- Each button is individually clickable to re-run that probe

**Probe detail sections** (appear below the grid after running):
- For each completed probe:
  - Pass/Fail badge with probe number
  - Title and description
  - "Expected: ... · Got: N rows"
  - "Show SQL" toggle button -- reveals the actual query
  - Result table with column headers and data rows (max 20 rows shown)

**The 8 probes:**
1. **Rule catalog completeness** -- all 16 rules exist with thresholds
2. **RAP scopes READINESS_STATE** -- no patient data leaks to unauthorized users
3. **Binding lifecycle integrity** -- no dangling sessions left open
4. **Three-clock coverage** -- every event has all three timestamps (Rule R2)
5. **Review task idempotency** -- no duplicate tasks from double-clicking
6. **Consent-gated access** -- patients without consent are unbindable
7. **Gate outcome distribution** -- all 4 outcomes exist (pass/fail/not_evaluated/conflicting)
8. **Scheme eligibility coverage** -- 3 government schemes with eligible patients

---

## What needs design improvement (all screens exist but need polish)

### Homepage
- The search box works but looks basic -- could use a search icon and clearer empty state
- Census rows are clickable but the "Open" button and the row click do the same thing -- consider removing the button
- Tally counters could be more visual (small bar chart or coloured dots)
- "Also under your care" sidebar is minimal -- could show patient count or last-visit date

### Patient View
- Gate strip tiles are functional but dense -- 13 tiles on one patient is a lot to scan
- The two-column layout (left: content, right: evidence) works but the evidence panel can feel disconnected from what you clicked
- Chat assistant responses have a grey tint but could have clearer visual separation from user messages
- The tab control (Ask / Timeline / Checklist) is functional but looks like plain buttons
- Timeline events all look the same -- derived values could have a visual marker
- The floating chat input works but can overlap content at the bottom

### Navigator View
- Scheme eligibility cards work but are styled the same as evidence cards -- could have their own visual treatment
- The "Copy message" button could be more prominent (it's the main action on this page)
- No visual indication of which checklist items have been reviewed by a navigator vs. draft

### Judge Console
- The probe grid works but all probes look the same before running -- could show a brief description on hover
- SQL display uses preformatted text -- could have syntax highlighting
- Pass/fail results could have more visual weight (the badge is small)

---

## Design Principles Already Established (must follow)

1. **Status is glyph + word + border style, never colour alone.** 4-8% of Indian males are red-green deficient. All four outcomes are distinguishable in greyscale.

2. **Gate failures are quiet and specific, not alert banners.** Research shows ~90% override rate for interruptive alerts in clinical systems.

3. **`not_evaluated` is neutral and dashed, never styled as failure.** A missing lab does not mean a bad result -- it means we don't know.

4. **Evidence panel is persistent, never a modal.** Verifying a citation requires seeing claim and source simultaneously.

5. **Tabular numerals on every value and timestamp.** Digits must align for comparison.

6. **Source pages render as `pre` (preformatted), not wrapped.** Lab reports are columnar; wrapping breaks the alignment.

7. **Inter font, not SF Pro.** SF Pro is not licensed for web redistribution.

8. **The system never outputs a confidence percentage.** It reports the observed evidence state.

9. **Blocked patients always sort first.** The coordinator handles problems before confirming ready patients.

---

## Status Vocabulary (the four outcomes)

These four outcomes appear everywhere -- census chips, gate tiles, evidence panel, chat citations. They must always look consistent.

| Outcome | Glyph | Word | Border style | Colour | Meaning |
|---|---|---|---|---|---|
| **pass** | ✓ | Pass | 1px solid | Green (#1E6B3A) | Requirement met |
| **fail** | ✕ | Fail | 2px solid | Red (#A8261C) | Requirement not met, action needed |
| **not_evaluated** | – | Not evaluated | 1px dashed | Grey (#656C73) | Insufficient evidence, need to obtain it |
| **conflicting** | ⇄ | Conflicting | 3px double | Amber (#8A5300) | Sources disagree, human must reconcile |

The border weight and style carry the urgency: fail is the thickest solid, conflicting is double, not_evaluated is dashed (uncertain), pass is the thinnest.

---

## Census status vocabulary (five states)

These appear on the homepage census rows:

| Status | Maps to | Meaning |
|---|---|---|
| **Blocked** | fail outcome | Patient cannot proceed until resolved |
| **Conflict** | conflicting outcome | Sources disagree on at least one check |
| **Waiting on evidence** | not_evaluated outcome | Evidence missing for a blocker check |
| **Ready · advisory** | fail on advisory severity | Ready but with a non-blocking note (e.g., HbA1c elevated but doesn't block chemo) |
| **Ready** | all pass | All clear |

---

## Files for Reference

- `docs/COMPLETENESS-MAP.md` -- Detailed audit of what exists vs. what's missing
- `docs/TESTING-PLAYBOOK.md` -- 65 test cases with expected results (shows exact user flows)
- `docs/PROJECT-OVERVIEW.md` -- Architecture, 16 rules, 8 tools, access control model
- `IMPLEMENTATION-STATUS.md` -- Per-component status with honest labels
- `planning/research/design/DESIGN-SYSTEM.md` -- Full design system specification
- `planning/research/design/screens/` -- Screenshots of the running app
- `web/components/sa.tsx` -- Current design system components (colour tokens, chips, layout)
- `web/app/saarthi.css` -- Full stylesheet with commented design decisions (315 lines, every decision explained)
