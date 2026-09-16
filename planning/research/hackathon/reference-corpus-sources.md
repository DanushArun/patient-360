# Real Regulatory Documents — Reference Corpus Sources

**Researched 2026-09-16. Confirms which documents are publicly available for the reference corpus (R6).**

> **Headline finding: Every document we need for the reference corpus is publicly available and freely downloadable.** PM-JAY Operation Manual, DPDP Act 2023, NHCX specification, NCG guidelines, NABH standards (partial), ABDM FHIR IG, and the trastuzumab FDA label are all published online. The only limitation is that some are PDFs that need scraping/download rather than API access, and the NCG clinical guidelines are available only as web pages (not downloadable PDFs in all cases).

---

## Document inventory for reference corpus

| Document | URL / Source | Format | Pages (est.) | Status |
|---|---|---|---|---|
| **PM-JAY Operation Manual** | pmjay.gov.in (Downloads section) | PDF | ~200 | ✅ Public, downloadable |
| **DPDP Act 2023** | meity.gov.in / indiacode.nic.in | PDF | ~30 | ✅ Public, downloadable |
| **DPDP Rules 2025** | meity.gov.in (gazette notification) | PDF | ~50 | ✅ Public, downloadable |
| **NHCX Specification** | nhcx.swasth.app / docs.swasth.app | Web + PDF | ~100 | ✅ Public. Some sections require navigation. |
| **ABDM FHIR IG v6.5.0** | nrces.in/ndhm/fhir/r4/ | Web (FHIR IG format) | ~300 web pages | ✅ Public. Structured as a FHIR IG — individual pages, not one PDF. |
| **NCG Clinical Guidelines (Breast)** | tmc.gov.in/ncg/guidelines | Web / PDF | ~50-80 | ✅ Public. Resource-stratified. Check which version is current. |
| **NABH Standards 6th Ed. (IMS chapter)** | nabh.co (publications) | PDF | ~30 (IMS chapter) | ⚠️ Full standards may require purchase. Summary/key sections are in public domain via conference presentations. |
| **IRDAI Annual Report 2024-25** | irdai.gov.in (publications) | PDF | ~300 (full report) | ✅ Public, downloadable. Extract relevant sections on claims/repudiation. |
| **Trastuzumab prescribing information (FDA label)** | accessdata.fda.gov (Drugs@FDA) | PDF | ~30 | ✅ Public, downloadable. Use the full prescribing information, not the patient leaflet. |
| **ESC 2022 Cardio-Oncology Guidelines** | academic.oup.com (European Heart Journal) | PDF | ~130 | ⚠️ Published in EHJ, open access. Large document. |
| **NMC Telemedicine Practice Guidelines 2020** | nmc.org.in / mohfw.gov.in | PDF | ~20 | ✅ Public, downloadable |
| **ICMR AI Ethics Guidelines 2023** | icmr.gov.in | PDF | ~40 | ✅ Public, downloadable |
| **Consumer Protection Act 2019** | indiacode.nic.in | PDF | ~50 | ✅ Public |
| **Bharatiya Sakshya Adhiniyam 2023** | indiacode.nic.in | PDF | ~80 | ✅ Public |

---

## What to actually include in the hackathon corpus

### Tier 1 — Must have (directly cited in demo questions Q1-Q6)
1. **PM-JAY Operation Manual** — Q5 cites "what does the scheme require before this claim is submitted?"
2. **Trastuzumab prescribing information** — LVEF monitoring rules, cardiac hold criteria
3. **NCG Breast Cancer Guidelines** — the oncology-specific readiness rules

### Tier 2 — Should have (strengthens regulatory copilot angle)
4. **DPDP Act 2023 + Rules 2025** — demonstrates real legal text in the corpus
5. **NHCX Specification** — claims/pre-auth workflow reference
6. **NMC Telemedicine Guidelines** — cited in Class A refusal ("only an RMP may decide")

### Tier 3 — Nice to have (breadth signal)
7. **NABH IMS chapter** — medical records requirements
8. **IRDAI Annual Report** (repudiation section only)
9. **ICMR AI Ethics Guidelines**

### Credit budget consideration
At 1 credit/page for AI_PARSE_DOCUMENT, the Tier 1 documents alone are ~250-310 pages = 250-310 credits. On an unpaid trial (10 credits/day), this takes 25-31 days to parse. **On a paid account, it's ~$0.75-1.00 total.**

**Strategy**: parse Tier 1 documents first. If credits allow, add Tier 2. Tier 3 can be ingested as raw text without AI_PARSE_DOCUMENT (they're already structured text).

---

## Download plan

For each document, before ingesting:
1. **Verify it's the current version** — regulation amendments may supersede.
2. **Record the download URL, date, and file hash** — the provenance chain for the reference corpus starts at download.
3. **Store originals on a Snowflake internal stage** — the judge can verify what was actually ingested.
4. **License check**: all listed documents are government publications or open-access academic papers. No copyright restriction on indexing for a non-commercial hackathon demo. State this explicitly in the README.

---

## Sources

pmjay.gov.in · meity.gov.in · nrces.in · tmc.gov.in/ncg · nabh.co · irdai.gov.in · accessdata.fda.gov · nmc.org.in · icmr.gov.in · indiacode.nic.in · nhcx.swasth.app
