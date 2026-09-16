# Data Artifact Map — Every Record in the Patient Journey

**Every document, record, and transaction generated during HER2+ breast cancer treatment in India. This is the synthetic data generator's specification.**

> **Read alongside patient-journey-meera.md for the narrative. This file is the data model ground truth — every row in every table must trace to an artifact on this map.**

---

## Artifact categories

### 1. PATIENT — one row per patient
| Field | Source | Example | Notes |
|---|---|---|---|
| patient_id | System-generated canonical ID | PAT-0017 | Not the MRN — the canonical anchor |
| tenant_id | Facility/organization | SAARTHI-DEMO | Single-tenant for hackathon |
| abha_ref | NHA ABHA registry | 91-1234-5678-9012 | NULL if patient has no ABHA |
| name | Registration | Meera Devi | May differ between facilities |
| dob | Registration | 1979-03-15 | |
| gender | Registration | F | |
| district | Registration | Jhansi | |
| state | Registration | Uttar Pradesh | |
| primary_language | Registration | Hindi | For bring-list translation |

### 2. ID_MAP — one row per (patient × source system × identifier)
| Source system | Source ID | Example | link_status |
|---|---|---|---|
| SPOKE_DIST_HOSP_JHANSI | MRN | DH-2026-44821 | manually_verified |
| HUB_CANCER_DELHI | MRN | HCC-887234 | abha_linked (if ABHA exists) or manually_verified |
| PMJAY | Beneficiary ID | UP-2023-BEN-991827 | abha_linked or manually_verified |
| AADHAAR | Number | (not stored — R4 prohibits) | — |
| LAB_METROPOLIS | Patient ID | MET-JH-20260415-003 | manually_verified |
| LAB_HUB_PATHOLOGY | Accession prefix | HCC-PATH-S882 | manually_verified |

### 3. ENCOUNTER — one row per visit/admission
| encounter_id | patient_id | facility | type | scheduled_time | event_time | cycle_number | status |
|---|---|---|---|---|---|---|---|
| ENC-001 | PAT-0017 | SPOKE | opd_consultation | NULL | 2026-07-15 | NULL | completed |
| ENC-002 | PAT-0017 | SPOKE | opd_imaging | NULL | 2026-07-22 | NULL | completed |
| ENC-003 | PAT-0017 | SPOKE | opd_biopsy | NULL | 2026-07-29 | NULL | completed |
| ENC-004 | PAT-0017 | HUB | opd_first_visit | NULL | 2026-08-19 | NULL | completed |
| ENC-005 | PAT-0017 | HUB | opd_diagnostics | NULL | 2026-08-20-26 | NULL | completed |
| ENC-006 | PAT-0017 | HUB | daycare_chemo | 2026-09-09 | 2026-09-09 | 1 | completed |
| ENC-007 | PAT-0017 | HUB | daycare_chemo | 2026-09-30 | 2026-09-30 | 2 | completed |
| ENC-008 | PAT-0017 | HUB | daycare_chemo | 2026-10-21 | 2026-10-28 | 3 | delayed_7d |
| ENC-009 | PAT-0017 | HUB | daycare_chemo | 2026-11-11 | 2026-11-11 | 4 | completed |
| ... | ... | ... | ... | ... | ... | ... | ... |

**Key**: `scheduled_time` vs `event_time` is R2. When a cycle is delayed, these differ. The system must track both.

### 4. CLINICAL_EVENT — one row per clinical observation/action

#### Diagnoses
| event_type | code_system | code | display | value | status | event_time |
|---|---|---|---|---|---|---|
| diagnosis | ICD-10 | C50.9 | Breast cancer, unspecified | NULL | confirmed | 2026-08-05 |
| diagnosis | SNOMED | 254837009 | HER2+ breast cancer | NULL | confirmed | 2026-09-02 |
| staging | AJCC | IIB | cT2N1M0 | NULL | confirmed | 2026-09-02 |

#### Labs (each cycle generates 5-10 rows)
| event_type | code | display | value_num | unit | specimen_id | status | event_time | source_recorded_at | ingested_at |
|---|---|---|---|---|---|---|---|---|---|
| lab | 26499-4 | WBC | 6800 | cells/uL | SP-LAB-001 | final | 2026-09-08 | 2026-09-08 | 2026-09-08 |
| lab | 751-8 | ANC | 3900 | cells/uL | SP-LAB-001 | final | 2026-09-08 | 2026-09-08 | 2026-09-08 |
| lab | 718-7 | Hemoglobin | 11.0 | g/dL | SP-LAB-001 | final | 2026-09-08 | 2026-09-08 | 2026-09-08 |
| lab | 777-3 | Platelets | 190000 | cells/uL | SP-LAB-001 | final | 2026-09-08 | 2026-09-08 | 2026-09-08 |
| lab | 2160-0 | Creatinine | 0.8 | mg/dL | SP-LAB-001 | final | 2026-09-08 | 2026-09-08 | 2026-09-08 |

**Note**: Platelets stored as cells/uL (190000), NOT lakhs (1.9). Normalization happens at ingestion. The original unit from the source report is preserved in the DOCUMENT.

#### Imaging
| event_type | code | display | value | status | event_time |
|---|---|---|---|---|---|
| imaging | ECHO | Echocardiogram | LVEF 62% | final | 2026-08-25 |
| imaging | CT-CAP | CT chest/abdomen/pelvis | No distant metastasis | final | 2026-08-22 |
| imaging | MAMMO | Mammogram | BIRADS 5, 2.5cm mass | final | 2026-07-22 |

#### Medications
| event_type | code | display | dose | unit | status | event_time |
|---|---|---|---|---|---|---|
| medication | DOXO | Doxorubicin | 100 | mg | administered | 2026-09-09 |
| medication | CYCLO | Cyclophosphamide | 1000 | mg | administered | 2026-09-09 |
| medication | PACLI | Paclitaxel | 135 | mg | ordered | 2026-12-02 |
| medication | TRASTU | Trastuzumab | 560 | mg | ordered | 2026-12-02 |

**Status matters**: `ordered ≠ administered`. Readiness checks fire at `ordered`. Cycle counting uses `administered` only.

#### Pathology assertions (extracted from documents)
| event_type | code | display | value | status | accession_id |
|---|---|---|---|---|---|
| pathology | ER | Estrogen receptor | positive_80pct | final | S-882 |
| pathology | PR | Progesterone receptor | positive_40pct | final | S-882 |
| pathology | HER2_IHC | HER2 IHC score | 2+ | preliminary | S-882 |
| pathology | HER2_FISH | HER2 FISH | positive_ratio_2.8 | final | S-882 |
| pathology | GRADE | Nottingham grade | 2 | final | S-882 |
| pathology | KI67 | Ki-67 index | 30pct | final | S-882 |

### 5. COVERAGE — one row per coverage policy
| coverage_id | patient_id | payer_type | payer_name | policy_number | effective_from | effective_to | annual_limit | used_amount |
|---|---|---|---|---|---|---|---|---|
| COV-001 | PAT-0017 | scheme | PM-JAY | UP-2023-BEN-991827 | 2023-04-01 | 2027-03-31 | 500000 | 0 |

### 6. AUTHORIZATION — one row per pre-auth request
| auth_id | coverage_id | encounter_id | package_code | requested_amount | approved_amount | status | requested_at | responded_at | valid_until | portability |
|---|---|---|---|---|---|---|---|---|---|---|
| AUTH-001 | COV-001 | ENC-006 | PMJAY-ONCO-MED-001 | 50000 | 50000 | approved | 2026-09-03 | 2026-09-05 | 2026-10-05 | cross_state |
| AUTH-002 | COV-001 | ENC-007 | PMJAY-ONCO-MED-001 | 50000 | 50000 | approved | 2026-09-25 | 2026-09-27 | 2026-10-27 | cross_state |
| AUTH-003 | COV-001 | ENC-008 | PMJAY-ONCO-MED-001 | 50000 | NULL | pending | 2026-10-16 | NULL | NULL | cross_state |

**AUTH-003 is the demo scenario**: authorization still pending when cycle 3 is due.

### 7. DOCUMENT — one row per document version
| doc_id | patient_id | scope | doc_type | version | accession_id | file_hash | signed_at | effective_at | ingested_at | supersedes_doc_id | source_facility | ingestion_method |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DOC-001 | PAT-0017 | patient | mammogram_report | 1 | IMG-001 | sha256:abc... | 2026-07-22 | 2026-07-22 | 2026-08-19 | NULL | SPOKE | physical_folder |
| DOC-002 | PAT-0017 | patient | pathology_preliminary | 1 | S-882 | sha256:def... | 2026-08-05 | 2026-08-05 | 2026-08-19 | NULL | EXT_LAB | physical_folder |
| DOC-003 | PAT-0017 | patient | pathology_ihc_addendum | 1 | S-882 | sha256:ghi... | 2026-08-10 | 2026-08-10 | 2026-08-19 | NULL | EXT_LAB | physical_folder |
| DOC-004 | PAT-0017 | patient | pathology_fish_addendum | 1 | S-882 | sha256:jkl... | 2026-09-02 | 2026-09-02 | 2026-09-02 | NULL | HUB_PATH | digital_emr |
| DOC-005 | PAT-0017 | patient | echo_report | 1 | ECHO-017 | sha256:mno... | 2026-08-25 | 2026-08-25 | 2026-08-25 | NULL | HUB | digital_emr |
| DOC-006 | PAT-0017 | patient | auth_approval_letter | 1 | AUTH-001 | sha256:pqr... | 2026-09-05 | 2026-09-05 | 2026-09-06 | NULL | PMJAY_SHA | digital_tms |
| DOC-REF-001 | NULL | reference | pmjay_operation_manual | 1 | NULL | sha256:stu... | 2024-01-01 | 2024-01-01 | 2026-09-16 | NULL | NHA | downloaded_pdf |
| DOC-REF-002 | NULL | reference | trastuzumab_fda_label | 1 | NULL | sha256:vwx... | 2023-07-01 | 2023-07-01 | 2026-09-16 | NULL | FDA | downloaded_pdf |

**Key design points**:
- `scope = patient | reference` — R6 corpus separation starts at document registration
- `ingestion_method` — physical_folder, digital_emr, digital_tms, whatsapp_photo, downloaded_pdf
- `supersedes_doc_id` — version chain. D4 (FISH) doesn't supersede D3 (IHC) — they're different tests on the same accession. But if a corrected IHC was issued, it would supersede D3.
- `signed_at` vs `effective_at` vs `ingested_at` — R2 three clocks. A report signed on Aug 5, effective from Aug 5, but not in our system until Aug 19 (when the patient brought the folder to the hub).

### 8. DOC_PAGE — one row per page of each document
| doc_id | page_index | text | char_offsets |
|---|---|---|---|
| DOC-002 | 0 | "HISTOPATHOLOGY REPORT\nPatient: Meera Devi..." | {start: 0, end: 2340} |
| DOC-002 | 1 | "MICROSCOPY\nSections show invasive ductal..." | {start: 2341, end: 4120} |

### 9. ASSERTION — one row per extracted typed assertion
| assertion_id | doc_id | page_index | subject | predicate | value | unit | negation | missingness_state | extractor_version | char_start | char_end |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ASS-001 | DOC-002 | 1 | tumor_type | histological_type | invasive_ductal_carcinoma | NULL | false | present | v1.0 | 45 | 78 |
| ASS-002 | DOC-003 | 0 | biomarker | HER2_IHC | 2+ | score | false | present | v1.0 | 120 | 135 |
| ASS-003 | DOC-003 | 0 | biomarker | HER2_FISH | NULL | NULL | false | pending | v1.0 | 200 | 245 |
| ASS-004 | DOC-004 | 0 | biomarker | HER2_FISH | positive_ratio_2.8 | ratio | false | present | v1.0 | 30 | 95 |

**ASS-003 is the critical case**: extracted from the IHC addendum, it says FISH is pending. When DOC-004 arrives with the FISH result (ASS-004), ASS-003's `pending` state is resolved and the EVIDENCE_LINK chain connects them.

### 10. EVIDENCE_LINK — connects assertions to each other and to source rows
| link_id | assertion_id | target_type | target_id | relation |
|---|---|---|---|---|
| EL-001 | ASS-004 | assertion | ASS-003 | supersedes |
| EL-002 | ASS-004 | clinical_event | CE-HER2-FISH | supports |
| EL-003 | ASS-002 | assertion | ASS-004 | complemented_by |

### 11. REVIEW_ISSUE — one row per gate failure
| issue_id | rule_id | rule_version | patient_id | encounter_id | gate | state | reason | evidence_ids | created_at |
|---|---|---|---|---|---|---|---|---|---|
| RI-001 | RULE-DOC-FISH | v1.0 | PAT-0017 | ENC-006 | documentation | open | HER2 IHC 2+ without FISH result | [ASS-003] | 2026-08-19 |
| RI-002 | RULE-COV-AUTH | v1.0 | PAT-0017 | ENC-008 | coverage | open | Authorization pending for cycle 3 | [AUTH-003] | 2026-10-16 |
| RI-003 | RULE-SURV-LVEF | v1.0 | PAT-0017 | ENC-020 | surveillance | open | LVEF assessment >90 days | [CE-ECHO-017] | 2027-01-15 |

### 12. TASK — one row per action taken on a review issue
| task_id | issue_id | owner | state | decision | reason | actor | idempotency_key | created_at |
|---|---|---|---|---|---|---|---|---|
| TASK-001 | RI-001 | coordinator | evidence_received | NULL | FISH report DOC-004 received | system | TASK-RI001-DOCRCV | 2026-09-02 |
| TASK-002 | RI-001 | coordinator | closed | accepted | FISH confirms HER2+, documentation complete | dr.sharma | TASK-RI001-CLOSE | 2026-09-03 |

### 13. ANSWER_RUN — one row per copilot answer generated
| run_id | question | role | patient_id | known_as_of | answer_status | claims_json | evidence_ids | model_version | validation_results | latency_ms |
|---|---|---|---|---|---|---|---|---|---|---|
| AR-001 | "Is PAT-0017 ready for cycle 1?" | coordinator | PAT-0017 | 2026-09-08T09:00 | supported | [...] | [ASS-001..ASS-004, CE-LAB-001..005, AUTH-001, DOC-005] | v1.0 | {checks: 5, passed: 5, stripped: 0} | 8200 |

**ANSWER_RUN stores pointers (evidence_ids), not content.** Per law-dpdp.md finding: erasure must be able to remove clinical content while the access record survives.

---

## Volume model for 100 synthetic patients

| Table | Rows per patient | Total (100 patients) |
|---|---|---|
| PATIENT | 1 | 100 |
| ID_MAP | 3-5 | 350 |
| ENCOUNTER | 15-25 | 2,000 |
| CLINICAL_EVENT | 80-150 | 11,500 |
| COVERAGE | 1-2 | 150 |
| AUTHORIZATION | 8-12 | 1,000 |
| DOCUMENT (patient scope) | 60-100 | 8,000 |
| DOCUMENT (reference scope) | — | 20-30 (shared) |
| DOC_PAGE | 150-300 | 22,500 |
| ASSERTION | 100-200 | 15,000 |
| EVIDENCE_LINK | 150-300 | 22,500 |
| REVIEW_ISSUE | 5-15 | 1,000 |
| TASK | 5-15 | 1,000 |
| **Total** | | **~85,000 rows** |

This is realistic for a demo. Verity has 245K rows across 5K members. We'll have ~85K across 100 patients — comparable density per patient, which is what matters for the evidence story.
