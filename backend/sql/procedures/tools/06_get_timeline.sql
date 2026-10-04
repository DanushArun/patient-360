-- =============================================================================
-- STEP 14 - Tool 6: get_timeline
-- =============================================================================
-- Contract 2. D10: closes a real hole - "when did the FISH result arrive?"
-- had no tool path before this. All three R2 clocks per event, plus facility.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.get_timeline(KNOWN_AS_OF VARCHAR DEFAULT NULL)
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Contract 2 tool 6. Chronology for the BOUND patient, all 3 R2 clocks. Takes no patient selector.'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_known_as_of    TIMESTAMP_NTZ;
    v_known_as_of_s  VARCHAR;
    v_binding_id     VARCHAR;
    v_patient_id     VARCHAR;
    v_practitioner   VARCHAR;
    v_care_team_id   VARCHAR;
    v_consent_id     VARCHAR;
    v_timeline       ARRAY;
    v_total          NUMBER;
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

    -- Every field the Timeline tab renders comes from here (CR1-01). Qualitative results
    -- (HER2 IHC, pathology) carry value_text, not value_num; a value that failed the
    -- plausibility check is withheld and its state is returned instead (R3). Provenance links
    -- use the same rule as the labs fact view: a verified, present assertion supports an event
    -- only on matching patient, concept, unit and number.
    v_total := (SELECT COUNT(*) FROM SAARTHI.CORE.DT_HARMONIZED_EVENTS
                 WHERE patient_id = :v_patient_id AND ingested_at <= :v_known_as_of);

    v_timeline := (
        SELECT ARRAY_AGG(OBJECT_CONSTRUCT_KEEP_NULL(
                 'concept', COALESCE(t.concept_name, NULLIF(TRIM(t.display), ''), NULLIF(TRIM(t.code), '')),
                 'event_type', t.event_type,
                 'display', t.display, 'code', t.code, 'source_status', t.source_status,
                 'value', IFF(t.plausibility_state = 'present', t.value_num, NULL),
                 'value_text', t.value_text,
                 'unit', t.unit,
                 'abnormal_flag', t.abnormal_flag,
                 -- SHARED RULE (also used by web_reads.sql labs facts; contract-tested identical).
                 'value_state', CASE
                     WHEN t.plausibility_state <> 'present' THEN t.plausibility_state
                     WHEN t.value_num IS NOT NULL OR NULLIF(TRIM(t.value_text), '') IS NOT NULL THEN 'present'
                     WHEN t.source_status = 'ordered' THEN 'pending'
                     WHEN t.source_status = 'cancelled' THEN 'not_received'
                     WHEN COALESCE(NULLIF(TRIM(t.concept_name), ''), NULLIF(TRIM(t.display), ''), NULLIF(TRIM(t.code), '')) IS NOT NULL THEN 'present'
                     ELSE 'unreadable' END,
                 'is_derived', t.is_derived, 'derivation', t.derivation,
                 'valid_until', TO_VARCHAR(t.valid_until, 'YYYY-MM-DD"T"HH24:MI:SS'),
                 'event_time', t.event_time, 'source_recorded_at', t.source_recorded_at,
                 'ingested_at', t.ingested_at, 'event_id', t.event_id,
                 'source_event_ids', IFF(t.is_derived, ARRAY_CONSTRUCT(), ARRAY_CONSTRUCT(t.event_id)),
                 'source_assertion_ids', COALESCE(t.assertion_ids, ARRAY_CONSTRUCT()),
                 'source_document_ids', COALESCE(t.doc_ids, ARRAY_CONSTRUCT()),
                 'source_links_observed_at', :v_known_as_of_s))
               WITHIN GROUP (ORDER BY t.event_time)
          FROM (
            SELECT h.*, ce.unit, ce.status AS source_status, ce.display, ce.code, l.assertion_ids, l.doc_ids
              FROM SAARTHI.CORE.DT_HARMONIZED_EVENTS h
              LEFT JOIN SAARTHI.CORE.CLINICAL_EVENT ce ON ce.event_id = h.event_id
              LEFT JOIN (SELECT el.target_id, ARRAY_AGG(DISTINCT a.assertion_id) AS assertion_ids,
                                ARRAY_AGG(DISTINCT a.doc_id) AS doc_ids
                           FROM SAARTHI.EVIDENCE.EVIDENCE_LINK el
                           JOIN SAARTHI.EVIDENCE.ASSERTION a ON a.assertion_id = el.assertion_id
                           JOIN SAARTHI.DOCUMENTS.DOCUMENT d ON d.doc_id = a.doc_id
                           JOIN SAARTHI.CORE.CLINICAL_EVENT se
                             ON se.event_id = el.target_id
                            AND se.patient_id = d.patient_id
                            AND se.concept_id = a.concept_id
                            AND se.unit = a.unit
                            AND se.value_num = TRY_TO_DOUBLE(REPLACE(a.value, ',', ''))
                          WHERE el.relation = 'supports' AND d.status = 'active'
                            AND a.verification_status = 'verified'
                            AND a.missingness_state = 'present'
                            AND d.scope = 'patient'
                            AND d.patient_id = :v_patient_id
                            AND d.ingested_at <= :v_known_as_of
                          GROUP BY el.target_id) l ON l.target_id = h.event_id
             WHERE h.patient_id = :v_patient_id AND h.ingested_at <= :v_known_as_of
             ORDER BY h.event_time DESC NULLS LAST, h.event_id
             LIMIT 200) t);

    RETURN OBJECT_CONSTRUCT('timeline', COALESCE(v_timeline, ARRAY_CONSTRUCT()),
                             'total_events', v_total, 'timeline_limit', 200,
                             'truncated', v_total > 200,
                             'provenance_observed_at', :v_known_as_of_s,
                             'binding_id', v_binding_id, 'known_as_of', v_known_as_of_s);
END;
$$;
