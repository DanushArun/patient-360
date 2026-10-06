# Clinical completeness: proof, not claims

This folder answers one question: **before a chemotherapy cycle, what must be true, and does Saarthi check it?**

You don't need medical training to verify the answer, and you don't need to trust whoever wrote it. Every requirement is copied word for word from the documents that govern cancer treatment: the regimen protocol, the drug's label, a published nursing checklist, and the PM-JAY manual. A script proves the copying is exact, compares every number against Saarthi's rules, and computes coverage.

## Verify it yourself

```bash
brew install poppler          # once; provides pdftotext (Linux: apt install poppler-utils)
venv/bin/python backend/scripts/verify_clinical_proof.py
```

The script:

1. **Downloads the official documents** and checks each file's fingerprint (sha256). If a publisher has revised a document since it was cited, the report says so.
2. **Finds every quote, word for word, on the stated page.** If one word or number is wrong, it fails. It tells you if the quote is on a different page, or not in the document at all.
3. **Reads each Saarthi rule's numbers from `backend/sql/data/rules.sql`** and compares them to the document's numbers. The script decides "match", "stricter" or "looser", and says which patients are affected.
4. **Refuses dishonest labels.** If a rule is looser than its source, the requirement must be marked `unsafe`. The script fails if it is marked anything kinder.
5. **Writes [`REPORT.md`](REPORT.md)** with the coverage numbers, and [`clinician_review.csv`](clinician_review.csv) for expert review.

To see that the checks can fail, change a digit inside any quote in `requirements.yaml` and run it again.

## What this proves, and what it does not

| Proven by the script | Not proven by the script |
|---|---|
| Each requirement really is in a named, dated, official document | That these documents are the right ones for Indian practice |
| Saarthi's numbers match, or don't match, those documents | That the evaluator code behaves like the rule's numbers (see the `implementation` findings, which are read from code and need a live test) |
| Coverage is a count, not an opinion | Clinical validity. Engineering checks against published protocols are not clinical validation. |

Closing the right-hand column takes three steps:

1. **Expert proof.** Give `clinician_review.csv` to two or three clinicians: an oncologist, an oncology nurse and, ideally, a pharmacist. For each row they answer "required before a cycle in your practice?" and "is Saarthi's status right?", and they add anything missing at the bottom. The share of reviewers who say "required" is the item's content validity index. That is the same method the AIIMS Jodhpur checklist used (its validity index was 0.97). Record their names and roles in the sheet.
2. **Behaviour proof.** Every `implementation` finding has an `expect` case, for example "cisplatin regimen, creatinine clearance 40 mL/min → fail, not pass". Run each case through `evaluate_gates` on a live account using the scratch-patient harness in `backend/scripts/run_rule_fixtures.py`.
3. **Indian sources.** Add National Cancer Grid or Tata Memorial regimen protocols to `sources.yaml` where they are published. The verifier will then compare Saarthi against both.

## Files

| File | What it is |
|---|---|
| `sources.yaml` | Every document quoted, with URL or repo path, revision date and sha256. Also lists the sources not yet verified. |
| `requirements.yaml` | The ledger: quote, page, plain-English meaning, which regimens it applies to, Saarthi's status, numeric comparisons. |
| `REPORT.md` | Generated. The coverage numbers and every finding. |
| `clinician_review.csv` | Generated. The sheet for clinician sign-off. |
| `.cache/` | Downloaded documents (git-ignored). |

## Glossary

| Term | Plain English |
|---|---|
| **CBC & Diff** | Complete blood count with differential: one blood test counting red cells, white cells (by type) and platelets. |
| **ANC** | Absolute neutrophil count: the infection-fighting white cells. Chemo lowers them, and treating when they are low risks a deadly infection. Protocols write "1.5 x10⁹/L", which is the same as 1,500 per microlitre. |
| **Platelets** | Cells that make blood clot. When they are too low, bleeding is the risk. "90 x10⁹/L" = 90,000 per microlitre. |
| **Haemoglobin (Hb)** | The oxygen-carrying protein in red cells. Low haemoglobin is anaemia. |
| **Creatinine / creatinine clearance (CrCl)** | Creatinine is a blood marker of kidney function. CrCl (mL/min) is calculated from creatinine, age, weight and sex (the Cockcroft-Gault formula). Lower means weaker kidneys. Cisplatin and pemetrexed need healthy kidneys. |
| **Bilirubin, ALT, AST** | Liver blood tests. Drugs cleared by the liver (doxorubicin, paclitaxel) need lower doses when these are high. |
| **ULN** | Upper limit of normal, which each lab sets. "1.25 x ULN" means 1.25 times that lab's upper normal value. |
| **micromol/L vs mg/dL** | Two units for bilirubin. Divide micromol/L by 17.1 to get mg/dL. |
| **LVEF, echo, MUGA** | Left ventricular ejection fraction: how strongly the heart pumps, as a percentage (normal is about 55-70%). Measured by an echocardiogram (ultrasound) or a MUGA scan. Trastuzumab and doxorubicin can weaken the heart. |
| **mg/m²** | Dose per square metre of body surface area, calculated from height and weight. That is why weight must be current. |
| **Cumulative dose** | The total of every dose ever received. Doxorubicin's heart damage depends on this lifetime total. |
| **ECOG** | The doctor's 0-5 rating of how well a patient manages daily life (0 = fully active). Assessed in person. |
| **HBsAg, anti-HBc (HBcoreAb), anti-HBs** | Hepatitis B blood tests. Chemotherapy can reactivate a hidden hepatitis B infection. |
| **DPYD test** | A genetic test for the enzyme that breaks down fluorouracil and capecitabine. Without that enzyme, a normal dose can be fatal. |
| **INR** | A clotting test for patients on the blood thinner warfarin. |
| **Pre-authorisation** | PM-JAY's prior approval. Without it, the scheme does not pay. |
| **Tumour board / MDT** | A meeting of surgeon, radiation oncologist and medical oncologist that decides the treatment plan. |
| **Regimen** | The named drug combination and schedule, e.g. AC = doxorubicin (Adriamycin) + cyclophosphamide, every 3 weeks. |
