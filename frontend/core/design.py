"""Design tokens and the single CSS injection point.

Spec: planning/research/design/DESIGN-SYSTEM.md. Read it before changing a value here;
every token in it is either traced to a source or marked as a judgment call.

WHY THIS MODULE EXISTS
    One place decides what things look like. Pages compose semantics, never style.
    A page that writes its own CSS is a defect: it is how a design system rots into
    five slightly different greys.

THE RULE THAT MATTERS MOST
    Status is carried by a GLYPH, a WORD and a BORDER STYLE — never by hue alone.
    WCAG 2.2 SC 1.4.1 forbids colour as the sole carrier of meaning, and 4-8% of
    Indian males are red-green colour deficient (clinical-ux-evidence.md 6.2). The
    emoji circles this replaces were identical in greyscale.

    `greyscale_audit=True` desaturates the whole app. Every status must stay readable
    with it on. Run it before any demo; if something becomes unreadable, the design is
    broken, not the user's eyes.

CONTRAST
    Every ratio below was computed, not estimated, against both surfaces. Text clears
    4.5:1 on white AND on the sunken evidence surface. Status borders reuse the status
    inks (all >= 4.96:1), which is why the decorative hairline is allowed to stay light:
    it carries no meaning, and WCAG 1.4.11 exempts purely decorative elements.
"""

from __future__ import annotations

from dataclasses import dataclass

# ---------------------------------------------------------------------------
# Colour. Ratios are (on #FFFFFF, on #F6F7F8), computed.
# ---------------------------------------------------------------------------

INK = "#1A1D21"              # 16.91 / 15.77  primary text
INK_SECONDARY = "#4A5157"    #  8.06 /  7.51  supporting text
INK_MUTED = "#656C73"        #  5.32 /  4.96  meta, and `not_evaluated`
INK_PASS = "#1E6B3A"         #  6.52 /  6.08
INK_FAIL = "#A8261C"         #  7.10 /  6.62
INK_CONFLICT = "#8A5300"     #  6.33 /  5.90

SURFACE = "#FFFFFF"
SURFACE_SUNKEN = "#F6F7F8"   # evidence margin

RULE = "#D8DCDF"             # 1.38 — DECORATIVE ONLY. Never carries meaning.
PATIENT_EDGE = "#1A5C8A"     #  7.14 /  6.66  left edge, patient evidence  (R6)
REFERENCE_EDGE = "#5B4B8A"   #  7.45 /  6.95  left edge, reference evidence (R6)

# ---------------------------------------------------------------------------
# Type. Derived from Apple's published macOS text styles at 1pt = 4/3 px (96dpi).
# apple-hig-primary.md 2.4. macOS is the right basis: this is a workstation tool.
# Body lands on 17px, which coincides with Apple's iOS Body 17pt.
# Floor is 13px = Apple's macOS 10pt minimum.
# ---------------------------------------------------------------------------

TYPE = {
    "display":    ("34px", "42px", "400"),  # macOS Large Title 26/32
    "title":      ("29px", "35px", "500"),  # Title 1  22/26
    "heading":    ("23px", "29px", "500"),  # Title 2  17/22
    "subheading": ("20px", "27px", "500"),  # Title 3  15/20
    "strong":     ("17px", "22px", "600"),  # Headline 13/16
    "body":       ("17px", "22px", "400"),  # Body     13/16
    "callout":    ("16px", "20px", "400"),  # Callout  12/15
    "label":      ("15px", "19px", "500"),  # Subhead  11/14
    "meta":       ("13px", "17px", "400"),  # Footnote 10/13
}

SPACE = {"xs": "4px", "sm": "8px", "md": "12px", "lg": "16px",
         "xl": "24px", "xxl": "32px", "xxxl": "48px"}

MEASURE = "68ch"   # judgment call; standard 45-75ch practice, not an Apple number
MOTION = "120ms cubic-bezier(0.32, 0.72, 0, 1)"  # one transition, ease-out


@dataclass(frozen=True)
class StatusStyle:
    """How one outcome renders. Three redundant signals, so colour is never load-bearing."""

    glyph: str
    word: str
    ink: str
    border: str      # CSS border shorthand — the greyscale-safe carrier
    weight: str


# The four gate outcomes. Border style is what survives greyscale:
#   solid    = a rule was evaluated and satisfied
#   2px      = a rule was evaluated and failed
#   dashed   = incomplete outline for an incomplete record -> we do not know
#   double   = two lines for two disagreeing sources
STATUS: dict[str, StatusStyle] = {
    "pass": StatusStyle("\u2713", "Pass", INK_PASS, f"1px solid {INK_PASS}", "500"),
    "fail": StatusStyle("\u2715", "Fail", INK_FAIL, f"2px solid {INK_FAIL}", "600"),
    # Deliberately quiet. not_evaluated is NOT a failure: "a missing lab does not mean
    # ANC is low, it means we do not know" (SPEC.md 8). Styling it as a warning would
    # destroy the distinction R3 exists to protect.
    "not_evaluated": StatusStyle("\u2013", "Not evaluated", INK_MUTED, f"1px dashed {INK_MUTED}", "400"),
    "conflicting": StatusStyle("\u21c4", "Conflicting", INK_CONFLICT, f"3px double {INK_CONFLICT}", "500"),
}

# R7 verification. Words, never percentages (AGENTS.md 5). A percentage invites a
# clinical decision; an evidence state invites a human to look.
VERIFICATION_WORD = {
    "verified": "verified",
    "single_pass": "one read only",
    "conflicting": "two reads disagree",
    "unverified": "unverified",
}

# R3 missingness. `not_received` and `explicitly_negative` must never share a
# treatment - conflating them is a clinical error the UI is capable of causing.
MISSINGNESS_WORD = {
    "present": "present",
    "explicitly_negative": "explicitly negative",
    "pending": "pending",
    "not_received": "not received",
    "conflicting": "conflicting",
    "unreadable": "unreadable",
    "superseded": "superseded",
}


def status_style(outcome: str) -> StatusStyle:
    """Look up an outcome. Raises on unknown values - never silently defaults to pass."""
    try:
        return STATUS[outcome]
    except KeyError:
        raise ValueError(f"unknown outcome {outcome!r} - never default to pass") from None


def stylesheet(*, greyscale_audit: bool = False) -> str:
    """The whole stylesheet. One <style> block, injected once per page."""
    body_size, body_lh, body_w = TYPE["body"]
    meta_size, meta_lh, _ = TYPE["meta"]

    # Applied at the app root so nothing can escape it. `section.main` does not exist in
    # current Streamlit - an earlier version of this selector silently did nothing, which
    # is the worst failure mode for an accessibility check: it reports success by default.
    audit = (
        '[data-testid="stAppViewContainer"], [data-testid="stSidebar"] '
        "{ filter: grayscale(1) !important; }"
        if greyscale_audit else ""
    )

    return f"""
<style>
/* ---- reset Streamlit's chrome ------------------------------------------- */
#MainMenu, footer, header [data-testid="stStatusWidget"] {{ visibility: hidden; }}
/* Top padding must clear the fixed toolbar, or the masthead - the line carrying
   consent and known_as_of - renders underneath it and is unreadable. */
.block-container {{ padding-top: 5rem; max-width: 1180px; }}

/* ---- type -------------------------------------------------------------- */
/* Deliberately NOT [class*="st-"]: that selector also matches Streamlit's icon
   spans, which overrides the Material Symbols font and renders ligature NAMES as
   literal text ("keyboard_double_arrow_right" in the sidebar). Target the app
   container and the text containers, and let inheritance do the rest. */
html, body, .stApp, .stMarkdown, [data-testid="stMarkdownContainer"],
[data-testid="stWidgetLabel"], .stRadio, .stButton, .stTextInput {{
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: {INK};
    -webkit-font-smoothing: antialiased;
}}
html, body, .stMarkdown, [data-testid="stMarkdownContainer"] {{
    font-size: {body_size};
    line-height: {body_lh};
    font-weight: {body_w};
}}

/* Icon fonts are never overridden. Restoring these explicitly rather than only
   avoiding them, so a future broad selector cannot silently break them again. */
[data-testid="stIconMaterial"], .material-icons, .material-symbols-rounded,
span[class*="material-symbols"], span[class*="material-icons"] {{
    font-family: "Material Symbols Rounded", "Material Icons" !important;
}}

/* Tabular figures on every number. Two reasons: values align on the digit for
   comparison, and when known_as_of moves the digits change IN PLACE instead of
   jittering horizontally. This is why the time-travel demo reads as precise. */
.sa-num, .sa-value, .sa-ts, .sa-meta {{
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum" 1;
}}

.sa-measure {{ max-width: {MEASURE}; }}

/* ---- masthead: who is asking, about whom, under what authority, as of when -- */
.sa-masthead {{
    border-bottom: 1px solid {RULE};
    padding-bottom: {SPACE['md']};
    margin-bottom: {SPACE['xl']};
    display: flex; flex-wrap: wrap; gap: {SPACE['xl']}; align-items: baseline;
}}
.sa-masthead-patient {{ font-size: {TYPE['heading'][0]}; line-height: {TYPE['heading'][1]};
                        font-weight: 500; letter-spacing: -0.01em; }}
.sa-field {{ display: flex; flex-direction: column; gap: 2px; }}
.sa-field-label {{ font-size: {meta_size}; line-height: {meta_lh}; color: {INK_MUTED};
                   text-transform: uppercase; letter-spacing: 0.06em; }}
.sa-field-value {{ font-size: {TYPE['label'][0]}; line-height: {TYPE['label'][1]};
                   color: {INK_SECONDARY}; font-variant-numeric: tabular-nums; }}

/* ---- claim: text, not a card. No shadow - shadow implies a button. ------- */
.sa-claim {{
    border-top: 1px solid {RULE};
    padding: {SPACE['xl']} 0 {SPACE['lg']} 0;
}}
.sa-claim:first-of-type {{ border-top: none; }}
.sa-claim-text {{ font-size: {body_size}; line-height: {body_lh};
                  max-width: {MEASURE}; margin-bottom: {SPACE['md']}; }}

/* ---- status chip: glyph + word + border style --------------------------- */
.sa-status {{
    display: inline-flex; align-items: center; gap: {SPACE['sm']};
    padding: 3px {SPACE['md']}; border-radius: 4px;
    font-size: {TYPE['label'][0]}; line-height: {TYPE['label'][1]};
    white-space: nowrap;
}}
.sa-status-glyph {{ font-size: 15px; line-height: 1; }}

/* ---- meta line: rule id, version, provenance --------------------------- */
.sa-meta {{ font-size: {meta_size}; line-height: {meta_lh}; color: {INK_MUTED}; }}
.sa-meta code {{ font-family: "JetBrains Mono", ui-monospace, monospace;
                 font-size: 12px; color: {INK_MUTED}; }}

/* provenance_note is shown wherever a threshold is practice consensus rather
   than a guideline requirement. Three thresholds here are consensus. */
.sa-provenance {{ font-size: {meta_size}; line-height: {meta_lh};
                  color: {INK_SECONDARY}; font-style: italic; }}

/* ---- action: what to do, addressed to someone -------------------------- */
.sa-action {{
    font-size: {TYPE['callout'][0]}; line-height: {TYPE['callout'][1]};
    border-left: 2px solid {INK_MUTED};
    padding-left: {SPACE['md']}; margin-top: {SPACE['md']};
    max-width: {MEASURE}; color: {INK_SECONDARY};
}}

/* ---- evidence margin: persistent, never a modal ------------------------ */
/* Provenance verification needs claim and source visible SIMULTANEOUSLY; a modal
   that covers the claim defeats the purpose (clinical-ux-evidence.md 4.3). */
.sa-evidence {{
    background: {SURFACE_SUNKEN};
    padding: {SPACE['lg']};
    border-radius: 6px;
    transition: background {MOTION};
}}
/* R6: patient evidence and reference evidence must never look alike -
   "a guideline clause in the same panel style as a pathology page invites
   reading it as a finding about the patient" (COPILOT-SPEC 2). Three signals:
   left edge colour, surface tint, and an explicit word. */
.sa-ev-patient   {{ border-left: 3px solid {PATIENT_EDGE}; }}
.sa-ev-reference {{ border-left: 3px solid {REFERENCE_EDGE}; background: #FAF9FC; }}
.sa-ev-kind {{
    font-size: {meta_size}; line-height: {meta_lh};
    text-transform: uppercase; letter-spacing: 0.06em;
    margin-bottom: {SPACE['sm']};
}}
.sa-ev-patient .sa-ev-kind   {{ color: {PATIENT_EDGE}; }}
.sa-ev-reference .sa-ev-kind {{ color: {REFERENCE_EDGE}; }}
.sa-ev-id {{ font-family: "JetBrains Mono", ui-monospace, monospace;
             font-size: 12px; color: {INK_SECONDARY}; }}

/* ---- the three R2 clocks, always all three ----------------------------- */
.sa-clocks {{ display: flex; flex-wrap: wrap; gap: {SPACE['lg']}; margin-top: {SPACE['md']}; }}
.sa-clock-label {{ font-size: 11px; color: {INK_MUTED};
                   text-transform: uppercase; letter-spacing: 0.06em; }}
.sa-clock-value {{ font-size: {meta_size}; color: {INK_SECONDARY};
                   font-variant-numeric: tabular-nums; }}

/* ---- derivation trace: the hero moment (demo beat 2) ------------------- */
/* A computed value presented as if printed is a quiet form of fabrication, so the
   arithmetic is shown and the page is explicitly disclaimed. */
.sa-derivation {{
    background: {SURFACE}; border: 1px solid {RULE}; border-radius: 6px;
    padding: {SPACE['lg']}; margin-top: {SPACE['md']};
}}
.sa-derivation-lead {{ font-size: {TYPE['label'][0]}; font-weight: 600;
                       color: {INK}; margin-bottom: {SPACE['md']}; }}
.sa-formula {{
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 14px; line-height: 24px; color: {INK};
    font-variant-numeric: tabular-nums;
    background: {SURFACE_SUNKEN}; border-radius: 4px;
    padding: {SPACE['md']};
    /* pre-wrap, not pre: in the evidence margin `pre` clipped the equation
       mid-expression ("WBC x (neutrophil% +"), truncating the single most
       important string in the product. It must wrap, never scroll away. */
    white-space: pre-wrap; overflow-wrap: anywhere;
}}
.sa-derivation-note {{ font-size: {meta_size}; color: {INK_SECONDARY};
                       margin-top: {SPACE['md']}; }}

/* ---- Class A refusal: a formal addressed notice, not a yellow warning --- */
/* NMC TPG 2020 is a legal boundary. It should read like a referral, because that
   is what it is: this question belongs to a named registered practitioner. */
.sa-refusal {{
    border: 1px solid {INK_SECONDARY}; border-top: 3px solid {INK};
    border-radius: 2px; padding: {SPACE['xl']}; max-width: {MEASURE};
}}
.sa-refusal-kind {{ font-size: {meta_size}; text-transform: uppercase;
                    letter-spacing: 0.08em; color: {INK_MUTED};
                    margin-bottom: {SPACE['md']}; }}
.sa-refusal-message {{ font-size: {TYPE['subheading'][0]};
                       line-height: {TYPE['subheading'][1]}; margin-bottom: {SPACE['lg']}; }}
.sa-refusal-addressee {{ border-top: 1px solid {RULE}; padding-top: {SPACE['md']};
                         font-size: {TYPE['label'][0]}; }}

/* ---- limitations: first-class, not a caption --------------------------- */
/* What the system could NOT establish is the most credible thing on the screen.
   Burying it in grey 12px would be the dishonest choice. */
.sa-limitation {{
    border-left: 2px dashed {INK_MUTED};
    padding: {SPACE['sm']} 0 {SPACE['sm']} {SPACE['md']};
    font-size: {TYPE['callout'][0]}; line-height: {TYPE['callout'][1]};
    color: {INK_SECONDARY}; max-width: {MEASURE}; margin-bottom: {SPACE['sm']};
}}

/* ---- gate strip (Patient 360) ----------------------------------------- */
.sa-gate-row {{
    display: flex; align-items: baseline; gap: {SPACE['lg']};
    padding: {SPACE['md']} 0; border-bottom: 1px solid {RULE};
}}
.sa-gate-name {{ font-size: {TYPE['strong'][0]}; font-weight: 600;
                 min-width: 140px; letter-spacing: -0.01em; }}

/* ---- source text with the cited span highlighted ---------------------- */
.sa-page-text {{
    font-family: "JetBrains Mono", ui-monospace, monospace;
    /* `pre`, not `pre-wrap`: a lab report is a COLUMNAR document. Wrapping it breaks
       the alignment between analyte, value, unit and reference range - which is exactly
       where the Indian-format traps live (GM%, /CUMM, lakh commas). Scroll sideways
       rather than reflow a clinical document into something it never was. */
    font-size: 13px; line-height: 21px; white-space: pre; overflow-x: auto;
    background: {SURFACE}; border: 1px solid {RULE}; border-radius: 4px;
    padding: {SPACE['lg']}; max-height: 420px; overflow-y: auto;
    color: {INK_SECONDARY};
}}
/* The cited range. Underline + weight carry it, so the highlight is not
   colour-dependent - it survives greyscale and print. */
.sa-page-text mark {{
    background: #FFF3C4; color: {INK}; font-weight: 600;
    border-bottom: 2px solid {INK_CONFLICT};
    padding: 1px 0; border-radius: 2px;
}}

/* ---- focus: visible, never removed ------------------------------------ */
:focus-visible {{ outline: 2px solid {PATIENT_EDGE}; outline-offset: 2px; }}

/* ---- day-care census: the coordinator's home screen -------------------- */
/* Urgency is position (sorted blocked-first) and chip shape. Rows are text on
   hairlines, not cards - eleven boxed cards would be the clutter anti-pattern. */
.sa-census-head {{ display: flex; flex-wrap: wrap; align-items: baseline;
                   gap: {SPACE['lg']}; margin-bottom: {SPACE['md']}; }}
.sa-census-day {{ font-size: {TYPE['subheading'][0]}; line-height: {TYPE['subheading'][1]};
                  font-weight: 500; letter-spacing: -0.01em; }}
.sa-census-counts {{ display: flex; flex-wrap: wrap; gap: {SPACE['lg']};
                     font-size: {TYPE['label'][0]}; color: {INK_SECONDARY}; }}
.sa-census-count b {{ color: {INK}; font-weight: 600; }}
.sa-census-row {{ display: grid; grid-template-columns: minmax(180px, 2fr) minmax(0, 3fr);
                  gap: {SPACE['lg']}; align-items: start; }}
.sa-census-name {{ font-size: {TYPE['strong'][0]}; font-weight: 600; letter-spacing: -0.01em; }}
.sa-census-state {{ display: flex; flex-direction: column; gap: {SPACE['xs']};
                    align-items: flex-start; }}
.sa-census-reason {{ font-size: {TYPE['callout'][0]}; line-height: {TYPE['callout'][1]};
                     color: {INK_SECONDARY}; max-width: {MEASURE}; }}
.sa-census-reason code {{ font-family: "JetBrains Mono", ui-monospace, monospace;
                          font-size: 12px; color: {INK_MUTED}; }}
@media (max-width: 640px) {{ .sa-census-row {{ grid-template-columns: 1fr; }} }}

/* ---- family checklist (Navigator View) --------------------------------- */
.sa-check-item {{ display: flex; gap: {SPACE['md']}; padding: {SPACE['md']} 0;
                  border-top: 1px solid {RULE}; }}
.sa-check-n {{ flex: 0 0 24px; height: 24px; border-radius: 12px; text-align: center;
               line-height: 24px; font-size: 13px; font-weight: 600;
               border: 1px solid {INK_SECONDARY}; color: {INK_SECONDARY}; }}
.sa-check-text {{ font-size: {body_size}; line-height: {body_lh}; max-width: {MEASURE}; }}

/* ---- Streamlit's own chrome, restyled to the same system --------------- *
 * Everything above styles the sa-* HTML islands this app writes itself.
 * Without this block those islands sit inside stock Streamlit widgets —
 * default chat bubbles, default buttons, default sidebar — which is exactly
 * what makes a deliberately-designed panel look pasted onto a generic app.
 * Streamlit ships no CSS classes for these, only data-testid hooks, which is
 * why every rule below is a data-testid selector rather than a sa-* class. */

/* Chat messages: no avatar circle, no bubble fill. A hairline between turns
   and left/right alignment carry the distinction instead - consistent with
   "text, not a card. No shadow - shadow implies a button" for claims above. */
[data-testid="stChatMessage"] {{
    background: transparent; border: none; box-shadow: none;
    padding: {SPACE['lg']} 0; border-bottom: 1px solid {RULE};
    gap: {SPACE['md']};
}}
[data-testid="stChatMessage"]:first-of-type {{ padding-top: 0; }}
[data-testid="stChatMessageAvatarUser"],
[data-testid="stChatMessageAvatarAssistant"] {{
    background: {SURFACE_SUNKEN} !important; color: {INK_SECONDARY} !important;
    border: 1px solid {RULE};
}}
.sa-chat-avatar {{
    width: 34px; height: 34px; flex: 0 0 34px;
    display: grid; place-items: center;
    border: 1px solid {RULE}; border-radius: 4px;
    background: {SURFACE_SUNKEN}; color: {INK_SECONDARY};
    font-family: "Material Symbols Rounded";
    font-size: 20px; font-weight: 400; line-height: 1;
    font-feature-settings: "liga";
    -webkit-font-smoothing: antialiased;
}}

/* Chat input: match the measure and type scale, replace the default heavy
   pill border with the same hairline the rest of the app uses. */
[data-testid="stChatInput"] {{
    border: 1px solid {RULE}; border-radius: 8px; box-shadow: none;
    font-size: {body_size};
}}
[data-testid="stChatInput"]:focus-within {{
    border-color: {PATIENT_EDGE}; box-shadow: none;
}}

/* Buttons: one flat, quiet treatment everywhere - suggested-question chips,
   evidence-card selection, and gate actions all reuse this, so a button never
   competes visually with the claim or evidence text next to it. */
.stButton>button {{
    background: {SURFACE}; color: {INK}; border: 1px solid {RULE};
    border-radius: 6px; font-weight: 500; box-shadow: none;
    transition: border-color {MOTION}, background {MOTION};
}}
.stButton>button:hover {{
    border-color: {PATIENT_EDGE}; background: {SURFACE_SUNKEN}; color: {INK};
}}
.stButton>button:focus-visible {{ outline: 2px solid {PATIENT_EDGE}; outline-offset: 2px; }}
/* The single primary action per screen (bind, submit) - filled, everything
   else stays flat so it doesn't compete with it. */
.stButton>button[kind="primary"] {{
    background: {INK}; color: {SURFACE}; border-color: {INK};
}}
.stButton>button[kind="primary"]:hover {{ background: {INK_SECONDARY}; border-color: {INK_SECONDARY}; }}

/* Popover (patient picker) and expander ("Assistant's reasoning"): same card
   language as .sa-evidence - border, radius, no shadow - so they read as the
   same product instead of a browser form control next to a designed card. */
[data-testid="stPopoverBody"] {{
    border: 1px solid {RULE}; border-radius: 6px; box-shadow: none;
    padding: {SPACE['lg']};
}}
[data-testid="stExpander"] {{
    border: 1px solid {RULE}; border-radius: 6px; background: {SURFACE};
}}
[data-testid="stExpander"] summary {{
    font-size: {TYPE['label'][0]}; font-weight: 500; color: {INK_SECONDARY};
}}

/* Sidebar: the demo controls (greyscale audit, connection status, clear
   conversation) get the same type scale and spacing as the main surface. */
[data-testid="stSidebar"] {{
    background: {SURFACE_SUNKEN}; border-right: 1px solid {RULE};
}}
[data-testid="stSidebar"] [data-testid="stMarkdownContainer"] {{
    font-size: {meta_size}; color: {INK_SECONDARY};
}}

{audit}
</style>
"""


def status_chip(outcome: str) -> str:
    """Status as glyph + word + border. Readable in greyscale, by design."""
    s = status_style(outcome)
    return (
        f'<span class="sa-status" style="color:{s.ink};border:{s.border};'
        f'font-weight:{s.weight}">'
        f'<span class="sa-status-glyph" aria-hidden="true">{s.glyph}</span>{s.word}</span>'
    )
