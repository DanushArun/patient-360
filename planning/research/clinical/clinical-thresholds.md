# Clinical Thresholds for Chemotherapy Readiness

Reference document for the SQL rule engine. Each threshold includes the value,
source guideline, and caveats relevant to implementation.

---

## 1. Absolute Neutrophil Count (ANC)

**Threshold:** ANC >= 1500 cells/uL (1.5 x 10^9/L) to proceed with cytotoxic
chemotherapy.

**Source:** NCCN Guidelines - Myeloid Growth Factors (Version 2.2023). Also
reflected in ASCO Clinical Practice Guideline on Use of White Blood Cell Growth
Factors (Smith TJ et al., J Clin Oncol, 2015;33(28):3199-3212).

**Detail:**
- Most standard-dose regimens require ANC >= 1500/uL on Day 1 of each cycle.
- Some regimens (e.g., weekly paclitaxel) may permit ANC >= 1000/uL per
  protocol-specific criteria.
- Dose reduction or delay is triggered when ANC < 1500/uL at scheduled
  cycle start.
- Febrile neutropenia (ANC < 500/uL + fever >= 38.3C) is an emergency,
  not a "delay" scenario.

**SQL rule caveats:**
- The rule should be `ANC >= 1500` as default, with regimen-level overrides.
- ANC is calculated: WBC x (% neutrophils + % bands) / 100. Some labs report
  it directly; others require calculation from CBC differential.
- Flag if ANC result is > 7 days old at cycle start date.

---

## 2. Platelet Count

**Threshold:** Platelets >= 100 x 10^9/L (100,000/uL) for most cytotoxic
regimens.

**Source:** NCCN Guidelines (regimen-specific pages across disease sites).
CTCAE v5.0 defines Grade 1 thrombocytopenia as < 150 x 10^9/L but treatment
hold threshold is consistently 100 x 10^9/L in most protocols.

**Detail:**
- Carboplatin, cisplatin, gemcitabine: >= 100 x 10^9/L required.
- Some protocols (e.g., gemcitabine monotherapy maintenance) permit
  >= 75 x 10^9/L.
- Dose reductions are typically tiered:
  - 75-99: reduce dose by 25% (regimen-dependent).
  - 50-74: hold treatment.
  - < 50: hold + evaluate for transfusion.

**SQL rule caveats:**
- Default rule: `platelets >= 100000` (stored as cells/uL in most Indian labs).
- Unit normalization is critical. Indian labs may report as "1.0 lakh/uL"
  (= 100,000/uL = 100 x 10^9/L). The ETL layer must normalize.
- Regimen-level override table needed for protocols allowing >= 75,000.

---

## 3. LVEF Monitoring for Trastuzumab (and Other HER2-Targeted Agents)

### 3.1 Monitoring Interval

**FDA Label (Herceptin prescribing information):**
- Baseline LVEF assessment before initiation.
- Repeat every 3 months during treatment.
- Repeat at treatment completion.

**NCCN Guidelines (Breast Cancer, Version 4.2023):**
- Baseline LVEF.
- Every 3 months during adjuvant trastuzumab.
- Clinical judgment for metastatic setting (may extend if stable).

**ESC 2022 Cardio-Oncology Guidelines (Lyon AR et al., Eur Heart J,
2022;43(41):4229-4361):**
- Baseline LVEF by echocardiography (preferably 3D echo or CMR).
- Repeat at 3 months, 6 months, 9 months, 12 months during adjuvant
  trastuzumab.
- For metastatic: at least every 3 months for the first year, then can
  extend to every 6 months if stable.
- Recommends GLS (global longitudinal strain) in addition to LVEF for
  early detection.

**The 3-Monthly vs 4-Monthly Debate:**
- PMC8700071 (Dhir V et al., "Cardiac monitoring during adjuvant
  trastuzumab therapy") argues that 4-monthly monitoring may be
  non-inferior to 3-monthly in low-risk patients (no prior cardiac
  disease, normal baseline LVEF, no concurrent anthracycline).
- The SAFE-HEaRt study and real-world data suggest that in low-risk
  patients, extending to 4 months does not increase cardiac event rates.
- However, no major guideline body has formally adopted 4-monthly as
  standard. NCCN and FDA label remain at 3 months.

### 3.2 LVEF Decline Triggers

**FDA Label:**
- Hold trastuzumab if LVEF drops >= 16 percentage points from baseline, OR
- Hold if LVEF is below institutional lower limit of normal (typically 50%)
  AND drop is >= 10 percentage points from baseline.
- Reassess in 4 weeks. Discontinue permanently if no recovery after 3 holds.

**NCCN:**
- Consistent with FDA label.
- Absolute LVEF < 50% with >= 10% drop from baseline: hold and re-evaluate.
- Absolute LVEF < 40%: strong consideration for permanent discontinuation.

**ESC 2022:**
- More granular risk stratification:
  - New LVEF < 50%: hold, start cardioprotective therapy (ACE-I/ARB + BB),
    reassess in 2-3 weeks.
  - LVEF drop > 10% but still >= 50%: continue with close monitoring +
    consider cardioprotection.
  - GLS drop > 12% relative from baseline (even with preserved LVEF):
    consider cardioprotection.
- ESC is more aggressive on early cardioprotection, less aggressive on
  permanent discontinuation.

### 3.3 SQL Rule Design

```
-- Primary rule (FDA label / NCCN aligned):
HOLD if:
  (baseline_lvef - current_lvef) >= 16
  OR (current_lvef < 50 AND (baseline_lvef - current_lvef) >= 10)

-- Alert if:
  Days since last LVEF assessment > 90 (for adjuvant)
  Days since last LVEF assessment > 90 (for metastatic, first year)

-- Soft alert (ESC-informed, optional):
  GLS relative decline > 12% from baseline
```

**Caveats:**
- LVEF measurement variability between echo and MUGA is 5-10%. The method
  must be consistent across assessments for the same patient.
- Indian reality: GLS is not routinely available outside tier-1 centers.
  Default to LVEF-only rules; make GLS rules optional/configurable.
- Baseline LVEF must be captured before the first trastuzumab dose, not
  before the first anthracycline dose (these may differ by weeks).

---

## 4. Renal Function Thresholds (Creatinine Clearance)

Calculated via Cockcroft-Gault formula (CrCl) or measured GFR. Most oncology
protocols use Cockcroft-Gault, NOT CKD-EPI.

### Agent-Specific Thresholds

| Agent | Minimum CrCl | Action if Below | Source |
|-------|-------------|-----------------|--------|
| Cisplatin | >= 60 mL/min | Contraindicated below 60. Switch to carboplatin. | NCCN; FDA label |
| Carboplatin | >= 30 mL/min (for Calvert dosing) | Dose by AUC using Calvert formula. CrCl < 15: avoid. | NCCN; Calvert AH et al., J Clin Oncol, 1989 |
| Methotrexate (high-dose) | >= 60 mL/min | Hold. Risk of fatal toxicity with impaired clearance. | NCCN |
| Pemetrexed | >= 45 mL/min | Contraindicated below 45. | FDA label; NCCN NSCLC |
| Capecitabine | >= 30 mL/min | Reduce dose 75% for CrCl 30-50. Avoid below 30. | FDA label |
| Bleomycin | >= 40 mL/min | Dose reduce by 50% for CrCl 25-40. Avoid below 25. | NCCN Hodgkin |

### SQL Rule Design

```
-- Store agent-specific thresholds in a reference table:
-- CHEMO_RENAL_THRESHOLDS(agent_name, min_crcl, action_code)

-- Cockcroft-Gault calculation:
-- CrCl = ((140 - age) * weight_kg * [0.85 if female]) / (72 * serum_creatinine_mg_dl)
```

**Caveats:**
- Cockcroft-Gault uses actual body weight. Some institutions cap at ideal
  body weight for obese patients. This is not standardized.
- Indian labs report creatinine in mg/dL (same as US). No unit conversion
  needed for Cockcroft-Gault.
- Serum creatinine alone is insufficient. A creatinine of 1.0 mg/dL in a
  60-year-old 45 kg woman yields CrCl ~42 mL/min (cisplatin contraindicated).
  The rule engine MUST calculate CrCl, not just check creatinine.
- Carboplatin dosing by Calvert formula (AUC-based) is a separate concern
  from the readiness check, but uses the same GFR input.

---

## 5. Hepatic Function Thresholds

Hepatic impairment is classified by the NCI Organ Dysfunction Working Group
criteria (not Child-Pugh, which is for chronic liver disease).

### NCI Organ Dysfunction Classification

| Group | Bilirubin | AST |
|-------|-----------|-----|
| Normal | <= ULN | <= ULN |
| Mild | <= 1.5x ULN | any |
| Moderate | 1.5-3x ULN | any |
| Severe | > 3x ULN | any |

### Agent-Specific Thresholds

| Agent | Bilirubin Limit | AST/ALT Limit | Action | Source |
|-------|----------------|----------------|--------|--------|
| Doxorubicin | <= 1.2 mg/dL | AST <= 3x ULN | Reduce 50% for bili 1.2-3.0; 75% for > 3.0 | NCCN; FDA label |
| Paclitaxel | <= 1.5x ULN | AST <= 10x ULN | Complex tiered dose reduction. Avoid if bili > 5x ULN. | FDA label |
| Docetaxel | <= ULN | AST/ALT <= 1.5x ULN AND ALP <= 2.5x ULN | Contraindicated if any exceeded | FDA label; NCCN |
| 5-FU / Capecitabine | <= 3x ULN | No strict cutoff | Use clinical judgment; no formal dose modification in label | NCCN |
| Gemcitabine | Use caution > 1.6x ULN | No strict cutoff | No formal recommendations; limited PK data in hepatic dysfunction | FDA label |

### SQL Rule Design

```
-- Reference table: CHEMO_HEPATIC_THRESHOLDS(agent_name, max_bilirubin_x_uln,
--   max_ast_x_uln, max_alt_x_uln, max_alp_x_uln, action_code)

-- Lab values must be normalized to multiples of ULN:
-- ratio = patient_value / lab_upper_limit_of_normal

-- ULN varies by lab. Must store ULN per lab/assay or use institution default.
```

**Caveats:**
- ULN for bilirubin, AST, ALT varies across Indian labs. The system must
  either (a) store lab-specific ULN or (b) use a configurable institutional
  default (e.g., bilirubin ULN = 1.2 mg/dL, AST ULN = 40 U/L).
- Gilbert syndrome (benign unconjugated hyperbilirubinemia, ~5% prevalence)
  causes isolated bilirubin elevation. Clinicians may override the hold.
  The rule engine should flag but allow clinician override with reason.
- Liver metastases commonly cause elevated LFTs. The thresholds above still
  apply; the clinician decides whether the benefit outweighs risk.

---

## 6. HER2 Testing Requirements

### Testing Algorithm (ASCO/CAP 2018 Guidelines - Wolff AC et al.,
J Clin Oncol, 2018;36(20):2105-2122)

**Step 1: IHC (Immunohistochemistry)**
- 0 or 1+: HER2-Negative. No further testing required.
- 2+: Equivocal. MUST reflex to FISH/ISH.
- 3+: HER2-Positive. No further testing required.

**Step 2: FISH/ISH (if IHC 2+)**
- HER2/CEP17 ratio >= 2.0 AND HER2 copy number >= 4.0: Positive.
- HER2/CEP17 ratio >= 2.0 AND HER2 copy number < 4.0: Positive (with
  additional confirmatory criteria per ASCO/CAP 2018).
- HER2/CEP17 ratio < 2.0 AND HER2 copy number >= 6.0: Positive.
- HER2/CEP17 ratio < 2.0 AND HER2 copy number >= 4.0 and < 6.0:
  Equivocal. Retest on new specimen or alternative assay.
- HER2/CEP17 ratio < 2.0 AND HER2 copy number < 4.0: Negative.

### When is an Addendum Required?

An addendum to the original pathology report is required when:

1. **Reflex FISH after IHC 2+:** The FISH result is typically issued as an
   addendum to the original surgical pathology report. This is the most
   common addendum scenario.
2. **Retesting on a different specimen:** If initial testing is equivocal
   or technically unsatisfactory, retesting on a new biopsy or the surgical
   specimen generates an addendum or new report.
3. **Discordant results:** If IHC and FISH are discordant (e.g., IHC 3+ but
   FISH negative), ASCO/CAP recommends retesting and the result is an addendum.
4. **Change in HER2 status on recurrence/metastasis:** Retesting on metastatic
   tissue may yield a different result. This is a new report, not technically
   an addendum, but must be reconciled.

### What Constitutes a "Final" HER2 Result?

For the SQL rule engine, a HER2 result is "final" when:

- IHC 0, 1+, or 3+: The IHC result itself is final.
- IHC 2+: NOT final until FISH/ISH result is available. The system must
  block trastuzumab initiation on IHC 2+ alone.
- FISH result after IHC 2+: This is the final result.
- Any "equivocal" FISH: NOT final. Requires retest.

### SQL Rule Design

```
-- HER2 status determination:
-- FINAL if ihc_score IN ('0', '1+', '3+')
-- FINAL if ihc_score = '2+' AND fish_result IS NOT NULL
--   AND fish_result != 'EQUIVOCAL'
-- NOT FINAL (block trastuzumab) if ihc_score = '2+' AND fish_result IS NULL
-- NOT FINAL if fish_result = 'EQUIVOCAL'
```

**Caveats:**
- HER2-low (IHC 1+ or IHC 2+/FISH-negative) is now clinically actionable
  for trastuzumab-deruxtecan (T-DXd) per DESTINY-Breast04 trial. The rule
  engine should capture the granular IHC/FISH result, not just pos/neg.
- Indian pathology labs vary in FISH availability. Some centers use CISH
  (chromogenic ISH) instead. The system should accept ISH broadly.
- Turnaround time: IHC is ~2-3 days; FISH is ~5-7 days. The "IHC 2+ pending
  FISH" state can persist for a week. The rule engine must handle this
  intermediate state explicitly.

---

## 7. Indian NCG Resource-Stratified Guidelines

### Source
National Cancer Grid (NCG) India - Evidence-Based Management Guidelines.
Available at: https://tmc.gov.in/ncg/guidelines

### Key Differences from NCCN/ASCO

| Parameter | NCCN/ASCO | NCG (India) | Notes |
|-----------|-----------|-------------|-------|
| ANC threshold | >= 1500/uL | >= 1500/uL | **No difference** for standard regimens |
| Platelet threshold | >= 100,000/uL | >= 100,000/uL | **No difference** |
| LVEF monitoring | Every 3 months | Every 3 months (echocardio preferred) | NCG aligns with NCCN. Acknowledges MUGA may be unavailable. |
| HER2 testing | IHC + reflex FISH | IHC mandatory; FISH recommended but "if available" | **Key difference.** NCG acknowledges FISH may not be available at all centers. IHC 3+ alone may drive treatment in resource-limited settings. |
| CrCl calculation | Cockcroft-Gault | Cockcroft-Gault | No difference in formula |
| Renal thresholds | Same per-agent | Same per-agent | NCG adopts international thresholds |
| Hepatic thresholds | Same per-agent | Same per-agent | NCG adopts international thresholds |
| GLS monitoring | ESC recommends | Not mentioned | GLS not widely available in India |
| Cardioprotection | ESC 2022 detailed | "Consider cardiology referral" | Less prescriptive |

### Practical Differences for Implementation

1. **FISH availability:** The system should not hard-block trastuzumab if
   IHC 3+ is available but FISH is not, in the Indian context. NCCN would
   also allow this (IHC 3+ is definitive), but IHC 2+ without FISH is the
   real gap. NCG permits clinical judgment here; NCCN does not.

2. **MUGA vs Echo:** NCG does not require MUGA. Echo (2D, not necessarily 3D)
   is the standard. The system should accept "echocardiogram" as the LVEF
   source without requiring modality specification.

3. **Resource-stratified regimen recommendations:** NCG provides alternative
   regimens for resource-limited settings (e.g., oral CMF instead of AC-T for
   breast cancer). These have different toxicity profiles and therefore
   different monitoring requirements. The rule engine should be regimen-aware,
   not just drug-aware.

4. **Biosimilar trastuzumab:** Widely used in India. Same LVEF monitoring
   requirements. No rule difference.

---

## 8. Medication Status: Ordered vs Administered vs Dispensed

These are distinct lifecycle states in clinical systems (EHR/pharmacy). The
rule engine must distinguish them because they answer different questions.

### Definitions

| Status | Meaning | System of Record | Clinical Question Answered |
|--------|---------|------------------|---------------------------|
| **Ordered** | A clinician has entered a medication order/prescription. The drug has NOT been given to the patient. | CPOE / EHR order entry | "Is there an intent to treat?" |
| **Dispensed** | Pharmacy has prepared and released the medication. For inpatients, it is sent to the ward. For outpatients, it is handed to the patient. The drug has NOT necessarily been administered. | Pharmacy Information System | "Is the drug physically available?" |
| **Administered** | The drug has been given to the patient (IV infusion started, injection given, oral dose witnessed). Documented by nursing. | MAR (Medication Administration Record) | "Did the patient actually receive the drug?" |

### Why This Matters for the Rule Engine

1. **Chemotherapy readiness checks apply at the "Ordered" stage.** The system
   should evaluate lab thresholds BEFORE the order is fulfilled/administered.
   An alert at the "Administered" stage is too late.

2. **"Ordered" does not mean "given."** An order can be:
   - Active (awaiting dispensing/administration)
   - Held (clinician paused it)
   - Cancelled (clinician rescinded it)
   - Discontinued (stopped after being active)
   - Completed (fully administered)

3. **"Dispensed" without "Administered"** can indicate:
   - Patient did not show up for infusion.
   - Drug was returned to pharmacy (waste).
   - Drug is pending administration (normal lag for oral meds).

4. **For the patient-360 system:**
   - Use "Ordered" status to trigger pre-treatment readiness checks.
   - Use "Administered" status to confirm treatment was actually given
     (for cycle counting, interval calculations, cumulative dose tracking).
   - Use "Dispensed" status for pharmacy/inventory reconciliation, which
     is out of scope for clinical decision support but relevant for
     billing/audit.

### HL7 FHIR Mapping

| Our Status | FHIR MedicationRequest.status | FHIR MedicationAdministration.status |
|------------|-------------------------------|--------------------------------------|
| Ordered | active, on-hold | (not applicable) |
| Dispensed | (see MedicationDispense resource) | (not applicable) |
| Administered | completed | completed, in-progress |
| Cancelled | cancelled | not-done |

### SQL Rule Implications

```
-- Readiness check trigger:
-- Fire when medication_status = 'ORDERED'
--   AND medication_category = 'CHEMOTHERAPY'
--   AND administration_date IS IN FUTURE (or today)

-- Cycle counting:
-- Count only records where medication_status = 'ADMINISTERED'

-- Cumulative dose (e.g., doxorubicin lifetime dose):
-- SUM(dose) WHERE medication_status = 'ADMINISTERED'
--   NOT 'ORDERED' (orders may be cancelled or dose-modified)
```

---

## Summary: Default Thresholds for SQL Rule Engine

| Check | Default Threshold | Override Level |
|-------|-------------------|----------------|
| ANC | >= 1500/uL | Per-regimen |
| Platelets | >= 100,000/uL | Per-regimen |
| LVEF (trastuzumab) | Last assessment <= 90 days ago | Per-risk-group |
| LVEF decline (hold) | Drop >= 16% from baseline OR (< 50% AND drop >= 10%) | Fixed (FDA label) |
| CrCl (cisplatin) | >= 60 mL/min | Fixed |
| CrCl (carboplatin) | >= 30 mL/min (for dosing) | Fixed |
| CrCl (pemetrexed) | >= 45 mL/min | Fixed |
| Bilirubin (docetaxel) | <= ULN | Fixed |
| AST (docetaxel) | <= 1.5x ULN | Fixed |
| HER2 final status | IHC 0/1+/3+ OR IHC 2+ with FISH | Fixed |
| Medication status for readiness | ORDERED (not administered) | Fixed |

---

*This document is a reference for building SQL rules. Clinical decisions
remain with the treating oncologist. All thresholds should support clinician
override with documented reason.*
