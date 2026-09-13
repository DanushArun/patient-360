# Study 01 — How clinicians actually read a record, and what "industry standard in India" means

**Why this study exists.** Mapping the oncology department surfaced a gap: `plan.md` specified what a
screen must be *correct* about and never specified what it must be *readable* as. That is a category
miss, not a detail — and the rule is that a miss gets studied before it gets patched.

**The diagnosis.** The plan was built from one model only: evidence integrity (what is true, what is
cited, what supersedes what, what is missing). That is a **correctness model**. It is necessary and it
is not sufficient, because the consumer of the output is a human with 2–5 minutes and a queue outside
the door. A screen can be 100% correct and still fail, and it fails in the identical way a wrong screen
fails: the clinician abandons it and goes back to the paper folder. Correctness is a property of the
system. Usability is a property of the *encounter*. We modelled only the first.

---

## Part 1 — What the research says about clinical reading

### 1.1 The hunting tax is the real cost, and it is measurable
In a high-fidelity ICU simulation, critical care pharmacists reviewing three charts viewed **25.5 total
and 15.1 unique EHR screens per case**, with most time on medication screens, then notes, labs, vitals
(eye-tracking study, ICU pharmacists). Fifteen distinct screens to assemble one picture of one patient.

That number is the benchmark to beat. Every screen switch is navigation effort that produces no clinical
value — and it is separable from thinking effort, which brings us to the most useful distinction found:

### 1.2 Germane vs extraneous load — the distinction that tells us what to optimise
A structural-equation study of **564 physicians** separated two effects:
- **Data usability ↑ → germane load ↑** — better data makes clinicians engage *more* deeply with
  meaningful information. Germane load is the good kind; it is thinking about the patient.
- **System usability ↑ → extraneous load ↓** — interface design aligned to workflow reduces
  *navigation* effort. Extraneous load is the bad kind; it is hunting, scrolling, and switching.

Information overload partially mediates both.

**What this settles for us:** our target is not "less information on screen." It is **extraneous load →
0, germane load preserved.** Those are opposite moves and conflating them is how summary screens become
dangerous. Which is the next finding, and it is the one that changes a design assumption.

### 1.3 Information *underload* is a named safety hazard — over-summarising is not a win
A human-factors analysis of primary care named **five** hazards, not one:

| Hazard | What it is |
|---|---|
| Information **overload** | too much to review, organise, synthesise |
| Information **underload** | the relevant thing isn't there / was filtered out |
| Information **scatter** | the picture exists but is spread across locations |
| Information **conflict** | two sources disagree |
| **Erroneous** information | the record is wrong |

**This directly corrects a naive reading of our own plan.** A readiness-gate strip that compresses a
patient to five green ticks is not automatically safer than a dense chart — it has traded overload for
**underload**, and underload is on the same hazard list. A summary that hides is as dangerous as a chart
that buries.

Three of these five hazards are already first-class in our architecture, which is a genuine validation:
**scatter** → `EVIDENCE_LINK` + one-screen assembly (§5); **conflict** → `conflicting` is a preserved
state, never auto-resolved (R3); **erroneous** → version chains and supersession (R2). But **underload**
we had not modelled at all, and **overload** we had only implicitly.

### 1.4 Note bloat and why our documents are the adversary
Note bloat — copy-paste, template imports, billing-driven padding — is documented as a primary driver of
overload, degrading comprehension and creating patient-safety risk. Indian discharge summaries and
referral notes carry the same pathology.

**Implication:** our `AI_PARSE_DOCUMENT` → `ASSERTION` extraction path is not just a convenience for
retrieval. It is the de-bloating step — it converts a padded 6-page discharge summary into typed
assertions with offsets, so the clinician reads the claim and opens the page only when they want to
verify. That is scatter and overload reduction with the underlying document still one click away, which
is exactly the overload/underload balance the hazard list demands.

### 1.5 The strongest precedent: problem-oriented summarisation
**ProSPER** (problem-oriented summary of the patient electronic record) built auto-generated problem
lists with disease-specific views over 1,500 longitudinal records, explicitly to reduce chart-review
cognitive load. The relevant architectural lesson: **organise by problem, not by data type.** Clinicians
do not think in tables named "labs" and "documents" — they think in problems and questions.

Corroborated by the dashboard literature, which lists as a core requirement "organisation of information
based on medical concepts (organ systems, classifiers, problems)" alongside dynamic presentation of
change/urgency and task management.

---

## Part 2 — What "industry standard in India" actually means

This is not a design-quality aspiration. In India it is a **specific, nameable certification path**, and
building to it is a concrete, checkable claim.

### 2.1 There is already an oncology EMR empanelment — and we should build to its shape
The **National Cancer Grid**, via the **Koita Centre for Digital Oncology (KCDO)**, defined a
requirements set for an EMR with specialised oncology capabilities, ran a Request For Empanelment, and
**empanelled six oncology EMR vendors**, then launched **LEAP (Leading EMR Adopter Program)** to support
NCG centres adopting ABDM-compliant empanelled oncology EMRs. NCG continues interoperability work on the
ABDM architecture.

**Consequence for us:** the credible positioning is *not* "a new oncology EMR." Six of those already
exist and are empanelled across a 300+ centre network. The credible positioning is **the evidence and
readiness layer that sits on top of an ABDM-compliant EMR** — which is also precisely what our federated,
never-a-central-lake identity model (R4) already assumes. Our architecture was accidentally right about
this; now it is deliberately right.

### 2.2 NABH is writing HIS/EMR certification standards right now
NABH has released **draft certification standards for HIS and EMR systems**, seeking industry comment,
expecting them to streamline hospital procurement and drive adoption. Separately, NABH hospital
accreditation (6th Edition, effective January 2025; 5th Edition April 2020 still in transitional use)
places medical-records requirements primarily under the **IMS (Information Management System)** chapter,
with clinical content distributed across **AAC, COP, MOM**.

Concrete NABH obligations our data model must not contradict:
- unique identification number per patient record → our `patient_id` + `ID_MAP` (R4)
- documented initial assessment within a defined timeframe (max 24 h), with presenting complaints and
  vitals → `ENCOUNTER` + `CLINICAL_EVENT`
- individualised care plan documented in the record → the regimen/protocol our gates evaluate against
- informed consent documented for procedures
- discharge summary given at discharge → already a first-class document type in our corpus (R6)
- **medical records are the primary evidence of compliance at assessment** — which means an auditable,
  citation-resolvable record is not a nice-to-have, it is the accreditation artifact itself

### 2.3 The market reality validates the premise
- Indian facilities run **hybrid paper-plus-electronic** records; typically only registration,
  administrative and billing layers are digital.
- **EMRs are rarely exchanged between hospitals**, even private ones — they stay put and are re-read on
  repeat visits.
- HIMSS EMRAM Stage 6 hospitals (Max Healthcare Saket, four Apollo hospitals) are **outliers**, not the
  baseline.
- A cancer-centre EMR study found the system was used predominantly by *administrative staff transcribing
  from paper*, with restricted interoperability against the main hospital EMR.

**This is the single strongest external validation of the whole project.** The thing we said was the
problem in `plan.md` §0 — the record does not travel between facilities — is independently documented as
the state of Indian health IT. We are not inventing a gap.

---

## Part 3 — The design laws this produces

Derived, each traceable to a finding above. These are binding on Screen 2 and on the app generally.

| # | Law | Source | Consequence |
|---|---|---|---|
| **L1** | **The screen answers before it is read.** Readiness verdict must be resolvable pre-attentively — position + text, top of viewport, no scroll, no click. | 2–5 min reality; extraneous load | Gate strip is the first element, always |
| **L2** | **One screen, zero hunting.** Target: the full pre-consult picture without a screen switch. | 15.1 unique screens benchmark | No tab-chasing for the core answer; tabs only for drill-down |
| **L3** | **Never hide to simplify — collapse, don't omit.** Every summarised item stays one click from its source. | information *underload* hazard | Progressive disclosure, not filtering |
| **L4** | **State what was NOT evaluated.** A gate with no data reads "not assessed", never green. | underload + R3 | New requirement — `not_evaluated` is distinct from `pass` |
| **L5** | **Organise by problem and question, not by data type.** | ProSPER; dashboard concept-organisation requirement | Sections are "is she ready", "what changed", "what's contested" — not "labs / documents" |
| **L6** | **Conflict is displayed, never resolved.** Both sources shown with their disagreement explicit. | conflict hazard; R3 | Already in plan — now externally grounded |
| **L7** | **Clinical review order is the drill-down order.** pathology → imaging → labs → problem list/meds. | oncology EMR review literature (dept map) | Screen 2 section order is fixed, not arbitrary |
| **L8** | **The record is the accreditation artifact.** Every displayed claim must resolve to an auditable source. | NABH IMS; records as compliance evidence | Citation resolution is a compliance feature, not just trust UX |

### The one genuinely new requirement: L4
`plan.md` R3 typed missingness at the *assertion* level (`present · pending · not_received · …`) but the
**gate strip has no equivalent**. As specified, a gate with no underlying data would render as pass/fail —
a binary that cannot express "we could not assess this." That is information underload with a green tick
on top, and it is the most dangerous single failure this study found in our own design.

**Fix:** gate outcomes become four-valued — `pass · fail · not_evaluated · conflicting` — and
`not_evaluated` renders visually distinct from `pass` (neutral slate, not blue), with the reason stated
("no CBC on file within 72 h of the planned date").

---

## What changes in `plan.md`

1. **§4 readiness gates** — gate outcome becomes four-valued; add `not_evaluated` and `conflicting`.
2. **§7 / app** — Screen 2 layout fixed: gate strip (L1) → drill-down in clinical review order (L7),
   progressive disclosure throughout (L3).
3. **§6.5 palette** — `not_evaluated` needs a fourth, deliberately non-committal token (neutral slate
   `#64748B` on `#F1F5F9`), distinct from the blue "clear" so absence of assessment never reads as a pass.
4. **New positioning line** — this is an evidence and readiness layer *on top of* an ABDM-compliant,
   NCG-empanelled oncology EMR; not a replacement EMR. Aligns with LEAP and with NABH draft HIS/EMR
   certification as the standards target.

---

## Sources
**Cognition:** ICU pharmacist eye-tracking EHR study; 564-physician cognitive-load SEM study (PMC12864774);
five-hazard human factors analysis (J Patient Safety, doi 10.1097/pts.0000000000001002); note-bloat review
(PMC11852943); ProSPER problem-oriented summary (PMC8861663); cognitive load/burnout narrative review
(PMC11053390); clinical dashboard design requirements (PGHD scoping review; PROM dashboard component study).
**India industry standard:** NCG / Koita Centre for Digital Oncology oncology EMR empanelment + LEAP
(kcdo.in/oncologyemr); NABH draft HIS/EMR certification standards (Healthcare IT News); NABH Accreditation
Standards for Hospitals 6th Ed. (Jan 2025), IMS/AAC/COP/MOM chapters (nabh.co); KLAS *India EMR 2025*;
EHR adoption roadmap for India (PMC5116537); cancer-centre EMR adoption study (PMC7789279).
