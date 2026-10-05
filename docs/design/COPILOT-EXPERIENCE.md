# SAARTHI Copilot: experience specification

How the copilot looks and behaves, translated from ChatGPT's interface for a clinical record tool. Visual rules come from `INTERFACE-GUIDELINES.md`. Safety rules come from `AGENTS.md` (R1–R7, Class A/B) and `planning/revised-architecture/COPILOT-SPEC.md`, and they always win over any pattern below.

**Sources studied (5 October 2026)**
- OpenAI Apps SDK UI guidelines (developers.openai.com/apps-sdk/concepts/ui-guidelines): display modes, visual rules.
- `@openai/apps-sdk-ui` v0.2.2 (MIT): ChatGPT's published design tokens.
- Composer and chat-anatomy teardowns: aiuxplayground.com ChatGPT composer; setproduct.com AI chat anatomy; 925studios ChatGPT breakdown.
- The ChatGPT desktop app's conversation inspector (Changes, Outputs, Subagents, Sources).

ChatGPT's own tokens agree with SAARTHI's: system font stack, 14/20 body, 12 px small text, 20/26 heading, 32 px default control, 4 px spacing grid. The copilot needs no separate visual language.

---

## 1. What makes ChatGPT feel "put together", and the SAARTHI equivalent

| ChatGPT pattern | Why it works | SAARTHI translation |
|---|---|---|
| **Calm default.** A blank composer and a few starter pills | Assumes competence; the blank field invites a question | The composer opens empty, with three starters written for the current page (§4) |
| **One input for everything** (+ menu, chips) | Users learn one surface; capability grows without new screens | One composer. The + menu attaches context from the page. Chips show what's attached. |
| **Scope chip with a pre-send contract** (Deep research) | Users know what kind of answer they'll get before sending | A source chip, **Patient record** or **Guidelines**, says what will be searched and what won't (R6). Guidelines is disabled, with a reason, until the reference corpus is live. |
| **Streaming** | Shows progress immediately, so a wait doesn't feel like failure | **Real staged progress** driven by actual gateway phases: Checking access → Routing question → Reading record → Validating citations → Saving to history. No fake typing, no fake percentages. |
| **Fixed reading column** (~768 px, ~65ch) | Comfortable to read at length | Answer text stops at `--measure`. The docked panel is 400 px; expanded, it is 720 px. |
| **Inline cards: at most 2 actions, no nested scroll** | Structured results stay scannable and sit in the conversation | A **record check card** (rule + version + status badge + reason + evidence IDs; actions **Open source** and **Escalate…**) and a **patient card** in cohort lists (one action: **Open patient**) |
| **Fullscreen with the composer still present** | Explore deeply without losing the conversation | The copilot is docked beside the record and stays open across sections and pages for the same patient. Opening a citation shows the source in the main view while the chat continues. |
| **Conversation inspector** (Changes / Outputs / Sources) | Everything the conversation touched stays visible | An **In this conversation** panel listing the patient in scope with its consent and binding, record checks discussed, sources cited (patient and guideline in separate groups), actions taken (follow-ups and evidence packets), and the clock |
| **Per-message actions on hover** | Power without clutter | Copy, Open in history (run ID), and, for refused clinical questions, **Prepare evidence packet** |
| **Stop while generating, Retry after an error** | Respects the user's time and control | Stop aborts the request. Errors show the reason next to the message, with Retry when a retry can help. |
| **Scroll-to-latest button** | Never lose your place in a long thread | A ↓ button appears when the newest message is out of view |
| **History as memory** (the sidebar timeline) | The product feels like it remembers | Each patient's conversation persists for the session and is listed in **History**. It is cleared when the patient changes (COPILOT-SPEC §1), because carrying one patient's facts into another's conversation is clinically unsafe. |
| **Outcome-labelled modes** (Auto / Fast / Thinking) | Users pick a result, not a mechanism | Users choose the **source** (record or guidelines), never a model or a tool |

## 2. Layout

```
┌ nav 216 ┬ record (fluid) ─────────────────────────┬ copilot 400 (docked) ───────┐
│         │ page header, tabs, tables              │ ▣ Fatima Begum ▾   ⓘ  ⤢  ✕ │
│         │                                        │ known as of 5 Oct, 07:51    │
│         │  [+ Ask] appears on hover over checks, │ ─────────────────────────── │
│         │  facts, documents, patients            │  messages (max --measure)   │
│         │                                        │  [check card] [citations]   │
│         │                                        │            ↓                │
│         │                                        │ ┌ Patient record ✕ PLT ✕ ─┐ │
│         │                                        │ │ Ask about this record… ↑│ │
└─────────┴────────────────────────────────────────┴─┴─────────────────────────┴─┘
```

- **Launcher.** A 44 px circular button, bottom-right, on every page. ⌘K / Ctrl+K opens the copilot and focuses the composer. Esc closes it.
- **Docked panel.** It narrows the record; it never covers it. ⤢ widens it to 720 px. Below 900 px it becomes an overlay sheet, and at phone width a full-screen sheet.
- **Header.** The scope pill (patient name, or *All my patients*) opens a menu to switch. Switching patient asks first, then clears the conversation. ⓘ opens the inspector. ✕ closes the panel.

## 3. Scopes (all on existing governed paths)

| Scope | When | Backend | What it answers |
|---|---|---|---|
| **Patient** | A patient page is open, or the user picked a patient | `/api/ask` → classifier → `ASK_SAARTHI` → validator → `RECORD_WEB_ANSWER` | Record-state questions, cited (Class B). Clinical judgement is refused with an evidence packet (Class A). |
| **Cohort** | Census or review queue, with no patient open | `/api/copilot/cohort` → classifier → deterministic intents over the scoped census and queue reads | Risk stratification: who is blocked, waiting, conflicting or ready, and why. Every row comes from a versioned SQL rule, and the user picks a patient by clicking. |
| **Guidelines** | The user selects the Guidelines source chip | Reference search (R6, separate corpus) | Disabled, with an explanation, until the reference Search service is live |

The patient is always selected by a human click: opening a patient page, choosing a patient card, or attaching a patient chip. The copilot never selects a patient from question text (COPILOT-SPEC §0).

## 4. Composer

- **Placeholder** names the scope: "Ask about Fatima Begum's record", "Ask about today's day-care list".
- **Enter** sends, **Shift+Enter** adds a new line. The field grows to 6 lines, then scrolls.
- **+ menu:** *Pick from page* (crosshair mode), *Attach current section*.
- **Chips** sit above the text: the source chip first, then attached items (at most 5), each removable. Chips carry kind and ID only, never the values, and the server re-validates every ID against the binding.
- **Send** is a 32 px circular button using the accent colour and the ↑ icon. While a request runs it becomes **Stop** (■).
- **Starters** appear only when the conversation is empty:
  - Patient: *What's blocking this visit?* · *What's missing before the next cycle?* · *Do any sources disagree?*
  - Cohort: *Who is blocked today?* · *Who is waiting on evidence?* · *Which patients have coverage conflicts?*

## 5. Message states

| State | What the user sees |
|---|---|
| Sending | The user's message appears immediately (optimistic), with the status line below it |
| Working | Staged progress from real server phases, current phase bold, finished phases ticked. The composer shows a subtle shimmer. |
| Answered (Class B) | The answer, citation chips, any record check cards, and the clock *Known as of …* |
| Partial | The same, plus a plain note on what's missing ("The language model is unavailable on this account; showing SQL record lookups only") |
| Refused (Class A) | "Clinical judgement belongs to Dr …", with **Prepare evidence packet** as the single primary action |
| Error | The reason next to the message, plus **Retry** when retrying can help |

The copilot never shows a confidence percentage. It shows evidence states instead ("2 sources disagree", "final report not received").

## 6. Page awareness and "+ Ask"

- Elements carry `data-copilot-ref="kind:id"`. Kinds: `patient`, `check` (rule ID), `fact` (event ID), `document` (doc ID), `task`, `section`.
- Hovering a tagged element shows a small **+ Ask** button. Clicking it attaches a chip and opens the copilot.
- **Pick from page** dims untagged regions and highlights tagged ones as the pointer moves. Click attaches; Esc exits.
- The current page and section are always attached as a quiet context line, not a chip: "Viewing: Fatima Begum · Facts".

## 7. Writing

- Plain and factual, in the third person about the record: "The platelet count recorded on 3 Oct is 82,000/µL".
- No "I think", no hedging adjectives, no "we".
- Every answer ends with the clock line.
- Refusals name who decides and what the copilot can do instead.
