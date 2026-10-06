# SAARTHI — Design System

**The interface is a dated, signed, cited document. Not a dashboard.**

Every token here is either traced to a source or explicitly marked as a judgment call. Sources:
`apple-hig-primary.md` (Apple HIG, fetched live), `clinical-ux-evidence.md` (peer-reviewed + regulator),
`sis-rendering-capabilities.md` (what Streamlit-in-Snowflake can actually render).

Provenance discipline here is the same as the product's: **a claim without a citation is a defect.**
Where a value is derived rather than published, it says so. Where Apple could not be verified, it says so.

---

## 0. Why not a dashboard

The product question is *"what do we have, what's missing, what contradicts what — and how do you know?"*
That is a document with citations, not a set of metrics. The closest well-solved precedent is legal
research tooling (Westlaw/Lexis provenance chains), not business intelligence.

Three findings make the dashboard instinct actively wrong:

| Finding | Source | Consequence |
|---|---|---|
| ~90% override rate for interruptive CDS alerts; top-50 DDI alerts overridden 95.1–99.3% | Phansalkar et al., JAMIA — **confirmed, full text read** | Gate failures must be quiet and specific. A wall of red tiles trains dismissal. |
| "High override rates are partly caused by alerts that do not apply to the individual patient" | van der Sijs systematic review | Every gate shown must carry its rule, its version, and its evidence. Generic alerts get ignored, correctly. |
| 4–8% of Indian males have colour vision deficiency; ~75% red-green | `clinical-ux-evidence.md` §6.2 | Status may **never** be encoded in hue alone. |

Apple's currently published principles (eight, as of 8 June 2026 — **not** the retired
"Clarity, Deference, Depth") include **Agency** and **Responsibility**. Those map exactly onto R1
(the LLM never decides) and the Class A boundary. The design posture — *we present, you decide* —
is Apple's own current language, not a borrowed slogan.

---

## 1. Structure — masthead, body, margin

```
┌─────────────────────────────────────────────────────────────┐
│  MASTHEAD   patient · practitioner · consent · known_as_of  │  who is asking, about whom,
├──────────────────────────────────┬──────────────────────────┤  under what authority, as of when
│  BODY                            │  MARGIN                  │
│  claims, one per block,          │  evidence for the        │
│  68ch measure                    │  selected claim          │
│                                  │  (persistent, not modal) │
└──────────────────────────────────┴──────────────────────────┘
```

**The margin is persistent, never a modal.** Provenance verification requires seeing the claim and its
source *simultaneously* — a modal that covers the claim defeats the purpose (`clinical-ux-evidence.md` §4.3).
This is the single most important layout decision on the centrepiece screen.

**Measure: 68 characters.** Judgment call, standard typographic practice (45–75ch); not an Apple number.

---

## 2. Type

**Typeface: Inter.** SF Pro is *not* licensed for web redistribution — "Apple typography" here means
Apple's *scale and restraint*, not Apple's font. Inter is the defensible substitute: designed for UI,
and it has true tabular figures.

**Scale — derived from Apple's published macOS text styles** (`apple-hig-primary.md` §2.4), converted
at 1pt = 4/3 px (96 dpi). macOS is the right basis: this is a workstation tool, not a phone app.
Body lands on 17px, which coincides with Apple's iOS Body of 17pt — a useful cross-check.

| Role | macOS source | px / line-height | Weight | Used for |
|---|---|---|---|---|
| `display` | Large Title 26/32 | 34 / 42 | 400 | Screen title only |
| `title` | Title 1 22/26 | 29 / 35 | 500 | Section head |
| `heading` | Title 2 17/22 | 23 / 29 | 500 | Claim group |
| `subheading` | Title 3 15/20 | 20 / 27 | 500 | Evidence panel head |
| `strong` | Headline 13/16 | 17 / 22 | 600 | Claim lead-in |
| `body` | Body 13/16 | 17 / 22 | 400 | **Claim text** |
| `callout` | Callout 12/15 | 16 / 20 | 400 | Action lines |
| `label` | Subheadline 11/14 | 15 / 19 | 500 | Field labels |
| `meta` | Footnote 10/13 | 13 / 17 | 400 | rule_id, timestamps, provenance |

**Minimum 13px.** Apple's macOS floor is 10pt = 13.3px (`apple-hig-primary.md` §2.2). Nothing goes smaller.

**Must support 200% text enlargement** (Apple, verified). All sizing in `rem`; no fixed-height text containers.

### Tabular numerals — non-negotiable

```css
font-variant-numeric: tabular-nums;
font-feature-settings: "tnum" 1;
```

Applied to **every** lab value, count, date and timestamp. Two reasons, both real:

1. Values in a column must align on the digit, or comparison requires effort.
2. When the `known_as_of` control moves, numbers change in place. With proportional figures the text
   *jitters* horizontally; with tabular figures it does not. The time-travel demo (beat 6) looks
   precise instead of twitchy.

This single property is the clearest visual signal that a numeric interface was built by someone who cared.

---

## 3. Status vocabulary — glyph + word + shape, never hue

**WCAG 2.2 SC 1.4.1 (Use of Colour)** forbids colour as the only carrier of meaning. With 4–8% of
Indian males red-green deficient, the current `🟢🔴🟠⚪` gate strip is unreadable for them — and
those four emoji are *identical in greyscale*.

Every status renders three redundant signals: a **glyph**, a **word**, and a **container shape**.

### The 4 gate outcomes

| Enum | Glyph | Word | Container | Ink | Intent |
|---|---|---|---|---|---|
| `pass` | `✓` | Pass | solid hairline, square | `ink-pass` | satisfied |
| `fail` | `✕` | Fail | solid 2px, square | `ink-fail` | act on this |
| `not_evaluated` | `–` | Not evaluated | **dashed** hairline | `ink-muted` | **we do not know** |
| `conflicting` | `⇄` | Conflicting | **doubled** hairline | `ink-conflict` | a human must reconcile |

Two deliberate choices:

- **`not_evaluated` is visually quiet.** It is not a failure. *"A missing lab does not mean ANC is low —
  it means we do not know. That distinction changes the action"* (SPEC.md §8). Styling it as a warning
  destroys the distinction R3 exists to protect. The **dashed** border is the carrier: an incomplete
  outline reads as an incomplete record, in any colour, in greyscale.
- **`conflicting` gets a doubled border** — two lines for two disagreeing sources. It is not a failed
  rule; it is two facts that cannot both be true.

### The 7 missingness states (R3)

Rendered as a text badge, never a colour chip. `present` · `explicitly_negative` · `pending` ·
`not_received` · `conflicting` · `unreadable` · `superseded`.

**`not_received` and `explicitly_negative` must never share a treatment.** *"Not received is never
negative."* A preliminary report is not a negative finding — conflating them is a clinical error the
UI is capable of causing.

### The 4 verification statuses (R7)

`verified` · `single_pass` · `conflicting` · `unverified` — as a word. **Never a percentage, ever**
(AGENTS.md §5). The evidence base supports this: Gigerenzer's work shows single-event probabilities are
systematically misread, and a percentage invites a clinical decision where an evidence state invites a
human to look (`clinical-ux-evidence.md` §3).

### Severity

`blocker` vs `advisory` — carried by *weight and position*, not colour. Blockers sort first and take
the heavier rule. `ENDO-HBA1C-001` is advisory and **must never** render as a blocker.

---

## 4. Colour — carries category, not status

Since status is glyph-borne, colour is freed for the job it is actually needed for: **separating
patient evidence from reference evidence (R6)**.

> *"a guideline clause rendered in the same panel style as a pathology page invites reading it as a
> finding about the patient"* — COPILOT-SPEC §2

Ratios below were **computed, not estimated**, against both surfaces. My first draft of this
table was wrong on eight of nine values and shipped one outright failure — recorded here rather
than quietly corrected, per `AGENTS.md` §4.

| Token | Value | on `#FFFFFF` | on `#F6F7F8` | Role |
|---|---|---|---|---|
| `ink` | `#1A1D21` | 16.91 | 15.77 | primary text |
| `ink-secondary` | `#4A5157` | 8.06 | 7.51 | supporting text |
| `ink-muted` | `#656C73` | 5.32 | 4.96 | meta, `not_evaluated` |
| `ink-pass` | `#1E6B3A` | 6.52 | 6.08 | pass |
| `ink-fail` | `#A8261C` | 7.10 | 6.62 | fail |
| `ink-conflict` | `#8A5300` | 6.33 | 5.90 | conflicting |
| `surface` | `#FFFFFF` | — | — | page |
| `surface-sunken` | `#F6F7F8` | — | — | evidence margin |
| `rule` | `#D8DCDF` | 1.38 | 1.29 | hairline — **decorative only** |
| `patient-edge` | `#1A5C8A` | 7.14 | 6.66 | left edge, **patient** evidence |
| `reference-edge` | `#5B4B8A` | 7.45 | 6.95 | left edge, **reference** evidence |

Every text token clears 4.5:1 **on both surfaces** — `ink-muted` was darkened from `#6B737A`
because it measured 4.49 on the sunken evidence surface, i.e. it failed exactly where it is used most.

### The border question, resolved honestly

`rule` at 1.38:1 is nowhere near the 3:1 that WCAG 2.2 SC 1.4.11 requires of UI components. That is
fine **only** because it is purely decorative — it separates claims and carries no meaning, and 1.4.11
exempts decoration.

The dashed and doubled borders are a different matter: they *are* the greyscale-safe carrier of status,
so they are meaning and 1.4.11 applies. Rather than darken grey until it complied, **status borders reuse
the status inks** — `ink-pass`, `ink-fail`, `ink-muted`, `ink-conflict`, all ≥ 4.96:1. Comfortably compliant,
and visually better: the border and the glyph agree.

Apple's 4.5:1 / 3:1 minimums verified at `apple-hig-primary.md` §1; WCAG 2.2 AA at
`clinical-ux-evidence.md` §6.1.

**Patient vs reference is carried by more than colour**: a 3px left edge *plus* a different surface
tint *plus* an explicit label (`Patient record` / `Reference`). Colour is the third signal, not the first.

### The greyscale audit

`design.py` exposes a `greyscale` flag that desaturates the entire app. **Every status must remain
readable with it on.** If it does not, the design is broken — not the user's eyes. Run it before any demo.

---

## 5. Spacing and rhythm

4px base unit, geometric: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`. Judgment call, not an Apple number
(Apple publishes iOS margins as assets, not text — `apple-hig-primary.md` notes this as unverified).

- Claim block: `24px` internal, `16px` between blocks
- Hairline rules separate claims. **No card shadows.** Shadow implies elevation, which implies
  interactivity; a claim is text, not a button.
- Touch targets **≥ 44×44px** where tapped, 28px minimum for pointer-only controls (Apple, verified).

---

## 6. Motion

Budget: **one transition, 120ms, ease-out** — the evidence margin updating when a claim is selected.
Nothing else animates. No skeleton shimmer, no count-up numbers, no fade-in cascade.

Apple's specific easing curves and durations are delivered as framework APIs, **not** as HIG text
(`apple-hig-primary.md` — explicitly flagged unverified). So 120ms/ease-out is my judgment, chosen to
sit below the ~150ms threshold at which a change reads as instant rather than animated.

A count-up animation on a lab value would be actively unsafe: it renders numbers that were never true.

---

## 7. Copy rules

These are product requirements, not style preferences. Each is enforced somewhere in code.

1. **No confidence percentages.** Report the observed evidence state.
2. **`derived` is mandatory when a value was computed.** *"Presenting a computed value as if it were
   printed is a subtle form of fabrication."* The derivation shows the arithmetic and says the number
   does not appear on the page.
3. **"Nothing found" always carries the timestamp** — *"Nothing found as of 18 Sep 09:00"*. Never a bare
   "No results".
4. **Error asymmetry survives into copy.** `no_patient_access` reveals nothing — not even whether the
   patient exists. `access_withdrawn` reveals the record exists, because that user previously had
   legitimate access. **Do not collapse them into one friendly message.**
5. **Every rule citation shows `rule_id` *and* `rule_version`.**
6. **`provenance_note` is shown wherever a threshold is practice consensus** rather than a guideline
   requirement. Three thresholds in this system are consensus and must be labelled.
7. **The standing deferral** closes every readiness answer: *"Gate outcomes are produced by versioned
   SQL rules over the record as it stands. Your treating team decides whether treatment proceeds."*

---

## 8. The hero interaction — the derivation trace

The highest-value three seconds in the product (demo beat 2).

A clinician clicks `ANC 2100`. It expands in place:

```
  ANC 2100 cells/µL                                    ✓ verified
  ─────────────────────────────────────────────────────────────
  Derived, not printed.

      WBC 6,000 /CUMM  ×  ( neutrophils 35% + bands 0% )
      ────────────────────────────────────────────────  =  2100
                            100

  This number appears nowhere on the source page.
  CLINICAL_EVENT · CE-LAB-441 · Facility FAC-002
  event 16 Sep 08:30 · recorded 16 Sep 16:45 · ingested 16 Sep 17:02
```

Three things a judge sees at once: the system computed a clinical value the lab never printed; it shows
its arithmetic; and it carries all three R2 clocks. This currently renders as a grey `st.info` box, which
is why it reads as nothing.

---

## 9. Constraints and open risks

| Item | Status |
|---|---|
| SF Pro on web | **Not licensed.** Using Inter. Do not claim SF Pro anywhere. |
| Apple corner radii, easing, hex values | **Unverified** — delivered as assets/APIs, not HIG text. Ours are derived; labelled as such. |
| SiS runtime Streamlit version | **Unknown.** Local is 1.64.0. Needs a deploy probe before depending on recent APIs. Fallbacks documented per component. |
| Indian-script clinical typography | **Thin evidence base.** Devanagari/Tamil/Bengali need greater line-height than Latin; working from W3C drafts, not clinical research. Say so in the submission. |
| `char_start`/`char_end` highlighting | Requires assertion offsets, which the extraction task does **not** currently populate. Design assumes them; the pipeline must fill them or the highlight degrades to page-level. |
