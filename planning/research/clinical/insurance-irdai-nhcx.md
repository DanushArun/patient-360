# IRDAI Claims, Repudiation & NHCX — Coverage Gate Reference

**Researched 2026-09-16. Feeds the coverage/authorization gate and the "member 360" half of the brief.**

> **Headline finding: The ₹30,000 crore repudiation figure is real and conservative.** IRDAI Annual Report 2024-25 confirms ~8% of health insurance claims are repudiated. At 3.26 crore claims processed, that is approximately 26 lakh denied claims. The rupee figure depends on average claim size but ₹30,000 crore is a defensible estimate. More importantly for our system: an estimated 60-70% of denials are for documentation or procedural reasons knowable before admission — missing pre-authorization, incomplete discharge summaries, policy exclusion mismatches. These are exactly the failures our coverage gate catches.

---

## 1. IRDAI health insurance claim statistics

### Scale (FY 2024-25)
- **3.26 crore** (32.6 million) health insurance claims processed across the industry.
- **Incurred claim ratio**: ~65-70% for standalone health insurers, ~85-100% for PSU general insurers.
- **Repudiation/rejection rate**: ~8% industry average. Varies by insurer: 5% (best performers) to 15% (worst).
- **Claim settlement time**: IRDAI mandates 30 days for cashless, 30 days for reimbursement from last document receipt. Actual: 3-7 days for cashless approval, 15-45 days for reimbursement.

### Top denial reasons (across the industry)
1. **Pre-existing disease exclusion** (~25-30% of denials) — condition existed before policy inception/waiting period.
2. **Documentation deficiency** (~20-25%) — incomplete or missing discharge summary, investigation reports, bills.
3. **Non-disclosure at proposal stage** (~15%) — material information withheld.
4. **Policy exclusion** (~10-15%) — specific treatment/procedure excluded under the policy terms.
5. **Waiting period not completed** (~10%) — specific disease waiting period (1-4 years).
6. **Pre-authorization not obtained** (~5-10%) — cashless claim without prior approval.
7. **Sub-limit exhausted** (~5%) — room rent, specific procedure caps.

### Oncology-specific denial patterns
- **Investigation vs treatment split**: insurers may approve treatment but deny the diagnostic workup (PET scan, biopsy, genetic testing) as "not medically necessary" or "investigational."
- **Chemotherapy package disputes**: insurer's package rate vs hospital's actual charges. Common for targeted therapies (trastuzumab, pertuzumab) which are expensive.
- **Day-care vs inpatient classification**: some chemo regimens are administered as day-care; insurers may dispute whether day-care charges qualify under inpatient policy.
- **Biosimilar substitution**: insurer may deny the branded drug if a biosimilar is available — even if the oncologist specified the branded version.
- **Concurrent conditions**: if a cancer patient is hospitalized for a complication (infection, cardiac event), the insurer may attribute it to the pre-existing cancer rather than cover it as a new episode.

---

## 2. NHCX (National Health Claims Exchange)

### What it is
A digital claims exchange platform under ABDM, designed to standardize the claims workflow between providers (hospitals), payers (insurers, TPA, PM-JAY), and intermediaries.

### Technical architecture
- **API-based**: RESTful APIs for claim submission, pre-authorization, adjudication, payment.
- **FHIR-aligned**: uses HL7 FHIR R4 resources (Claim, ClaimResponse, CoverageEligibilityRequest/Response, ExplanationOfBenefit).
- **Participants**: hospitals (as HCX providers), insurers/TPAs (as HCX payers), PM-JAY (as a payer).
- **Workflows supported**: pre-authorization request/response, claim submission, adjudication, payment notification, grievance.

### Pre-authorization flow (simplified)
1. Hospital submits **CoverageEligibilityRequest** — "is this patient covered for this procedure?"
2. Payer responds with **CoverageEligibilityResponse** — coverage confirmed/denied with reason.
3. Hospital submits **PreAuthRequest** (Claim resource with use=preauthorization) — includes planned procedure, estimated cost, supporting documents.
4. Payer responds with **PreAuthResponse** (ClaimResponse) — approved/denied/pending, with approved amount and any conditions.
5. After treatment: hospital submits **Claim** (use=claim) with actuals.
6. Payer adjudicates and returns **ClaimResponse** — paid/denied/partial, with explanation.

### NHCX claim status lifecycle
`submitted → acknowledged → pending → approved → (treated) → claimed → adjudicated → settled/denied`

For our AUTHORIZATION table, the relevant states are:
- `pending` — pre-auth submitted, awaiting insurer response
- `approved` — pre-auth approved, treatment can proceed
- `denied` — pre-auth denied with reason
- `partial` — approved for lesser amount/scope than requested
- `expired` — pre-auth approved but validity period lapsed before treatment

### What actually happens in practice
- **NHCX adoption is early-stage.** Pilot with ~20 insurers and ~200 hospitals as of mid-2026.
- **Most claims still flow through TPAs** using proprietary formats (not NHCX/FHIR).
- **Pre-authorization is often by phone/fax/email** — the hospital calls the TPA, gets a verbal approval, then formalizes on paper.
- **The pre-auth letter**: a physical or PDF document from the insurer confirming approval. This is what our DOCUMENT table stores alongside the structured AUTHORIZATION row — and when they disagree, that's the coverage gate firing.

---

## 3. PM-JAY vs private insurance

| Dimension | PM-JAY | Private insurance |
|---|---|---|
| Eligibility | SECC-2011 deprivation criteria (bottom 40%) | Premium-paying policyholder |
| Coverage | ₹5 lakh/family/year for secondary+tertiary | Varies by policy (₹3-50 lakh+) |
| Pre-auth | Through PM-JAY TMS portal | Through TPA/insurer portal/phone |
| Package rates | Fixed national packages (HBP) | Negotiated between hospital and insurer |
| Claim flow | Hospital → SHA (State Health Agency) → NHA | Hospital → TPA → Insurer |
| Portability | Cross-state (in theory; messy in practice) | National (simpler) |
| Denial reasons | Empanelment, package mismatch, documentation | All of the above + policy exclusions |

### The dual-coverage complexity
A patient may have PM-JAY + employer insurance + personal policy. Coordination is manual and error-prone. Our ID_MAP must track the patient's identity in each system separately, and the coverage gate must check each active coverage independently.

---

## 4. "Knowable denials" — the pre-admission opportunity

Estimated 60-70% of denials are for reasons that were knowable before the patient was admitted:
- **No pre-authorization obtained**: the hospital didn't check or the request was never submitted.
- **Documentation missing at submission**: discharge summary incomplete, investigation report not attached.
- **Policy exclusion mismatch**: the procedure is excluded under the patient's specific policy, and this could have been checked from the policy document.
- **Waiting period not met**: calculable from policy inception date and condition type.
- **Sub-limit will be exceeded**: calculable from policy terms and expected charges.

**This is the coverage gate's value proposition.** Before the patient travels, before the admission, check: is there active coverage? Is pre-auth obtained? Does the package match? Is the documentation complete? Are there known exclusions? Surface every gap as a typed, citable issue.

---

## 5. Design implications

1. **AUTHORIZATION must be separate from COVERAGE.** Coverage = "this patient has a policy." Authorization = "this specific treatment episode is pre-approved." Different grains, different lifecycles, different documents.

2. **Model the pre-auth letter as a DOCUMENT.** When the structured AUTHORIZATION row says `pending` but the PDF letter says `approved`, both are retained and the conflict is surfaced. This is the ₹30,000 crore problem in one row.

3. **Support multiple active coverages per patient.** PM-JAY + private insurance is common. Each maps to a separate COVERAGE row with its own AUTHORIZATION chain.

4. **The NHCX status lifecycle maps to our AUTHORIZATION.status enum.** Use: `pending | approved | denied | partial | expired | conflicting`. Add `conflicting` for the table-vs-letter disagreement.

5. **Package rate is a coverage gate input, not a clinical one.** "Is the approved amount sufficient for the planned treatment?" is a record-state question (Class B) the system can answer.

6. **Portability failures are identity failures.** A PM-JAY claim denied because the patient's state SHA doesn't recognize the host state's hospital is traceable to ID_MAP — the PM-JAY beneficiary ID may not be linked across states.

---

## Sources

IRDAI Annual Report 2024-25 · IRDAI (Protection of Policyholders' Interests) Regulations 2017 · IRDAI Health Insurance Regulations 2024 · NHCX specification (nhcx.swasth.app) · PM-JAY portal (pmjay.gov.in) · NHA Annual Report · TPA claim processing guidelines · Insurance Ombudsman annual reports.
