# SAARTHI Research Index

All research for the hackathon build. **24 files, ~5,000 lines, 7 folders.**

---

## 📁 law/ — Indian legal framework (4 files)
What governs us. Every legal boundary the system must respect.

| File | What it answers |
|---|---|
| `law-dpdp.md` | DPDP Act 2023 + Rules 2025. Audit trail is legally required. ANSWER_RUN must store pointers not content. |
| `law-nmc-clinical-practice.md` | NMC telemedicine rules + AI limits. Class A/B split is the correct legal enforcement — only an RMP may practise medicine. |
| `law-cdsco-device.md` | Is our system a medical device? **No**, if scoped to record-state. CDSCO published SaMD guidance July 2026. |
| `law-medical-records.md` | Medical records law, negligence, adverse inference doctrine. Missing records = presumed negligent in Indian courts. |

---

## 📁 clinical/ — Healthcare system & clinical detail (6 files)
How Indian healthcare actually works. Thresholds, units, identities, insurance.

| File | What it answers |
|---|---|
| `clinical-thresholds.md` | Every chemo readiness threshold with guideline citation. ANC, platelets, LVEF, renal, hepatic, HER2. SQL rule specs. |
| `lab-reporting-india.md` | Parsing traps. Platelet "1.5" is ambiguous by 100,000x. Unit variants, SGOT→AST mapping, Indian comma notation. |
| `treatment-timeline-clinical.md` | Day-by-day timing for the entire HER2+ breast cancer treatment. When each test happens, how long results take. |
| `abdm-architecture.md` | ABHA identity system. 780M ABHAs mostly dormant. R4 is correct but must handle no-ABHA patients. |
| `insurance-irdai-nhcx.md` | ₹30,000 cr in claim denials. NHCX specification. 60-70% of denials are preventable before admission. |
| `pmjay-oncology.md` | PM-JAY for cancer. Package rate ₹50K/cycle doesn't cover trastuzumab. Cross-state portability breaks. |

---

## 📁 patient-reality/ — The people this is for (4 files)
Real patient journeys, real struggles, real clinical workflows. The product truth.

| File | What it answers |
|---|---|
| `real-patient-dipali.md` | **Study of 19 actual medical report photos.** 3 hospitals, 7 identifiers, 0 ABHA. Grade discordance, IHC discordance, FISH addendum pattern, unit chaos — all confirmed from real reports. |
| `patient-journey-meera.md` | Complete synthetic patient journey, day by day, from first symptom through 1 year of treatment. Every document, every cost, every delay, every failure scenario. |
| `lived-experience-patients.md` | 14% missed cycles, 52.5% due to caretaker unavailable. The bring-list is the primary output for 85% of users. |
| `lived-experience-clinicians.md` | Coordinator role exists but is rare. Stage 9 (between-cycle) has no human assigned. 9-stage model validated. |

---

## 📁 platform/ — Snowflake constraints & patterns (3 files)
What the platform can and can't do. Read before writing any SQL.

| File | What it answers |
|---|---|
| `platform-constraints.md` | **CRITICAL**: Cortex Search ignores row access policies. Enterprise-only governance. Cross-region needed day one. |
| `snowflake-implementation-patterns.md` | Dynamic tables + semantic views + VQR = what judges expect. sf-hcls-solutions is the benchmark. |
| `streamlit-container-runtime.md` | Container runtime runs as owner role. RAP must use CURRENT_USER(). No persistent filesystem. |

---

## 📁 competition/ — Who we're up against (1 file)
Every PS-04 competitor profiled. Rule ledger showing where each one fails.

| File | What it answers |
|---|---|
| `ps04-competitive-landscape.md` | 4 serious competitors (Verity, ATLAS, SynapseCortex, CareCompass). None implements R2 or R5+R6. Verity is strongest. |

## 📁 Product workflow study

| File | What it answers |
|---|---|
| `health-system-workflow-landscape-2026-09-24.md` | Comparative workflow and chart-pattern study across Indian hospital/clinic products, global EHRs, diagnostic systems and national exchange programmes. Includes evidence limits and SAARTHI-specific implications. |
| `open-source-hospital-workflow-code-review-2026-09-24.md` | Source-level review of selected patient, encounter, chart, queue and hospital workflow paths in OpenMRS, Bahmni, OpenEMR, Open Hospital, LibreHealth and HospitalRun; includes archive/evidence limits. |

---

## 📁 implementation/ — How to build it (4 files)
Technical design decisions, validation pipeline, FHIR prior art.

| File | What it answers |
|---|---|
| `polarity-checking-implementation.md` | AI_FILTER for negation detection. 5-check validation pipeline. We beat Verity on 3 of 5 checks. |
| `evidence-why-citations.md` | 18% safety issues in AI discharge instructions. The 30-second answer for "why do you need citation machinery?" |
| `data-artifact-map.md` | Every table, every row, every field — mapped to Dipali/Meera's journey. Volume model: ~85K rows for 100 patients. |
| `should-close-gaps.md` | Synthetic data best practices, Class A/B edge cases, FHIR prior art (R2 is genuinely novel, R3 partially novel), VQR design. |

---

## 📁 hackathon/ — Competition mechanics (2 files)
What judges score and how to prove CoCo usage.

| File | What it answers |
|---|---|
| `coco-lifecycle-evidence.md` | 4 phases + 7 bonuses. Capture session IDs, failure+fix pairs. Evidence index as a product surface. |
| `reference-corpus-sources.md` | All regulatory docs are publicly downloadable. PM-JAY manual + trastuzumab label + NCG guidelines = Tier 1. |

---

## Single remaining blocker

- [ ] **Empirical test: immutable session attribute vs Cortex Search tool inside an agent.** Requires the live Snowflake account. Decides the final R5 implementation.
