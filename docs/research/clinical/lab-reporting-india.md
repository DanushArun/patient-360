# Indian Lab & Pathology Reporting — Parsing Traps

**Researched 2026-09-16. Every trap here is a bug our extraction pipeline will hit if we don't handle it.**

> **Headline finding: Indian lab reports have no enforced standard format.** NABL accreditation mandates certain information elements but not a template. The same test from two labs in the same city can use different units, different reference ranges, different layouts, and different terminology. The extraction pipeline must normalize aggressively and flag anything it cannot normalize rather than guessing.

---

## 1. Unit variants that will break parsing

### Complete Blood Count (CBC)

| Parameter | Unit variant 1 | Unit variant 2 | Unit variant 3 | Conversion trap |
|---|---|---|---|---|
| WBC (Total) | cells/µL | cells/cumm | ×10³/µL | 1 cells/µL = 1 cells/cumm = 0.001 ×10³/µL. "cumm" = cubic millimetre = µL. |
| ANC | cells/µL | ×10⁹/L | % of WBC (requires calculation) | Some labs report ANC directly; others report only differential %. System must calculate: ANC = WBC × (neutrophil% + band%) / 100 |
| Platelets | ×10⁹/L | lakhs/µL | ×10³/µL | **THE MOST DANGEROUS TRAP.** 1 lakh/µL = 100,000/µL = 100 ×10⁹/L. A value of "1.5" could mean 1.5 lakh (150,000 — normal) or 1.5 ×10⁹/L (1,500 — critically low). **Must parse the unit, never the number alone.** |
| Hemoglobin | g/dL | g/L | g% | 1 g/dL = 10 g/L = 1 g%. "g%" is outdated but still seen in Indian reports. |

### Renal function

| Parameter | India standard | SI unit | Conversion |
|---|---|---|---|
| Serum creatinine | mg/dL | µmol/L | mg/dL × 88.4 = µmol/L. India almost universally uses mg/dL. |
| BUN | mg/dL | mmol/L | mg/dL × 0.357 = mmol/L |
| eGFR | mL/min/1.73m² | same | No conversion needed but formula matters: CKD-EPI vs Cockcroft-Gault (oncology uses C-G) |

### Hepatic function

| Parameter | India standard | Notes |
|---|---|---|
| Bilirubin (total) | mg/dL | Universal in India. ULN varies: 1.0-1.2 mg/dL depending on lab |
| AST (SGOT) | U/L or IU/L | Same unit, different abbreviation. ULN varies: 35-40 U/L |
| ALT (SGPT) | U/L or IU/L | ULN varies: 35-45 U/L |
| ALP | U/L or IU/L | ULN varies: 100-130 U/L (highly method-dependent) |

**Critical trap**: "SGOT" and "SGPT" are the Indian/older names for AST and ALT. Many Indian reports use SGOT/SGPT. The extraction must map both.

---

## 2. Indian pathology report format

### Synoptic vs narrative
- **NABL-accredited labs and tertiary cancer centres** (Tata Memorial, AIIMS, large private chains): increasingly use **synoptic** reporting for surgical pathology, especially for cancer specimens. CAP-style checklists adopted at centres with international accreditation.
- **Most district/regional labs**: **narrative** (free-text paragraphs). No structured fields. The diagnosis may be buried in a paragraph.
- **Mixed**: common to see a synoptic template with narrative addenda. The critical values may be in either section.

### CAP synoptic adoption in India
- **Low overall**: estimated <15-20% of pathology labs use formal CAP checklists.
- **Higher at NCG centres**: National Cancer Grid recommends synoptic reporting but does not mandate a specific template.
- **ICMR guidelines** recommend structured reporting for cancer but compliance is voluntary.

### Typical Indian breast pathology report structure
1. **Header**: lab name, patient demographics, specimen ID, referring doctor
2. **Gross description**: specimen type, size, margins
3. **Microscopy**: histological type, grade (Nottingham/Bloom-Richardson), margins, lymphovascular invasion, lymph node status
4. **IHC panel**: ER, PR, HER2, Ki-67 — often on a separate page or addendum
5. **Diagnosis line**: may be at top or bottom depending on lab
6. **Comment/Note**: often contains the critical "addendum to follow" for pending FISH

### Addendum conventions
- **No standard format.** An addendum may be:
  - A separate page with the same specimen/accession number and "ADDENDUM" header
  - An appended paragraph on the original report with a date stamp
  - A completely new report with a reference to the original accession
  - A verbal communication followed by a written report days later
- **The "addendum to follow" phrase**: appears in the original report when IHC is pending or FISH is reflexed. Common variants: "Addendum to follow", "IHC results awaited", "FISH will be reported separately", "Supplementary report to follow."
- **Version tracking**: most labs do NOT version their reports. The addendum implicitly supersedes the relevant section. **Our system must explicitly model supersession** because the lab won't.

---

## 3. HER2 reporting specifics

### IHC scoring
- Reported as 0, 1+, 2+, or 3+ per ASCO/CAP guidelines.
- **Trap**: some reports write "negative" (meaning 0 or 1+), "equivocal" (2+), or "positive" (3+) without the numeric score. The extraction must handle both.
- **Trap**: older reports may use a different scoring system or not specify the clone/antibody used.

### FISH/ISH reflex
- IHC 2+ triggers FISH/SISH/CISH reflex testing.
- **Turnaround**: IHC 2-3 days, FISH 5-7 days. The gap between initial report (IHC 2+) and FISH result is the "addendum to follow" window.
- **Reporting**: FISH result may be on the same report as IHC (if done concurrently) or as a separate addendum.
- **Trap**: some reports say "HER2 equivocal — FISH pending" in the IHC section. This is NOT a final result. The system must not allow trastuzumab initiation on this alone.

### HER2-low
- IHC 1+ or IHC 2+/FISH-negative is now clinically actionable (T-DXd per DESTINY-Breast04).
- **The extraction must capture the granular IHC score**, not just pos/neg, because "HER2-negative" now has clinically distinct subcategories.

---

## 4. CBC report variations

### What varies across Indian labs
- **Automated vs manual differential**: large chains use automated analysers; smaller labs may do manual differential counts (reported as percentages, not absolute counts).
- **ANC reporting**: automated analysers report ANC directly; manual differentials require calculation from WBC × neutrophil%.
- **Flags**: some analysers flag abnormal values with H/L markers; some don't.
- **Reference ranges**: every lab prints its own. No national standard. A "normal" ANC range might be listed as 2000-7000 in one lab and 1500-8000 in another.

### Specimen collection metadata
- **Collection date/time**: usually on the report but format varies (DD/MM/YYYY, DD-Mon-YYYY, etc.).
- **Specimen type**: CBC is typically EDTA whole blood, but not always stated.
- **Fasting status**: not relevant for CBC but reported on metabolic panels — if the extraction captures it by mistake, it introduces noise.

---

## 5. Quality issues that affect extraction

| Issue | Frequency | Impact on extraction |
|---|---|---|
| **Inconsistent units between labs** | Very common | Same patient, two reports, different units for same test. Must normalize. |
| **Missing reference ranges** | Common in smaller labs | Cannot determine if a value is abnormal without external reference. |
| **Handwritten reports** | Still common in district hospitals | AI_PARSE_DOCUMENT OCR quality degrades. Consider flagging these. |
| **Scanned at angle/skew** | Very common (phone photos) | Layout detection fails. The "phone photo" document type needs special handling. |
| **Multiple patients on one page** | Seen in batch-printed lab reports | Specimen ID is the only reliable delimiter, not page boundaries. |
| **Watermarks/stamps** | Common (lab logo, "ORIGINAL" stamp, doctor stamp) | OCR may extract watermark text as content. |
| **Non-English content** | Hindi/regional language headers, bilingual reports | AI_PARSE_DOCUMENT handles this but extraction prompts must expect it. |
| **Abbreviation inconsistency** | Very common | "Hb" vs "Hgb" vs "Hemoglobin"; "PLT" vs "Platelet count" vs "Thrombocyte count" |
| **Report date vs collection date** | Often different, sometimes by days | Must extract both. Collection date is clinically relevant; report date is administrative. |

---

## 6. NABL requirements (what should be on every report)

NABL (ISO 15189:2022 aligned) mandates for accredited labs:
- Lab name and NABL accreditation number
- Patient name, age, sex, unique ID
- Requesting physician
- Specimen type and collection date/time
- Test name, result, unit, reference range
- Method (where clinically significant)
- Authorizing pathologist signature

**In practice**: NABL-accredited labs (~5,000 in India out of ~100,000+ labs) largely comply. Non-accredited labs may omit reference ranges, method, or collection time.

---

## 7. Parsing rules for the extraction pipeline

1. **Always extract the unit alongside the value.** A number without a unit is worthless and dangerous.
2. **Normalize to canonical units immediately**: ANC → cells/µL, platelets → cells/µL (not lakhs), Hb → g/dL, creatinine → mg/dL, bilirubin → mg/dL, AST/ALT → U/L.
3. **Map synonyms**: SGOT→AST, SGPT→ALT, cumm→µL, g%→g/dL, lakhs→×10⁵.
4. **Flag but don't guess**: if the unit is ambiguous or missing, set `missingness_state = unreadable` and surface it for human review. Never assume.
5. **Extract both collection date and report date.** Use collection date for clinical rules (R2 event_time), report date for record tracking (R2 source_recorded_at).
6. **Handle the IHC-2+/FISH-pending state explicitly.** This is `missingness_state = pending`, not "HER2 negative."
7. **Extract accession/specimen IDs** for linking addenda to original reports (supersession chain).
8. **Treat phone-photo documents as lower-confidence.** Flag `ingestion_method = informal_photo` and don't suppress the original if a formal version exists.

---

## Sources

NABL ISO 15189:2022 requirements · CAP Cancer Protocol Templates · ASCO/CAP HER2 Testing Guideline 2018 (Wolff AC et al., JCO) · ICMR reporting recommendations · NCG synoptic reporting guidance · Indian pathology practice surveys (Indian J Pathol Microbiol).
