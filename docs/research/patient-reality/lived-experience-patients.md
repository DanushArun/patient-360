# Patient & Family Lived Experience — Cancer Treatment in India

**Researched 2026-09-16. The emotional spine of the demo and the product truth.**

> **Headline finding: the record-state failure is not an edge case — it is the statistical norm.** 74% of breast cancer patients consult ≥2 facilities, 82.6% face a delay somewhere in the pathway, and the median missed-chemo delay is 13.75 days. The single most commonly cited reason for missed appointments is not money or distance — it is family illness (52.5%), which in the Indian context often means the caretaker who carries the records and navigates the system could not travel. When that person cannot come, the records don't come, and the cycle doesn't happen. The system we build is for that person.

---

## 1. The travel burden — not an anecdote, a statistical reality

### Published evidence
- **85% of Tata Memorial patients come from outside Mumbai**, ~60% from other states entirely (TMC director, ThinkGlobalHealth). A typical referral pattern: district hospital (spoke) → regional cancer centre → TMC Mumbai (hub). Each hop loses records.
- **52.8% of cancer patients report distress financing** (asset sale or borrowing) and travel >500 km (IIPS-TMC study).
- **Non-medical expenditure** (travel, lodging, food, caretaker costs) accounts for a significant portion of total treatment cost. For a family from rural Bihar traveling to Mumbai: train ₹2,000-4,000 round trip × 2 people, lodging ₹500-1,500/night × 3-5 nights, food ₹300-500/day, lost wages for caretaker. Per cycle: ₹10,000-25,000 in non-medical costs alone.
- **The ₹18,000 figure in our demo case (P-017)** is realistic for a single trip from a tier-2/3 city to a metro hub. For a family already in distress financing, this is not an expense — it is a catastrophe if the trip is wasted.

### What "wasted trip" means concretely
The patient and caretaker travel 1,000+ km. They arrive at the hub hospital. One of these happens:
- The pathology report addendum hasn't arrived → the oncologist cannot confirm HER2 status → chemo cannot start → "come back when you have the report."
- The PM-JAY pre-authorization is still pending → hospital won't start treatment until approval comes → "wait 2-3 days" (but the family has money for 1 night).
- The last echo was 4 months ago → trastuzumab requires ≤90-day echo → "get an echo first" → echo appointment is 2 days out → cycle delayed.
- The insurance pre-auth letter says "approved" but the hospital's authorization system says "pending" → nobody can resolve the discrepancy → cycle delayed.

Every one of these is a record-state or coverage-state failure. Every one is preventable with the information that already exists somewhere in the system.

---

## 2. The plastic folder and phone-photo problem

### How records actually travel in India
1. **The plastic folder**: a clear plastic document holder carried by the patient/caretaker. Contains physical copies of: previous discharge summaries, pathology reports, imaging reports, prescriptions, insurance papers, referral letters. Often incomplete — documents from the spoke hospital may not all be in the folder.
2. **Phone photos**: the caretaker photographs reports on their phone. Sent via WhatsApp to the hub hospital's front desk or coordinator. Quality varies from legible to unreadable. No version control — the same report may be photographed multiple times at different angles.
3. **Email**: some facilities email reports, particularly pathology and imaging. But the patient often doesn't have access to the email or doesn't know the report was sent.
4. **ABDM (in theory)**: digital sharing via the ABHA ecosystem. In practice: near-zero for most patients (see abdm-architecture.md).

### What goes wrong
- **Report not in the folder**: the key document (e.g., final pathology addendum) was never given to the patient, or was given but not included in the folder.
- **Wrong version**: the preliminary report is in the folder; the addendum with the final HER2 status was issued later and never reached the patient.
- **Illegible photo**: the phone photo is at an angle, partially cropped, or low resolution. The receiving doctor can't read it and requests the original.
- **No provenance**: the doctor has a printout but doesn't know which lab, which specimen, or which date. The accession number may be cut off in the photocopy.
- **Duplicate confusion**: two pathology reports from two facilities (spoke and hub), with slightly different findings, and no clear indication which supersedes which.

---

## 3. Insurance and financial toxicity

### The denial experience
- **8% industry-wide repudiation** (IRDAI 2024-25) masks the severity: for cancer treatment, denial rates are higher because of longer treatment courses, higher costs, and more documentation touchpoints.
- A family receives a cashless pre-authorization → proceeds with treatment → receives a denial letter weeks later because the discharge summary was "incomplete" → now owes the hospital the full amount.
- PM-JAY patients may receive approval for one cycle but denial for continuation cycles if the documentation for the previous cycle was incomplete.

### Financial toxicity statistics
- **84.2% of breast cancer patients** (n=500, TMC) experience catastrophic health expenditure (>40% of non-food household consumption) or distress financing (PMC11265332).
- **72.4%** report distress financing specifically (asset sale, borrowing, selling livestock/land).
- **OOP (out-of-pocket) expenditure** remains high even for insured/PM-JAY patients because: sub-limits, package rate gaps, non-covered items (supportive medications, anti-emetics, growth factors), and non-medical costs.

---

## 4. Missed chemotherapy cycles

### Scale and causes
- **14% of scheduled chemotherapy visits are missed** with a median delay of 13.75 days (Cancer Reports 2020, PMC7941559, n=870 visits at an Indian tertiary centre).
- **Causes breakdown**:
  - Family illness or domestic problems: 52.5%
  - Financial constraints: 27.5%
  - Transportation problems: 10%
  - Patient's own health (toxicity, complications): 10%

### Why "family illness" is the record-state problem in disguise
"Family illness" in this context usually means the **caretaker** — the person who accompanies the patient, carries the folder, navigates the hospital, talks to the insurance company, and tracks the appointment — is unable to travel. When the caretaker can't come:
- The patient often can't navigate the hospital alone (language, literacy, unfamiliarity with the system).
- The records don't travel (they're in the caretaker's folder/phone).
- The cycle is missed, not because of a clinical reason, but because the human who serves as the patient's "coordinator" is unavailable.

**This is exactly the gap a systematic between-cycle tracking system fills.** A coordinator who reviews the record state before the trip — and generates a document checklist the family can act on — prevents the scenario where the caretaker's absence means the cycle is missed.

---

## 5. Language and literacy barriers

- **Indian medical reports are in English.** Lab reports, pathology reports, discharge summaries, insurance correspondence — all English.
- **A significant proportion of cancer patients and their families do not read English.** This is especially true for patients from rural areas, who form the majority of hub-hospital populations (85% at TMC).
- **The family's interaction with the record is through a translator** — usually a relative who reads English, or a hospital social worker, or nobody. Important nuances (e.g., "IHC 2+ — FISH pending" vs "HER2 positive") are lost in translation.
- **The bring-list in the patient's own language** (Hindi / Tamil / Bengali / Marathi) is not decoration — it is the difference between "bring the FISH addendum" (meaningless to a non-English speaker) and a translated checklist they can show the spoke hospital's front desk.

---

## 6. The between-cycle gap — what actually happens

### When a coordinator exists (rare)
At centres like Tata Memorial that have navigator/coordinator programs:
- Navigator calls the patient 1-2 weeks before next cycle.
- Checks: do they have the reports? Has the authorization been renewed? Are labs drawn?
- Resolves gaps before the trip: calls the spoke hospital for missing reports, contacts the insurer for pending authorization.
- **The missed-cycle rate at well-coordinated centres is lower.** But these programs are limited to a few centres and often depend on individual staff rather than institutional systems.

### When no coordinator exists (the norm)
- Nobody tracks the between-cycle gap.
- The patient/family is on their own to: remember the appointment, gather reports, check insurance, arrange travel.
- Missing reports are discovered at the hub hospital on the day of the appointment — too late.
- Authorization delays are discovered at the front desk — too late.
- The cycle is missed. The next appointment is 3-4 weeks out. The delay compounds.

---

## 7. Direct quotes and specific accounts

### From published research
- *"Of the 870 visits studied, 14% were missed. The median delay was 13.75 days. The predominant reason was family sickness (52.5%)."* — Cancer Reports 2020

- *"83.2% of households with cancer experienced catastrophic health expenditure. 52.8% resorted to distress financing."* — IIPS-TMC study

- *"84.2% of breast cancer patients experienced catastrophic expenditure; 72.4% reported distress financing."* — PMC11265332

- *"74% of breast cancer patients consulted ≥2 facilities; 82.6% experienced a delay."* — PMC12374521

- *"32% experienced delayed chemotherapy initiation."* — PMC12374521

### From journalism
- Families selling agricultural land to fund cancer treatment travel (The Hindu, Economic Times reporting on TMC financial counselling data).
- PM-JAY patients turned away because the hospital's oncology empanelment had lapsed — discovered only after the family traveled from another state (RTI-based reporting).
- Patients waiting 3-4 days in Mumbai for a PM-JAY pre-authorization to clear, sleeping in hospital corridors because they can't afford lodging.

---

## 8. Design implications

1. **The bring-list is not a nice feature — it is the primary output for 85% of the user base.** Most families interact with the system through the caretaker, who needs a concrete checklist before traveling.

2. **Translation of the bring-list is essential, not decorative.** A checklist in English for a family that reads Hindi is a checklist that doesn't get read.

3. **The between-cycle window is where the system adds the most value.** Not at the point of care (the oncologist has 2-5 minutes and will act on what's in front of them) but in the 14-21 days between cycles when gaps can be resolved before they become wasted trips.

4. **"Family illness" causing missed cycles is the navigator-absence problem.** The system is the always-available navigator that the 52.5% who missed due to "family illness" didn't have.

5. **The coverage gate must fire before the trip, not at the hospital.** A coverage denial discovered at the front desk after a 1,400 km trip is the most harmful failure mode. The gate must surface pending/denied/conflicting authorizations during the between-cycle window.

6. **Phone-photo documents must be modeled as a first-class ingestion path.** Not an edge case — it's how a majority of records travel. Flag as lower confidence, require verification, but don't reject.

---

## Sources

PMC7941559 (missed chemo cycles, Cancer Reports 2020) · PMC11265332 (breast cancer financial toxicity, TMC) · PMC12374521 (breast cancer delays and facility hopping) · IIPS-TMC catastrophic expenditure study · ThinkGlobalHealth (TMC patient origin data) · Indian Express / The Hindu / Economic Times reporting on cancer care access · PM-JAY grievance data (RTI).
