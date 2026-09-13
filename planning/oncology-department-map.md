# End-to-end map — Medical Oncology, one treatment cycle

Scope: one department (Medical Oncology, day-care chemotherapy), one recurring unit of work — the ~21-day
cycle — for a patient already diagnosed and on an active regimen. Not the diagnostic workup, not surgery,
not radiation. This is deliberately narrow: it is the unit our readiness gates (`plan.md` §4) already model,
and it is where the record-state failures in `plan.md` §0 concentrate (missed cycles, authorization
mismatches, stale surveillance).

Sourcing for the workflow itself: ACTREC outpatient procedure; Max Institute of Cancer Care day-care
operational review; AIIMS Jodhpur chemotherapy-checklist study; general oncology EMR pre-visit review
literature. Indian-specific pain points are cited inline, cross-referenced to `plan.md` §0.

---

## The nine stages

| # | Stage | Who | What happens |
|---|---|---|---|
| 1 | Pre-visit | patient/family | Travel to hub city; carry prior reports (paper folder or phone photos) |
| 2 | Registration + vitals | front office, nurse | ID confirmed, vitals taken, reason for visit logged |
| 3 | **Pre-consult chart review** | oncologist, alone, ~2–5 min | Reviews record *before* the patient enters the room |
| 4 | Consultation | oncologist + patient | History, exam, decision: proceed / hold / change |
| 5 | Gate check | nurse / pharmacist / verification nurse | Day-of-cycle labs + order re-verified against protocol |
| 6 | Day-care admission | day-care nurse | Bed/chair allotted, pre-medication given |
| 7 | Administration | day-care nurse | Chemo prepared, double-checked, infused |
| 8 | Discharge | nurse | Home instructions, next-cycle date set |
| 9 | Between-cycle | coordinator (if one exists) | Chasing missing reports, authorization, follow-up labs |

---

## Stage-by-stage: data, pain point, and what our system shows

### 1. Pre-visit
**What happens:** Family travels — often 500–1,400 km — carrying whatever records they have.
**Data state today:** Scattered across a plastic folder and phone camera rolls; no guarantee the
right document made the trip.
**India pain point:** 74% of breast cancer patients consult ≥2 facilities; 83.2% face catastrophic
non-medical spend on exactly this travel (`plan.md` §0).
**Our system:** This is what the **`family` role bring-list** exists for (`plan.md` §11, Q4) —
a coordinator-reviewed checklist of exactly what's missing, generated *before* the trip, not
discovered at the front desk.

### 2. Registration + vitals
**What happens:** Identity confirmed, vitals recorded, reason for visit logged.
**Data state today:** Identity is the first failure point — one patient may carry a hub MRN, a
spoke MRN, an ABHA, a PM-JAY beneficiary ID, and an insurer member ID, none necessarily linked.
**Our system:** `ID_MAP` (`plan.md` §5, R4) — evidence not resolved to a single linked identity
goes to quarantine and contributes nothing to any answer. This stage is where a wrong-merge would
happen if we ever allowed fuzzy name-matching; we don't (R4).

### 3. Pre-consult chart review — the stage this system is actually built for
**What happens:** Before the patient is called in, the oncologist reviews the chart alone, for
minutes, not longer. The literature is specific about the *order*: **pathology (tissue diagnosis)
→ imaging (extent/staging) → labs (organ function/baseline) → problem list/med history**
(oncology EMR review literature). This is a look-up task under time pressure, not a reading task.
**Data state today:** This is where the whole failure surface in `plan.md` §0 lands on one desk —
a pending addendum, a stale echo, an authorization nobody confirmed, a lab drawn at the wrong lab.
Today the oncologist either catches it in these 2–5 minutes or doesn't, and it surfaces later —
mid-cycle, at the chair, or in a denied claim.
**Our system — Patient 360 (Screen 2), ordered to match how it's actually read:**
1. **Readiness gate strip at the top** — clinical / surveillance / documentation / coverage /
identity, pass or fail, one line each, click any to open its evidence (`plan.md` §4).
2. **Pathology & biomarkers** — current assertion, version, "superseded" badge if an addendum
replaced it, citation to the exact page (R2/R3).
3. **Imaging** — most recent, staleness flagged against protocol (e.g. LVEF >90 days, `plan.md`
§4 surveillance gate).
4. **Labs** — most recent CBC/organ-function panel, collection date, source lab.
5. **Problem list / medication history** — encounters, current regimen, cycle number.

This ordering is not decoration — it is the literature's own stated review order, and it is why
Screen 2 is not a flat table: the gate strip alone should answer "can I proceed" in the same
2–5 minutes the doctor already has, before they open anything.

### 4. Consultation
**What happens:** History, exam, decision to proceed, hold, or modify.
**Our system's boundary:** This is **Class A** (`plan.md` §1.2) — the clinical decision itself.
The system has already done its job by stage 3; it does not participate here. Ask+Evidence
(Screen 3) is available if the oncologist wants a cited answer to a Class B question mid-visit
("has the authorization letter arrived yet?"), but any Class A question is refused and routed
back to the oncologist's own judgment — which is where it already is.

### 5. Gate check
**What happens:** Day-of-cycle labs re-checked against protocol thresholds (ANC ≥1500/µL,
platelets ≥100×10⁹/L — `plan.md` §4); a verification nurse independently re-checks the order.
**India pain point:** this is exactly the AIIMS Jodhpur finding — *no protocol existed* for
this step at the site studied; it was ad hoc.
**Our system:** The clinical gate (`plan.md` §4) is a versioned SQL rule, not a memory-dependent
step. Its evidence — the specific lab row, its unit, its collection time — is the same citation a
verification nurse would need to independently confirm the order, satisfying the "second
person re-checks" safety pattern without duplicating manual chart-hunting.

### 6–7. Day-care admission & administration
**What happens:** Bed/chair allotted (Max Institute's workflow notes this is itself a scheduling
bottleneck at scale — 1,200+ sessions/month at one centre), pre-medication given, drug prepared
and infused under a double-check.
**Our system:** Out of scope for direct participation (this is real-time clinical execution, not
a record-state question) — but the **Review queue** (Screen 1) is what determines whether a
patient should have been called in at all: if a documentation or coverage gate was still open at
stage 3 and never resolved, that's a review-priority item, not a chair booked and then unwound.

### 8. Discharge
**What happens:** Home instructions given, next cycle date set (typically +21 days).
**Our system:** This creates the next `ENCOUNTER` row and restarts the readiness-gate clock —
`known_as_of` for the next cycle's answer starts fresh (`plan.md` §5 R2).

### 9. Between-cycle — where documentation and coverage actually get resolved
**What happens:** In principle, someone chases the pending pathology addendum, confirms the
authorization, checks the next lab draw happened. In practice, in most Indian centres, there is
no dedicated navigator role doing this systematically (`plan.md` §0 — patient navigation evidence
review) — it falls to an overloaded coordinator, or to nobody, until it resurfaces at stage 3 of
the *next* cycle, now urgent.
**Our system:** This is **Screen 1 (Review queue) + Screen 4 (Review + history)** — the
between-cycle gap is precisely the queue's reason to exist. An open `REVIEW_ISSUE` sits here,
owned, with a due date tied to the next encounter, resolved through a `TASK` with an audit trail
(`plan.md` §5) — not rediscovered under time pressure at stage 3.

---

## What this settles about the four screens

| Screen | Stage it serves | Primary user | Core job |
|---|---|---|---|
| 1. Review queue | 9 (between-cycle) | coordinator | surface open gates before they become stage-3 surprises |
| 2. Patient 360 | 3 (pre-consult review) | oncologist | answer "can I proceed" in the same 2–5 min already spent, in pathology→imaging→labs→history order |
| 3. Ask + evidence | 4, 9 (mid-visit / chasing) | oncologist, coordinator | one cited Class B answer on demand; refuses Class A |
| 4. Review + history | 9 (between-cycle resolution) | coordinator | close the loop with an auditable action, not a memory |

**The one thing this map changes in the existing plan:** Screen 2's evidence ordering was not yet
specified. It should follow the oncologist's own documented review order (pathology → imaging →
labs → problem list), with the readiness-gate strip above all of it — because the gate strip is
the two-minute answer, and the ordered sections below are what's opened only if something needs
a closer look.

---

## Sources
ACTREC outpatient procedure (actrec.gov.in); Max Institute of Cancer Care day-care operational
review (Asian Journal of Oncology); AIIMS Jodhpur chemotherapy-checklist validation study
(PMC9942124); oncology EMR pre-visit review order (Doximity/OpMed, UC Davis Health, Acibadem
first-appointment guides). Indian-system statistics cross-referenced to `plan.md` §0.
