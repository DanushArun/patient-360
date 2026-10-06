cre# Saarthi -- Readiness Checks Explained

**What are these checks?** Before a cancer patient receives chemotherapy, 16 things must be verified. Saarthi runs these checks automatically against the patient's record and shows the result as tiles on the patient page. Each tile shows one of four outcomes:

| Outcome | What it means | What the coordinator does |
|---|---|---|
| **Pass** (✓, green solid border) | Requirement met. Safe to proceed on this check. | Nothing — move to the next check. |
| **Fail** (✕, red solid border) | Requirement NOT met. Something is wrong or below threshold. | Resolve it: get a new lab, request a document, escalate to the doctor. |
| **Not evaluated** (–, grey dashed border) | We don't have enough information to check. Lab not done, document missing, data too old. | Obtain the missing evidence. This is NOT "pass" and NOT "fail" — it means we don't know. |
| **Conflicting** (⇄, amber double border) | Two sources disagree. The system does not auto-resolve this. | A human must look at both sources and decide which is correct. |

**Severity:**
- **Blocker** — if this fails, the patient CANNOT proceed to treatment
- **Advisory** — flagged but does NOT block treatment (e.g., HbA1c is elevated but cancer chemo should not be deferred for blood sugar)

---

## The 16 Checks

### 1. CLIN-ANC-001 — Absolute Neutrophil Count (ANC)

**What it checks:** Is the patient's ANC at least 1,500 per microlitre? ANC measures the body's ability to fight infection. Chemotherapy destroys white blood cells, so if ANC is already low, giving chemo could be life-threatening.

**Threshold:** ANC ≥ 1,500/µL within the last 7 days

**Severity:** Blocker — cannot proceed if ANC is too low

**Guideline:** NCCN Myeloid Growth Factors v2.2023; ASCO 2015

**What you'll see:**
- **Pass:** "ANC is 2208, meets threshold 1500"
- **Fail:** "ANC is 1160, below threshold 1500" (seen on Suresh Patil)
- **Not evaluated:** "ANC assessment is 11 days old, exceeds 7-day limit" (lab too old) or "no ANC evidence found" (never done)

**Note:** ANC is often not directly printed on the lab report. Saarthi calculates it as WBC × neutrophil% / 100. When it does this, the evidence panel shows "Derived, not printed" with the formula.

---

### 2. CLIN-PLT-001 — Platelet Count

**What it checks:** Are the patient's platelets at least 100,000 per microlitre? Platelets control bleeding. Low platelets during chemo means dangerous bleeding risk.

**Threshold:** PLT ≥ 100,000/µL within the last 7 days

**Severity:** Blocker

**Guideline:** NCCN; CTCAE v5.0

**What you'll see:**
- **Pass:** "PLT is 150000, meets threshold 100000"
- **Fail:** "PLT is 82000, below threshold 100000" (seen on Fatima Begum)
- **Not evaluated:** "no PLT evidence found" (seen on Savitri Bai — no labs at all)

---

### 3. CLIN-CRCL-001 — Creatinine Clearance (Kidney Function)

**What it checks:** Can the patient's kidneys handle the specific drug being given? Different drugs have different kidney thresholds. Cisplatin needs CrCl ≥ 60 mL/min; carboplatin needs ≥ 30 mL/min.

**Threshold:** Varies by drug (per-agent minimum):
- Cisplatin: ≥ 60 mL/min
- Carboplatin: ≥ 30 mL/min
- Methotrexate (high dose): ≥ 60 mL/min
- Pemetrexed: ≥ 45 mL/min
- Capecitabine: ≥ 30 mL/min
- Bleomycin: ≥ 40 mL/min

**Severity:** Blocker

**Guideline:** NCCN; FDA drug labels; Calvert formula (carboplatin dosing)

**What you'll see:**
- **Pass:** "CrCl 89 mL/min (Cockcroft-Gault, age=44 weight=55 cr=0.7) — clears strictest per-agent minimum (60 for cisplatin)"
- The evidence panel shows the full Cockcroft-Gault calculation as a derived value

**Note:** CrCl is calculated, not directly measured. The formula uses age, weight, sex, and creatinine. Saarthi shows the calculation explicitly so the doctor can verify it.

---

### 4. CLIN-BILI-001 — Bilirubin / Liver Function

**What it checks:** Is the patient's liver function adequate for the specific drug? High bilirubin means the liver can't clear the drug safely. Each drug has its own limit.

**Threshold:** Varies by drug:
- Doxorubicin: bilirubin ≤ 1.2 mg/dL, AST ≤ 3× ULN
- Paclitaxel: bilirubin ≤ 1.5× ULN, AST ≤ 10× ULN
- Docetaxel: bilirubin ≤ 1× ULN, AST/ALT ≤ 1.5× ULN

**Severity:** Blocker

**Guideline:** NCCN; FDA drug labels; NCI Organ Dysfunction Working Group

**What you'll see:**
- **Pass:** "bilirubin 0.6 mg/dL clears strictest per-agent absolute (doxorubicin ≤1.2), AST 29 U/L for context"

---

### 5. SURV-LVEF-001 — Heart Function Recency (LVEF)

**What it checks:** Has the patient had a heart scan (echocardiogram) in the last 90 days? Trastuzumab and other HER2-targeted drugs can damage the heart, so regular monitoring is required.

**Threshold:** LVEF measurement within 90 days

**Severity:** Blocker

**Guideline:** FDA Herceptin label; NCCN Breast Cancer v4.2023

**What you'll see:**
- **Pass:** "LVEF measured 45 days ago, within 90-day interval"
- **Fail:** "LVEF last measured 118 days ago, exceeds 90-day surveillance interval" (seen on Lakshmi Narayanan)

---

### 6. SURV-LVEF-002 — Heart Function Decline (LVEF Drop)

**What it checks:** Has the heart function dropped dangerously compared to the baseline? If LVEF drops ≥16 points from baseline, or drops ≥10 points AND current LVEF is below 50%, trastuzumab must be held.

**Threshold:** Hold if:
- (Baseline LVEF - Current LVEF) ≥ 16 points, OR
- Current LVEF < 50% AND (Baseline - Current) ≥ 10 points

**Severity:** Blocker

**Guideline:** FDA Herceptin label; NCCN Breast Cancer v4.2023

**What you'll see:**
- **Pass:** "LVEF stable — no significant decline from baseline"
- **Not evaluated:** "delta rule requires baseline + current LVEF, only 1 measurement on record" (seen on Meera Iyer — need at least 2 measurements to compare)

---

### 7. ENDO-HBA1C-001 — Blood Sugar (HbA1c)

**What it checks:** Is the patient's long-term blood sugar controlled? HbA1c reflects average blood sugar over 3 months.

**Threshold:** HbA1c < 8.5% within the last 90 days

**Severity:** Advisory — NEVER blocks treatment

**Guideline:** CPOC UK 2022; Association of Anaesthetists 2021

**What you'll see:**
- **Pass:** "HBA1C is 5.4, within threshold 8.5" (seen on Fatima Begum)
- **Fail:** "HBA1C is 9.4, at or above threshold 8.5" (seen on Abdul Rahman — flagged but does NOT block)

**Important:** This is advisory by design. CPOC and the Association of Anaesthetists both state that cancer surgery should NOT be deferred for blood sugar optimisation. An elevated HbA1c is noted for the care team but never prevents treatment.

---

### 8. ENDO-DEXA-001 — Bone Density (DEXA Scan)

**What it checks:** Is the patient's bone density scan current? Some cancer treatments (especially aromatase inhibitors) weaken bones. The required scan interval depends on the T-score:
- Normal (T ≥ -1.0): scan every 24 months
- Osteopenia (-2.5 < T < -1.0): scan every 12 months
- Osteoporosis (T ≤ -2.5): scan every 12 months + bone-modifying agent needed

**Severity:** Advisory

**Guideline:** NCCN Breast v4.2024; ASCO/OH(CCO) 2022

**What you'll see:**
- **Pass:** "DEXA T-score -0.5 (normal, T≥-1.0) — 24-month interval, last scan 90 days old, within interval" (seen on Fatima Begum)
- **Not evaluated:** "no T_SCORE evidence found" (seen on many patients — DEXA scan not done)

---

### 9. COV-AUTH-001 — Insurance Pre-Authorization

**What it checks:** Is the patient's pre-authorization for this treatment approved, current, and not conflicting? The system compares the database status with the authorization letter.

**Threshold:** Status must be "approved" and not expired

**Severity:** Blocker

**Guideline:** Institutional payer practice (PM-JAY, IRDAI, NHCX)

**What you'll see:**
- **Pass:** "pre-authorisation approved and current" (seen on Fatima Begum)
- **Not evaluated:** "pre-authorisation status is pending — decision not yet issued" (seen on Priya Sharma)
- **Conflicting:** "pre-auth table status is 'pending' but letter says 'approved' — human reconciliation required" (seen on Gopal Das — the database and the letter disagree)

**This is the flagship conflicting case.** The system finds that one source says "pending" and another says "approved". It does NOT auto-resolve this — a human must look at both and decide.

---

### 10. COV-LIMIT-001 — Annual Coverage Limit

**What it checks:** Has the patient exceeded their annual insurance coverage limit? PM-JAY provides ₹5,00,000 per family per year.

**Threshold:** Used amount < annual limit

**Severity:** Advisory

**Guideline:** PM-JAY scheme rules (₹5 lakh per family per year)

**What you'll see:**
- **Pass:** "used 120000 of annual limit 500000 — within limit" (seen on Fatima Begum)

**Note:** For family-floater policies (where the ₹5 lakh is shared across the whole family), the system reports the patient-level figure only and explicitly states it cannot compute the family's shared remaining balance. This is Rule R3 — report what you know, state what you don't.

---

### 11. DOC-PATH-001 — Pathology Report

**What it checks:** Is there a FINAL pathology report on file? A preliminary or pending report is not sufficient.

**Threshold:** At least one pathology report with status "final"

**Severity:** Blocker

**Guideline:** Institutional standard of care

**What you'll see:**
- **Pass:** "1 pathology report(s) in final status" (seen on Fatima Begum)
- **Not evaluated:** "pathology report status is preliminary/pending"

---

### 12. DOC-HER2-001 — HER2 Status Finality

**What it checks:** Is the HER2 status determined? HER2 determines whether the patient gets trastuzumab. The rules:
- IHC 0, 1+, or 3+ → HER2 status is final (no further testing needed)
- IHC 2+ → FISH/ISH test is REQUIRED to confirm (this is the "reflex" rule)

**Threshold:** HER2 status must be final per ASCO/CAP 2018

**Severity:** Blocker

**Guideline:** ASCO/CAP 2018 (Wolff et al.)

**What you'll see:**
- **Pass:** "HER2 status final from IHC alone: grade=II ihc=1+" (seen on Fatima Begum)
- **Not evaluated:** "HER2 IHC=2 on latest specimen — FISH reflex required, no FISH result on record yet" (seen on Radha Krishnan — IHC 2+ but no FISH done)

---

### 13. DOC-DISC-001 — Biomarker Discordance

**What it checks:** Do the biomarker results from different specimens (e.g., biopsy vs. surgical specimen) agree? If the grade or HER2 status differs between two specimens, this must be flagged — never auto-resolved.

**Threshold:** No discordance across specimens

**Severity:** Blocker

**Guideline:** ASCO/CAP 2018

**What you'll see:**
- **Pass:** "no cross-source discordance detected"
- **Conflicting:** surfaces both values and says "discordant across specimens — never auto-resolved"

---

### 14. ID-LINK-001 — Identity Verification

**What it checks:** Is the patient's identity resolved through ABHA (Ayushman Bharat Health Account) or manually verified? The system never joins records by name — only by verified identity links.

**Threshold:** At least one "abha_linked" or "manually_verified" identity link

**Severity:** Blocker

**Guideline:** ABDM identity architecture

**What you'll see:**
- **Pass:** "2 verified identifier link(s) present (abha_linked or manually_verified)"

---

### 15. ID-QUAR-001 — Quarantined Identity

**What it checks:** Are there any quarantined identity matches? A quarantined match means the system found a possible identity link but it's ambiguous or suspect. Quarantined identities contribute ZERO evidence — they are excluded entirely.

**Threshold:** No quarantined identity matches

**Severity:** Blocker

**Guideline:** ABDM identity architecture

**What you'll see:**
- **Pass:** "no quarantined identity matches on record"

---

### 16. SURG-CLEAR-001 — Post-Operative Clearance

**What it checks:** If the patient had recent surgery, has enough time passed and has the surgeon cleared them to resume chemo? Three things are required:
1. Wound healing status is "adequate" or "healed"
2. Infection status is "resolved"
3. Surgical clearance signed by a practitioner

Plus a minimum interval:
- Default: 21 days (practice consensus, NOT a guideline)
- Anti-VEGF drugs (bevacizumab): 28 days (FDA label — the only hard guideline interval)
- Contaminated wound: 42 days (practice consensus)

**Severity:** Blocker

**Guideline:** FDA bevacizumab label (28-day); NCCN/ESMO perioperative (21-day practice consensus)

**What you'll see:**
- **Pass:** all three assertions documented + interval met
- **Not evaluated:** "surgical clearance documentation not found"

**Important:** The 21-day default and 42-day contaminated-wound intervals are practice consensus — NOT guideline requirements. They are labelled with a provenance note wherever they appear. Only the 28-day anti-VEGF interval is FDA-mandated.

---

## Quick Reference Card

| Rule ID | Short name | What it checks | Blocker? | Key threshold |
|---|---|---|---|---|
| CLIN-ANC-001 | ANC | Neutrophil count | Yes | ≥ 1,500/µL within 7 days |
| CLIN-PLT-001 | Platelets | Platelet count | Yes | ≥ 100,000/µL within 7 days |
| CLIN-CRCL-001 | Kidney (CrCl) | Creatinine clearance | Yes | Per-drug minimum (30-60 mL/min) |
| CLIN-BILI-001 | Liver (bilirubin) | Bilirubin + AST/ALT | Yes | Per-drug ULN multiples |
| SURV-LVEF-001 | Heart scan recency | Echo within 90 days | Yes | Measurement ≤ 90 days old |
| SURV-LVEF-002 | Heart function drop | LVEF decline vs baseline | Yes | ≥16pt drop, or ≥10pt + <50% |
| ENDO-HBA1C-001 | Blood sugar (HbA1c) | Long-term glucose | **No (advisory)** | < 8.5% within 90 days |
| ENDO-DEXA-001 | Bone density (DEXA) | Bone scan currency | **No (advisory)** | 12 or 24 months by T-score band |
| COV-AUTH-001 | Pre-authorization | Insurance approval | Yes | Approved + not expired |
| COV-LIMIT-001 | Coverage limit | Annual cap not exceeded | **No (advisory)** | Used < annual limit |
| DOC-PATH-001 | Pathology report | Final report on file | Yes | At least 1 final report |
| DOC-HER2-001 | HER2 status | HER2 determination complete | Yes | IHC 0/1+/3+ final; 2+ needs FISH |
| DOC-DISC-001 | Discordance | Specimens agree | Yes | No cross-specimen disagreement |
| ID-LINK-001 | Identity linked | ABHA or manual verification | Yes | ≥ 1 verified link |
| ID-QUAR-001 | Identity quarantine | No suspect matches | Yes | 0 quarantined links |
| SURG-CLEAR-001 | Surgical clearance | Post-op clearance documented | Yes | 3 assertions + interval |
