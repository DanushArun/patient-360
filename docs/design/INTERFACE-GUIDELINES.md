# SAARTHI Interface Guidelines

The rules every SAARTHI screen follows. Each rule is adapted from Apple's Human Interface Guidelines (HIG). macOS is the reference platform, because SAARTHI is a desktop web tool used at a clinic workstation. The rules are enforced in code by `web/app/tokens.css` and checked by `web/lib/design-tokens.test.mjs`.

**Why this exists.** A 5 October 2026 audit found that the web app used 24 font sizes, 149 hex colours, 115 padding values, 59 heights and 18 corner radii across 21 CSS files. One census toolbar row had four controls at four sizes. Inconsistency reads as unreliability, and a clinician who doubts the interface will doubt the record.

---

## 1. Principles

| HIG principle | What it means for SAARTHI |
|---|---|
| Purpose | The census answers *who can be treated at this visit, and if not, why*. Every screen serves one question. |
| Agency | Nothing auto-dismisses. Every action can be reviewed in history. Long work can be cancelled where that's safe. |
| Responsibility | State is never shown by colour alone. Every answer shows its clock. No confidence percentages. Class A questions are refused. |
| Familiarity | Use standard controls (pop-up button, segmented control, search field, table) that behave as people expect. |
| Simplicity | Say a thing once. Every element earns its place. Detail sits one click away (progressive disclosure). |
| Craft | One scale each for type, space, size, radius and colour. Nothing is off-scale. |

## 2. Typography

*HIG Typography: "Minimize the number of typefaces"; macOS text styles; default 13 pt, minimum 10 pt; avoid light weights.*

Eight text styles replace every ad-hoc size. They follow the macOS built-in text-style ratios, scaled ×1.08 for browser legibility.

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `--text-large-title` | 28 / 34 | 700 | One per page: the page or patient name |
| `--text-title-2` | 20 / 26 | 600 | Section headings |
| `--text-title-3` | 16 / 22 | 600 | Panel and card headings |
| `--text-headline` | 14 / 20 | 600 | Emphasised row text (patient name in a table) |
| `--text-body` | 14 / 20 | 400 | Default text |
| `--text-callout` | 13 / 18 | 400 | Control labels, secondary table text |
| `--text-footnote` | 12 / 16 | 400 | Meta lines, clocks, captions |
| `--text-caption` | 11 / 14 | 500 | Identifiers and badge text only. Nothing smaller exists. |

- Typeface: the system stack (`system-ui`, so SF Pro on a Mac), falling back to Inter. Identifiers use `ui-monospace` at caption size.
- Weights: 400, 500, 600 and 700 only.
- Use `font-variant-numeric: tabular-nums` wherever numbers sit in columns.
- Sentence case everywhere: headings, buttons, labels, column titles.
- Uppercase is allowed only for a caption-size section label, with letter-spacing `0.04em`.

## 3. Space, size and shape

*HIG Layout: "Align elements… group related items… use consistent spacing." HIG Accessibility: macOS default control 28 pt, minimum 20 pt. About 12 pt of padding around bezelled controls and 24 pt around unbezelled ones.*

- **Spacing scale** (4 px grid): `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-6` 24 · `--space-8` 32 · `--space-12` 48. No other spacing values.
- **Control height**: `--control-height` **32 px** for every button, field, pop-up and segmented control. `--control-height-small` 24 px is only for compact inline actions inside table rows. Controls on the same row always share one height and the callout text style.
- **Touch**: at phone width (≤640 px) or with a coarse pointer, the same tokens become **44 px** and 32 px (HIG minimum hit target: 44 pt on iOS and iPadOS versus 28 pt default on macOS). Components never set their own touch sizes; they inherit them from the token.
- **Corner radius**: `--radius-control` 6 px · `--radius-panel` 10 px · `--radius-pill` 999 px. No other radii.
- **Page gutter**: `--space-8` on desktop, `--space-4` below 640 px.
- **Reading width**: prose stops at `--measure` (68ch). Tables can use the full width.
- **Grouping**: separate related groups with space first, a hairline separator second and a container third. Don't nest bordered boxes inside bordered boxes.

## 4. Colour

*HIG Color: "Avoid using the same color to mean different things… provide light and dark variants." HIG Labels: four label colours by importance. HIG Accessibility: contrast of at least 4.5:1 for text up to 17 pt.*

Components use semantic tokens only. A raw hex value appears nowhere except `tokens.css`.

| Role | Tokens |
|---|---|
| Text by importance | `--label`, `--label-secondary`, `--label-tertiary` (unavailable), `--label-quaternary` (watermark) |
| Surfaces | `--bg` (window), `--bg-secondary` (grouped panels, sidebar), `--bg-tertiary` (inset wells, hover), `--bg-elevated` (popovers, copilot) |
| Lines | `--separator`, `--separator-strong` (control borders) |
| Interaction | `--accent` (links, focus, the one prominent action), `--accent-label` (text on accent) |
| Status | `--status-ready`, `--status-blocked`, `--status-conflict`, `--status-waiting`, `--status-advisory`, `--status-neutral`, each with a `-bg` tint |
| Evidence corpora (R6) | `--evidence-patient`, `--evidence-reference` |

- **Accent is for interaction only.** Text that isn't interactive never uses the accent colour.
- **Status is never colour alone.** Every status carries an icon and a word:

| State | Icon | Word | Token |
|---|---|---|---|
| Ready | ✓ check | Ready | `--status-ready` |
| Blocked | ✕ cross | Blocked | `--status-blocked` |
| Conflict | ⇄ arrows | Conflict | `--status-conflict` |
| Waiting on evidence | − dash | Waiting on evidence | `--status-waiting` |
| Advisory | ! mark | Advisory | `--status-advisory` |
| Not evaluated | ○ ring | Not evaluated | `--status-neutral` |

- **Dark mode.** Every token has a dark value. The app follows the system setting, with no in-app toggle (HIG Dark Mode).
- **Contrast.** Text-on-surface pairs reach 4.5:1 or better. Small text aims for 7:1.

## 5. Components

### Buttons (HIG Buttons)
- Three styles, all 32 px: **plain** (text only, for tertiary actions), **bordered** (default) and **prominent** (accent fill).
- **At most one prominent button per view**, placed on the trailing side.
- **Style, not size, marks the preferred choice.**
- Labels start with a verb: "Recompute readiness", "Escalate to treating doctor". A trailing "…" means the button opens another view.
- Every button has hover, press, focus and disabled states.
- Slow actions show an inline spinner and an "-ing" label ("Recomputing…").

### Segmented control (HIG Segmented controls)
- Closely related choices that change one view, with equal-width segments.
- A segmented control either selects or performs actions, never both.
- Noun labels, five segments at most.
- A segmented control with text segments needs no introductory label.

### Pop-up button (HIG Pop-up buttons)
- A flat list of mutually exclusive options, showing the current value (for example the visit date).
- It has a useful default and the same 32 px height as its neighbours.

### Search field (HIG Search fields)
- Search icon at the leading edge, Clear button at the trailing edge, placeholder text that fits ("Search patients").
- It filters as people type and sits at the trailing side of the toolbar.

### Toolbar (HIG Toolbars)
- **Leading edge:** view controls (date, window).
- **Centre:** grouping controls.
- **Trailing edge:** search and the primary action.
- Items don't overflow by default. Below 640 px the toolbar wraps into two rows.

### Page header (HIG Toolbars, Titles)
- Breadcrumb **or** eyebrow, never both.
- One large title, one summary line in callout style, and the as-of clock in footnote style on the trailing side.

### Tables (HIG Lists and tables)
- Column headings are short nouns with no punctuation.
- Clicking a sortable heading sorts the column; clicking again reverses it.
- **Dates stay on one line**: `Mon 5 Oct · 09:30`.
- Names sit above their identifier with `--space-1` between them.
- Rows that open a detail view highlight on hover and keep the selection when people return.
- Wide tables scroll inside their own container. The page never scrolls sideways.

### Status badge
Uses the status set from §4: an icon and a word, caption weight 500, `--radius-pill`, with the tint background.

### Progress and loading (HIG Loading, Progress indicators)
- **Show something immediately.** Skeleton rows appear in the shape of the content.
- **Use staged, determinate progress for long work**, driven by real request phases ("Checking consent → Reading record → Validating citations"). Never fake timers.
- **Keep indicators moving.** If something stalls, explain why and what to do.
- **Offer Cancel** where cancelling is safe.

### Panels and sheets (HIG Modality, Sidebars)
- Use them only when they clearly help.
- Give them a title naming the task, an obvious Close, and Esc to dismiss.
- Never show two at once.
- The copilot is a docked panel on the trailing side, not a modal. The record stays visible beside it.

## 6. Writing

*HIG Writing: "Be clear… be action oriented… build language patterns… write clear error messages." HIG Feedback: show status near the item it describes.*

- **Say it once.** Don't repeat a value in a label and a control.
- **Times in sentences** read naturally: `5 Oct, 09:30`. The exact timestamp is available on hover. Raw ISO strings (`2026-10-04T01:52:56`) never appear in prose.
- **Time zones.** State "Times as recorded; time zone not supplied" once per page in the clock legend, never after every value.
- **Errors** appear next to the problem and say what to do: "The record service didn't respond. Try again." Don't use "we", "oops" or blame.
- **Empty states** name what will appear and offer the next step as a button.
- **Glossary.** Use these terms exactly:

| Term | Meaning |
|---|---|
| Record check | One versioned SQL rule evaluated for a patient (rule ID + version) |
| Blocked | A blocker-severity record check failed |
| Waiting on evidence | A required input hasn't been received (R3: never "negative") |
| Conflict | Two sources disagree. A person must reconcile them. |
| Not evaluated | The check couldn't run on the available evidence. The reason is always shown. |
| Known as of | The snapshot clock an answer or check was computed against (R2) |
| Evidence packet | Facts assembled for the named treating practitioner when a question needs clinical judgement (Class A) |

## 7. Accessibility

*HIG Accessibility: perceivable, adaptable, keyboard-operable.*

- Every interactive element shows a visible focus ring (`--focus-ring`, 2 px accent with a 2 px offset).
- The whole workflow works by keyboard. Esc closes panels. ⌘K / Ctrl+K opens the copilot.
- Icon-only controls carry an `aria-label`.
- `prefers-reduced-motion` turns slides into fades.
- Text can zoom to 200% without clipping: rows stack and tables scroll in place.
- Hit areas are at least 28 px. Inline 24 px actions get padding that brings the target to 28 px.

## 8. Review checklist (run before merging any UI change)

- [ ] Only the text style tokens, with no raw `font-size`
- [ ] Only the spacing, radius and control-height tokens
- [ ] Only semantic colour tokens, with no hex outside `tokens.css`
- [ ] Every control on a row is the same height
- [ ] At most one prominent button in the view
- [ ] Every status shows an icon and a word
- [ ] Dates are on one line, with no ISO strings in prose
- [ ] Checked in light and dark, at 1440 px and 390 px
- [ ] Keyboard path and focus ring work

`npm test` enforces the first three automatically.
