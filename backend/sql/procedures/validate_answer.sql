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
    v_known_as_of_s VARCHAR;
    v_practitioner VARCHAR;
    v_care_team_id VARCHAR;
    v_consent_id VARCHAR;
    v_validated     ARRAY DEFAULT ARRAY_CONSTRUCT();
    v_limitations   ARRAY DEFAULT ARRAY_CONSTRUCT();
    v_n_claims      INTEGER;
    v_ci            INTEGER DEFAULT 0;
BEGIN
-- >>> SAARTHI PREAMBLE v1 BEGIN
    -- 0 -- KNOWN_AS_OF. Resolved before anything can fail, so every error carries it.
    v_known_as_of := COALESCE(TRY_TO_TIMESTAMP_NTZ(:KNOWN_AS_OF), CURRENT_TIMESTAMP());
    v_known_as_of_s := TO_VARCHAR(:v_known_as_of, 'YYYY-MM-DD"T"HH24:MI:SS');

    -- 1 -- SELECTION. The subject comes from a human click, never from question text.
    v_binding_id := (SELECT binding_id
                       FROM SAARTHI.GOVERNANCE.PATIENT_BINDING
                      WHERE session_id = CURRENT_SESSION()
                        AND released_at IS NULL
                      ORDER BY bound_at DESC
                      LIMIT 1);
    IF (v_binding_id IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error', 'no_patient_bound',
                                'known_as_of', :v_known_as_of_s);
    END IF;

    v_patient_id := (SELECT patient_id
                       FROM SAARTHI.GOVERNANCE.PATIENT_BINDING
                      WHERE binding_id = :v_binding_id);

    -- 2 -- AUTHORISATION. CURRENT_USER() survives owner's-rights elevation; CURRENT_ROLE() does not (F3).
    v_practitioner := (SELECT practitioner_id
                         FROM SAARTHI.GOVERNANCE.PRACTITIONER
                        WHERE snowflake_user = CURRENT_USER()
                          AND active = TRUE);
    IF (v_practitioner IS NULL) THEN
        RETURN OBJECT_CONSTRUCT('error', 'no_patient_access',
                                'known_as_of', :v_known_as_of_s);
    END IF;

    v_care_team_id := (SELECT care_team_id
                         FROM SAARTHI.GOVERNANCE.CARE_TEAM
                        WHERE practitioner_id = :v_practitioner
                          AND patient_id     = :v_patient_id
                          AND active_from   <= CURRENT_DATE()
                          AND (active_to IS NULL OR active_to >= CURRENT_DATE())
                        ORDER BY active_from DESC
                        LIMIT 1);
    IF (v_care_team_id IS NULL) THEN
        -- Reveals nothing about whether the patient exists. Do not add a reason.
        RETURN OBJECT_CONSTRUCT('error', 'no_patient_access',
                                'known_as_of', :v_known_as_of_s);
    END IF;

    -- 3 -- CONSENT, at query time. Never at ingest, never cached in the binding.
    v_consent_id := (SELECT c.consent_id
                       FROM SAARTHI.GOVERNANCE.CONSENT c
                       JOIN SAARTHI.GOVERNANCE.PRACTITIONER p
                         ON p.practitioner_id = :v_practitioner
                       LEFT JOIN SAARTHI.GOVERNANCE.FACILITY f
                         ON f.facility_id = p.facility_id
                      WHERE c.patient_id = :v_patient_id
                        AND c.status     = 'active'
                        AND c.valid_from <= CURRENT_TIMESTAMP()
                        AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP())
                        AND c.purpose_code IN ('treatment', 'coordination')
                        AND (c.granted_to_facility_id = p.facility_id
                          OR c.granted_to_org_id      = f.org_id)
                      ORDER BY c.valid_from DESC
                      LIMIT 1);
    IF (v_consent_id IS NULL) THEN
        -- Release the binding: the context is cleared, not merely hidden.
        UPDATE SAARTHI.GOVERNANCE.PATIENT_BINDING
           SET released_at = CURRENT_TIMESTAMP()
         WHERE binding_id = :v_binding_id
           AND released_at IS NULL;
        -- This code DOES reveal that a record exists. That is deliberate: it only
        -- reaches a user who previously had legitimate access to it.
        RETURN OBJECT_CONSTRUCT('error', 'access_withdrawn',
                                'known_as_of', :v_known_as_of_s);
    END IF;
-- <<< SAARTHI PREAMBLE v1 END

    IF (NOT COALESCE(IS_ARRAY(CLAIMS),FALSE) OR ARRAY_SIZE(CLAIMS)>16) THEN
        RETURN OBJECT_CONSTRUCT('error','invalid_claims','known_as_of',v_known_as_of_s);
    END IF;

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
        LET v_canonical_evidence ARRAY := ARRAY_CONSTRUCT();

        IF (NOT COALESCE(IS_ARRAY(v_evidence),FALSE) OR COALESCE(v_n_ev,0)=0) THEN
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
                v_canonical_evidence := ARRAY_APPEND(v_canonical_evidence,
                    OBJECT_CONSTRUCT('kind','structured','id',v_ev_id));
            ELSEIF (v_kind = 'document_span') THEN
                LET v_ev_verif VARCHAR := NULL;
                LET v_ev_doc_patient VARCHAR := NULL;
                LET v_ev_value VARCHAR := NULL;
                LET v_ev_doc_id VARCHAR := NULL;
                LET v_ev_page INT := NULL;
                LET v_ev_start INT := NULL;
                LET v_ev_end INT := NULL;
                LET v_ev_doc_ingested TIMESTAMP_NTZ := NULL;
                LET v_ev_missing VARCHAR := NULL;
                LET v_ev_source VARCHAR := NULL;
                SELECT a.verification_status, d.patient_id, a.value, a.doc_id, a.page_index,
                       a.char_start,a.char_end,d.ingested_at,a.missingness_state,dp.text
                  INTO :v_ev_verif, :v_ev_doc_patient, :v_ev_value, :v_ev_doc_id, :v_ev_page,
                       :v_ev_start,:v_ev_end,:v_ev_doc_ingested,:v_ev_missing,:v_ev_source
                  FROM SAARTHI.EVIDENCE.ASSERTION a
                  JOIN SAARTHI.DOCUMENTS.DOCUMENT d ON d.doc_id = a.doc_id
                  JOIN SAARTHI.DOCUMENTS.DOC_PAGE dp ON dp.doc_id=a.doc_id AND dp.page_index=a.page_index
                 WHERE a.assertion_id = :v_ev_id AND d.scope='patient' AND d.status='active';
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
                ELSEIF (v_ev_doc_ingested IS NULL OR v_ev_doc_ingested>v_known_as_of) THEN
                    v_claim_ok := FALSE; v_strip_reason := 'check3_temporality: document unavailable at cutoff';
                ELSEIF (v_ev_start IS NULL OR v_ev_end IS NULL OR v_ev_start<0
                    OR v_ev_end<=v_ev_start OR v_ev_source IS NULL OR v_ev_end>LENGTH(v_ev_source)) THEN
                    v_claim_ok := FALSE; v_strip_reason := 'check1_existence: exact source span unavailable';
                ELSEIF (v_ev_verif!='verified') THEN
                    -- Check 6. The most important check: evidence <-> reality,
                    -- not just claim <-> evidence. Downgrade, do not silently strip.
                    v_claim_ok := FALSE;
                    v_strip_reason := 'check6_trustworthiness: assertion is ' || v_ev_verif || ', value not asserted';
                    v_limitations := ARRAY_APPEND(v_limitations,
                        'A value was read but could not be verified on a second pass (' || v_ev_verif || '). Confirm against the original report.');
                ELSEIF (v_ev_missing IS NULL OR v_ev_missing NOT IN ('present','explicitly_negative')
                    OR v_ev_value IS NULL) THEN
                    -- Pending/unreadable observations are not an asserted value.
                    v_claim_ok := FALSE; v_strip_reason := 'check6_trustworthiness: no assertable result';
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
                        v_passage := SUBSTR(v_ev_source,v_ev_start+1,v_ev_end-v_ev_start);

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
                            ELSEIF (NOT COALESCE(TRY_TO_BOOLEAN(GET_PATH(:v_filter_result, 'value')::VARCHAR),FALSE)) THEN
                                v_claim_ok := FALSE;
                                v_strip_reason := 'check4_polarity: passage does not confirm claim';
                            END IF;
                        ELSE
                            v_claim_ok := FALSE;
                            v_strip_reason := 'check1_existence: source passage unavailable';
                        END IF;
                    END IF;
                END IF;
                -- Never return model-supplied positions or a forged document URL.
                v_canonical_evidence := ARRAY_APPEND(v_canonical_evidence,
                    OBJECT_CONSTRUCT('kind','document_span','id',v_ev_id,'assertion_id',v_ev_id,
                      'doc_id',v_ev_doc_id,'page_index',v_ev_page,
                      'char_start',v_ev_start,'char_end',v_ev_end));
            ELSE
                v_claim_ok := FALSE; v_strip_reason := 'check5_type_match: unrecognised evidence kind';
            END IF;
            v_ei := v_ei + 1;
        END WHILE;

        IF (v_claim_ok) THEN
            v_validated := ARRAY_APPEND(v_validated, OBJECT_INSERT(v_claim,'evidence',v_canonical_evidence,TRUE));
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
