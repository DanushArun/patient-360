-- Bounded web reads. No table grants or shared patient sessions; CURRENT_USER is authoritative.
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.GET_WEB_WORKSPACE(VIEW_NAME VARCHAR, HORIZON_DAYS INTEGER)
RETURNS VARIANT LANGUAGE SQL EXECUTE AS OWNER AS $$
DECLARE v_rows ARRAY;
BEGIN
IF (HORIZON_DAYS IS NULL OR HORIZON_DAYS < 1 OR HORIZON_DAYS > 31) THEN RETURN OBJECT_CONSTRUCT('error','invalid_argument'); END IF;
IF (VIEW_NAME = 'patients') THEN
SELECT COALESCE(ARRAY_AGG(OBJECT_CONSTRUCT_KEEP_NULL(*)), ARRAY_CONSTRUCT()) INTO :v_rows FROM (
WITH patient_scope AS (
  SELECT DISTINCT p.patient_id, p.name
  FROM SAARTHI.CORE.PATIENT p
  JOIN SAARTHI.GOVERNANCE.CARE_TEAM ct ON ct.patient_id = p.patient_id
  JOIN SAARTHI.GOVERNANCE.PRACTITIONER pr ON pr.practitioner_id = ct.practitioner_id
  LEFT JOIN SAARTHI.GOVERNANCE.FACILITY f ON f.facility_id = pr.facility_id
  WHERE UPPER(pr.snowflake_user) = UPPER(CURRENT_USER()) AND pr.active = TRUE
    AND ct.role_type IN ('treating', 'coordinator')
    AND ct.active_from <= CURRENT_DATE()
    AND (ct.active_to IS NULL OR ct.active_to >= CURRENT_DATE())
    AND EXISTS (
      SELECT 1 FROM SAARTHI.GOVERNANCE.CONSENT c
      WHERE c.patient_id = p.patient_id AND c.status = 'active'
        AND c.valid_from <= CURRENT_TIMESTAMP()
        AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP())
        AND c.purpose_code IN ('treatment', 'coordination')
        AND (c.granted_to_facility_id = pr.facility_id OR c.granted_to_org_id = f.org_id)
    )
)
SELECT patient_id, name FROM patient_scope ORDER BY name, patient_id
);
ELSEIF (VIEW_NAME = 'queue_readiness') THEN
SELECT COALESCE(ARRAY_AGG(OBJECT_CONSTRUCT_KEEP_NULL(*)), ARRAY_CONSTRUCT()) INTO :v_rows FROM (
WITH patient_scope AS (
  SELECT DISTINCT p.patient_id, p.name
  FROM SAARTHI.CORE.PATIENT p
  JOIN SAARTHI.GOVERNANCE.CARE_TEAM ct ON ct.patient_id = p.patient_id
  JOIN SAARTHI.GOVERNANCE.PRACTITIONER pr ON pr.practitioner_id = ct.practitioner_id
  LEFT JOIN SAARTHI.GOVERNANCE.FACILITY f ON f.facility_id = pr.facility_id
  WHERE UPPER(pr.snowflake_user) = UPPER(CURRENT_USER()) AND pr.active = TRUE
    AND ct.role_type IN ('treating', 'coordinator')
    AND ct.active_from <= CURRENT_DATE()
    AND (ct.active_to IS NULL OR ct.active_to >= CURRENT_DATE())
    AND EXISTS (
      SELECT 1 FROM SAARTHI.GOVERNANCE.CONSENT c
      WHERE c.patient_id = p.patient_id AND c.status = 'active'
        AND c.valid_from <= CURRENT_TIMESTAMP()
        AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP())
        AND c.purpose_code IN ('treatment', 'coordination')
        AND (c.granted_to_facility_id = pr.facility_id OR c.granted_to_org_id = f.org_id)
    )
), selected_visit AS (
  SELECT e.patient_id, e.encounter_id, e.scheduled_time
  FROM SAARTHI.CORE.ENCOUNTER e JOIN patient_scope p ON p.patient_id = e.patient_id
  WHERE e.encounter_type = 'daycare'
  QUALIFY ROW_NUMBER() OVER (PARTITION BY e.patient_id ORDER BY
    IFF(e.scheduled_time >= CURRENT_TIMESTAMP(), 0, 1),
    IFF(e.scheduled_time >= CURRENT_TIMESTAMP(), e.scheduled_time, NULL) ASC NULLS LAST,
    IFF(e.scheduled_time < CURRENT_TIMESTAMP(), e.scheduled_time, NULL) DESC NULLS LAST,
    e.encounter_id) = 1
)
SELECT p.patient_id, p.name, e.encounter_id,
       TO_VARCHAR(e.scheduled_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS scheduled,
       DATEDIFF(day, CURRENT_DATE(), e.scheduled_time) AS days_to_visit,
       rs.gate, rs.rule_id, rs.rule_version, rs.outcome, rs.severity, rs.reason,
       TO_VARCHAR(rs.known_as_of, 'YYYY-MM-DD"T"HH24:MI:SS') AS known_as_of
FROM patient_scope p
LEFT JOIN selected_visit e ON e.patient_id = p.patient_id
LEFT JOIN SAARTHI.OPERATIONAL.READINESS_STATE rs
  ON rs.patient_id = p.patient_id AND rs.encounter_id = e.encounter_id
ORDER BY e.scheduled_time, p.patient_id, rs.gate, rs.rule_id
);
ELSEIF (VIEW_NAME = 'queue_tasks') THEN
SELECT COALESCE(ARRAY_AGG(OBJECT_CONSTRUCT_KEEP_NULL(*)), ARRAY_CONSTRUCT()) INTO :v_rows FROM (
WITH patient_scope AS (
  SELECT DISTINCT p.patient_id, p.name
  FROM SAARTHI.CORE.PATIENT p
  JOIN SAARTHI.GOVERNANCE.CARE_TEAM ct ON ct.patient_id = p.patient_id
  JOIN SAARTHI.GOVERNANCE.PRACTITIONER pr ON pr.practitioner_id = ct.practitioner_id
  LEFT JOIN SAARTHI.GOVERNANCE.FACILITY f ON f.facility_id = pr.facility_id
  WHERE UPPER(pr.snowflake_user) = UPPER(CURRENT_USER()) AND pr.active = TRUE
    AND ct.role_type IN ('treating', 'coordinator')
    AND ct.active_from <= CURRENT_DATE()
    AND (ct.active_to IS NULL OR ct.active_to >= CURRENT_DATE())
    AND EXISTS (
      SELECT 1 FROM SAARTHI.GOVERNANCE.CONSENT c
      WHERE c.patient_id = p.patient_id AND c.status = 'active'
        AND c.valid_from <= CURRENT_TIMESTAMP()
        AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP())
        AND c.purpose_code IN ('treatment', 'coordination')
        AND (c.granted_to_facility_id = pr.facility_id OR c.granted_to_org_id = f.org_id)
    )
), task_subjects AS (
  SELECT rt.*, ri.patient_id, ri.rule_id, ri.encounter_id
  FROM SAARTHI.OPERATIONAL.REVIEW_TASK rt
  JOIN SAARTHI.OPERATIONAL.REVIEW_ISSUE ri ON ri.issue_id = rt.issue_id
  JOIN patient_scope p ON p.patient_id = ri.patient_id
  UNION ALL
  SELECT rt.*, r.patient_id, r.rule_id, NULL AS encounter_id
  FROM SAARTHI.OPERATIONAL.REVIEW_TASK rt
  JOIN (SELECT DISTINCT rs.patient_id, rs.rule_id
        FROM SAARTHI.OPERATIONAL.READINESS_STATE rs
        JOIN patient_scope p ON p.patient_id = rs.patient_id) r
    ON rt.issue_id = r.patient_id || ':' || r.rule_id
  WHERE NOT EXISTS (SELECT 1 FROM SAARTHI.OPERATIONAL.REVIEW_ISSUE ri WHERE ri.issue_id = rt.issue_id)
)
SELECT t.patient_id, t.rule_id, t.encounter_id, t.task_id, t.issue_id,
       t.owner_practitioner_id, owner.name AS owner_name, t.state, t.decision, t.reason,
       TO_VARCHAR(t.created_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at
FROM task_subjects t
LEFT JOIN SAARTHI.GOVERNANCE.PRACTITIONER owner
  ON owner.practitioner_id = t.owner_practitioner_id
WHERE t.idempotency_key NOT LIKE 'web-event:%'
ORDER BY t.created_at DESC, t.task_id
);
ELSEIF (VIEW_NAME = 'census') THEN
SELECT COALESCE(ARRAY_AGG(OBJECT_CONSTRUCT_KEEP_NULL(*)), ARRAY_CONSTRUCT()) INTO :v_rows FROM (
WITH patient_scope AS (
  SELECT DISTINCT p.patient_id, p.name
  FROM SAARTHI.CORE.PATIENT p
  JOIN SAARTHI.GOVERNANCE.CARE_TEAM ct ON ct.patient_id = p.patient_id
  JOIN SAARTHI.GOVERNANCE.PRACTITIONER pr ON pr.practitioner_id = ct.practitioner_id
  LEFT JOIN SAARTHI.GOVERNANCE.FACILITY f ON f.facility_id = pr.facility_id
  WHERE UPPER(pr.snowflake_user) = UPPER(CURRENT_USER()) AND pr.active = TRUE
    AND ct.role_type IN ('treating', 'coordinator')
    AND ct.active_from <= CURRENT_DATE()
    AND (ct.active_to IS NULL OR ct.active_to >= CURRENT_DATE())
    AND EXISTS (
      SELECT 1 FROM SAARTHI.GOVERNANCE.CONSENT c
      WHERE c.patient_id = p.patient_id AND c.status = 'active'
        AND c.valid_from <= CURRENT_TIMESTAMP()
        AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP())
        AND c.purpose_code IN ('treatment', 'coordination')
        AND (c.granted_to_facility_id = pr.facility_id OR c.granted_to_org_id = f.org_id)
    )
)
   , plan AS (
      SELECT patient_id, regimen_display
        FROM SAARTHI.CORE.TREATMENT_PLAN
      QUALIFY ROW_NUMBER() OVER (PARTITION BY patient_id
                                 ORDER BY version DESC, decided_at DESC NULLS LAST) = 1
  )
  SELECT e.encounter_id, p.patient_id, p.name, p.district, p.state, p.primary_language,
         plan.regimen_display, e.cycle_number,
         TO_VARCHAR(e.scheduled_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS scheduled,
         rs.gate, rs.rule_id, rs.rule_version, rs.outcome, rs.severity, rs.reason
    FROM SAARTHI.CORE.ENCOUNTER e
    JOIN SAARTHI.CORE.PATIENT p ON p.patient_id = e.patient_id
    LEFT JOIN plan ON plan.patient_id = e.patient_id
    LEFT JOIN SAARTHI.OPERATIONAL.READINESS_STATE rs ON rs.encounter_id = e.encounter_id
   WHERE e.encounter_type = 'daycare'
     AND e.scheduled_time >= CURRENT_DATE()
     AND e.scheduled_time <  DATEADD(day, :HORIZON_DAYS, CURRENT_DATE())
 AND e.patient_id IN (SELECT patient_id FROM patient_scope)
 ORDER BY e.scheduled_time, p.name
);
ELSEIF (VIEW_NAME = 'practitioner') THEN
SELECT COALESCE(ARRAY_AGG(OBJECT_CONSTRUCT_KEEP_NULL(*)), ARRAY_CONSTRUCT()) INTO :v_rows FROM (
SELECT name, qualification FROM SAARTHI.GOVERNANCE.PRACTITIONER WHERE UPPER(snowflake_user)=UPPER(CURRENT_USER()) AND active=TRUE
);
ELSE RETURN OBJECT_CONSTRUCT('error','invalid_argument'); END IF;
RETURN OBJECT_CONSTRUCT('rows',v_rows);
END;
$$;

CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA(VIEW_NAME VARCHAR, ARGUMENT VARCHAR)
RETURNS VARIANT LANGUAGE SQL EXECUTE AS OWNER AS $$
DECLARE KNOWN_AS_OF VARCHAR DEFAULT NULL;
v_known_as_of TIMESTAMP_NTZ; v_known_as_of_s VARCHAR; v_binding_id VARCHAR;
v_patient_id VARCHAR; v_practitioner VARCHAR; v_care_team_id VARCHAR; v_consent_id VARCHAR;
v_rows ARRAY;
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
IF (VIEW_NAME = 'context') THEN
SELECT COALESCE(ARRAY_AGG(OBJECT_CONSTRUCT_KEEP_NULL(*)), ARRAY_CONSTRUCT()) INTO :v_rows FROM (
WITH next_visit AS (
         SELECT patient_id, cycle_number,
                TO_VARCHAR(scheduled_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS scheduled_at
           FROM SAARTHI.CORE.ENCOUNTER
          WHERE encounter_type = 'daycare' AND scheduled_time >= CURRENT_DATE()
          QUALIFY ROW_NUMBER() OVER (PARTITION BY patient_id ORDER BY scheduled_time) = 1
       ), latest_plan AS (
         SELECT patient_id, regimen_display
           FROM SAARTHI.CORE.TREATMENT_PLAN
          QUALIFY ROW_NUMBER() OVER (
            PARTITION BY patient_id ORDER BY version DESC, decided_at DESC) = 1
       )
       SELECT p.name, p.primary_language, nv.scheduled_at, nv.cycle_number,
              lp.regimen_display,
              (SELECT b.consent_id FROM SAARTHI.GOVERNANCE.PATIENT_BINDING b
                WHERE b.session_id = CURRENT_SESSION() AND b.released_at IS NULL
                ORDER BY b.bound_at DESC LIMIT 1) AS consent_id,
              pr.name AS practitioner_name
         FROM SAARTHI.CORE.PATIENT p
         JOIN SAARTHI.GOVERNANCE.PRACTITIONER pr
           ON UPPER(pr.snowflake_user) = UPPER(CURRENT_USER()) AND pr.active = TRUE
         LEFT JOIN next_visit nv ON nv.patient_id = p.patient_id
         LEFT JOIN latest_plan lp ON lp.patient_id = p.patient_id
        WHERE p.patient_id = :v_patient_id
);
ELSEIF (VIEW_NAME = 'snapshot') THEN
SELECT COALESCE(ARRAY_AGG(OBJECT_CONSTRUCT_KEEP_NULL(*)), ARRAY_CONSTRUCT()) INTO :v_rows FROM (
WITH ranked_encounters AS (
         SELECT e.patient_id, e.encounter_id,
                ROW_NUMBER() OVER (ORDER BY
                  IFF(e.scheduled_time >= CURRENT_TIMESTAMP(), 0, 1),
                  IFF(e.scheduled_time >= CURRENT_TIMESTAMP(),
                      e.scheduled_time, NULL) ASC NULLS LAST,
                  IFF(e.scheduled_time < CURRENT_TIMESTAMP(),
                      e.scheduled_time, NULL) DESC NULLS LAST
                ) AS visit_rank
           FROM SAARTHI.CORE.ENCOUNTER e
          WHERE e.patient_id = :v_patient_id AND e.encounter_type = 'daycare'
       )
       SELECT rs.gate, rs.rule_id, rs.rule_version, rs.outcome, rs.severity, rs.reason,
              rs.evidence_ids::VARCHAR AS evidence_ids,
              TO_VARCHAR(rs.known_as_of, 'YYYY-MM-DD"T"HH24:MI:SS') AS known_as_of
         FROM SAARTHI.OPERATIONAL.READINESS_STATE rs
         JOIN ranked_encounters e
           ON e.patient_id = rs.patient_id AND e.encounter_id = rs.encounter_id
        WHERE e.visit_rank = 1
        ORDER BY rs.gate, rs.rule_id
);
ELSEIF (VIEW_NAME = 'tasks') THEN
SELECT COALESCE(ARRAY_AGG(OBJECT_CONSTRUCT_KEEP_NULL(*)), ARRAY_CONSTRUCT()) INTO :v_rows FROM (
SELECT rt.task_id,rt.issue_id,rt.owner_practitioner_id,COALESCE(pr.name,rt.owner_practitioner_id) AS owner,
rt.state,rt.decision,rt.reason,rt.actor_practitioner_id,actor.name AS actor,
COALESCE(ri.version,0) AS issue_version, rt.idempotency_key LIKE 'web-event:%' AS is_event,
TO_VARCHAR(rt.created_at,'YYYY-MM-DD"T"HH24:MI:SS') AS created_at
FROM SAARTHI.OPERATIONAL.REVIEW_TASK rt
LEFT JOIN SAARTHI.OPERATIONAL.REVIEW_ISSUE ri ON ri.issue_id=rt.issue_id
LEFT JOIN SAARTHI.GOVERNANCE.PRACTITIONER pr ON pr.practitioner_id=rt.owner_practitioner_id
LEFT JOIN SAARTHI.GOVERNANCE.PRACTITIONER actor ON actor.practitioner_id=rt.actor_practitioner_id
WHERE (rt.issue_id=:v_patient_id||':'||:ARGUMENT OR (ri.patient_id=:v_patient_id AND ri.rule_id=:ARGUMENT))
ORDER BY rt.created_at DESC,rt.task_id
);
ELSEIF (VIEW_NAME = 'owners') THEN
SELECT COALESCE(ARRAY_AGG(OBJECT_CONSTRUCT_KEEP_NULL(*)), ARRAY_CONSTRUCT()) INTO :v_rows FROM (
SELECT DISTINCT p.practitioner_id, p.name FROM SAARTHI.GOVERNANCE.CARE_TEAM ct
JOIN SAARTHI.GOVERNANCE.PRACTITIONER p ON p.practitioner_id=ct.practitioner_id
LEFT JOIN SAARTHI.GOVERNANCE.FACILITY f ON f.facility_id=p.facility_id
WHERE ct.patient_id=:v_patient_id AND p.active=TRUE AND ct.role_type IN ('treating','coordinator')
AND ct.active_from<=CURRENT_DATE() AND (ct.active_to IS NULL OR ct.active_to>=CURRENT_DATE())
AND EXISTS (SELECT 1 FROM SAARTHI.GOVERNANCE.CONSENT c WHERE c.patient_id=ct.patient_id
AND c.status='active' AND c.valid_from<=CURRENT_TIMESTAMP() AND (c.valid_until IS NULL OR c.valid_until>=CURRENT_TIMESTAMP())
AND c.purpose_code IN ('treatment','coordination') AND (c.granted_to_facility_id=p.facility_id OR c.granted_to_org_id=f.org_id))
ORDER BY p.name,p.practitioner_id
);
ELSEIF (VIEW_NAME = 'schemes') THEN
SELECT COALESCE(ARRAY_AGG(OBJECT_CONSTRUCT_KEEP_NULL(*)), ARRAY_CONSTRUCT()) INTO :v_rows FROM (
SELECT scheme_id,scheme_name,scheme_type,annual_limit,eligibility_status,covered_packages FROM SAARTHI.OPERATIONAL.DT_SCHEME_ELIGIBILITY WHERE patient_id=:v_patient_id
);
ELSEIF (VIEW_NAME = 'answers') THEN
SELECT COALESCE(ARRAY_AGG(OBJECT_CONSTRUCT_KEEP_NULL(*)), ARRAY_CONSTRUCT()) INTO :v_rows FROM (
SELECT run_id, question_class, answer_status, known_as_of::VARCHAR AS known_as_of,
evidence_ids, claims_json, validation_results, created_at::VARCHAR AS created_at
FROM SAARTHI.EVIDENCE.ANSWER_RUN WHERE patient_id=:v_patient_id ORDER BY created_at DESC LIMIT 50
);
ELSEIF (VIEW_NAME = 'packets') THEN
SELECT COALESCE(ARRAY_AGG(OBJECT_CONSTRUCT_KEEP_NULL(*)), ARRAY_CONSTRUCT()) INTO :v_rows FROM (
SELECT ep.packet_id, ep.evidence_ids,ep.gate_snapshot,ep.consent_id,
pr.name AS practitioner_name,ep.delivered_at::VARCHAR AS delivered_at
FROM SAARTHI.EVIDENCE.EVIDENCE_PACKET ep LEFT JOIN SAARTHI.GOVERNANCE.PRACTITIONER pr
ON pr.practitioner_id=ep.delivered_to_practitioner_id WHERE ep.patient_id=:v_patient_id LIMIT 50
);
ELSEIF (VIEW_NAME = 'document') THEN
SELECT COALESCE(ARRAY_AGG(OBJECT_CONSTRUCT_KEEP_NULL(*)), ARRAY_CONSTRUCT()) INTO :v_rows FROM (
SELECT d.doc_id,dp.page_index,dp.text,d.doc_type,d.scope,d.version,d.signed_at::VARCHAR AS source_recorded_at,
d.effective_at::VARCHAR AS event_time,d.ingested_at::VARCHAR AS ingested_at
FROM SAARTHI.DOCUMENTS.DOC_PAGE dp JOIN SAARTHI.DOCUMENTS.DOCUMENT d ON d.doc_id=dp.doc_id
WHERE d.doc_id=:ARGUMENT AND d.scope='patient' AND d.patient_id=:v_patient_id AND d.status='active'
AND d.ingested_at<=:v_known_as_of ORDER BY dp.page_index
);
ELSE RETURN OBJECT_CONSTRUCT('error','invalid_argument'); END IF;
RETURN OBJECT_CONSTRUCT('rows',v_rows,'known_as_of',v_known_as_of_s,'binding_id',v_binding_id);
END;
$$;
