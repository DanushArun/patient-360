# PM-JAY Oncology — Pre-Authorization, Documentation & Failure Modes

**Researched 2026-09-16. Feeds the coverage gate rules for government-scheme patients.**

> **Headline finding: PM-JAY covers oncology under ~1,000 procedure packages, but the documentation requirements and approval workflow create a systematic gap between coverage-on-paper and treatment-in-practice.** The pre-authorization step is digital (via TMS portal) but the required supporting documents — referral letter, diagnosis confirmation, treatment plan — are often physical and must be uploaded as scans. Missing or illegible uploads are the #1 cause of delayed approvals. For a patient traveling 1,400 km, a pre-auth delay = a wasted trip.

---

## 1. PM-JAY Health Benefit Package (HBP) for oncology

### Coverage scope
- **~1,393 procedures** in HBP 2.0 (current), of which approximately 100+ are oncology-specific.
- **Breast cancer packages** (examples):
  - Medical management of breast cancer (chemotherapy): ₹50,000 per cycle (package rate)
  - Modified radical mastectomy: ₹45,000-60,000
  - Radiation therapy (per course): ₹10,000-25,000 depending on type
  - Targeted therapy (trastuzumab): covered under "Medical management" but the package rate may not cover the actual drug cost for a full year of trastuzumab.
- **₹5 lakh/family/year** ceiling. For a trastuzumab-containing regimen over 12 months, this ceiling is often exhausted within 3-4 cycles.
- **No investigation-only package**: diagnostic workup (biopsy, PET-CT, IHC/FISH) must be bundled with a treatment package or may not be separately reimbursable.

### What's NOT covered
- Oral chemotherapy taken at home (some states have added exceptions).
- Experimental/investigational treatments.
- Treatment at non-empanelled hospitals.
- Costs exceeding the package rate (balance billing is prohibited but happens).

---

## 2. Pre-authorization workflow (TMS portal)

### Steps
1. **Patient registration**: hospital verifies PM-JAY eligibility via Ayushman card / Aadhaar / beneficiary ID on the Beneficiary Identification System (BIS).
2. **Case creation**: hospital creates a case on TMS portal specifying the package code, planned procedure, and estimated cost.
3. **Document upload**: hospital uploads supporting documents:
   - Referral letter from primary/secondary facility
   - Diagnosis confirmation (histopathology report)
   - Treatment plan (regimen, number of cycles planned)
   - Patient photo + ID proof
   - Previous treatment records (if continuation)
4. **Pre-auth review**: State Health Agency (SHA) medical officer reviews within **24-48 hours** (mandate) — actual turnaround varies by state (24 hours in well-run SHAs, 3-7 days in others).
5. **Approval/denial**: approved with package code + amount, or denied with reason code.
6. **Treatment**: hospital proceeds with treatment.
7. **Claim submission**: hospital submits final claim with discharge summary, treatment details, bills.
8. **Claim adjudication**: SHA reviews and approves for payment.
9. **Payment**: NHA releases funds to hospital (target: 15 days from claim approval).

### Pre-auth required documents (oncology)
| Document | Required? | Common failure |
|---|---|---|
| Histopathology report | Mandatory | Report still pending (addendum to follow), or only cytology available |
| Referral letter | Mandatory | Patient self-referred; no formal referral exists |
| Treatment plan / oncologist note | Mandatory | Handwritten, illegible, or doesn't specify regimen and cycle count |
| Previous treatment summary | If continuation | Patient treated at different hospital; records not available |
| Patient photo | Mandatory | Mismatch between photo and patient (identity verification) |
| IHC/FISH (for targeted therapy) | Required for trastuzumab | IHC 2+ without FISH — pre-auth for trastuzumab may be denied |

---

## 3. Common PM-JAY denial/failure modes for oncology

### Pre-auth denials
1. **Incomplete documentation** (~30% of denials): missing or illegible uploads. The referral letter is the most commonly missing document.
2. **Package code mismatch** (~20%): hospital selected wrong package code, or the diagnosis doesn't match the requested package.
3. **Empanelment issue** (~15%): hospital is empanelled but not for the specific oncology package, or empanelment has lapsed.
4. **Ceiling exhausted** (~10%): ₹5 lakh family ceiling already used.
5. **Investigation-only request** (~10%): hospital trying to get pre-auth for diagnostic workup alone, which requires a treatment package.
6. **Multiple state issue** (~5%): patient from State A seeking treatment in State B; portability agreement not in place or SHA State A denies cross-state case.
7. **Beneficiary verification failure** (~5%): Aadhaar mismatch, photo mismatch, card not found in BIS.

### Post-treatment claim denials
1. **Discharge summary gaps**: incomplete surgical/pathology details.
2. **Treatment deviated from pre-auth**: different drug or additional procedures not pre-authorized.
3. **Duplicate claims**: same case submitted twice (often due to TMS portal errors).
4. **Late submission**: claim submitted beyond the allowed window (typically 30 days post-discharge).

---

## 4. The package rate problem

PM-JAY package rates are fixed nationally but cancer treatment costs vary dramatically:
- **Trastuzumab** (biosimilar): ~₹20,000-25,000 per cycle. At 17 cycles (1 year), total drug cost alone = ₹3.4-4.25 lakh — within the ₹5 lakh ceiling, but leaving almost nothing for other costs.
- **Package rate for "medical management of breast cancer"**: ₹50,000 per cycle. This is supposed to cover the drug, administration, monitoring, and hospital charges. For a trastuzumab + pertuzumab + taxane regimen, ₹50,000 doesn't cover the drug cost alone.
- **Hospitals absorb the gap or refuse PM-JAY patients for expensive regimens.** This is a known, documented problem — hospitals either refuse to empanel for oncology or treat patients on cheaper regimens that fit the package.

### What this means for the coverage gate
The gate must model not just "is there approval?" but "does the approved amount cover the planned treatment?" This is a Class B question — factual comparison between approved amount and estimated treatment cost.

---

## 5. Portability — the cross-state problem

- **PM-JAY is portable across states** in theory: a beneficiary from Bihar can seek treatment in Mumbai.
- **In practice**: the beneficiary's home SHA (Bihar) must approve the case. Some SHAs routinely deny or delay out-of-state cases.
- **The hub-and-spoke model breaks here**: a spoke hospital in a small-town Bihar refers to Tata Memorial in Mumbai. The Bihar SHA may take 5-7 days to approve, during which the patient is already in Mumbai, money running out.
- **Portability failures are among the most harmful**: the patient has already traveled, already spent on transport and lodging, and then the pre-auth is denied.

---

## 6. Design implications for the coverage gate

1. **Pre-auth status must be checked against required documents.** If pre-auth = pending and histopathology report is missing → surface the specific document gap as an actionable item.

2. **Model the package rate vs estimated cost comparison.** `approved_amount < estimated_treatment_cost` is a coverage gap the system should flag — not as a denial, but as an advisory ("approved amount may not cover full treatment cost").

3. **Track ceiling utilization.** If ₹3.5 lakh of ₹5 lakh ceiling is already used and the next cycle costs ₹50,000 but 4 more cycles are planned, flag that the ceiling will be exhausted mid-treatment.

4. **Portability status is a first-class field.** `authorization.portability_status ∈ {same_state | cross_state_approved | cross_state_pending | cross_state_denied}` — because the failure mode is different from a medical denial.

5. **The "investigation vs treatment" split must be modeled.** A diagnostic workup without a treatment package may not be reimbursable. Flag when only investigation is planned and no treatment package is linked.

6. **PM-JAY beneficiary verification is an identity gate.** If ABHA and PM-JAY IDs don't match, or photo verification fails, pre-auth will be denied. This links to R4 (identity).

---

## Sources

PM-JAY Health Benefit Packages 2.0 (pmjay.gov.in/hi/HBP) · PM-JAY TMS Portal documentation · PM-JAY Annual Reports (NHA) · PM-JAY grievance data (RTI responses) · State SHA performance reports · NITI Aayog PM-JAY evaluation studies · Newspaper reports on PM-JAY oncology coverage gaps (Economic Times, The Hindu, Indian Express) · Hospital empanelment guidelines (pmjay.gov.in).
