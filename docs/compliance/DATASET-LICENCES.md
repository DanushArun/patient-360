# Dataset and licence inventory

Prepared 4 Oct 2026 (FIX-ROUND-5) for the hackathon T&C requirement to identify datasets and licences for non-Snowflake
data. Everything below was checked against the files in this repository; where a licence could not be established from
the repo it says **not verified in repo** rather than guessing. The team must confirm those rows before submission.

## 1. Patient data in the system: synthetic only

Every patient, encounter, lab result, authorisation and document loaded into the system is synthetic.

| Item | Where | Provenance |
|---|---|---|
| 12 patients (PAT-DEEP-0001, PAT-DC-01..11) | `backend/sql/data/load_synthetic.sql`, `load_daycare_cohort.sql` | Authored by the team; PAT-DEEP-0001 driven by `data/generator/ledger.py` (deterministic per seed) |
| 22 cohort PDFs (11 lab, 11 histopathology, one per PAT-DC patient) | `data/generated/pdf/cohort/DOC-*` | Rendered by `data/generator/cohort_documents.py` from `data/generated/cohort_events.json` (an export of the synthetic `CLINICAL_EVENT` rows). Generator output, owned by the team |
| Other generated PDFs | `data/generated/pdf/` (`ambiguous_cbc.pdf`, `EVT-*`, `LETTER-PA-DC-07`) | `data/generator/` (`_pdf_render.py`, `corruptions.py`, `documents.py`) |
| FHIR bundles | `data/generated/fhir/`, `data/generated/fhir_bundle.json` | `data/generator/fhir_bundles.py`, `fhir_from_db.py` from the synthetic rows |
| `data/synthetic_docs/lab_cbc_meera_20260908.pdf` | repo | Synthetic CBC report for a fictional patient |
| `data/fixtures/` (`patients.json`, rule fixtures) | repo | Authored by the team |
| Eval questions | `data/eval/dev.jsonl` (40), `held_out.jsonl` (40) | Authored by the team (`data/generator/eval_questions.py`) |

Names, IDs, dates and facility names in these files are fictional or placeholders. No real ABHA numbers are used (the
deep case has none by design).

## 2. The 19 real medical reports: what the repo does and does not contain

The team studied 19 photographed real medical reports, shared by a patient's family (a team member's relative; consent
reported by the team, not documented in the repo), **to learn document formats and workflows only**.

* **No scan, photo or PDF of those reports is in the repository** (checked: tracked image/PDF/DOCX files were listed;
  none correspond to them).
* **A written research note derived from them is in the repository:**
  `planning/research/patient-reality/real-patient-dipali.md`. It records, from the real reports, a **patient name,
  district and pincode, employer-scheme, diagnosis, IHC/FISH values, staging and facility roles**. It is a planning
  document, is not loaded into Snowflake, and no system data is taken from it. **It is nevertheless personal health
  information about a real person in a public submission.** Recommendation for the team before the freeze: redact
  the name, address and identifiers (or remove the file from the submitted tree) and keep only the format observations.
  Related, less identifying notes: `lived-experience-patients.md`, `lived-experience-clinicians.md`,
  `patient-journey-meera.md` (name suggests a composite; not verified).
* `AGENTS.md` and the README state "synthetic data only in the system"; that statement is accurate for the system and
  database, and this section is the exact statement about the planning corpus.

## 3. Reference corpus (public documents, `data/reference/`)

Indexed into the reference Cortex Search service (R6). Page counts read from the PDFs on 4 Oct; they total 692, matching
the 692 pages reported loaded on OS69400. The repo does not store a download URL, retrieval date or licence per file
(`planning/research/hackathon/reference-corpus-sources.md` states an intent to record them and a general expectation that
the documents are government publications or open access); **per-file source URLs and licence terms: not verified in
repo**.

| File | Pages | Publisher (from filename and PDF metadata) | Licence / terms |
|---|---|---|---|
| `aiims_rishikesh_standard_treatment_guidelines.pdf` | 431 | Government of Gujarat, Standard Treatment Guidelines, First Edition 2013 (title-page attribution; filename misleading) | not verified in repo |
| `fda_herceptin_trastuzumab_label_2024.pdf` | 38 | US FDA prescribing information (trastuzumab) | not verified in repo (US regulatory label) |
| `icmr_breast_cancer_consensus_2016.pdf` | 42 | ICMR | not verified in repo |
| `icmr_stw_breast_cancer.pdf` | 1 | ICMR Standard Treatment Workflow, breast cancer | not verified in repo |
| `icmr_type2_diabetes_guidelines_2018.pdf` | 82 | ICMR | not verified in repo |
| `ncg_breast_cancer_guidelines_2019.pdf` | 34 | National Cancer Grid, Breast Cancer Management Guidelines 2019 | not verified in repo |
| `pmjay_health_benefit_package_2.2_manual.pdf` | 64 | National Health Authority, PM-JAY HBP 2.2 manual | not verified in repo (government publication) |
| `data/reference/_retired/who_emro_diabetes_mellitus_standards_of_care.pdf` and the same file in `data/synthetic_docs/` | n/a | WHO EMRO | retired from the corpus; not verified in repo |

The same-day 16 Sept note expects all of these to be government publications or open access with no restriction on
indexing for a non-commercial demonstration. That is an expectation recorded by the team, not a licence check.
Clinical thresholds that the rules cite are tabulated with sources in `evidence/clinical/README.md`; thresholds are
facts used for synthetic engineering tests, not clinical guidance.

## 4. Other non-synthetic files in the tree

| File | What it is | Status |
|---|---|---|
| `dashboard-design/`, `planning/dashboard-release/evidence/` | Design screenshots and storyboards of the synthetic dashboard | Team-produced images of synthetic data |
| `frontend/public/saarthi-mark.png`, `frontend/app/icon.png`, `frontend/app/apple-icon.png`, `frontend/app/favicon.ico` | SAARTHI heart-and-stethoscope logo (sidebar mark, browser-tab and Apple touch icons) | Supplied by the team on 5 Oct 2026 as a PNG; how it was produced and its licence are not recorded in the repo, to be confirmed by the team. Replaces the earlier `carethread-mark.svg` |
| Fonts `frontend/public/fonts/` and `frontend/static/` | Inter (4 weights), JetBrains Mono (2 weights), Material Symbols Rounded (`MaterialSymbols-Rounded.woff2`) | Publisher licence notices added under `frontend/public/fonts/`; Inter/JetBrains notices also under `frontend/static/`. Local TTF name tables confirm SIL OFL 1.1 (Inter 4.000, JetBrains Mono 2.304). Google documents Material Symbols as Apache 2.0. Checked 5 Oct 2026; binary publisher identity for the WOFF2 remains unverified |

## 5. Third-party software

Read from `frontend/package.json`, `frontend/package-lock.json`, `frontend/node_modules/*/package.json` (`license` field) and
`importlib.metadata` in `./venv`, on 4 Oct 2026. Only a licence field is reported here; it is not legal advice.

### Direct dependencies, `frontend/package.json` (19)

| Package | Installed | Licence |
|---|---|---|
| next | 16.3.6 | MIT |
| react, react-dom | 19.2.8 | MIT |
| @base-ui/react | 1.8.0 | MIT |
| ajv | 8.20.0 | MIT |
| class-variance-authority | 0.7.1 | Apache-2.0 |
| cn | 0.4.0 | MIT |
| lucide-react | 1.47.0 | ISC |
| snowflake-sdk | 3.4.0 | Apache-2.0 |
| tw-animate-css | 1.4.0 | MIT |
| @playwright/test (dev) | 1.63.0 | Apache-2.0 |
| @tailwindcss/postcss, tailwindcss (dev) | 4.3.3 | MIT |
| @types/node, @types/react, @types/react-dom, @types/snowflake-sdk (dev) | 20.19.43 / 19.3.0 / 19.3.0 / 1.6.24 | MIT |
| shadcn (dev) | 4.21.0 | MIT |
| typescript (dev) | 5.9.3 | Apache-2.0 |

### Transitive tally, `frontend/package-lock.json` (579 packages)

MIT 447, Apache-2.0 61, ISC 24, MPL-2.0 12 (all `lightningcss*`), LGPL-3.0-or-later 10 (all optional `@img/sharp-libvips-*`
native binaries pulled in by Next for image optimisation), BSD-2-Clause 5, BSD-3-Clause 8, other composite or single
entries: Apache-2.0 AND LGPL-3.0-or-later 3, Apache-2.0 AND LGPL-3.0-or-later AND MIT 1 (`@img/sharp-wasm32`), 0BSD 2,
BlueOak-1.0.0 2, Python-2.0 1 (`argparse`), Unlicense 1, CC-BY-4.0 1 (`caniuse-lite`, data), no licence field 1. The
LGPL and MPL packages are optional or build-time binaries and are not modified or bundled into source by the team.

### Python, `requirements.txt` (8)

| Package | Installed | Licence (package metadata) | Use |
|---|---|---|---|
| python-dotenv | 1.2.2 | BSD-3-Clause | scripts |
| jsonschema | 4.26.0 | MIT | contract validation |
| pytest | 9.1.1 | MIT | tests |
| PyYAML | 6.0.2 | MIT | fixtures and manifests |
| fpdf2 | 2.8.8 | **LGPL-3.0-only** | synthetic PDF generation only (`data/generator/_pdf_render.py`), not shipped in the web app |
| pypdf | 6.19.0 | BSD-3-Clause | PDF text checks |
| streamlit | 1.64.0 | Apache-2.0 | earlier Streamlit build in `frontend/`; not in the product path |
| streamlit-extras | 1.6.0 | Apache-2.0 | same |

Other Python tooling referenced in docs (`langextract` 1.7.0, `backend/extraction/`) is an opt-in local trial adapter run
only with injected fake responses; it is not in `requirements.txt` and its licence was not read here.

### Snowflake-native services (no external data)

Snowflake Cortex (`AI_PARSE_DOCUMENT`, `AI_COMPLETE`, `AI_FILTER`, Cortex Search, Cortex Agent), Dynamic Tables, Tasks,
Streams, semantic view. Models used: `llama3.3-70b` and `claude-haiku-4-5` for the two extraction passes, accessed through
Snowflake under Snowflake's terms. No external model API and no local model is used.

## 6. Open items for the team

1. Decide on `real-patient-dipali.md` (redact or remove) and the Apollo `.docx` (remove or document sources).
2. Reference origin: five PDFs now byte-match publisher downloads. FDA/NHA byte origin, effective dates and redistribution terms remain unverified; see `data/reference/catalog.json`.
3. Confirm logo origin. Font notices are included and preserved by the hosted packager.

## 5 October publisher-origin receipts

Five of seven reference PDFs match SHA256 of newly downloaded public publisher copies:
Gujarat GMSCL, ICMR breast consensus, ICMR breast workflow, ICMR diabetes and NCG breast.
URLs, sizes and hashes: `evidence/qa/reference-publisher-origin-2026-10-05.json`.
The Gujarat PDF also matches the AIIMS Rishikesh institutional mirror; publisher attribution
remains Gujarat. The ICMR workflow prints July/2020, now recorded as its publication period.
None of these byte matches establishes present clinical applicability or an effective date.
FDA's indexed 2024 label has Reference ID 5399895, but its direct URL returned 404.
The earlier NHA URL returned HTML. Those two origins remain unverified.

Font notice sources checked 5 October 2026:
- https://github.com/rsms/inter/blob/master/LICENSE.txt
- https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt
- https://github.com/google/material-design-icons/blob/master/LICENSE
- https://developers.google.com/fonts/docs/material_symbols

Each notice was downloaded unchanged from its publisher repository. TTF embedded name
records identify Inter 4.000 and JetBrains Mono 2.304 and explicitly state SIL OFL 1.1.
Material Symbols WOFF2 byte origin has not been independently matched. The official Google
guide states Apache 2.0 for the family; the repository notice is included without claiming
a binary-version match. The hosted package now contains 167 allowlisted files including
these three notices; credentials and build outputs remain excluded.
