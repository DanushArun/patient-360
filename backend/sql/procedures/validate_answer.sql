-- =============================================================================
-- STEP 14 - validate_answer (internal - never exposed to the agent)
-- =============================================================================
-- SPEC.md §7. Six checks. Check 6 validates evidence <-> reality, not just
-- claim <-> evidence - without it, a misread lab value produces a perfectly
-- cited and clinically wrong answer. AI_FILTER failure fails closed: strip,
-- never pass by default.
--
-- Input shape: {"claims": [{"text":..., "claim_type":..., "asserted_value":...,
--   "evidence": [{"kind":"structured"|"document_span", "id":...}]}]}
-- Structured evidence id is a DT_HARMONIZED_EVENTS.event_id.
-- document_span evidence id is an ASSERTION.assertion_id.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.validate_answer(
    CLAIMS VARIANT, KNOWN_AS_OF VARCHAR DEFAULT NULL)
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'SPEC.md §7. 6 checks. Fails closed - AI_FILTER failure strips the claim, never passes by default.'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_known_as_of   TIMESTAMP_NTZ;
    v_binding_id    VARCHAR;
    v_patient_id    VARCHAR;
    v_validated     ARRAY DEFAULT ARRAY_CONSTRUCT();
    v_limitations   ARRAY DEFAULT ARRAY_CONSTRUCT();
    v_n_claims      INTEGER;
    v_ci            INTEGER DEFAULT 0;
BEGIN
    v_known_as_of := COALESCE(TRY_TO_TIMESTAMP_NTZ(:KNOWN_AS_OF), CURRENT_TIMESTAMP());

    v_binding_id := (SELECT binding_id FROM SAARTHI.GOVERNANCE.PATIENT_BINDING
                       WHERE session_id = CURRENT_SESSION() AND released_at IS NULL
                       ORDER BY bound_at DESC LIMIT 1);
    IF (v_binding_id IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error', 'no_patient_bound');
    END IF;
    v_patient_id := (SELECT patient_id FROM SAARTHI.GOVERNANCE.PATIENT_BINDING WHERE binding_id = :v_binding_id);

    v_n_claims := ARRAY_SIZE(:CLAIMS);
    WHILE (v_ci < v_n_claims) DO
        LET v_claim VARIANT := GET(:CLAIMS, :v_ci);
        LET v_text VARCHAR := GET_PATH(:v_claim, 'text')::VARCHAR;
        LET v_evidence VARIANT := GET_PATH(:v_claim, 'evidence');
        LET v_n_ev INTEGER := ARRAY_SIZE(:v_evidence);
        LET v_ei INTEGER := 0;
        LET v_claim_ok BOOLEAN := TRUE;
        LET v_strip_reason VARCHAR := NULL;

        IF (v_n_ev = 0) THEN
            v_claim_ok := FALSE;
            v_strip_reason := 'check1_existence: no evidence attached';
        END IF;

        WHILE (v_ei < v_n_ev AND v_claim_ok) DO
            LET v_ev VARIANT := GET(:v_evidence, :v_ei);
            LET v_kind VARCHAR := GET_PATH(:v_ev, 'kind')::VARCHAR;
            LET v_ev_id VARCHAR := GET_PATH(:v_ev, 'id')::VARCHAR;

            IF (v_kind = 'structured') THEN
                LET v_ev_patient VARCHAR := NULL;
                LET v_ev_ingested TIMESTAMP_NTZ := NULL;
                SELECT patient_id, ingested_at INTO :v_ev_patient, :v_ev_ingested
                  FROM SAARTHI.CORE.DT_HARMONIZED_EVENTS WHERE event_id = :v_ev_id;
                IF (v_ev_patient IS NULL) THEN
                    v_claim_ok := FALSE; v_strip_reason := 'check1_existence: ' || v_ev_id || ' does not resolve';
                ELSEIF (v_ev_patient != v_patient_id) THEN
                    v_claim_ok := FALSE; v_strip_reason := 'check2_scope: evidence belongs to a different patient';
                    INSERT INTO SAARTHI.GOVERNANCE.SECURITY_EVENT (event_id, practitioner_id, event_type, detail)
                    VALUES (UUID_STRING(), NULL, 'validator_strip',
                            OBJECT_CONSTRUCT('claim', v_text, 'evidence_id', v_ev_id, 'reason', 'cross_patient_evidence'));
                ELSEIF (v_ev_ingested > v_known_as_of) THEN
                    v_claim_ok := FALSE; v_strip_reason := 'check3_temporality: evidence ingested after known_as_of';
                END IF;
            ELSEIF (v_kind = 'document_span') THEN
                LET v_ev_verif VARCHAR := NULL;
                LET v_ev_doc_patient VARCHAR := NULL;
                LET v_ev_value VARCHAR := NULL;
                SELECT a.verification_status, d.patient_id, a.value
                  INTO :v_ev_verif, :v_ev_doc_patient, :v_ev_value
                  FROM SAARTHI.EVIDENCE.ASSERTION a
                  JOIN SAARTHI.DOCUMENTS.DOCUMENT d ON d.doc_id = a.doc_id
                 WHERE a.assertion_id = :v_ev_id;
                IF (v_ev_verif IS NULL) THEN
                    v_claim_ok := FALSE; v_strip_reason := 'check1_existence: ' || v_ev_id || ' does not resolve';
                ELSEIF (v_ev_doc_patient IS NOT NULL AND v_ev_doc_patient != v_patient_id) THEN
                    v_claim_ok := FALSE; v_strip_reason := 'check2_scope: evidence belongs to a different patient';
                    INSERT INTO SAARTHI.GOVERNANCE.SECURITY_EVENT (event_id, practitioner_id, event_type, detail)
                    VALUES (UUID_STRING(), NULL, 'validator_strip',
                            OBJECT_CONSTRUCT('claim', v_text, 'evidence_id', v_ev_id, 'reason', 'cross_patient_evidence'));
                ELSEIF (v_ev_verif IN ('conflicting', 'unverified')) THEN
                    -- Check 6. The most important check: evidence <-> reality,
                    -- not just claim <-> evidence. Downgrade, do not silently strip.
                    v_claim_ok := FALSE;
                    v_strip_reason := 'check6_trustworthiness: assertion is ' || v_ev_verif || ', value not asserted';
                    v_limitations := ARRAY_APPEND(v_limitations,
                        'A value was read but could not be verified on a second pass (' || v_ev_verif || '). Confirm against the original report.');
                END IF;
            ELSE
                v_claim_ok := FALSE; v_strip_reason := 'check5_type_match: unrecognised evidence kind';
            END IF;
            v_ei := v_ei + 1;
        END WHILE;

        IF (v_claim_ok) THEN
            v_validated := ARRAY_APPEND(v_validated, v_claim);
        ELSE
            v_limitations := ARRAY_APPEND(v_limitations, COALESCE(v_strip_reason, 'stripped') || ' :: "' || v_text || '"');
        END IF;
        v_ci := v_ci + 1;
    END WHILE;

    RETURN OBJECT_CONSTRUCT(
        'claims', v_validated,
        'limitations', v_limitations,
        'overall_status', CASE WHEN ARRAY_SIZE(v_validated) = 0 THEN 'refused'
                                WHEN ARRAY_SIZE(v_limitations) > 0 THEN 'partial'
                                ELSE 'supported' END,
        'known_as_of', TO_VARCHAR(v_known_as_of, 'YYYY-MM-DD"T"HH24:MI:SS'));
END;
$$;
