-- =============================================================================
-- STEP 16d - TASK reconcile_evidence
-- =============================================================================
-- SPEC.md §12 / R7. Detects two cross-source conditions on the ASSERTION table:
--   (a) same-specimen disagreement -> mark verification_status = 'conflicting'
--   (b) different-specimen disagreement -> preserve verified findings and write
--       an EVIDENCE_LINK relation, keeping the seven-state missingness type.
--
-- Deterministic; no AI. Runs downstream of extract_assertions so it sees a
-- coherent pass1/pass2 pair. Idempotent via MERGE - re-running produces the
-- same tagging without duplicates.

CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.reconcile_evidence_proc()
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Task body for reconcile_evidence. Cross-source discordance detection over ASSERTION.'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_same_spec_conflicts INTEGER DEFAULT 0;
    v_cross_spec_discordant INTEGER DEFAULT 0;
    v_links INTEGER DEFAULT 0;
BEGIN
    -- Same-specimen disagreement: two ASSERTION rows share (subject, predicate,
    -- specimen_id via source doc) but disagree on value. Uses pass1_value <>
    -- pass2_value as the direct R7 conflict signal. Missing specimen link
    -- (both NULL) means we treat the subject+predicate pair as one specimen.
    MERGE INTO SAARTHI.EVIDENCE.ASSERTION t
    USING (
        SELECT a.assertion_id
          FROM SAARTHI.EVIDENCE.ASSERTION a
         WHERE a.pass1_value IS NOT NULL
           AND a.pass2_value IS NOT NULL
           AND a.pass1_value <> a.pass2_value
           AND a.verification_status = 'verified'
    ) s
    ON t.assertion_id = s.assertion_id
    WHEN MATCHED THEN UPDATE SET t.verification_status = 'conflicting';

    v_same_spec_conflicts := SQLROWCOUNT;

    -- Different documents alone do not establish different specimens. Require
    -- distinct recorded accession IDs for the same patient and concept; missing
    -- accession IDs contribute no inferred cross-specimen relation.
    MERGE INTO SAARTHI.EVIDENCE.EVIDENCE_LINK t
    USING (
        SELECT DISTINCT a1.assertion_id, a2.assertion_id AS target_id
          FROM SAARTHI.EVIDENCE.ASSERTION a1
          JOIN SAARTHI.EVIDENCE.ASSERTION a2
            ON a1.concept_id = a2.concept_id
           AND a1.doc_id <> a2.doc_id
           AND a1.value <> a2.value
           -- Qualitative findings may legitimately have no unit in either read.
           AND EQUAL_NULL(a1.unit, a2.unit)
           AND a1.verification_status = 'verified'
           AND a2.verification_status = 'verified'
          JOIN SAARTHI.DOCUMENTS.DOCUMENT d1 ON d1.doc_id = a1.doc_id
          JOIN SAARTHI.DOCUMENTS.DOCUMENT d2 ON d2.doc_id = a2.doc_id
          -- Only specimen-bound concepts (biomarkers: HER2 IHC/FISH ...) can be discordant
          -- across specimens. A serial analyte (Hb 10.1 then 11.2) is a trend, not a discordance.
          JOIN SAARTHI.OPERATIONAL.CLINICAL_ONTOLOGY co
            ON co.concept_id = a1.concept_id AND co.concept_type = 'biomarker'
         WHERE a1.missingness_state = 'present'
           AND a2.missingness_state = 'present'
           AND d1.patient_id = d2.patient_id
           AND d1.scope = 'patient' AND d2.scope = 'patient'
           AND d1.status = 'active' AND d2.status = 'active'
           AND d1.accession_id <> d2.accession_id
           AND LENGTH(TRIM(d1.accession_id)) > 0
           AND LENGTH(TRIM(d2.accession_id)) > 0
    ) s
    ON t.assertion_id = s.assertion_id AND t.target_id = s.target_id
       AND t.target_type = 'assertion' AND t.relation = 'discordant_across_specimens'
    WHEN NOT MATCHED THEN INSERT (assertion_id, target_type, target_id, relation)
        VALUES (s.assertion_id, 'assertion', s.target_id, 'discordant_across_specimens');

    v_cross_spec_discordant := SQLROWCOUNT;

    -- Provenance: a verified numeric assertion SUPPORTS a structured event only when
    -- exactly one event of the same patient and concept, on the source document's
    -- effective date, carries the same number and exact unit (digit separators ignored, so the
    -- Indian "2,60,604" equals 260604). Ambiguity or mismatch writes no link -
    -- provenance is never guessed. Non-numeric results (HER2 IHC text) are not linked.
    MERGE INTO SAARTHI.EVIDENCE.EVIDENCE_LINK t
    USING (
        SELECT a.assertion_id, MIN(ce.event_id) AS event_id
          FROM SAARTHI.EVIDENCE.ASSERTION a
          JOIN SAARTHI.DOCUMENTS.DOCUMENT d
            ON d.doc_id = a.doc_id AND d.scope = 'patient' AND d.status = 'active'
          JOIN SAARTHI.CORE.CLINICAL_EVENT ce
            ON ce.patient_id = d.patient_id
           AND ce.concept_id = a.concept_id
           AND ce.event_time::DATE = d.effective_at::DATE
           AND ce.value_num = TRY_TO_DOUBLE(REPLACE(a.value, ',', ''))
           -- Equal numbers in different or unknown units are not corroboration.
           -- Unit conversion belongs to the existing normalization rules.
           AND a.unit = ce.unit
         WHERE a.verification_status = 'verified'
           AND a.missingness_state = 'present'
           AND TRY_TO_DOUBLE(REPLACE(a.value, ',', '')) IS NOT NULL
         GROUP BY a.assertion_id
        HAVING COUNT(*) = 1
    ) s
    ON t.assertion_id = s.assertion_id AND t.target_type = 'clinical_event'
       AND t.target_id = s.event_id AND t.relation = 'supports'
    WHEN NOT MATCHED THEN INSERT (assertion_id, target_type, target_id, relation)
        VALUES (s.assertion_id, 'clinical_event', s.event_id, 'supports');

    v_links := SQLROWCOUNT;

    RETURN OBJECT_CONSTRUCT(
        'same_specimen_conflicts', v_same_spec_conflicts,
        'cross_specimen_discordant', v_cross_spec_discordant,
        'support_links_added', v_links,
        'reconciled_at', TO_VARCHAR(CURRENT_TIMESTAMP(), 'YYYY-MM-DD"T"HH24:MI:SS')
    );
END;
$$;

CREATE OR REPLACE TASK SAARTHI.OPERATIONAL.TASK_RECONCILE_EVIDENCE
  WAREHOUSE = SAARTHI_AI_WH
  AFTER SAARTHI.OPERATIONAL.TASK_EXTRACT_ASSERTIONS
AS
  CALL SAARTHI.OPERATIONAL.reconcile_evidence_proc();
