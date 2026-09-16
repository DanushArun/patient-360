# Real Patient Journey — Dipali Mahato (de-identified study from reports)

**Studied 2026-09-16 from 19 WhatsApp photos of actual medical reports. This is the ground truth our synthetic data must match.**

> **NOTE: This file contains observations from real medical reports shared by the user's friend's family. All analysis is for the purpose of understanding document formats, workflows, and data patterns for synthetic data generation. No clinical advice is given or implied.**

---

## Patient overview (extracted from reports)

- **Name**: Dipali Mahato
- **Age at diagnosis**: 45 (2024), now 51-52 (reports span 2024-2026)
- **Address**: East Singhbhum, Jharkhand (pincode 831019)
- **Payer**: Employee Family (Tata Steel — treated at Tata Main Hospital, Jamshedpur)

## Diagnosis
- **Invasive ductal carcinoma, left breast, Grade II→III** (grade escalated between outside biopsy and hub pathology)
- **IHC**: ER positive (7/8 Allred at CMC, 8/8 at outside), PR negative (2/8), HER2 **2+ equivocal** by IHC → **FISH NEGATIVE** (ratio 0.62, copy number 1.8)
- **Ki-67/MIB**: 25-30%
- **Stage**: pT2N0 post-surgery → later reclassified **Stage IVA** (oligometastasis to right scapula on PET-CT)
- **Final diagnosis**: ER+/PR-/HER2-negative (Luminal B) with bone oligometastasis

---

## The facilities — exactly the multi-hospital pattern we modeled

| Facility | Role | Location | Documents from |
|---|---|---|---|
| **Outside biopsy lab** (unnamed) | Spoke — initial biopsy | Likely Jharkhand | Initial pathology with IHC (Aug 2024) |
| **Christian Medical College Vellore, Ranipet Campus** | Hub — surgical treatment + pathology | Tamil Nadu (632517) | Medical report, biopsy full report, IHC, FISH, imaging, surgical pathology (Sep-Oct 2024) |
| **Tata Main Hospital, Jamshedpur** | Follow-up hub — chemo, ongoing care | Jharkhand (831001) | Discharge summaries, cycle records, lab reports, prescription (Oct 2024 - ongoing 2026) |

**Three facilities. Three sets of identifiers. 650+ km between Jharkhand and Tamil Nadu.**

---

## Timeline reconstructed from reports

| Date | Event | Facility | Key documents |
|---|---|---|---|
| Mar 2024 | Lump noticed (6 months before presentation) | — | — |
| 09/08/2024 | Mammography: BIRADS V left, BIRADS II right | CMC Vellore | Mammogram report |
| 21/08/2024 | Tru-cut biopsy left breast | Outside lab | Biopsy No: R20287/24. IDC Grade II. |
| 24/08/2024 | USG abdomen — ovarian cyst found | CMC Vellore | USG report |
| 05/09/2024 | PT/INR, CBC, biopsy slides reviewed at CMC | CMC Vellore | Lab reports |
| 06/09/2024 | USG breast + bilateral mammography at CMC | CMC Vellore | Imaging reports |
| 06/09/2024 | **Outside IHC**: ER 8/8, PR 0/8, HER2 1+ | Outside lab | IHC report |
| 10/09/2024 | USG abdomen and pelvis, PET-CT scan | CMC Vellore | Imaging |
| 18/09/2024 | **Left modified radical mastectomy** | CMC Vellore | Surgical specimen: 17.5×18×5.5cm |
| 19/09/2024 | Gross examination of specimen | CMC Vellore | Biopsy R21369/24, page 1 of 3 |
| 21/09/2024 | **Surgical pathology reported**: IDC Grade 3, pT2N0 | CMC Vellore | Full HPE — grade ESCALATED from 2 to 3 |
| 06/09/2024 (reported 21/09) | **CMC IHC on surgical specimen**: ER 7/8, PR 2/8, HER2 **2+ equivocal**, MIB 25-30% | CMC Vellore | IHC addendum |
| 03/10/2024 | **FISH result**: HER2 **NEGATIVE** (ratio 0.62) | CMC Vellore | FISH addendum — ADDITIONAL REPORT section |
| 07/10/2024 | **All reports printed** (printout date on all CMC docs) | CMC Vellore | Consolidated printout |
| 07/10/2024 | Medical oncology consultation at CMC | CMC Vellore | Medical report — 5 pages |
| 10/2024 | PET-CT reveals: **right scapula uptake** → oligometastasis → Stage IVA | CMC/TMH | PET-CT finding |
| 14/10/2024 | Visited Medical Oncology at TMH Jamshedpur | TMH Jamshedpur | — |
| 01/11/2024 | **Tumor board discussion** at TMH | TMH | Stage IVA, potentially curative intent |
| 25/10-14/11/2024 | **Radiation therapy**: 15 fractions, local RT to breast | TMH | — |
| Nov 2024 | RT to scapula NOT given (PET CT review: no definite mets) | TMH | — |
| 07/12/2024 | **Chemo Cycle 1 (TC)** | TMH | — |
| 28/12/2024 | **Chemo Cycle 2** | TMH | — |
| 19/02/2025 | **Chemo Cycle 3** | TMH | — |
| 14/03/2025 (?) | **Chemo Cycle 4** | TMH | — |
| Jan 2025 | **Appendectomy (perforation)** — complication mid-treatment | TMH | Surgical event |
| Mar 2025 | Post 4 #TC, treatment on hold till Mar 25 | TMH | — |
| Apr 2025 | DEXA scan: **Osteopenia** diagnosed | TMH | New finding |
| Apr 2025 | Plan changed: **HT + 3M LEUP + RIBO × 3 YRS (T2N0,G3) + 6M ZOL** | TMH | New treatment plan |
| 04/04/2025 | Cycle 1 of new regimen (Leuprolide + Zole) | TMH | — |
| 04/07/2025 | Cycle 2 | TMH | — |
| 04/10/2025 | **Cycle 3** — Leuprolide 11.25mg IM + Zoledronic acid 4mg IV | TMH | Cycle 3 document with signatures |
| 01/01/2026 | **Pre-cycle labs drawn** (for ongoing treatment) | TMH | CBC + LFT + biochemistry |
| 02/01/2026 | **Lab reports printed** | TMH | 3-page haematology + biochemistry |

---

## What these reports teach us that our research missed

### 1. Grade discordance between facilities
- Outside biopsy (Jharkhand): **Grade II**
- CMC Vellore surgical pathology: **Grade III**
- This is not an error — it's a known phenomenon (biopsy vs surgical specimen grading can differ). But the system must flag it as a **conflict**, not silently accept the newer value. Both are correct for their specimen.

### 2. The IHC discordance
- Outside lab IHC: ER 8/8, PR 0/8, **HER2 1+**
- CMC Vellore IHC on surgical specimen: ER 7/8, PR 2/8, **HER2 2+**
- HER2 went from 1+ (negative, no FISH needed) to 2+ (equivocal, FISH required). If the patient had only the outside lab result, no FISH would have been done, and HER2 status would have been recorded as negative. The CMC re-test caught this.
- **R3 implication**: the missingness state for HER2 must track which specimen and which lab. "HER2 1+ at Lab A, 2+ at Lab B" is `conflicting`, not `present`.

### 3. The FISH addendum pattern — exactly as we modeled
- The FISH result appears as "ADDITIONAL REPORT" at the bottom of the page that already contains the surgical pathology impression. It's not a separate document — it's appended to the same report, with a different date and different reporting pathologist.
- **Date chain**: specimen 18/09, surgical path reported 21/09, IHC reported 06/09 (confusing — likely the IHC was ordered earlier but reported on the surgical specimen), FISH reported 03/10. Two weeks between IHC and FISH.

### 4. The consolidated printout
- All CMC reports were printed on **07/10/2024** as one batch (page footer: "Printout Taken on 07-Oct-2024 11:52"). This is how reports travel — not individually as they're produced, but as a batch printout when the patient is discharged or transferred.
- **R2 implication**: `signed_at` (when the pathologist reported) ≠ `effective_at` (when the specimen was taken) ≠ `ingested_at` (when the printout was given to the patient). All three differ by days to weeks.

### 5. Real unit formats observed
- **Haemoglobin**: "10.3 GM%" and "10.7 L gm/dl" and "12.0 g/dL" — THREE different formats across reports
- **WBC**: "5800 /CUMM" with reference "4,000-12,000"
- **Platelets**: "228000 /CUMM" with reference "1,50,000-4,50,000" (Indian comma notation!) and "192000 per cumm" with reference "150000-410000"
- **Neutrophils**: "52 L %" (reported as percentage, not absolute — ANC must be calculated)
- **Bilirubin**: Total 0.31 mg/dL, Direct 0.06 mg/dL (CMC uses "L" suffix for low)
- **AST (SGOT)**: 15 U/L at one time, 9.80 U/L at another, 27.70 U/L yet another — method column shows "IFCC Kinetic"
- **Creatinine**: 0.71 mg% and 0.68 mg/dL — "mg%" used interchangeably with mg/dL
- **RBC**: "4.56 MM/cumm" — million per cumm

**These are the exact parsing traps we documented in lab-reporting-india.md — and they all appear in one patient's records.**

### 6. The multi-facility identifier problem
| Facility | Identifier type | Value |
|---|---|---|
| CMC Vellore | Hospital Number | AG62251 |
| CMC Vellore | Biopsy No | R21369/24 |
| Outside lab | Biopsy No | R20287/24 |
| TMH Jamshedpur | UHID (MR) | MR/24/010770 |
| TMH Jamshedpur | IP Number | IP/2025/043574 |
| TMH Jamshedpur | PNO | 430467 |
| TMH Jamshedpur | Visit No | OPRefr/2025/1483363-EPN/2025 |

**Seven identifiers across two hospitals for one patient.** No ABHA visible on any report.

### 7. The treatment plan evolution
The plan changed multiple times:
1. Initial (CMC): Surgery first (MRM done 18/09/2024)
2. CMC plan: Abemaciclib + Letrozole + Leuprolide (hormonal, no chemo — based on HER2-negative, ER+)
3. TMH tumor board (01/11/2024): Stage IVA (oligomet), plan changed to RT >> then chemo TC ×4 >> then HT
4. Post-chemo: plan evolved to HT + 3M LEUP + RIBO × 3 YRS + 6M ZOL (Ribociclib added for CDK4/6 inhibition)

**Each plan change generates documents and invalidates previous assumptions.** The system must track treatment plan versions.

### 8. The handwritten vs printed mix
- TMH cycle 3 document: printed template at top, **handwritten medication orders in the middle** (Zoledronic acid dose, infusion instructions in doctor's handwriting), printed consent at bottom, **handwritten signatures** of MO, nursing staff, and patient.
- The same page has printed text, handwritten clinical notes, and a signature — three different extraction challenges.

### 9. The complication mid-treatment
- January 2025: **Appendectomy (perforation)** — an unrelated surgical emergency during chemo.
- Treatment was on hold for weeks. This kind of interruption is common and the system must handle it: a cycle gap that isn't a documentation failure but a clinical event.

### 10. The upside-down/rotated pages
- Several images are photographed with the page upside down or rotated 90°. The biochemistry report is completely inverted. This is reality — a family member photographing reports on a hospital bed. AI_PARSE_DOCUMENT must handle rotation.

---

## Design corrections from this study

1. **Add `specimen_id` to pathology assertions.** Grade II on biopsy R20287/24 and Grade III on specimen R21369/24 are both correct — for different specimens. Without specimen tracking, this is a false conflict.

2. **Treatment plan must be a versioned entity.** Not just "current regimen" — the full chain of plan changes with dates, reasons, and the tumor board decision that triggered each change.

3. **The "consolidated printout" is a real document type.** Multiple reports printed as one batch, with a single printout date. The system must parse this as multiple logical documents from one physical printout.

4. **Indian comma notation in reference ranges** ("1,50,000-4,50,000") must be parsed. This is lakhs notation — 1,50,000 = 150,000.

5. **"L" and "H" suffixes on lab values** indicate low/high relative to reference range. These are flags, not units. Must not be parsed as part of the value.

6. **Handwritten sections within printed reports** are real and common. The extraction pipeline must handle mixed content on a single page.

7. **Appendectomy/complication events** create legitimate treatment gaps. The between-cycle tracker must distinguish "gap due to missing documents" from "gap due to clinical event."

8. **No ABHA on any report.** Seven identifiers, zero ABHA. R4's handling of the no-ABHA case is not a theoretical fallback — it is the default reality.

---

## Sources

19 WhatsApp photos of actual medical reports, shared with permission for hackathon research purposes. All clinical observations are factual readings of the documents, not interpretations or advice.
