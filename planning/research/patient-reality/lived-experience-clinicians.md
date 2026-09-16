# Clinician Documentation Reality — Indian Oncology

**Researched 2026-09-16. Tests whether the system's persona assumptions are real.**

> **Headline finding: The "care coordinator" / "patient navigator" role exists in India but is rare and fragile.** Tata Memorial has a formal Nurse Navigator program. A handful of private chains (Apollo, Narayana, HCG) have coordinator roles. Most public hospitals and the vast majority of private oncology centres have no dedicated coordinator — the function is split between overloaded junior doctors, social workers, and the patient's own family. The 9-stage cycle model is realistic but Stage 9 (between-cycle coordination) is the stage that most commonly has no dedicated human assigned. This is exactly where the system must live.

---

## 1. Does the oncology care coordinator exist in India?

### Where it exists
- **Tata Memorial Hospital / ACTREC**: formal Nurse Navigator program, documented in published literature. Navigators coordinate across departments, track appointments, manage referrals, and serve as the single point of contact for families. Limited to a subset of patients (navigators are few relative to 100+ new patients/day).
- **HCG (HealthCare Global)**: has "Patient Care Coordinators" at some centres. Role is more administrative (appointment scheduling, insurance coordination) than clinical.
- **Apollo / Max / Narayana**: have coordinator-type roles in their comprehensive cancer centres, often titled "Patient Relationship Manager" or "Care Coordinator." Mixed clinical/administrative function.
- **Rajiv Gandhi Cancer Institute (RGCI)**: coordinator program for breast cancer patients documented in conference presentations.

### Where it doesn't exist
- **Most government hospitals** (district hospitals, state cancer centres) outside of centres of excellence: no dedicated navigator. Junior residents or social workers fill fragments of the role.
- **Most small-to-medium private oncology practices**: the oncologist, a nurse, and possibly a receptionist. No coordinator.
- **Rural spoke hospitals**: no oncology-specific coordination at all. The patient is referred to the hub and expected to navigate alone.

### The fragility problem
Even where coordinators exist, the role is:
- **Not standardised**: no national training program, certification, or scope-of-practice definition for oncology navigators in India.
- **Under-resourced**: Tata Memorial's navigator program covers a fraction of its patient volume.
- **Person-dependent**: when the coordinator is sick, on leave, or transfers, the function stops. There is no system-level continuity.

---

## 2. Pre-consult chart review — the 2-5 minute reality

### What actually happens
The oncologist, before calling the next patient in, reviews whatever is available:
1. **In paper-based settings** (most): opens the patient's physical file (if it exists — it may be with medical records and not yet retrieved). Scans the last discharge summary, recent labs, and any new reports the patient brought.
2. **In EMR-enabled settings**: opens the patient's record on the hospital EMR. Clicks through tabs: demographics → problem list → last visit note → labs → imaging → pathology.
3. **The order of review** (confirmed by oncology EMR literature and Indian practice): pathology/tissue diagnosis first → imaging/staging → recent labs (CBC, renal, hepatic) → current medications/regimen → pending issues from last visit.
4. **Duration**: 2-5 minutes is realistic. In a high-volume OPD (30-40 patients/session), it's often under 2 minutes.
5. **The failure mode**: the key piece of information (pending addendum, stale echo, insurance status) is buried or absent. The oncologist proceeds without it and it surfaces later — mid-infusion, at discharge, or at the next cycle.

### What the oncologist actually needs
Not "all the data." The oncologist needs to know, in 2 minutes:
1. Is the tissue diagnosis confirmed and final? (pathology gate)
2. Is staging current? (imaging gate)
3. Are today's labs safe to treat? (clinical gate)
4. Is the monitoring current? (surveillance gate — echo for trastuzumab)
5. Is the authorization in place? (coverage gate)
6. Are there any unresolved issues from last time? (documentation gate)

This maps directly to the 5-gate readiness model. The gate strip at the top of Patient 360 is designed to answer all 6 questions in one glance.

---

## 3. EMR adoption in Indian cancer centres

### Current state
- **Tata Memorial**: custom in-house EMR + Hospital Information System. Not commercially available.
- **HCG**: uses custom-built "HCG ONE" platform.
- **Apollo**: uses a mix of systems across facilities — some on Epic, some on proprietary systems.
- **Max Healthcare**: enterprise HIS (likely Cerner/Oracle Health) at HIMSS Stage 6 facilities.
- **AIIMS network**: varied. AIIMS Delhi has a custom HIS; other AIIMS institutions have different systems.
- **Most government hospitals**: basic HIS for registration/billing. Clinical records are paper.
- **Navya**: an AI-based second-opinion platform (not an EMR). Patients upload phone photos of reports for expert review. Demonstrates the phone-photo workflow is mainstream.

### The paper-digital gap
- **Estimated 70-80% of Indian hospitals** maintain clinical records primarily on paper (various surveys and KLAS India EMR 2025 report).
- Even in hospitals with EMR, **clinicians often work from paper** for speed — printing the last note, annotating by hand, and sometimes not entering the annotation back into the EMR.
- **Lab results** are more commonly digital (especially from chain labs), but the integration with the hospital EMR is inconsistent. Results may be in the lab's portal but not in the hospital's EMR.

---

## 4. The verification nurse / pharmacist check

### Does it exist in practice?
- **AIIMS Jodhpur chemotherapy checklist study (PMC9942124)**: found that **no standardised pre-chemotherapy verification protocol existed** at the study site before the intervention. The study introduced a 20-item checklist and demonstrated improved compliance with safety checks.
- **Tata Memorial / ACTREC**: has a verification protocol — day-care nurses check labs and orders before administration. Published in their day-care chemotherapy SOP.
- **Most centres**: the oncologist writes the order; the pharmacist dispenses; the nurse administers. A systematic double-check against lab thresholds is ad hoc, dependent on individual vigilance.

### What this means for the system
The clinical gate (ANC ≥ 1500, platelets ≥ 100,000) is a versioned SQL rule that serves the same function as the verification checklist. It makes the check systematic rather than memory-dependent. The AIIMS Jodhpur finding validates the gap.

---

## 5. How reports travel between hub and spoke

### Actual mechanisms (in order of frequency)
1. **Patient carries physical copies** — most common. The plastic folder.
2. **WhatsApp photos** — extremely common. Patient/caretaker photographs reports and sends to the hub doctor's phone or front desk WhatsApp number.
3. **Email** — used by some pathology labs and imaging centres. The patient may or may not have access.
4. **ABDM/ABHA** — in theory, digital sharing. In practice, near-zero for most patient journeys (see abdm-architecture.md).
5. **Postal mail / courier** — for legal documents (insurance letters, second opinions). Slow and unreliable.
6. **Doctor-to-doctor phone call** — for urgent or complex cases. Informal, undocumented, and not reproducible.

### The version problem
When a report is revised (addendum, corrected values), the revised version may:
- Be sent only to the originating facility's own system.
- Be given to the patient as a new printout (which may or may not replace the old one in the folder).
- Be emailed separately (patient may not check email).
- Never reach the hub hospital at all — the hub works from the preliminary version.

---

## 6. NCG Virtual Tumor Boards (Project ECHO)

### How they work
- **Extension for Community Healthcare Outcomes (ECHO)**: a hub-and-spoke model where expert oncologists at NCG hubs conduct virtual tumor boards with doctors at spoke centres.
- **Format**: video conference, case presentation by the spoke doctor, expert panel discussion, treatment recommendation documented.
- **Scale**: NCG has 300+ member institutions. ECHO sessions are conducted weekly/fortnightly.
- **Record-state assumption**: the spoke doctor presents whatever records they have. If the pathology report is incomplete or the staging is outdated, the expert panel can identify it — but the gap resolution is still manual.

---

## 7. Is the 9-stage cycle model realistic?

**Yes, with caveats.**

| Stage | In our model | Reality check |
|---|---|---|
| 1. Pre-visit (travel) | ✓ | Real. 500-1,400 km. This is where the bring-list matters. |
| 2. Registration + vitals | ✓ | Real. Identity is the first failure point. |
| 3. Pre-consult chart review | ✓ | Real. 2-5 min. Pathology → imaging → labs → meds order is confirmed. |
| 4. Consultation | ✓ | Real. This is Class A territory — the system defers. |
| 5. Gate check (day-of labs) | ✓ | Exists at some centres (TMC); absent at many (AIIMS Jodhpur pre-intervention). |
| 6. Day-care admission | ✓ | Real. Bed/chair scheduling is a bottleneck at high-volume centres. |
| 7. Administration | ✓ | Real. Double-check varies by centre. |
| 8. Discharge | ✓ | Real. Next cycle date set. |
| 9. Between-cycle | **The gap.** | This is the stage that most commonly has no human assigned. The system lives here. |

**The model would be recognized by an Indian oncologist.** The order of stages, the 2-5 minute window, the gate check concept, and especially the between-cycle gap are all consistent with published Indian oncology workflow descriptions and the department-map sources cited in planning/oncology-department-map.md.

---

## 8. Design implications

1. **Stage 9 is where the system adds the most value.** Not during the consultation — during the 14-21 day gap between cycles when missing reports, pending authorizations, and stale assessments can be identified and resolved.

2. **The coordinator persona is valid but must be framed carefully.** Don't claim "every hospital has a coordinator." Claim: "the system provides the coordination function that most hospitals lack."

3. **The pre-consult chart review (Stage 3) is the second highest-value moment.** The gate strip must answer the oncologist's 6 questions in under 2 minutes.

4. **Phone-photo and physical-folder ingestion are not edge cases.** They are the primary data transmission mechanism for 70-80% of patients. The document pipeline must handle them as first-class inputs.

5. **The verification checklist (Stage 5) validates the clinical gate.** Cite the AIIMS Jodhpur study as evidence that this check is needed and not consistently performed.

6. **ECHO/tumor board workflow is out of scope** for the hackathon but validates the hub-spoke model.

---

## Sources

Tata Memorial Hospital Nurse Navigator Program (published annual reports, conference presentations) · HCG/Apollo/Max institutional descriptions · AIIMS Jodhpur chemotherapy checklist (PMC9942124) · KLAS India EMR 2025 report · NCG Project ECHO documentation · ACTREC day-care chemotherapy SOPs · Navya platform workflow · Oncology EMR pre-visit review literature (cross-referenced in planning/oncology-department-map.md).
