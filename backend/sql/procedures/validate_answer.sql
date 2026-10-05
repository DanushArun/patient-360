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
                          AND role_type IN ('treating', 'coordinator')
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
    LET v_data_categories ARRAY := (SELECT data_categories FROM SAARTHI.GOVERNANCE.CONSENT
        WHERE consent_id=:v_consent_id);
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
        LET v_canonical_claim VARIANT := NULL;
        IF (NOT COALESCE(IS_ARRAY(v_evidence),FALSE) OR COALESCE(v_n_ev,0)!=1) THEN
            v_claim_ok := FALSE;
            v_strip_reason := 'check1_existence: exactly one factual source is required';
        END IF;
        IF (v_text IS NULL OR LENGTH(v_text)=0 OR v_claim_type IS NULL
            OR v_claim_type NOT IN ('numeric','date','status','textual')
            OR (v_claim_type!='textual' AND (v_asserted IS NULL
                OR IS_NULL_VALUE(v_asserted)))) THEN
            v_claim_ok := FALSE;
        END IF;
        WHILE (v_ei < v_n_ev AND v_claim_ok) DO
            LET v_ev VARIANT := GET(:v_evidence, :v_ei);
            LET v_kind VARCHAR := GET_PATH(:v_ev, 'kind')::VARCHAR;
            LET v_ev_id VARCHAR := GET_PATH(:v_ev, 'id')::VARCHAR;
            IF (v_kind='structured' AND
                (STARTSWITH(v_ev_id,'ROW-') OR STARTSWITH(v_ev_id,'RULE--'))) THEN
                LET v_record VARIANT;
                LET v_categories ARRAY := (SELECT data_categories
                    FROM SAARTHI.GOVERNANCE.CONSENT
                    WHERE consent_id=:v_consent_id);
                CALL SAARTHI.OPERATIONAL.ANSWER_GATEWAY_RECORD(:v_claim,:v_known_as_of_s,
                    OBJECT_CONSTRUCT('patient_id',:v_patient_id,'categories',:v_categories))
                    INTO :v_record;
                IF (v_record:error IS NOT NULL) THEN
                    v_claim_ok := FALSE; v_strip_reason := v_record:error::VARCHAR;
                ELSE
                    v_text := v_record:claim:text::VARCHAR;
                    v_canonical_claim := v_record:claim;
                    v_asserted := NULL;
                    v_canonical_evidence := v_record:claim:evidence::ARRAY;
                    v_limitations := ARRAY_CAT(v_limitations,v_record:limitations::ARRAY);
                END IF;
            ELSEIF (v_kind='structured' AND NOT COALESCE(ARRAY_CONTAINS(
                'clinical'::VARIANT,:v_data_categories),FALSE)) THEN
                v_claim_ok := FALSE; v_strip_reason := 'clinical_consent_required';
            ELSEIF (v_kind = 'structured') THEN
                LET v_ev_patient VARCHAR := NULL;
                LET v_ev_ingested TIMESTAMP_NTZ := NULL;
                LET v_ev_num FLOAT := NULL;
                LET v_ev_txt VARCHAR := NULL;
                LET v_ev_concept VARCHAR := NULL;
                LET v_ev_time TIMESTAMP_NTZ := NULL;
                LET v_ev_recorded TIMESTAMP_NTZ := NULL;
                LET v_ev_derived BOOLEAN := FALSE;
                LET v_ev_state VARCHAR := NULL;
                LET v_ev_unit VARCHAR := NULL;
                LET v_ev_negated BOOLEAN := NULL;
                SELECT h.patient_id,h.ingested_at,h.value_num,h.value_text,h.concept_name,
                       h.event_time,h.source_recorded_at,h.is_derived,h.plausibility_state,
                       h.unit,ce.negation
                  INTO :v_ev_patient,:v_ev_ingested,:v_ev_num,:v_ev_txt,:v_ev_concept,
                       :v_ev_time,:v_ev_recorded,:v_ev_derived,:v_ev_state,
                       :v_ev_unit,:v_ev_negated
                  FROM SAARTHI.CORE.DT_HARMONIZED_EVENTS h
                  LEFT JOIN SAARTHI.CORE.CLINICAL_EVENT ce
                    ON ce.event_id=h.event_id AND ce.patient_id=h.patient_id
                 WHERE h.event_id=:v_ev_id;
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
                ELSEIF (v_n_ev!=1 OR v_ev_derived OR v_ev_state!='present'
                    OR v_ev_state IS NULL OR v_ev_concept IS NULL OR v_ev_negated IS NULL
                    OR v_ev_time IS NULL OR v_ev_recorded IS NULL
                    OR v_ev_ingested IS NULL OR (v_ev_num IS NULL AND v_ev_txt IS NULL)) THEN
                    v_claim_ok := FALSE;
                    v_strip_reason := 'structured source cannot be safely rendered';
                ELSEIF (v_ev_ingested > v_known_as_of) THEN
                    v_claim_ok := FALSE; v_strip_reason := 'check3_temporality: evidence ingested after known_as_of';
                ELSEIF (v_claim_type = 'numeric' AND v_asserted IS NOT NULL) THEN
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
                IF (v_claim_ok) THEN
                    v_text := 'Recorded ' || v_ev_concept || ': '
                        || IFF(v_ev_negated,'explicitly negative; ','')
                        || COALESCE(v_ev_num::VARCHAR,v_ev_txt)
                        || IFF(v_ev_num IS NOT NULL AND v_ev_unit IS NOT NULL,
                            ' ' || v_ev_unit,'')
                        || ' (event time ' || TO_VARCHAR(v_ev_time,
                            'YYYY-MM-DD"T"HH24:MI:SS') || ').';
                    v_claim_type := 'textual';
                    v_asserted := NULL;
                END IF;
                v_canonical_evidence := ARRAY_APPEND(v_canonical_evidence,
                    OBJECT_CONSTRUCT('kind','structured','id',v_ev_id,
                        'table','SAARTHI.CORE.DT_HARMONIZED_EVENTS',
                        'event_time',TO_VARCHAR(v_ev_time,'YYYY-MM-DD"T"HH24:MI:SS'),
                        'source_recorded_at',TO_VARCHAR(v_ev_recorded,
                            'YYYY-MM-DD"T"HH24:MI:SS'),
                        'ingested_at',TO_VARCHAR(v_ev_ingested,'YYYY-MM-DD"T"HH24:MI:SS')));
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
                 WHERE a.assertion_id = :v_ev_id AND d.scope='patient' AND d.status='active'
                   AND COALESCE(ARRAY_CONTAINS(TO_VARIANT(
                       CASE d.doc_type WHEN 'authorization_letter' THEN 'financial'
                       WHEN 'claim_document' THEN 'financial'
                       WHEN 'lab_report' THEN 'clinical' WHEN 'pathology_report' THEN 'clinical'
                       WHEN 'imaging_report' THEN 'clinical' WHEN 'discharge_summary' THEN 'clinical'
                       WHEN 'prescription' THEN 'clinical' WHEN 'referral_letter' THEN 'clinical'
                       WHEN 'surgical_note' THEN 'clinical' WHEN 'consent_form' THEN 'identity'
                       WHEN 'cbc_report' THEN 'clinical' WHEN 'discharge_note' THEN 'clinical'
                       ELSE NULL END),
                       :v_data_categories),FALSE);
                IF (v_ev_verif IS NULL) THEN
                    v_claim_ok := FALSE; v_strip_reason := 'check1_existence: ' || v_ev_id || ' does not resolve';
                    LET v_sec_event_id3 VARCHAR := UUID_STRING();
                    LET v_sec_detail3 VARIANT := OBJECT_CONSTRUCT('claim', :v_text, 'evidence_id', :v_ev_id, 'reason', 'fabricated_evidence_id');
                    INSERT INTO SAARTHI.GOVERNANCE.SECURITY_EVENT (event_id, practitioner_id, event_type, detail)
                    SELECT :v_sec_event_id3, NULL, 'validator_strip', :v_sec_detail3;
                ELSEIF (v_ev_doc_patient IS NULL OR v_ev_doc_patient != v_patient_id) THEN
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
                    v_claim_ok := FALSE;
                    v_strip_reason := 'check6_trustworthiness: assertion is ' || v_ev_verif || ', value not asserted';
                    v_limitations := ARRAY_APPEND(v_limitations,
                        'A value was read but could not be verified on a second pass (' || v_ev_verif || '). Confirm against the original report.');
                ELSEIF (v_ev_missing IS NULL OR v_ev_missing NOT IN ('present','explicitly_negative')
                    OR v_ev_value IS NULL) THEN
                    v_claim_ok := FALSE; v_strip_reason := 'check6_trustworthiness: no assertable result';
                ELSE
                    -- SQL checks precede the AI call so a claim strippable by structure
                    -- never fires AI_FILTER.
                    IF (v_claim_type = 'numeric' AND v_asserted IS NOT NULL) THEN
                        LET v_ev_num_ds FLOAT := TRY_TO_DOUBLE(v_ev_value);
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
                        LET v_passage VARCHAR := NULL;
                        v_passage := SUBSTR(v_ev_source,v_ev_start+1,v_ev_end-v_ev_start);
                        IF (v_passage IS NOT NULL) THEN
                            LET v_filter_result VARIANT := (
                                SELECT AI_FILTER(
                                  PROMPT('Does this passage confirm that {0}? Passage: {1}',
                                         :v_text, :v_passage),
                                  TRUE));
                            IF (GET_PATH(:v_filter_result, 'error') IS NOT NULL
                                AND NOT IS_NULL_VALUE(GET_PATH(:v_filter_result, 'error'))) THEN
                                v_claim_ok := FALSE;
                                v_strip_reason := 'check4_polarity: AI_FILTER error (' ||
                                                  GET_PATH(:v_filter_result, 'error')::VARCHAR ||
                                                  ') - fail-closed strip';
                            ELSEIF (NOT COALESCE(TRY_TO_BOOLEAN(GET_PATH(:v_filter_result, 'value')::VARCHAR),FALSE)) THEN
                                v_claim_ok := FALSE;
                                v_strip_reason := 'check4_polarity: passage does not confirm claim';
                            END IF;
                            IF (v_claim_ok) THEN
                                v_text := 'Verified source passage: ' || v_passage;
                                IF (v_claim_type='numeric') THEN
                                    v_asserted := TO_VARIANT(TRY_TO_DOUBLE(v_ev_value));
                                ELSEIF (v_claim_type='date') THEN
                                    v_asserted := TO_VARIANT(
                                        TO_CHAR(TRY_TO_DATE(v_ev_value),'YYYY-MM-DD'));
                                ELSEIF (v_claim_type='status') THEN
                                    v_asserted := TO_VARIANT(v_ev_value);
                                END IF;
                            END IF;
                        ELSE
                            v_claim_ok := FALSE;
                            v_strip_reason := 'check1_existence: source passage unavailable';
                        END IF;
                    END IF;
                END IF;
                v_canonical_evidence := ARRAY_APPEND(v_canonical_evidence,
                    OBJECT_CONSTRUCT('kind','document_span','id',v_ev_id,
                      'doc_id',v_ev_doc_id,'page_index',v_ev_page,
                      'char_start',v_ev_start,'char_end',v_ev_end,
                      'verification_status',v_ev_verif));
            ELSEIF (v_kind='reference_clause' AND v_claim_type='textual') THEN
                LET v_ref VARIANT;
                CALL SAARTHI.OPERATIONAL.ANSWER_GATEWAY_REFERENCE(
                    :v_ev_id,:v_known_as_of_s) INTO :v_ref;
                IF (v_ref:error IS NOT NULL) THEN
                    v_claim_ok := FALSE; v_strip_reason := 'unverified_reference';
                ELSE
                    v_text := v_ref:claim:text::VARCHAR;
                    v_asserted := NULL;
                    v_canonical_evidence := v_ref:claim:evidence::ARRAY;
                    v_limitations := ARRAY_CAT(v_limitations,v_ref:limitations::ARRAY);
                END IF;
            ELSE
                v_claim_ok := FALSE; v_strip_reason := 'check5_type_match: unrecognised evidence kind';
            END IF;
            v_ei := v_ei + 1;
        END WHILE;
        IF (v_claim_ok) THEN
            v_validated := ARRAY_APPEND(v_validated, OBJECT_CONSTRUCT(
                'text',v_text,'claim_type',v_claim_type,'asserted_value',v_asserted,
                'gate',v_canonical_claim:gate,'outcome',v_canonical_claim:outcome,
                'rule_id',v_canonical_claim:rule_id,'rule_version',v_canonical_claim:rule_version,
                'provenance_note',v_canonical_claim:provenance_note,
                'evidence',v_canonical_evidence));
        ELSE
            LET v_strip_event_id VARCHAR := UUID_STRING();
            LET v_strip_detail VARIANT := OBJECT_CONSTRUCT('reason',
                SPLIT_PART(COALESCE(v_strip_reason,'invalid_claim'),':',1));
            INSERT INTO SAARTHI.GOVERNANCE.SECURITY_EVENT
                (event_id,practitioner_id,event_type,detail)
            SELECT :v_strip_event_id,:v_practitioner,'validator_strip',:v_strip_detail;
            v_limitations := ARRAY_APPEND(v_limitations,
                'A candidate claim could not be verified and was omitted.');
        END IF;
        v_ci := v_ci + 1;
    END WHILE;
    LET v_versions VARIANT := (SELECT COALESCE(OBJECT_AGG(rule_id,version),OBJECT_CONSTRUCT())
        FROM (SELECT value:rule_id::VARCHAR AS rule_id,
        TO_VARIANT(MAX(value:rule_version::INTEGER)) AS version
        FROM TABLE(FLATTEN(INPUT=>:v_validated)) WHERE value:rule_id IS NOT NULL GROUP BY 1));
    RETURN OBJECT_CONSTRUCT('rule_versions',v_versions,
        'access_scope',SHA2(v_binding_id || '|' || v_consent_id || '|' || v_patient_id
            || '|' || COALESCE(TO_JSON(v_data_categories),'null'),256),
        'claims', v_validated,
        'limitations', v_limitations,
        'overall_status', CASE WHEN ARRAY_SIZE(v_validated) = 0 THEN 'partial'
                                WHEN ARRAY_SIZE(v_limitations) > 0 THEN 'partial'
                                ELSE 'supported' END,
        'known_as_of', TO_VARCHAR(v_known_as_of, 'YYYY-MM-DD"T"HH24:MI:SS'));
END;
$$;
