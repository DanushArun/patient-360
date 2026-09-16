# Treatment Timeline — Day-by-Day Clinical Detail for HER2+ Breast Cancer

**The precise timing between every clinical event. The synthetic data generator uses this to place events realistically.**

> **Read alongside patient-journey-meera.md (the narrative) and data-artifact-map.md (the records). This file is the clock.**

---

## Regimen: AC-TH (most common Indian HER2+ adjuvant protocol)

### Phase 1: AC (Doxorubicin + Cyclophosphamide)
- **Cycles**: 4
- **Interval**: every 21 days
- **Duration**: 12 weeks (+ delays)

### Phase 2: TH (Paclitaxel + Trastuzumab)
- **Paclitaxel**: weekly × 12 weeks
- **Trastuzumab**: loading dose 8 mg/kg, then 6 mg/kg every 3 weeks
- **Duration**: 12 weeks

### Phase 3: Surgery (if not done upfront)
- **Timing**: 3-6 weeks after last chemo cycle

### Phase 4: Trastuzumab maintenance
- **Continue q3w** to complete 1 year total (17 cycles)
- **Duration**: ~36 additional weeks after TH phase

### Phase 5: Radiation (if indicated)
- **Timing**: starts 3-4 weeks after surgery, concurrent with trastuzumab
- **Duration**: 15-25 fractions over 3-5 weeks

---

## Pre-treatment diagnostic timeline (typical Indian delays included)

| Day | Event | Documents | Turnaround |
|---|---|---|---|
| 0 | First symptom noticed | None | Patient delay: median 2-12 weeks in India |
| 14-84 | First doctor visit (spoke) | Consultation note | Same day |
| 15-85 | Mammogram + USG ordered | Reports | 1-3 days for appointment, 1-2 days for report |
| 20-90 | Core needle biopsy | Consent, request form | Same day procedure |
| 27-97 | **Histopathology report (preliminary)** | HPE report (no IHC) | **5-7 working days** from specimen receipt |
| 30-100 | **IHC report (ER/PR/HER2/Ki-67)** | Addendum or separate report | **3-5 working days** after HPE |
| 30-100 | If HER2 2+: **FISH ordered** | Request sent to referral lab | Specimen may need to travel to another city |
| 37-112 | **FISH result** | Addendum | **5-7 working days** from specimen receipt at FISH lab |
| 40-115 | Referral to hub hospital | Referral letter | Same day. Travel: 1-7 days depending on distance |
| 42-120 | Hub hospital first visit | New MRN, consultation note | Same day |
| 43-125 | Hub: review outside slides | Slide review report | **3-5 working days** |
| 43-125 | Hub: staging CT ordered | CT report | 2-3 day wait for appointment, report next day |
| 43-125 | Hub: baseline echo ordered | Echo report | 1-3 day wait, report same day |
| 43-125 | Hub: baseline labs | CBC, metabolic panel | Same day or next morning |
| 45-130 | If FISH not done: **FISH at hub** | FISH addendum | **5-7 working days** |
| 50-135 | MDT / tumor board | MDT recommendation | Same day as meeting |
| 50-135 | PM-JAY pre-auth submitted | Pre-auth request | Submitted same day |
| 52-140 | **PM-JAY pre-auth response** | Approval/denial letter | **2-7 working days** (varies by state SHA) |

**Total diagnostic timeline: 52-140 days (7-20 weeks) from first symptom to treatment start.** Published Indian data (PMC12374521): median time from first consultation to treatment initiation = 6-12 weeks. Time from symptom to first consultation adds another 2-12 weeks.

---

## Treatment cycle timeline — AC phase

### Each AC cycle (repeat × 4)
| Day relative to cycle | Event | Documents | Lab requirements |
|---|---|---|---|
| Day -2 to -1 | **Pre-cycle labs drawn** | CBC, metabolic panel | ANC ≥1500, Plt ≥100K, adequate renal/hepatic |
| Day -1 | Labs reviewed by oncologist | Lab report review note | If below threshold: delay decision |
| Day 0 | **Cycle administered** | Chemo order, administration record, day-care discharge note | |
| Day +1 to +20 | At home (side effects managed) | Phone consultation notes if needed | |
| Day +19 to +20 | **Pre-cycle labs for next cycle** | CBC, metabolic panel | Drawn at spoke or hub lab |
| Day +21 | **Next cycle due** | | If labs not back or below threshold: delay |

### AC cycle spacing
| Cycle | Planned day | Typical actual day | Common delay reason |
|---|---|---|---|
| AC-1 | Day 0 | Day 0 | — |
| AC-2 | Day 21 | Day 21-23 | Travel logistics (1-2 day flex is normal) |
| AC-3 | Day 42 | Day 49-56 | **ANC nadir.** 15-20% of patients have ANC <1500 at day 42. Delay 7-14 days. |
| AC-4 | Day 63 | Day 63-70 | PM-JAY re-authorization delay |

**AC phase total**: planned 63 days, typical 70-84 days.

---

## Treatment cycle timeline — TH phase

### Paclitaxel weekly (12 doses)
| Week | Day relative to TH start | Event | Labs |
|---|---|---|---|
| 1 | Day 0 | Paclitaxel dose 1 + **Trastuzumab loading dose (8 mg/kg)** | CBC (ANC ≥1000 for weekly taxane) |
| 2 | Day 7 | Paclitaxel dose 2 | CBC |
| 3 | Day 14 | Paclitaxel dose 3 | CBC |
| 4 | Day 21 | Paclitaxel dose 4 + **Trastuzumab dose 2 (6 mg/kg)** | CBC |
| 5-12 | Days 28-77 | Paclitaxel weekly + Trastuzumab q3w | CBC weekly, echo at week 12 |

### Trastuzumab schedule (q3w)
| Trastuzumab dose # | Day (from TH start) | Dose |
|---|---|---|
| 1 (loading) | Day 0 | 8 mg/kg |
| 2 | Day 21 | 6 mg/kg |
| 3 | Day 42 | 6 mg/kg |
| 4 | Day 63 | 6 mg/kg |
| 5 | Day 84 | 6 mg/kg (continues through surgery + maintenance) |
| ... | q3w | 6 mg/kg |
| 17 | ~Day 336 (1 year from first dose) | Last dose |

### Echo surveillance schedule during trastuzumab
| Echo # | Timing | What it checks |
|---|---|---|
| 1 (baseline) | Before first trastuzumab | LVEF. Must be ≥50% to start. |
| 2 | 3 months after start (~Day 84) | LVEF. Check for decline. |
| 3 | 6 months (~Day 168) | LVEF. |
| 4 | 9 months (~Day 252) | LVEF. |
| 5 | 12 months (~Day 336) | LVEF. Final on-treatment. |
| 6 | 3-6 months post-completion | Recovery check if any decline. |

---

## Lab turnaround times (Indian context)

| Lab test | Sample type | Turnaround (NABL-accredited chain lab) | Turnaround (district hospital lab) |
|---|---|---|---|
| CBC with differential | EDTA whole blood | 2-4 hours | 4-8 hours (may be next day if afternoon sample) |
| Metabolic panel (creatinine, LFT) | Serum | 4-6 hours | 6-12 hours |
| Histopathology (HPE) | Tissue in formalin | 5-7 working days | 7-14 working days |
| IHC panel (ER/PR/HER2/Ki-67) | Tissue block from HPE | 3-5 working days after HPE | 5-10 working days (if available) |
| FISH for HER2 | Tissue section from IHC block | 5-7 working days | **Not available** — must send to referral lab |
| CT scan | — | Report: 1-2 days. Appointment wait: 2-7 days. | Report: 2-5 days. Wait: 1-4 weeks. |
| Echocardiogram | — | Report: same day. Appointment wait: 1-5 days. | Report: 1-3 days. Wait: 1-2 weeks. |
| PET-CT | — | Report: 2-3 days. Appointment wait: 3-14 days. | **Not available** — referral to metro centre. |

---

## Document version chains and supersession

### The pathology addendum chain (most common)
```
DOC: Pathology preliminary (S-882 v1)
  → contains: histological type, grade, margins, LVI
  → says: "IHC panel to follow"
  → signed: Day 27

DOC: IHC addendum (S-882 v1-addendum-1)
  → contains: ER, PR, HER2 (IHC score), Ki-67
  → says: "HER2 2+ equivocal. FISH recommended."
  → signed: Day 30
  → does NOT supersede v1 — it SUPPLEMENTS it

DOC: FISH addendum (S-882 v1-addendum-2)
  → contains: HER2 FISH result (ratio, copy number, interpretation)
  → says: "HER2 FISH POSITIVE"
  → signed: Day 37
  → does NOT supersede addendum-1 — it SUPPLEMENTS it
  → RESOLVES the "pending" state from addendum-1
```

### The corrected report chain (less common, more dangerous)
```
DOC: Lab report (LAB-441 v1)
  → contains: ANC 2100/µL, Plt 1.9 lakh/µL
  → signed: Day -1 before cycle
  → USED for readiness decision

DOC: Corrected lab report (LAB-441 v2)
  → contains: ANC 1100/µL, Plt 1.9 lakh/µL (ANC was wrong in v1)
  → signed: Day +2 after cycle
  → SUPERSEDES v1
  → THE CYCLE SHOULD NOT HAVE PROCEEDED
  → This is the R2 scenario: what was known at decision time (v1) 
    differs from what is known now (v2)
```

---

## The three clocks in practice

| Clock | What it records | Example |
|---|---|---|
| `event_time` | When the clinical event happened | Blood drawn at 08:00 on Sep 8 |
| `source_recorded_at` | When the source system recorded it | Lab result finalized at 14:00 on Sep 8 |
| `ingested_at` | When SAARTHI received it | Report uploaded at 10:00 on Sep 9 (next day, brought in folder) |

**Why all three matter**: A query at `known_as_of = Sep 8 18:00` should see the lab result (event happened, source recorded). A query at `known_as_of = Sep 8 09:00` should NOT — the event happened but SAARTHI didn't know yet. A query at `known_as_of = Sep 9 11:00` sees everything.

The corrected report scenario: at `known_as_of = Sep 9` the answer uses v1 (ANC 2100). At `known_as_of = Sep 12` (after v2 arrived) the answer uses v2 (ANC 1100) and marks v1 as superseded. Both answers are correct for their moment.

---

## Sources

NCCN Breast Cancer v4.2023 (AC-TH regimen schedule) · NCG Guidelines · ESC Cardio-Oncology 2022 (echo surveillance) · FDA Herceptin prescribing information · ASCO/CAP HER2 Testing 2018 · PMC12374521 (diagnostic delays India) · clinical-thresholds.md · lab-reporting-india.md
