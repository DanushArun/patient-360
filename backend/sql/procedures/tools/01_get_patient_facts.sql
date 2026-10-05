-- =============================================================================
-- STEP 14 - Tool 1: get_patient_facts
-- =============================================================================
-- Contract 2. COPILOT-SPEC.md §6: "GetPatientFacts across 6 domains."
-- Domains mapped directly to the CORE schema: demographics, labs, coverage,
-- treatment_plan, encounters, identity. No patient selector - the preamble
-- resolves the bound patient from CURRENT_SESSION().
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.get_patient_facts(
    DOMAIN      VARCHAR,
    KNOWN_AS_OF VARCHAR DEFAULT NULL)
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Contract 2 tool 1. Structured facts by domain for the BOUND patient. Takes no patient selector.'
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
    v_data_categories ARRAY;
    v_result         VARIANT;
    v_snapshot       TIMESTAMP_TZ;
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

    -- Preamble note 1 applies here: a consent valid for clinical data is not
    -- thereby valid for financial data. The coverage domain additionally
    -- requires 'financial' in CONSENT.data_categories.
    v_data_categories := (SELECT data_categories FROM SAARTHI.GOVERNANCE.CONSENT WHERE consent_id = :v_consent_id);
    LET v_required_category VARCHAR := CASE :DOMAIN
        WHEN 'coverage' THEN 'financial'
        WHEN 'demographics' THEN 'identity' WHEN 'identity' THEN 'identity'
        ELSE 'clinical' END;
    IF (NOT COALESCE(ARRAY_CONTAINS(TO_VARIANT(v_required_category),
        :v_data_categories),FALSE)) THEN
        RETURN OBJECT_CONSTRUCT('error', 'consent_not_valid', 'known_as_of', :v_known_as_of_s);
    END IF;

    v_snapshot := TRY_TO_TIMESTAMP_TZ(v_known_as_of_s || '+00:00');
    CASE (:DOMAIN)
        WHEN 'demographics' THEN
            v_result := (SELECT OBJECT_CONSTRUCT('evidence_id','ROW-PATIENT--'||patient_id,'patient_id', patient_id, 'name', name, 'dob', dob,
                            'gender', gender, 'district', district, 'state', state, 'primary_language', primary_language)
                          FROM SAARTHI.CORE.PATIENT AT(TIMESTAMP => :v_snapshot)
                         WHERE patient_id = :v_patient_id);
        WHEN 'labs' THEN
            -- value_text alongside value_num: a qualitative result (HER2 IHC
            -- "grade=III ihc=2+", a FISH ratio/copy pair) has no value_num at
            -- all, and dropping value_text made every such result invisible
            -- here even though evaluate_gates.sql reads the same column -
            -- found live asking about a HER2 FISH result the record actually
            -- has.
            v_result := (SELECT ARRAY_AGG(OBJECT_CONSTRUCT('concept', concept_name, 'value', value_num,
                            'value_text', value_text, 'unit', unit,
                            'is_derived', is_derived, 'derivation', derivation,
                            'event_time', event_time, 'source_recorded_at', source_recorded_at,
                            'ingested_at', ingested_at, 'event_id', event_id))
                          FROM SAARTHI.CORE.DT_HARMONIZED_EVENTS
                          WHERE patient_id = :v_patient_id AND ingested_at <= :v_known_as_of);
        WHEN 'coverage' THEN
            v_result := (SELECT ARRAY_AGG(OBJECT_CONSTRUCT('evidence_id','ROW-COVERAGE--'||coverage_id,'payer_name', payer_name, 'annual_limit', annual_limit,
                            'used_amount', used_amount, 'is_family_floater', is_family_floater))
                          FROM SAARTHI.CORE.COVERAGE AT(TIMESTAMP => :v_snapshot)
                         WHERE patient_id = :v_patient_id);
        WHEN 'treatment_plan' THEN
            v_result := (SELECT ARRAY_AGG(OBJECT_CONSTRUCT('evidence_id','ROW-PLAN--'||plan_id,'version', version, 'regimen_display', regimen_display,
                            'intent', intent, 'decided_at', decided_at)) WITHIN GROUP (ORDER BY version DESC)
                          FROM SAARTHI.CORE.TREATMENT_PLAN AT(TIMESTAMP => :v_snapshot)
                         WHERE patient_id = :v_patient_id);
        WHEN 'encounters' THEN
            v_result := (SELECT ARRAY_AGG(OBJECT_CONSTRUCT('evidence_id','ROW-ENCOUNTER--'||encounter_id,'encounter_id', encounter_id, 'cycle_number', cycle_number,
                            'event_time', event_time, 'gap_type', gap_type)) WITHIN GROUP (ORDER BY event_time)
                          FROM SAARTHI.CORE.ENCOUNTER AT(TIMESTAMP => :v_snapshot)
                         WHERE patient_id = :v_patient_id);
        WHEN 'identity' THEN
            v_result := (SELECT ARRAY_AGG(OBJECT_CONSTRUCT('evidence_id','ROW-IDENTITY--'||map_id,'source_system', source_system, 'link_status', link_status))
                          FROM SAARTHI.CORE.ID_MAP AT(TIMESTAMP => :v_snapshot)
                         WHERE patient_id = :v_patient_id
                           AND link_status IN ('abha_linked','manually_verified'));
        ELSE
            RETURN OBJECT_CONSTRUCT('error', 'invalid_argument', 'known_as_of', :v_known_as_of_s);
    END CASE;

    RETURN OBJECT_CONSTRUCT('domain', DOMAIN, 'facts', COALESCE(v_result, ARRAY_CONSTRUCT()),
                             'binding_id', v_binding_id, 'known_as_of', v_known_as_of_s);
EXCEPTION WHEN STATEMENT_ERROR THEN
    RETURN OBJECT_CONSTRUCT('error','record_snapshot_unavailable','known_as_of',v_known_as_of_s);
END;
$$;
