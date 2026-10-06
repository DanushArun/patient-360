# CDSCO / Indian Law: Is Patient-360 a Medical Device?

**Research date:** September 2026
**Bottom line:** A read-only "evidence copilot" that displays patient record
state, surfaces gaps, and explicitly refuses clinical recommendations is
**likely not a medical device** under current Indian law -- but the boundary
is narrow and the regulatory landscape is actively tightening.

---

## 1. Medical Devices Rules 2017 (MDR 2017) -- The Foundation

The Drugs & Cosmetics Act 1940, as amended, governs medical devices in India.
The **Medical Devices Rules 2017** (GSR 78(E), January 31 2017) are the
operative subordinate legislation.

### Definition of "Medical Device" (Rule 2, MDR 2017)

> All devices including an instrument, apparatus, appliance, implant, material
> or other article, whether used alone or in combination, **including a
> software or an accessory**, intended by its manufacturer to be used specially
> for human beings or animals which does not achieve the primary intended
> action in or on human body by any pharmacological or immunological or
> metabolic means, but which may assist in its intended function by such means
> for one or more of the specific purposes of --
>
> (a) diagnosis, prevention, monitoring, treatment or alleviation of any
>     disease or disorder;
> (b) diagnosis, monitoring, treatment, alleviation or assistance for, any
>     injury or disability;
> (c) investigation, replacement or modification or support of the anatomy or
>     of a physiological process;
> (d) supporting or sustaining life;
> (e) disinfection of medical devices;
> (f) control of conception.

**Key point:** Software is explicitly included. Standalone software that meets
any purpose (a)-(f) is a medical device regardless of whether it runs on
dedicated hardware or a general-purpose computer.

### Risk Classification (First Schedule, Part I)

| Class | Risk Level       | Regulatory Pathway           |
|-------|------------------|------------------------------|
| A     | Low              | Registration (Notified Body) |
| B     | Low-Moderate     | Registration (Notified Body) |
| C     | Moderate-High    | Manufacturing/Import Licence |
| D     | High             | Manufacturing/Import Licence |

GSR 102(E) of February 11, 2020 brought all medical devices (not just
"notified" ones) under regulatory control in a phased manner:
- Class C & D: licensed from October 1, 2023
- Class A & B: registered from October 1, 2022
- Class A non-sterile, non-measuring: exempted from licensing per
  GSR 777(E) October 14, 2022

### Key Amendments

- **S.O. 648(E), February 11, 2020**: Expanded the definition to cover *all*
  devices matching the definition, not just those on the "notified" list.
- **GSR 918(E), December 31, 2021**: Unique Device Identification (UDI) rules.
- **GSR 409(E), June 2, 2023**: Further amendments tightening compliance.
- **The New Drugs, Medical Devices and Cosmetics Bill**: Introduced in
  Parliament to replace the 1940 Act entirely. As of September 2026, the Bill
  has been referred to a Standing Committee. It would give CDSCO stronger
  enforcement powers and modernize the device framework.

---

## 2. CDSCO Guidance on Software as a Medical Device (SaMD)

### Classification of Software (September 13, 2021)

CDSCO published "Classification of Medical Device pertaining to Software under
the provisions of Medical Devices Rules 2017." This document classifies
software-type medical devices into risk classes A through D based on the IMDRF
(International Medical Device Regulators Forum) framework that India is a
member of.

### Guidance Document on Medical Device Software (July 21, 2026)

CDSCO released the **"Guidance document on Medical Device Software under
MDR-2017"** (1589 KB, published July 21, 2026). This is the most current and
authoritative CDSCO guidance on SaMD. It covers:

- When standalone software qualifies as a medical device
- Risk classification methodology for SaMD
- Software lifecycle requirements
- Quality management system expectations

### IMDRF-Aligned Risk Framework for SaMD

India follows the IMDRF SaMD risk categorization (IMDRF/SaMD WG/N12, 2014):

| SaMD Category | Significance to Healthcare Decision | State of Healthcare Situation |
|---------------|--------------------------------------|------------------------------|
| IV (Class D)  | Treat or diagnose                    | Critical                     |
| III (Class C) | Treat or diagnose                    | Serious / Non-serious        |
| II (Class B)  | Drive clinical management            | Serious                      |
| I (Class A)   | Drive clinical management / Inform   | Non-serious / any            |

The classification depends on TWO axes:
1. **Significance of information**: Does it treat/diagnose, drive clinical
   management, or merely inform?
2. **State of healthcare situation**: Critical, serious, or non-serious?

**"Inform" is the lowest tier.** Software that only provides information to a
healthcare professional -- without itself suggesting a diagnosis, treatment,
or clinical management action -- lands in the lowest risk category or may fall
outside device regulation entirely.

---

## 3. Clinical Decision Support -- Device or Not?

This is the critical question for Patient-360.

### The MDR 2017 Test

Software is a medical device if it is **intended** for one of the enumerated
purposes: diagnosis, prevention, monitoring, treatment, alleviation of disease.
The manufacturer's **intended use** (as stated in labeling, marketing materials,
and instructions for use) is determinative.

### What CDS Systems Are NOT Devices (Under Indian Law)

The following types of software are generally **excluded** from medical device
regulation:

1. **Administrative/operational software**: EHR systems, practice management,
   scheduling, billing.
2. **General wellness software**: Fitness trackers that don't claim to diagnose
   or monitor a medical condition.
3. **Data display without clinical interpretation**: Software that retrieves,
   displays, or formats patient data from existing records without adding
   clinical analysis, diagnostic suggestions, or treatment recommendations.
4. **Literature/reference tools**: Drug reference databases, clinical
   guidelines viewers, medical calculators where the clinician applies
   independent judgment.

### What CDS Systems ARE Devices

Software becomes a medical device when it:
- Provides a **diagnosis** or diagnostic suggestion
- **Recommends** a treatment or clinical intervention
- Provides **alerts** that a clinician would reasonably act upon without
  independent verification (e.g., "this patient has sepsis")
- **Processes** patient data through an algorithm to generate a clinical
  conclusion

### The US FDA "Four Criteria" Test (Useful Analogy)

The US 21st Century Cures Act (Section 3060) excludes CDS from device
regulation if ALL four criteria are met:

1. Not intended to acquire, process, or analyze a medical image, signal, or
   pattern
2. Intended for the purpose of displaying, analyzing, or printing medical
   information
3. Intended for use by a healthcare professional
4. Intended to enable the healthcare professional to independently review the
   basis for the recommendation (i.e., the software is "transparent")

India does not have an identical statutory carve-out, but CDSCO's
interpretation follows the same logic via the IMDRF framework. The **intended
use** framing is what matters.

---

## 4. Patient-360 Specific Analysis

### What Patient-360 Does

- Aggregates patient records from multiple Snowflake tables
- Displays record state: what exists, what is missing, what is stale
- Identifies gaps in documentation (e.g., "no HbA1c in 6 months")
- Shows timeline of events
- **Never recommends treatment, diagnosis, or clinical action**
- **Never interprets clinical data** (does not say "HbA1c of 9.2 means
  uncontrolled diabetes")
- **Explicitly refuses clinical judgment** when asked

### Classification Assessment

| Factor | Assessment |
|--------|------------|
| Intended use | Display record state, surface gaps |
| Does it diagnose? | No |
| Does it recommend treatment? | No |
| Does it drive clinical management? | Arguable -- gap identification *could* be seen as driving management |
| Does it inform only? | Yes, if properly scoped |
| Healthcare situation severity | Non-serious (administrative/completeness) |
| IMDRF SaMD Category | Below Category I, or Category I at most |
| MDR 2017 Risk Class | Likely not a device; if captured, Class A |

### Risk Assessment

**Arguments it is NOT a device:**
- Intended use is record completeness and administrative awareness, not
  clinical decision-making
- It displays existing data without clinical interpretation
- It does not acquire, process, or analyze medical images/signals
- Clinician must independently decide what action (if any) to take
- The manufacturer (us) explicitly disclaims clinical purpose

**Arguments it COULD be a device:**
- Flagging "no HbA1c in 6 months" could be construed as a clinical reminder,
  which is "monitoring" adjacent
- If a clinician relies on the gap analysis to order tests, the software is
  functionally "driving clinical management"
- CDSCO's expansive definition includes software that assists in "monitoring"
  or "diagnosis" -- gap detection could be stretched into monitoring
- Marketing or user perception may override manufacturer intent if CDSCO
  determines the *de facto* use is clinical

---

## 5. IEC 62304 Applicability in India

IEC 62304:2006+AMD1:2015 (Medical device software -- Software life cycle
processes) is referenced in Indian medical device regulation through:

- **Fifth Schedule of MDR 2017**: Quality Management System requirements
  reference ISO 13485, which in turn references IEC 62304 for software
  lifecycle.
- **BIS Standards**: The Bureau of Indian Standards (BIS) has adopted IEC 62304
  as IS/IEC 62304. The "list of standards published under Medical Equipment
  and Hospital Planning (MHD) of BIS" (updated October 2025) includes this.
- **CDSCO Guidance on MD Software (July 2026)**: Expected to reference
  IEC 62304 as the normative standard for SaMD lifecycle processes.

### Practical Applicability

| If Patient-360 is... | IEC 62304 Required? |
|-----------------------|---------------------|
| Not a medical device  | No (but good practice) |
| Class A device        | Yes -- Safety Class A (lowest); documentation-light |
| Class B device        | Yes -- Safety Class B; full lifecycle documentation |
| Class C/D device      | Yes -- Safety Class C; rigorous verification/validation |

**If we stay outside device regulation**, IEC 62304 compliance is not legally
required but may be useful as a defensive measure if classification is ever
challenged.

---

## 6. CDSCO Notifications on AI/ML in Medical Devices

### Current State (As of September 2026)

India does not yet have a standalone regulatory framework for AI/ML-based
medical devices equivalent to the US FDA's AI/ML SaMD Action Plan. However:

1. **MDR 2017 already covers AI/ML SaMD**: Any software (including AI/ML-based)
   that meets the medical device definition is regulated. The technology used
   (rule-based vs. ML) does not change the classification.

2. **CDSCO Software Classification (2021)**: Includes AI/ML-based software
   in its classification lists. AI/ML diagnostic tools (e.g., AI-based
   radiology screening) have been classified as Class C or D.

3. **CDSCO Guidance on MD Software (July 2026)**: The latest guidance document
   addresses software including AI/ML components. This is the primary
   reference for AI/ML SaMD regulatory expectations in India.

4. **NITI Aayog**: Published papers on responsible AI in healthcare but these
   are policy documents, not enforceable regulation.

5. **ABDM (Ayushman Bharat Digital Mission)**: Focuses on health data
   interoperability and digital health infrastructure, not device regulation.
   ABDM standards govern data exchange, not whether software is a device.

6. **ICMR Ethical Guidelines (2023 update)**: Cover AI in clinical research
   but are ethics guidelines, not device regulations.

### AI/ML-Specific Concerns for Patient-360

Patient-360 does NOT use AI/ML for clinical analysis. If it uses ML for
anything (e.g., NLP to parse notes, embeddings for search), those features
are operational/administrative, not clinical. This further distances it from
AI/ML SaMD regulation.

**However**: If any future feature uses ML to generate clinical insights
(e.g., "this patient is at risk of X"), that feature would instantly bring the
software into SaMD territory, likely Class B or C.

---

## 7. The "Evidence Copilot" Framing Strategy

### How It Works

Framing Patient-360 as an **"evidence copilot that refuses clinical judgment"**
is a deliberate regulatory positioning strategy:

| Framing Element | Regulatory Effect |
|-----------------|-------------------|
| "Evidence" | Positions as data aggregation/display, not analysis |
| "Copilot" | Assistive to clinician, not autonomous |
| "Refuses clinical judgment" | Explicitly disclaims diagnostic/treatment intent |

### What This Means for Classification

If the product genuinely and consistently:
1. Only shows what is in the record and what is missing
2. Never interprets clinical significance of data
3. Never recommends actions, tests, or treatments
4. Presents the data source and basis for any flag (transparency)
5. Requires the clinician to make all clinical decisions independently

Then it is **not a medical device** under MDR 2017, because the intended use
does not fall within purposes (a)-(f) of the definition.

### Where This Framing Can Fail

- **Marketing creep**: If sales materials say "helps doctors catch missed
  diagnoses" or "improves patient outcomes," CDSCO can reclassify based on
  *de facto* intended use regardless of formal labeling.
- **Feature creep**: Adding risk scores, clinical alerts, or diagnostic
  suggestions -- even as "experimental" features -- collapses the argument.
- **User testimonials**: If published case studies describe clinicians using
  Patient-360 to make diagnostic decisions, regulators can infer clinical
  intent.
- **Implicit clinical logic**: If the rules for "gap detection" encode clinical
  guidelines (e.g., "diabetic patients should have HbA1c every 3 months"),
  this embeds clinical knowledge and edges toward "monitoring."

### Defensive Measures

1. **Terms of use**: Explicit disclaimer that the software is not a medical
   device and is not intended for clinical decision-making.
2. **Labeling**: Clear intended use statement limited to "administrative record
   review and completeness assessment."
3. **UI guardrails**: When a user asks a clinical question, the system refuses
   and states it cannot provide clinical guidance.
4. **Marketing review**: All external communications must avoid language
   implying clinical utility for diagnosis or treatment.
5. **Gap rules sourced to administrative standards**: Frame gaps as
   "documentation completeness per hospital policy" rather than
   "clinical care gaps per medical guidelines."
6. **Legal opinion**: Obtain a formal legal opinion from an Indian regulatory
   law firm (e.g., Khaitan & Co, AZB & Partners, Nishith Desai) confirming
   non-device status under MDR 2017.

---

## 8. Recent Developments (2024-2026)

### 2024

- **All Class C/D devices fully under licensing** since October 2023; 2024
  saw enforcement ramp-up.
- CDSCO continued publishing risk classification lists for specialty areas
  (Oncology, Interventional Radiology, etc.).
- **Materiovigilance Programme of India (MvPI)** expanded adverse event
  reporting (new form Version 1.2, October 2024).
- Circular on medical device testing laboratories strengthening (May 2024).

### 2025

- **Risk-based classification list for Class A (non-sterile, non-measuring)**
  published October 2025, completing the classification landscape.
- Updated risk classification lists for Cardiovascular, Neurological, and
  other specialties (drafts April 2025, stakeholder comments invited).
- **Merged existing Medical Devices risk-classification** document published
  January 2025 (33.5 MB) -- a comprehensive consolidation.
- New provisions for manufacturer neutral codes, auto-generated certificates.
- BIS standards list updated (October 2025).

### 2026

- **Guidance document on Medical Device Software under MDR-2017** published
  **July 21, 2026** -- the single most important document for SaMD
  classification. This is the first comprehensive CDSCO guidance specifically
  addressing software as a medical device.
- **Workshop on Medical Devices Frameworks** organized by Danish Medical Agency
  (DKMA) with CDSCO (April 8-9, 2026) -- signals international harmonization
  efforts.
- The New Drugs, Medical Devices and Cosmetics Bill continues in Parliamentary
  process.
- Oncology and Radiotherapy risk classification lists published
  (January/November 2025, extending into 2026 implementation).

---

## 9. Practical Recommendations for Patient-360

### Immediate Actions

1. **Read the July 2026 CDSCO Guidance on MD Software** in full. This is the
   definitive document. Download from CDSCO website (Gazette Notifications
   section, item 1).
2. **Audit all marketing and sales materials** for language that implies
   clinical use.
3. **Document intended use** formally: "Administrative patient record
   aggregation and documentation completeness tool."
4. **Review gap detection rules**: Ensure they reference hospital
   administrative policies, not clinical guidelines.
5. **Implement hard refusal** for any clinical query or recommendation request.

### Medium-Term Actions

1. **Obtain regulatory legal opinion** from an Indian law firm specializing in
   medical device regulation.
2. **Monitor the New Drugs, Medical Devices and Cosmetics Bill** -- it may
   change the device definition or create new software categories.
3. **Consider voluntary IEC 62304 alignment** for the software development
   process as a defensive measure.
4. **Establish a regulatory change monitoring process** -- CDSCO publishes
   frequently and the landscape is shifting.

### Red Lines (Do Not Cross)

- Do not add diagnostic suggestions or differential diagnosis features
- Do not add treatment recommendations
- Do not add clinical risk scores (e.g., APACHE, SOFA, Wells)
- Do not add clinical alerts that imply urgency (e.g., "critical lab value")
- Do not market as reducing diagnostic errors or improving clinical outcomes
- Do not add AI/ML features that generate clinical conclusions
- Do not allow the system to say "the patient should..." or "consider..."

---

## 10. Summary Decision Matrix

| Question | Answer |
|----------|--------|
| Is Patient-360 a medical device today? | **No**, if scoped to record display and gap identification without clinical interpretation |
| Could it become one? | **Yes**, through feature creep, marketing language, or regulatory reinterpretation |
| What is the nearest risk class if captured? | **Class A** (low risk, inform only) |
| Is IEC 62304 required? | **No**, unless classified as a device |
| Does AI/ML regulation apply? | **No**, Patient-360 does not use AI/ML for clinical purposes |
| Is the July 2026 CDSCO guidance relevant? | **Yes** -- must read and verify our position against it |
| Should we get a legal opinion? | **Yes** -- recommended before any hospital deployment |

---

## Sources

1. Medical Devices Rules 2017, GSR 78(E), January 31, 2017 (Gazette of India)
2. S.O. 648(E), February 11, 2020 -- Medical Device Definition expansion
3. GSR 102(E), February 11, 2020 -- Registration of all medical devices
4. CDSCO "Classification of Medical Device pertaining to Software under MDR
   2017" (September 13, 2021)
5. CDSCO "Guidance document on Medical Device Software under MDR-2017"
   (July 21, 2026, 1589 KB)
6. IMDRF/SaMD WG/N10 FINAL:2013 -- SaMD Key Definitions
7. IMDRF/SaMD WG/N12 FINAL:2014 -- SaMD Risk Categorization Framework
8. GSR 777(E), October 14, 2022 -- Class A exemptions
9. GSR 918(E), December 31, 2021 -- UDI requirements
10. BIS Standards list for Medical Equipment (MHD), October 2025
11. IEC 62304:2006+AMD1:2015 -- Medical device software lifecycle processes
12. CDSCO website: cdsco.gov.in (Medical Device & Diagnostics section)
