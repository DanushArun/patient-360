-- =============================================================================
-- DEMO - align the cohort's generated documents with re-anchored events
-- =============================================================================
-- load_daycare_cohort.sql moves every cohort event relative to tomorrow's visit.
-- The generated reports (DOC-LAB-DC-xx, DOC-PATH-DC-xx) were printed from an
-- earlier snapshot, so their "Report date:" line would no longer match the event
-- it reports. This rewrites only that date, from the event, in place:
--   - YYYY-MM-DD is fixed width, so no cited character span moves;
--   - values are untouched, so every verified assertion still matches its page;
--   - extraction is not re-run.
-- The hero patient (DC-12) builds its own page text and is excluded here.

CREATE OR REPLACE TEMPORARY TABLE SAARTHI.OPERATIONAL._COHORT_DOC_DATES AS
SELECT 'DOC-LAB-' || SUBSTR(e.patient_id, 5) AS doc_id, MAX(e.event_time) AS at
  FROM SAARTHI.CORE.CLINICAL_EVENT e
  JOIN SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY o ON o.concept_id = e.concept_id
 WHERE e.patient_id RLIKE 'PAT-DC-(0[1-9]|1[01])' AND o.canonical_name = 'WBC'
 GROUP BY e.patient_id
UNION ALL
SELECT 'DOC-PATH-' || SUBSTR(e.patient_id, 5), MAX(e.event_time)
  FROM SAARTHI.CORE.CLINICAL_EVENT e
 WHERE e.patient_id RLIKE 'PAT-DC-(0[1-9]|1[01])' AND e.event_type = 'pathology'
 GROUP BY e.patient_id;

MERGE INTO SAARTHI.DOCUMENTS.DOC_PAGE t
USING (
  SELECT p.doc_id, p.page_index,
         REGEXP_REPLACE(p.text, 'Report date: [0-9]{4}-[0-9]{2}-[0-9]{2}',
                        'Report date: ' || TO_CHAR(d.at, 'YYYY-MM-DD')) AS text
    FROM SAARTHI.DOCUMENTS.DOC_PAGE p
    JOIN SAARTHI.OPERATIONAL._COHORT_DOC_DATES d ON d.doc_id = p.doc_id
) s ON t.doc_id = s.doc_id AND t.page_index = s.page_index
WHEN MATCHED AND t.text != s.text AND LENGTH(t.text) = LENGTH(s.text) THEN UPDATE SET t.text = s.text;

MERGE INTO SAARTHI.DOCUMENTS.DOCUMENT t
USING SAARTHI.OPERATIONAL._COHORT_DOC_DATES s ON t.doc_id = s.doc_id
WHEN MATCHED AND (t.effective_at IS NULL OR t.effective_at != s.at)
  THEN UPDATE SET t.effective_at = s.at, t.signed_at = DATEADD(hour, 3, s.at);
