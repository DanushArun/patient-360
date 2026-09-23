-- =============================================================================
-- Judge Console fixtures - a second synthetic patient, unrelated to PAT-DEEP-0001
-- =============================================================================
-- SPEC.md §10, probe 2: "Search without the filter -> returns another
-- patient's text" (F5, the competitor failure mode). Proving that live needs
-- a SECOND patient's real chunk content to actually leak - a single-patient
-- system can only ever demonstrate probe 2 in the abstract. This patient has
-- deliberately NO CARE_TEAM row for PRAC-01 (the demo practitioner), so any
-- appearance of their text in a PRAC-01-scoped result is unambiguous proof of
-- a cross-patient leak, not a permitted access path.
--
-- Fully synthetic: fictional name, fictional facility-local MRN, fictional
-- clinical values - same standard as PAT-DEEP-0001 (AGENTS.md §1).
MERGE INTO SAARTHI.CORE.PATIENT t USING (SELECT 'PAT-CONTROL-0002' patient_id) s ON t.patient_id = s.patient_id
WHEN NOT MATCHED THEN INSERT (patient_id, abha_ref, name, dob, gender, district, state, primary_language)
VALUES ('PAT-CONTROL-0002', NULL, 'Anjali Nair', '1985-11-02', 'female', 'Kochi', 'Kerala', 'Malayalam');

MERGE INTO SAARTHI.DOCUMENTS.DOCUMENT t USING (SELECT 'DOC-CONTROL-0002' doc_id) s ON t.doc_id = s.doc_id
WHEN NOT MATCHED THEN INSERT (doc_id, patient_id, scope, doc_type, version, source_quality, status, ingestion_method, source_facility_id)
VALUES ('DOC-CONTROL-0002', 'PAT-CONTROL-0002', 'patient', 'pathology_report', 1, 'clean_pdf', 'active', 'digital_emr', 'FAC-01');

-- Guarded on DOC_CHUNK, not a MERGE on DOC_PAGE: DOC_PAGE's row access policy
-- hides this page from whoever deploys (no one is on this patient's care
-- team), so a MERGE never saw the existing row and inserted another copy on
-- every deploy - 6 copies found on 24 Sept, each extracted separately.
-- DOC_CHUNK carries no RAP and is written below, so it marks "already loaded".
INSERT INTO SAARTHI.DOCUMENTS.DOC_PAGE (doc_id, page_index, text, char_count)
SELECT 'DOC-CONTROL-0002', 0,
  'PATHOLOGY REPORT\nPatient: Anjali Nair    MRN: FAC01-CTRL-0002\nSpecimen: Left breast core biopsy\n' ||
  'Diagnosis: Invasive ductal carcinoma, Grade II\nER: Positive (90%)   PR: Positive (70%)\n' ||
  'HER2 immunohistochemistry: Negative (score 1+)\nKi-67: 18%\n' ||
  'This report is unrelated to any other patient in this system.',
  260
WHERE NOT EXISTS (SELECT 1 FROM SAARTHI.DOCUMENTS.DOC_CHUNK WHERE chunk_id = 'DOC-CONTROL-0002-0');

-- chunk_documents_proc cannot reach this row: it reads DOC_PAGE, which is
-- RAP-protected, and this patient deliberately has zero CARE_TEAM rows for
-- ANY practitioner - so even an EXECUTE AS OWNER call sees nothing (F3: RAP
-- keys on the real CURRENT_USER(), which survives owner elevation). That is
-- correct: DOC_PAGE stays genuinely inaccessible. DOC_CHUNK, by contrast, has
-- NO RAP at all (F4) - inserting here directly is exactly the exposure
-- surface probe 2 exists to demonstrate, not a workaround of it.
MERGE INTO SAARTHI.DOCUMENTS.DOC_CHUNK t USING (SELECT 'DOC-CONTROL-0002-0' chunk_id) s ON t.chunk_id = s.chunk_id
WHEN NOT MATCHED THEN INSERT (chunk_id, doc_id, page_index, chunk_index, text, doc_scope, patient_id, doc_type, doc_version)
VALUES ('DOC-CONTROL-0002-0', 'DOC-CONTROL-0002', 0, 0,
  'PATHOLOGY REPORT\nPatient: Anjali Nair    MRN: FAC01-CTRL-0002\nSpecimen: Left breast core biopsy\n' ||
  'Diagnosis: Invasive ductal carcinoma, Grade II\nER: Positive (90%)   PR: Positive (70%)\n' ||
  'HER2 immunohistochemistry: Negative (score 1+)\nKi-67: 18%\n' ||
  'This report is unrelated to any other patient in this system.',
  'patient', 'PAT-CONTROL-0002', 'pathology_report', 1);
