-- =============================================================================
-- SAARTHI - TOOL PREAMBLE v1
-- =============================================================================
--
-- THE REFERENCE COPY. This file creates nothing. Every agent-visible tool
-- procedure opens with the block between the markers below, pasted verbatim.
--
-- WHY PASTED AND NOT ABSTRACTED
--   Snowflake procedures have no include mechanism, so the choice is between
--   one clever indirection and eight honest copies. Eight copies win here:
--   a reviewer - or a judge - can diff every tool against this one file and
--   see that not one of them skipped the consent check. That is a security
--   property you can demonstrate in ten seconds. An abstraction is not.
--
--   scripts/check_gate.py --preamble enforces it, so drift is a build failure
--   rather than a discovery.
--
-- STATUS: NOT YET EXECUTED. No GOVERNANCE tables exist at the time of writing.
--   Compile-check this the day tables/10_governance.sql lands, before pasting
--   it eight times. Record the query ID.
--
-- ORDER MATTERS, AND THE ORDER IS NOT OBVIOUS
--   0. known_as_of is resolved FIRST, before any check can fail, because the
--      uniform error shape carries it: {"error": ..., "known_as_of": "<ts>"}.
--      An error with no timestamp is not the contract.
--   1. SELECTION before AUTHORISATION. "Which patient is this question about"
--      is a different question from "may this user see that patient", and
--      collapsing them was the fatal gap COPILOT-SPEC.md 0 was written to fix.
--      A permitted set is not a subject.
--   2. CARE_TEAM failure and CONSENT failure return DIFFERENT codes on purpose.
--      no_patient_access reveals nothing - not even that the patient exists.
--      access_withdrawn reveals that one does, and only ever reaches a user who
--      previously had legitimate access and needs to know why their view changed.
--   3. Steps 1-3 run on EVERY call and their results are NEVER cached. A binding
--      is a record of a human's selection. It is not, and must never become, a
--      cached authorisation: consent can be revoked and CARE_TEAM.active_to can
--      pass while a conversation is open. This is the 30-second demo.
--
-- =============================================================================


/* ---------------------------------------------------------------------------
   USAGE - what a tool looks like with the preamble in place.

   CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.GET_PATIENT_FACTS(
       DOMAIN        VARCHAR,
       KNOWN_AS_OF   VARCHAR DEFAULT NULL)
     RETURNS VARIANT
     LANGUAGE SQL
     EXECUTE AS OWNER          -- every tool, no exceptions
     COMMENT = 'Contract 2 tool 1. Takes no patient selector.'
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
       v_result         VARIANT;
   BEGIN
       << PREAMBLE GOES HERE >>

       -- tool body, scoped to :v_patient_id and :v_known_as_of only.
       -- The body never re-reads CURRENT_USER() and never accepts a patient
       -- identifier from its own arguments.

       RETURN v_result;
   END;
   $$;
--------------------------------------------------------------------------- */


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


-- =============================================================================
-- FOUR THINGS THE PREAMBLE DELIBERATELY DOES NOT DO
-- =============================================================================
--
-- 1. It does not check data_categories. A tool that returns financial data -
--    GET_PATIENT_FACTS(domain => 'coverage') - must additionally require
--    ARRAY_CONTAINS('financial'::VARIANT, c.data_categories). Put that check in
--    the tool body, not here: a consent valid for clinical data is not thereby
--    valid for financial data, and burying that in shared code hides it.
--
-- 2. It does not check CONSENT.date_range_from / date_range_to. Those bound
--    WHICH RECORDS are covered, not whether the caller may ask, so they belong
--    in the retrieval predicate of each tool alongside known_as_of.
--
-- 3. It does not validate encounter_ref. GET_READINESS must additionally confirm
--    the encounter belongs to :v_patient_id and return
--    {"error":"binding_mismatch"} otherwise - an encounter id identifies a
--    patient, so this is A1 wearing a different parameter name.
--
-- 4. It does not write a SECURITY_EVENT. A no_patient_access result is the
--    system working correctly and logging every one of them would bury the real
--    signal. SECURITY_EVENT is written by validate_answer on a scope violation,
--    where evidence crossed a boundary it should not have reached.
--
-- =============================================================================
-- COHORT_QUERY IS THE ONE EXCEPTION
-- =============================================================================
-- It has no single subject and must REFUSE while a patient is bound. It uses
-- step 0 and step 1 only, inverted: if a binding exists, return
-- {"error":"binding_mismatch"} with a message telling the user to release the
-- patient first. Mixing a bound-patient conversation with cross-patient results
-- is how a coordinator misreads one patient's data as another's.
-- =============================================================================
