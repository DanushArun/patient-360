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
        LET v_claim_type VARCHAR := GET_PATH(:v_claim, 'claim_type')::VARCHAR;
        LET v_asserted VARIANT := GET_PATH(:v_claim, 'asserted_value');
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
                LET v_ev_num FLOAT := NULL;
                LET v_ev_txt VARCHAR := NULL;
                SELECT patient_id, ingested_at, value_num, value_text
                  INTO :v_ev_patient, :v_ev_ingested, :v_ev_num, :v_ev_txt
                  FROM SAARTHI.CORE.DT_HARMONIZED_EVENTS WHERE event_id = :v_ev_id;
                IF (v_ev_patient IS NULL) THEN
                    v_claim_ok := FALSE; v_strip_reason := 'check1_existence: ' || v_ev_id || ' does not resolve';
                    LET v_sec_event_id VARCHAR := UUID_STRING();
                    LET v_sec_detail VARIANT := OBJECT_CONSTRUCT('claim', :v_text, 'evidence_id', :v_ev_id, 'reason', 'fabricated_evidence_id');
                    INSERT INTO SAARTHI.GOVERNANCE.SECURITY_EVENT (event_id, practitioner_id, event_type, detail)
                    SELECT :v_sec_event_id, NULL, 'validator_strip', :v_sec_detail;
                ELSEIF (v_ev_patient != v_patient_id) THEN
                    v_claim_ok := FALSE; v_strip_reason := 'check2_scope: evidence belongs to a different patient';
                    LET v_sec_event_id2 VARCHAR := UUID_STRING();
                    LET v_sec_detail2 VARIANT := OBJECT_CONSTRUCT('claim', :v_text, 'evidence_id', :v_ev_id, 'reason', 'cross_patient_evidence');
                    INSERT INTO SAARTHI.GOVERNANCE.SECURITY_EVENT (event_id, practitioner_id, event_type, detail)
                    SELECT :v_sec_event_id2, NULL, 'validator_strip', :v_sec_detail2;
                ELSEIF (v_ev_ingested > v_known_as_of) THEN
                    v_claim_ok := FALSE; v_strip_reason := 'check3_temporality: evidence ingested after known_as_of';
                ELSEIF (v_claim_type = 'numeric' AND v_asserted IS NOT NULL) THEN
                    -- Check 5. Type match for numeric claims. 1% relative tolerance is
                    -- a calibration decision (SPEC says "within tolerance" without a
                    -- number) - documented in REMAINING-WORK.md §6, not a spec citation.
                    IF (v_ev_num IS NULL) THEN
                        v_claim_ok := FALSE;
                        v_strip_reason := 'check5_type_match: numeric claim but evidence has no value_num';
                    ELSEIF (ABS(v_asserted::FLOAT - v_ev_num) / GREATEST(ABS(v_asserted::FLOAT), 1) > 0.01) THEN
                        v_claim_ok := FALSE;
                        v_strip_reason := 'check5_type_match: asserted ' || v_asserted::VARCHAR
                                          || ' vs evidence ' || v_ev_num::VARCHAR || ' exceeds 1% tolerance';
                    END IF;
                ELSEIF (v_claim_type = 'status' AND v_asserted IS NOT NULL AND v_ev_txt IS NOT NULL) THEN
                    IF (LOWER(v_asserted::VARCHAR) != LOWER(v_ev_txt)) THEN
                        v_claim_ok := FALSE;
                        v_strip_reason := 'check5_type_match: status mismatch (asserted ' || v_asserted::VARCHAR
                                          || ' vs evidence ' || v_ev_txt || ')';
                    END IF;
                ELSEIF (v_claim_type = 'date' AND v_asserted IS NOT NULL) THEN
                    IF (TRY_TO_DATE(v_asserted::VARCHAR) IS DISTINCT FROM TRY_TO_DATE(v_ev_txt)) THEN
                        v_claim_ok := FALSE;
                        v_strip_reason := 'check5_type_match: date mismatch';
                    END IF;
                END IF;
            ELSEIF (v_kind = 'document_span') THEN
                LET v_ev_verif VARCHAR := NULL;
                LET v_ev_doc_patient VARCHAR := NULL;
                LET v_ev_value VARCHAR := NULL;
                LET v_ev_doc_id VARCHAR := NULL;
                LET v_ev_page INT := NULL;
                SELECT a.verification_status, d.patient_id, a.value, a.doc_id, a.page_index
                  INTO :v_ev_verif, :v_ev_doc_patient, :v_ev_value, :v_ev_doc_id, :v_ev_page
                  FROM SAARTHI.EVIDENCE.ASSERTION a
                  JOIN SAARTHI.DOCUMENTS.DOCUMENT d ON d.doc_id = a.doc_id
                 WHERE a.assertion_id = :v_ev_id;
                IF (v_ev_verif IS NULL) THEN
                    v_claim_ok := FALSE; v_strip_reason := 'check1_existence: ' || v_ev_id || ' does not resolve';
                    LET v_sec_event_id3 VARCHAR := UUID_STRING();
                    LET v_sec_detail3 VARIANT := OBJECT_CONSTRUCT('claim', :v_text, 'evidence_id', :v_ev_id, 'reason', 'fabricated_evidence_id');
                    INSERT INTO SAARTHI.GOVERNANCE.SECURITY_EVENT (event_id, practitioner_id, event_type, detail)
                    SELECT :v_sec_event_id3, NULL, 'validator_strip', :v_sec_detail3;
                ELSEIF (v_ev_doc_patient IS NOT NULL AND v_ev_doc_patient != v_patient_id) THEN
                    v_claim_ok := FALSE; v_strip_reason := 'check2_scope: evidence belongs to a different patient';
                    LET v_sec_event_id4 VARCHAR := UUID_STRING();
                    LET v_sec_detail4 VARIANT := OBJECT_CONSTRUCT('claim', :v_text, 'evidence_id', :v_ev_id, 'reason', 'cross_patient_evidence');
                    INSERT INTO SAARTHI.GOVERNANCE.SECURITY_EVENT (event_id, practitioner_id, event_type, detail)
                    SELECT :v_sec_event_id4, NULL, 'validator_strip', :v_sec_detail4;
                ELSEIF (v_ev_verif IN ('conflicting', 'unverified')) THEN
                    -- Check 6. The most important check: evidence <-> reality,
                    -- not just claim <-> evidence. Downgrade, do not silently strip.
                    v_claim_ok := FALSE;
                    v_strip_reason := 'check6_trustworthiness: assertion is ' || v_ev_verif || ', value not asserted';
                    v_limitations := ARRAY_APPEND(v_limitations,
                        'A value was read but could not be verified on a second pass (' || v_ev_verif || '). Confirm against the original report.');
                ELSE
                    -- Check 5 first (cheap type match against ASSERTION.value), then
                    -- Check 4 last (AI_FILTER polarity — the only AI call in this proc).
                    -- SPEC §7 order was 1..6; runtime order optimises for cost: all cheap
                    -- SQL checks precede the AI call so a claim strippable by structure
                    -- never fires AI_FILTER.
                    IF (v_claim_type = 'numeric' AND v_asserted IS NOT NULL) THEN
                        LET v_ev_num_ds FLOAT := TRY_TO_NUMBER(v_ev_value);
                        IF (v_ev_num_ds IS NULL) THEN
                            v_claim_ok := FALSE;
                            v_strip_reason := 'check5_type_match: numeric claim but ASSERTION.value is not numeric';
                        ELSEIF (ABS(v_asserted::FLOAT - v_ev_num_ds) / GREATEST(ABS(v_asserted::FLOAT), 1) > 0.01) THEN
                            v_claim_ok := FALSE;
                            v_strip_reason := 'check5_type_match: asserted ' || v_asserted::VARCHAR
                                              || ' vs assertion ' || v_ev_value || ' exceeds 1% tolerance';
                        END IF;
                    ELSEIF (v_claim_type = 'status' AND v_asserted IS NOT NULL AND v_ev_value IS NOT NULL) THEN
                        IF (LOWER(v_asserted::VARCHAR) != LOWER(v_ev_value)) THEN
                            v_claim_ok := FALSE;
                            v_strip_reason := 'check5_type_match: status mismatch (asserted ' || v_asserted::VARCHAR
                                              || ' vs assertion ' || v_ev_value || ')';
                        END IF;
                    ELSEIF (v_claim_type = 'date' AND v_asserted IS NOT NULL) THEN
                        IF (TRY_TO_DATE(v_asserted::VARCHAR) IS DISTINCT FROM TRY_TO_DATE(v_ev_value)) THEN
                            v_claim_ok := FALSE;
                            v_strip_reason := 'check5_type_match: date mismatch';
                        END IF;
                    END IF;

                    IF (v_claim_ok) THEN
                        -- Check 4 — polarity via AI_FILTER (SPEC §7 line 630, F8-verified).
                        -- Fail-closed: any error returned by AI_FILTER strips the claim
                        -- (AGENTS.md §3 #10). return_error_details=TRUE gives {value,error}
                        -- so we distinguish "confirmed false" from "call errored".
                        LET v_passage VARCHAR := NULL;
                        SELECT dp.text INTO :v_passage
                          FROM SAARTHI.DOCUMENTS.DOC_PAGE dp
                         WHERE dp.doc_id = :v_ev_doc_id
                           AND (v_ev_page IS NULL OR dp.page_index = v_ev_page)
                         LIMIT 1;

                        IF (v_passage IS NOT NULL) THEN
                            LET v_filter_result VARIANT := (
                                SELECT AI_FILTER(
                                  PROMPT('Does this passage confirm that {0}? Passage: {1}',
                                         :v_text, :v_passage),
                                  TRUE));
                            IF (GET_PATH(:v_filter_result, 'error') IS NOT NULL) THEN
                                v_claim_ok := FALSE;
                                v_strip_reason := 'check4_polarity: AI_FILTER error (' ||
                                                  GET_PATH(:v_filter_result, 'error')::VARCHAR ||
                                                  ') - fail-closed strip';
                            ELSEIF (GET_PATH(:v_filter_result, 'value')::BOOLEAN = FALSE) THEN
                                v_claim_ok := FALSE;
                                v_strip_reason := 'check4_polarity: passage does not confirm claim';
                            END IF;
                        END IF;
                    END IF;
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
