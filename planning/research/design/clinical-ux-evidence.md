# Clinical UX Evidence Base for Patient-360

**Research compiled: 22 September 2026**
**Scope:** Peer-reviewed and regulatory evidence relevant to designing a clinical information copilot (non-advisory, evidence-display, oncology, India).

**Methodology note:** Primary sources were fetched and read directly where possible. PubMed and several PMC articles were blocked by rate-limiting/reCAPTCHA during this session. Where I cite papers I could not directly re-read in this session, I mark them `[from training knowledge — verify before citing in submission]`. All DOIs and PMCIDs are provided so you can verify. Sources I directly accessed and confirmed are marked `[confirmed]`.

---

## 1. Clinical UI/UX Regulatory and Research Evidence

### 1.1 ONC SAFER Guides (2025 revision) `[confirmed]`

The Office of the National Coordinator (ONC) publishes the **SAFER Guides** — Safety Assurance Factors for EHR Resilience. The 2025 revision consists of eight guides organised into three groups:

- **Foundational:** High Priority Practices (16 recommendations), Organisational Responsibilities
- **Infrastructure:** Contingency Planning, System Management
- **Clinical Process:** Patient Identification, CPOE with Decision Support, Test Results Reporting, Clinician Communication

Key finding for us: The **CPOE with Decision Support** guide specifically addresses "the design, implementation, use, and monitoring of orders and clinical decision support (CDS). This includes order structure, mapping, libraries, alerts, and warnings that users rely on during patient care."

The 2025 update adds a section on **AI-enabled systems** — the Organisational Responsibilities guide now includes "the use of Artificial Intelligence (AI)*-enabled systems, or EHRs with enhanced AI features or functions for the administration, diagnosis, treatment, and management of patient care."

**Source:** ONC/HealthIT.gov, https://healthit.gov/clinical-quality-and-safety/safer-guides/ — regulator guidance, non-peer-reviewed but authoritative.

### 1.2 NIST Health IT Usability Programme `[confirmed]`

NIST has published a substantial body of work on EHR usability through its Health IT Usability initiative, in collaboration with ONC and AHRQ. Key publications:

- **NISTIR 7804** (2012): "A Human Factors Guide to Enhance EHR Usability of Critical User Interactions when Supporting Pediatric Patient Care" — Lowry, Quinn, Ramaiah et al. Establishes scenario-based usability evaluation methods for clinical IT.
- **NISTIR 7741** (2011): "Human Factors Guidance to Prevent Healthcare Disparities with the Adoption of EHRs" — Gibbons, Lowry, Quinn.
- **NISTIR 7742** (2010): "Usability in Health IT: Technical Strategy, Research, and Implementation" — Redish, Lowry.
- **NISTIR 7743** (2010): "NIST Guide to the Processes Approach for Improving the Usability of Electronic Health Records" — Schumacher, Lowry.
- **NISTIR 7988** (2014): "Integrating Electronic Health Records into Clinical Workflow: An Application of Human Factors Modeling Methods to Ambulatory Care"
- **NIST 8095** (2015): "Improving Clinical Workflow in Ambulatory Care" — with VHA Innovation Prototype
- **(2015)** Wiklund et al., "Technical Basis for User Interface Design of Health IT"
- **(2017)** Lowry et al., "Examining the Copy and Paste Function in the Use of Electronic Health Records"
- **Lowry et al. (2015, JMIR):** "Applying Human Factors Principles to Mitigate Usability Issues Related to Embedded Assumptions in Health IT Design" (NISTIR 8042)

The recurring themes across this body of work:
1. **Workflow integration** is the primary driver of EHR usability — technology that disrupts clinical workflow is rejected regardless of its accuracy
2. **Cognitive load** is the central design concern — clinicians are managing multiple patients, interrupted constantly, and making decisions under time pressure
3. **Scenario-based testing** (not just heuristic evaluation) is required to catch real clinical errors
4. **Assumptions embedded in design** (about who reads what, when, in what order) are the hidden source of most usability failures

**Source:** NIST, https://www.nist.gov/programs-projects/health-information-technology-usability — US government agency publications, not peer-reviewed in the journal sense but produced by human factors researchers.

### 1.3 AHRQ EHR Usability Toolkit `[confirmed — PDF accessed but binary]`

AHRQ funded a comprehensive **EHR Usability Toolkit** background report (available at digital.ahrq.gov). The report "identified key shortcomings among certified EHR vendors in the processes, practices and use of standards and best practices with regard to usability and human factors" (per NIST's summary of the AHRQ findings).

**Source:** AHRQ, https://digital.ahrq.gov/sites/default/files/docs/citation/EHR_Usability_Toolkit_Background_Report.pdf — US federal agency.

### 1.4 AHRQ/ONC CDS "Five Rights" Framework `[from training knowledge — verify before citing]`

The widely cited **"Five Rights" of CDS** framework states that effective clinical decision support delivers:
1. The right **information**
2. To the right **person**
3. In the right **format**
4. Through the right **channel**
5. At the right **time** in workflow

This framework was developed through AHRQ-funded work and is referenced in the ONC CDS initiative. It directly applies to our gate-failure notifications.

**Citation:** Osheroff JA, Teich JM, Middleton BF, Steen EB, Wright A, Detmer DE. "A Roadmap for National Action on Clinical Decision Support." JAMIA. 2007;14(2):141-145. doi:10.1197/jamia.M2278

### 1.5 Bates and Gawande on CDS Implementation `[from training knowledge — verify]`

Bates DW, Kuperman GJ, Wang S, et al. "Ten Commandments for Effective Clinical Decision Support: Making the Practice of Evidence-based Medicine a Reality." JAMIA. 2003;10(6):523-530. doi:10.1197/jamia.M1370. PMCID: PMC264429.

Key principles relevant to our system:
- CDS should **fit into clinical workflow** rather than requiring clinicians to adapt
- **Speed is everything** — clinicians will not wait for a system that takes >3 seconds to respond
- Alerts that are overridden >90% of the time are doing active harm (training clinicians to dismiss all alerts)
- **Provide a recommendation, not just an assessment** — but note this conflicts with our Class A/B boundary; we provide evidence, not recommendations

**Source strength:** Highly cited peer-reviewed paper (>2,500 citations per Google Scholar), JAMIA.

---

## 2. Alert and Alarm Fatigue

### 2.1 Override Rates for CDS Alerts `[confirmed — full text read]`

**Phansalkar S, van der Sijs H, Tucker AD, et al.** "Drug–drug interactions that should be non-interruptive in order to reduce alert fatigue in electronic health records." JAMIA. 2013;20(3):489-493. doi:10.1136/amiajnl-2012-001089. PMCID: PMC3628052.

This is one of the most concrete papers on alert fatigue, produced under an ONC-sponsored initiative. Key quantitative findings:

- **Override rates of 49%–96%** for medication-related CDS alerts across studies (citing van der Sijs 2006, Taylor/Tamblyn 2004, Isaac 2009)
- **~90% override rate specifically for drug–drug interaction (DDI) alerts** (citing van der Sijs 2006)
- At one academic medical centre, **4,077 DDI pairs generated 158,794 alerts in 6 months**
- The top 50 most frequently occurring DDI accounted for **51% of all alerts shown to providers**, with average override rates of **95.1%–99.3%**
- Their expert panel identified **33 class-based DDI that could safely be made non-interruptive**, which would reduce alert volume by approximately **one third (36%)**

The paper defines alert fatigue as "the mental state resulting from receiving too many alerts that consume time and mental energy, which can cause important alerts to be ignored along with clinically unimportant ones" (citing Peterson & Bates 2001).

Critical design insight: The paper distinguishes between **interruptive alerts** (requiring user response, blocking workflow) and **non-interruptive alerts** (displayed but not blocking). They recommend converting low-priority alerts to non-interruptive display, not suppressing them entirely.

### 2.2 Van der Sijs Systematic Review `[from training knowledge — verify]`

**van der Sijs H, Aarts J, Vulto A, Berg M.** "Overriding of drug safety alerts in computerized physician order entry." JAMIA. 2006;13(2):138-147. doi:10.1197/jamia.M1809.

The foundational systematic review on alert overrides. Reported override rates across studies:
- Drug-allergy alerts: **65–90% overridden**
- Drug-drug interaction alerts: **78–96% overridden**
- Drug-dose alerts: **55–90% overridden**

Key finding: "High override rates are partly caused by alerts that do not apply to the individual patient." This is the specificity problem — alerts that fire based on generic rules without patient context are correctly overridden but train dismissal behaviour.

### 2.3 Design Factors That Reduce Fatigue `[from training knowledge — verify]`

The literature identifies several evidence-based strategies to reduce alert fatigue:

**a) Tiered severity with differentiated display:**
- Kuperman GJ, Bobb A, Payne TH, et al. "Medication-related clinical decision support in computerized provider order entry systems: a review." JAMIA. 2007;14(1):29-40. doi:10.1197/jamia.M2170.
- Recommendation: Use at least 3 tiers (high/medium/low), with only high-severity alerts being interruptive.

**b) Contextual filtering (patient-specific):**
- Duke JD, Bolchini D. "A successful model and visual design for creating context-aware drug–drug interaction alerts." AMIA Annual Symposium Proceedings. 2011:339-348.
- Include patient parameters (lab values, age, comorbidities) to suppress inapplicable alerts.

**c) Clustering and grouping:**
- Rather than firing 5 separate alerts for related issues, group them into a single contextualised notification.

**d) Non-interruptive display for lower-severity items:**
- The Phansalkar paper [confirmed] explicitly recommends this, and the Weingart study (cited therein) found that "63% of providers took an action other than discontinuing or modifying a prescription in response to an alert" — providers are responding to alert information even when they override.

### 2.4 Direct Application to Our Gate System

Our system has gates (R7 extraction disagreement, missing documents, conflicting sources). The alert fatigue evidence suggests:

1. **Gate failures that block clinical progress** (e.g., "extraction conflict detected — value not asserted") must be interruptive but rare and specific
2. **Informational states** (e.g., "document pending from lab") should be non-interruptive — visible in the status display but not triggering a modal or blocking action
3. **Never show a count without context** — "3 alerts" means nothing; "Final histopathology report not received from [Lab X] since [date]" means everything
4. **Group related issues** — if 4 documents from the same source are all pending, that's one notification about the source, not four about documents

---

## 3. Displaying Uncertainty and Missing Data

### 3.1 The Problem with Confidence Percentages

**Gigerenzer G, Gaissmaier W, Kurz-Milcke E, Schwartz LM, Woloshin S.** "Helping Doctors and Patients Make Sense of Health Statistics." Psychological Science in the Public Interest. 2007;8(2):53-96. doi:10.1111/j.1539-6053.2008.00033.x.

`[from training knowledge — verify]`

This is one of the most cited papers on statistical illiteracy in medicine. Key findings:
- Most physicians cannot correctly interpret **sensitivity, specificity, positive predictive value, or negative predictive value** in isolation
- **Natural frequencies** (e.g., "8 out of 1,000 women") are understood far better than conditional probabilities (e.g., "the probability of breast cancer given a positive mammogram is 7.8%")
- **Single-event probabilities** (e.g., "there is a 30% chance this is malignant") are particularly problematic because they conflate epistemic uncertainty (we don't know) with aleatory uncertainty (it could go either way)

**Gigerenzer G.** "What are natural frequencies?" BMJ. 2011;343:d6386. doi:10.1136/bmj.d6386.

Further argues that probabilities expressed as percentages are inherently misleading for clinical communication.

### 3.2 Spiegelhalter on Risk Communication `[from training knowledge — verify]`

**Spiegelhalter D.** "Visualizing Uncertainty About the Future." Science. 2011;333(6048):1393-1400. doi:10.1126/science.1191181. PMID: 21903802.

Key principles from Spiegelhalter's work on uncertainty visualisation:
1. **Show the data, not just the summary** — icon arrays (e.g., 100 human figures, 8 highlighted) outperform percentages for risk communication
2. **Make uncertainty visible as a first-class property**, not hidden behind a single number
3. **Use multiple representations** — no single format works for all audiences
4. **Acknowledge what is not known** — explicitly showing "we don't know" is more honest than a wide confidence interval

**Spiegelhalter D, Pearson M, Short I.** "Visualizing Uncertainty About the Future." Science. 2011. — Same paper, but also relevant is:

**Spiegelhalter D.** "Risk and Uncertainty Communication." Annual Review of Statistics and Its Application. 2017;4:31-60. doi:10.1146/annurev-statistics-010814-020148.

In the 2017 review, Spiegelhalter specifically argues:
- **Numerical probability formats** (percentages, ratios) should always be accompanied by **verbal descriptors** and ideally **visual representations**
- **The "framing effect"** means that "90% survival" and "10% mortality" produce different decisions despite being identical — this is a deep problem with percentage display
- For uncertainty about evidence states (as opposed to outcome probabilities), **categorical descriptors** with clear definitions are more defensible than continuous scales

### 3.3 Evidence For and Against Our "No Confidence Percentage" Decision

**Arguments for refusing to show confidence percentages (our position):**

1. **Gigerenzer's body of work** (above): physicians systematically misinterpret probabilities; showing "87% confidence" on an extraction result invites exactly the kind of false precision that leads to overtrust or inappropriate distrust
2. **Spiegelhalter's framing work**: a "confidence" percentage for an extracted value conflates model uncertainty, data quality, and clinical significance into a single meaningless number
3. **The anchoring effect** (Tversky & Kahneman, 1974 — foundational cognitive science): once a number is shown, it anchors subsequent judgement regardless of its validity. A "92% confidence" extraction will be treated as near-certain even if the underlying model has known systematic biases.
4. **Regulatory alignment**: NMC Telemedicine Practice Guidelines 2020 (India) prohibit AI platforms from clinical counselling. Displaying confidence percentages on clinical data could be interpreted as the system making a clinical assertion about the reliability of a finding.

**Arguments against our position (intellectual honesty requires stating these):**

1. **Calibrated probabilities can be useful** if the system is well-calibrated and the user is trained to interpret them — but our users include non-clinical navigators, and we cannot assume calibration training
2. **Withholding probability information could be seen as paternalistic** — the counter-argument is that we should show it to clinicians who can interpret it. However, the evidence base (Gigerenzer 2007) suggests that even trained clinicians frequently cannot.
3. **Some uncertainty IS quantifiable** — when we have 2/3 documents received, that's a factual count, not a probability. We do show this kind of concrete state information; what we refuse is model-derived confidence scores.

**Strength of evidence:** The case against confidence percentages is well-supported by multiple high-quality peer-reviewed studies in cognitive psychology and risk communication. The case is strongest when the "confidence" derives from an ML model rather than a simple count. Our approach of showing evidence states ("3 of 5 documents received", "two sources disagree", "final report not received") rather than derived probabilities is well-aligned with this evidence base.

### 3.4 Distinguishing "Unknown" from "Negative" `[from training knowledge — verify]`

**Hripcsak G, Albers DJ.** "Next-generation phenotyping of electronic health records." JAMIA. 2013;20(1):117-121. doi:10.1136/amiajnl-2012-001145.

The EHR phenotyping literature repeatedly identifies the **"absence of evidence is not evidence of absence"** problem as one of the hardest in clinical informatics. When a lab result is missing from the record, it could mean:
- The test was not ordered (clinician decision)
- The test was ordered but not yet resulted
- The test was resulted but not yet transmitted
- The result was transmitted but not yet ingested
- The result was ingested but failed parsing

Our missingness type system (R3: `present · explicitly_negative · pending · not_received · conflicting · unreadable · superseded`) is well-aligned with this recognised problem. I could not find a published system that uses exactly this typology, but the conceptual foundation is well-established in the clinical informatics literature.

**Design implication:** The visual treatment of these states must be **clearly distinct**. A missing value and a negative value must never look the same. The evidence supports using:
- **Explicit verbal labels** (not just colour or icon differences)
- **Different visual weight/prominence** — "not received" should be visually salient (it requires action), while "explicitly negative" should be routine
- **Timestamp context** — "not received as of [date/time]" is more useful than "not received" alone

---

## 4. Citation and Provenance UI

### 4.1 Legal Research Tools as a Model

Legal research systems (Westlaw, LexisNexis, now Casetext/CoCounsel) have the most mature provenance UIs in any domain. Common patterns `[from training knowledge — practitioner knowledge]`:

1. **Inline citation markers** — every factual claim has a superscript or bracketed reference that links directly to the source document
2. **Passage-level linking** — clicking the citation takes you not just to the document but to the **specific passage** that supports the claim
3. **Source reliability signals** — Westlaw's KeyCite and Lexis's Shepard's Citations show whether a legal authority is still valid, has been questioned, or has been overruled. The analogy for us: showing whether a clinical document has been **superseded** by a later version.
4. **Side-by-side verification** — the user can view the system's claim and the source document simultaneously, without navigating away

### 4.2 Clinical Evidence Tools

**UpToDate** (Wolters Kluwer) is the closest clinical analogue. Its pattern:
- Every clinical recommendation is followed by a **strength of evidence grade** (Grade 1A, 1B, 2A, 2B, 2C)
- Clicking the grade shows the underlying studies
- Grading uses the **GRADE framework** (Grading of Recommendations Assessment, Development, and Evaluation) — an international standard

**For our system specifically:**
- We are not grading evidence quality (we're not making recommendations)
- We ARE showing provenance: "This hemoglobin value of 9.2 g/dL was extracted from [document name], page [N], dated [date], by [extraction pass A: llama3.3-70b] and [extraction pass B: claude-haiku-4-5]"
- The user must be able to **click through to the source page** and see the actual text from which the value was extracted
- Where two passes disagree, both extractions and their sources must be visible

### 4.3 Interaction Patterns for Provenance

Based on the legal and clinical evidence tool patterns, the recommended interaction design:

1. **Every displayed datum has a visible provenance indicator** — not hidden behind a hover, but always present (even if compact)
2. **Single-click drill-down** — one click to see the source document excerpt
3. **Two-click full source** — two clicks to see the full source document page
4. **Disagreement is surfaced, not hidden** — when sources conflict, both are shown with their respective provenance
5. **Temporal ordering** — more recent documents are visually distinguished from older ones (supersession is a key concept in medical records)

---

## 5. Glanceability and Clinical Scanning

### 5.1 Eye-Tracking Studies in EHR Use `[from training knowledge — verify]`

**Zheng K, Padman R, Johnson MP, Diamond HS.** "Understanding technology adoption in clinical care: clinician adoption behavior of a point-of-care reminder system." International Journal of Medical Informatics. 2005;74(7-8):535-543.

**Roman LC, Ancker JS, Johnson SB, Senathirajah Y.** "Navigation in the electronic health record: A review of the safety and usability literature." Journal of Biomedical Informatics. 2017;67:69-79. doi:10.1016/j.jbi.2017.01.005. PMCID: PMC5373773.

This systematic review of EHR navigation and safety found:
- **EHR navigation is a significant source of clinical error** — information that exists in the record but is not found due to poor navigation design can lead to patient harm
- **Clinicians develop idiosyncratic scanning patterns** — they do not read records linearly but jump to sections they consider most relevant
- **"Note bloat"** (excessive copy-paste, auto-populated text) makes it harder to find the signal in clinical notes

**Saitwal H, Feng X, Walji M, Patel V, Zhang J.** "Assessing performance of an Electronic Health Record (EHR) using Cognitive Task Analysis." International Journal of Medical Informatics. 2010;79(7):501-506.

Key finding: Clinicians in time-pressured environments develop a **"chart biopsy"** approach — they extract small, targeted pieces of information rather than reading comprehensively. This means:
- **The most critical information must be visible without scrolling** (above the fold)
- **Information hierarchy must match clinical priority**, not document chronology
- **Summary views are essential** — clinicians need a "dashboard" before they need detail

### 5.2 The "Two-Minute Chart Review" `[from training knowledge — verify]`

This is a widely referenced concept in clinical informatics (referenced in multiple AMIA conference proceedings), though I cannot point to a single definitive study that established the "two-minute" figure. The practical reality, documented across multiple workflow studies:

- **Emergency medicine:** Physicians typically spend **<2 minutes** reviewing a patient's chart before initial assessment (multiple studies in Annals of Emergency Medicine, variously cited)
- **Inpatient rounds:** Chart review before seeing a patient is typically **3-5 minutes** per patient on a service of 15-20 patients
- **Oncology (more relevant to us):** Somewhat longer due to complexity, but oncologists report feeling pressure to review cases in **5-10 minutes** before a clinic visit, while the record may contain dozens of documents spanning months

**Tai-Seale M, Olson CW, Li J, et al.** "Electronic Health Record Logs Indicate That Physicians Split Time Evenly Between Seeing Patients and Desktop Medicine." Health Affairs. 2017;36(4):655-662. doi:10.1377/hlthaff.2016.0811.

This study found physicians spend approximately **equal time on "desktop medicine" (EHR work) as on face-to-face patient care** — roughly 50/50. This is not all chart review; much of it is documentation. But it underscores that EHR time is a major component of the clinical workday and efficiency matters.

### 5.3 Eye-Tracking Specifics `[from training knowledge — verify]`

**Howe JL, Adams KT, Hettinger AZ, Ratwani RM.** "Electronic Health Record Usability Issues and Potential Contribution to Patient Harm." JAMA. 2018;319(12):1276-1278. doi:10.1001/jama.2018.1171.

This JAMA research letter analysed FDA-reported safety events related to EHR usability. While not an eye-tracking study per se, it documented:
- **Fragmented information display** was a contributor in the majority of reported events
- **Alert/notification overload** was the second most common category
- Information presented in the **wrong location or format** for the clinical context was a significant factor

Direct eye-tracking studies on EHR use are relatively scarce in published literature. The most relevant:

**Hribar MR, Read-Brown S, Reznick L, Lombardi L, Parikh M, Yackel TR, Chiang MF.** "Secondary Use of Electronic Health Record Data for Clinical Workflow Analysis." AMIA Annual Symposium Proceedings. 2015:737-746.

**Belden JL, Grayson R, Barnes J.** "Defining and Testing EMR Usability: Principles and Proposed Methods of EMR Usability Evaluation and Rating." Healthcare Information and Management Systems Society (HIMSS). 2009.

**Evidence strength note:** The eye-tracking evidence in clinical computing is thinner than I would like. Most studies are small (N<30), often in simulated rather than real clinical environments, and most focus on specific tasks (e.g., medication reconciliation) rather than general chart review patterns. The claim that "clinicians scan rather than read" is well-supported by workflow observation studies, but the specific visual patterns are less precisely documented than in, say, web usability research (where eye-tracking studies by Nielsen Norman Group and others are extensive).

### 5.4 Design Implications for Our System

Based on the available evidence:

1. **Information density should be high but structured** — clinicians prefer dense displays over paginated ones (they scan, not click through), but density without structure causes errors
2. **Use a "summary → detail" progressive disclosure** — the first screen should show the evidence state at a glance (what's present, what's missing, what conflicts), with drill-down for details
3. **Critical states (conflicts, missing data, gate failures) must be in the primary visual field** — not in a sidebar or behind a tab
4. **Use spatial consistency** — the same type of information should always appear in the same location on screen, across patients and sessions
5. **Minimise mandatory scrolling** — if possible, the complete evidence state for one patient should be visible in one viewport

---

## 6. Accessibility in a Clinical Setting

### 6.1 WCAG 2.2 AA Requirements `[from training knowledge — verify against spec]`

WCAG 2.2 (published October 2023 by W3C) at AA level includes these requirements directly relevant to our use case:

**Contrast (Success Criterion 1.4.3):**
- **Normal text (< 18pt / <14pt bold):** minimum contrast ratio **4.5:1** against background
- **Large text (≥ 18pt / ≥14pt bold):** minimum contrast ratio **3:1**
- These ratios are measured using relative luminance, not subjective assessment

**Target Size (Success Criterion 2.5.8 — new in 2.2):**
- Minimum target size: **24×24 CSS pixels** at AA level
- This is critical for touch interfaces in clinical settings where gloves may be worn
- Exception: inline targets within text (links) are exempt but should still be generous

**Non-Text Contrast (Success Criterion 1.4.11):**
- UI components and graphical objects that are needed to understand content must have **3:1 contrast** against adjacent colours

**Colour Independence (Success Criterion 1.4.1):**
- **Colour must not be the sole means of conveying information** — this directly applies to status indicators

### 6.2 Colour-Blindness Considerations

- **Approximately 8% of males and 0.5% of females** of Northern European descent have colour vision deficiency (CVD). Indian population rates are somewhat lower but still significant — studies report **4-8% of Indian males** depending on the regional population studied.
  - **Source:** `[from training knowledge — verify]` Fareed M, Anwar MA, Afzal M. "Prevalence and gene frequency of color vision impairments among children of six populations from North Indian region." Genes & Diseases. 2015;2(2):211-218. doi:10.1016/j.gendis.2015.02.006.
  
- **Red-green deficiency** (protanopia/deuteranopia) is by far the most common form (~75% of CVD cases)

- **Design implication:** Our system uses gates that fire. If gate failure is shown as red and gate pass as green, roughly **1 in 12 male users** cannot distinguish them. Every status must be conveyed through **colour + shape + text** — a "triple encoding" approach.

Specific recommendations:
- Use **shape** (✓ checkmark vs. ⚠ triangle vs. ✕ cross) in addition to colour
- Use **text labels** ("Verified", "Pending", "Conflict") — not just icons
- If using colour, prefer **blue-orange** over red-green (distinguishable by virtually all forms of CVD)
- Test designs with a CVD simulator (e.g., Coblis, or built-in OS accessibility tools)

### 6.3 Indian Multilingual UI Considerations

This is an area where the published evidence is genuinely thin. Key considerations:

**Devanagari (Hindi, Marathi, Sanskrit, Nepali):**
- Devanagari script requires a **headline** (shirorekha) — the horizontal line connecting characters. This means:
  - **Line height must be at least 1.5× the font size** (more generous than Latin text) to avoid the headline of one line touching descenders/matras of the line above
  - Complex conjuncts (ligatures) are common and require **proper OpenType rendering** — system fonts that lack Devanagari conjuncts will display broken text
  - **Recommended fonts:** Noto Sans Devanagari (Google, open source, excellent coverage), Tiro Devanagari (SIL), Mangal (Windows system font but less typographically refined)

- **W3C Indic Layout Requirements:** The W3C has a working draft at https://www.w3.org/TR/ilreq/ (could not access during this session — W3C returned HTTP 403). This document covers line-breaking, justification, and text layout for Indian scripts. Key known requirements:
  - **Never break a conjunct** (multi-character ligature) across lines
  - **Kashida (stretching) is not used** in Devanagari — justify via inter-word spacing only
  - **Numbers:** Indian numbering system uses lakh (1,00,000) and crore (1,00,00,000) separators, not million/billion. Both numeral systems (Devanagari digits and Arabic digits) should be supported.

**Tamil:**
- Distinct script with different line-height requirements
- Tamil script has **fewer conjuncts** than Devanagari but still requires proper font support
- **Recommended font:** Noto Sans Tamil

**Bengali (Bangla):**
- Similar headline (matra) structure to Devanagari
- Complex conjuncts are common
- **Recommended font:** Noto Sans Bengali

**General principles:**
- **Never hardcode font sizes in pixels** — use relative units (rem/em) to respect user font size preferences
- **Test with actual Indic text**, not just Latin placeholders — text expansion in Indian languages is typically **30-50% longer** than English for the same content
- **Right-to-left is NOT a concern** for any major Indian language (all are left-to-right), but **bidirectional text** may appear in mixed English-Hindi contexts
- **Transliteration is not translation** — clinical terms that lack standard translations in Indian languages should be shown in English (or transliterated), not machine-translated. This is a practical reality in Indian clinical settings where English is the language of medical education.

**Evidence strength:** The Indic typography recommendations are based on W3C working drafts and typography best practices, not peer-reviewed clinical studies. There is very little published research specifically on clinical UI design for Indian language scripts. This is a genuine gap in the literature.

---

## 7. Demonstrating Trustworthiness to Judges

### 7.1 The Principle of "Showing the Seams"

This is less a published evidence base and more a design philosophy, but it has support:

**Kizilcec RF.** "How Much Information? Effects of Transparency on Trust in an Algorithmic Interface." CHI 2016 Proceedings. 2016:2390-2395. doi:10.1145/2858036.2858402.

`[from training knowledge — verify]`

This CHI paper studied the effect of algorithmic transparency on user trust. Key finding:
- **Moderate transparency increased trust** compared to no transparency
- **Excessive transparency (full model details) decreased trust** — users found it overwhelming or anxiety-inducing
- The "sweet spot" is showing **what the system did, what it found, and what it couldn't determine** — without exposing internal model details

This directly supports our design approach:
- Show **what was extracted** (and from where)
- Show **what was not found** (and why it matters)
- Show **where sources disagree** (and what the system did about it)
- Do NOT show model confidence scores, extraction model internals, or processing logs

### 7.2 Making a Demo Credible for Technical Judges

Drawing on both the transparency research and practitioner experience with evaluation panels:

**a) Show failures, not just successes:**
- Per AGENTS.md §4: "Failure-and-fix pairs are the most credible lifecycle evidence available."
- This is supported by the transparency literature — systems that only show successes appear unrealistic. A judge who sees the system handle a conflict gracefully (two contradictory lab reports, a missing document, an unreadable scan) trusts the system more than one that only sees green checkmarks.

**b) Show the evidence trail live:**
- When the system says "Hemoglobin: 9.2 g/dL", the judge should be able to click and see the source document with the relevant passage highlighted
- When the system says "Conflict: Hb reported as 9.2 by Lab A and 8.7 by Lab B", the judge should see both documents
- This is the legal research pattern (§4.1) applied to clinical data

**c) Show time provenance:**
- Every piece of data should carry a visible "known as of [datetime]" marker
- This demonstrates that the system is aware of its own information currency
- Per the SAFER guides: temporal awareness is a safety requirement

**d) Show what the system refuses to do:**
- When asked a Class A question, the system should **visibly refuse** and explain why, offering an evidence packet instead
- This is more impressive to a technical judge than never being asked the question

**e) Use real (synthetic) edge cases:**
- A patient with contradictory reports, missing documents, superseded results, and a genuine clinical ambiguity is a better demo than a clean case with everything present
- This demonstrates that the system handles the messy reality of Indian hospital records (mixed languages, scanned handwritten notes, partial documents)

### 7.3 Signal vs. Veneer `[opinion/synthesis]`

**Evidence strength: This section is my synthesis, not a peer-reviewed finding.**

The difference between a trustworthy demo and a polished demo:

| Trustworthy (show the seams) | Polished (hide the seams) |
|---|---|
| "Document not received from path lab since 14 Sept" | Green checkmarks everywhere |
| "Two extraction passes disagreed on tumor grade — showing both" | Single "high confidence" answer |
| "This answer is based on 3 of 5 expected documents" | Answer with no provenance |
| "Class A question refused — generating evidence packet" | Vague disclaimer in footer |
| "Query took 4.2s due to cross-region inference" | Silent 4.2s wait |

The first column communicates engineering discipline. The second communicates wishful thinking. Technical judges (per the rubric: Technical Execution 40%) will recognise the difference.

---

## Summary of Evidence Strength by Topic

| Topic | Evidence Quality | Key Gap |
|---|---|---|
| Alert fatigue / override rates | **Strong** — large systematic reviews, quantitative data, ONC-sponsored work | Most data from US; no studies specific to Indian clinical settings |
| CDS design principles | **Strong** — NIST/AHRQ/ONC body of work, highly cited JAMIA papers | Less evidence on AI-extracted information (vs. rule-based alerts) |
| Uncertainty communication | **Strong** — Gigerenzer, Spiegelhalter, extensive risk communication literature | Limited work specific to clinical information systems (most is patient-facing) |
| Provenance/citation UI | **Moderate** — well-established in legal; less formalised in clinical | No published study comparing provenance UI designs in clinical tools |
| Glanceability / scanning | **Moderate** — workflow studies support the "chart biopsy" pattern; eye-tracking studies are small and often simulated | Thin direct evidence on optimal information density for clinical review tools |
| WCAG 2.2 AA | **Strong** — formal W3C specification with testable criteria | Specification is definitive; the gap is in clinical-specific interpretation |
| Colour-blindness | **Strong** — prevalence well-established, design guidance well-documented | Indian population prevalence less precisely studied than European |
| Indian language typography | **Weak** — W3C working drafts exist but are incomplete; almost no clinical UI research | Major gap — we are largely working from typography best practices, not clinical evidence |
| Transparency / trust in algorithmic systems | **Moderate** — Kizilcec 2016 and related CHI work; replication varies | Most studies are with general public, not clinical professionals |

---

## Key References (Consolidated)

### Directly confirmed (full text accessed this session)
1. ONC SAFER Guides (2025). https://healthit.gov/clinical-quality-and-safety/safer-guides/
2. NIST Health IT Usability Programme. https://www.nist.gov/programs-projects/health-information-technology-usability
3. Phansalkar S et al. "Drug–drug interactions that should be non-interruptive…" JAMIA 2013;20(3):489-493. PMCID: PMC3628052.

### High-confidence citations (verify DOI/PMID before submission)
4. Bates DW et al. "Ten Commandments for Effective Clinical Decision Support." JAMIA 2003;10(6):523-530. PMCID: PMC264429.
5. van der Sijs H et al. "Overriding of drug safety alerts in CPOE." JAMIA 2006;13(2):138-147.
6. Kuperman GJ et al. "Medication-related CDS in CPOE systems: a review." JAMIA 2007;14(1):29-40.
7. Osheroff JA et al. "A Roadmap for National Action on CDS." JAMIA 2007;14(2):141-145.
8. Gigerenzer G et al. "Helping Doctors and Patients Make Sense of Health Statistics." PSPI 2007;8(2):53-96.
9. Spiegelhalter D. "Visualizing Uncertainty About the Future." Science 2011;333:1393-1400.
10. Spiegelhalter D. "Risk and Uncertainty Communication." ARSA 2017;4:31-60.
11. Roman LC et al. "Navigation in the EHR: A review of the safety and usability literature." JBI 2017;67:69-79. PMCID: PMC5373773.
12. Tai-Seale M et al. "EHR Logs Indicate That Physicians Split Time…" Health Affairs 2017;36(4):655-662.
13. Howe JL et al. "EHR Usability Issues and Potential Contribution to Patient Harm." JAMA 2018;319(12):1276-1278.
14. Kizilcec RF. "How Much Information? Effects of Transparency on Trust…" CHI 2016:2390-2395.
15. Lowry SZ et al. Multiple NISTIR publications (7741, 7742, 7743, 7804, 7988, 8042, 8095). 2010-2017.
16. Hripcsak G, Albers DJ. "Next-generation phenotyping of electronic health records." JAMIA 2013;20(1):117-121.

### Lower-confidence citations (need verification)
17. Fareed M et al. "Prevalence and gene frequency of color vision impairments…" Genes & Diseases 2015;2(2):211-218.
18. W3C Indic Layout Requirements. https://www.w3.org/TR/ilreq/ (working draft, could not access)
19. WCAG 2.2. https://www.w3.org/TR/WCAG22/ (could not access during session — W3C returned 403)
