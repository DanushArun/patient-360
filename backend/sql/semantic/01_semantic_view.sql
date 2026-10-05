-- =============================================================================
-- STEP 18 - Semantic view + 7 verified queries (SPEC.md s8)
-- =============================================================================
-- Round 6 (4 Oct 2026, unverified-needs-deploy): widened from PATIENT+ENCOUNTER to the record-state tables the
-- verified questions need - READINESS_STATE (gates), REVIEW_ISSUE, AUTHORIZATION, DT_SCHEME_ELIGIBILITY - all
-- inside SPEC s8's entity/metric list. DOCUMENTS and coverage limits are NOT modelled here. Every question
-- below is Class B (record and coverage state). Class A (clinical judgment) is out of scope for this view and is
-- refused upstream by classify_question; AI_QUESTION_CATEGORIZATION repeats that for Cortex Analyst.
-- The agent never receives a Cortex Analyst tool over patient data (AGENTS.md 3.5): CohortQuery is a procedure.
-- RAP on the base tables applies to the caller's session (AGENTS.md 3.1). The AI_VERIFIED_QUERIES / AI_QUESTION_CATEGORIZATION
-- clause syntax and the physical-table form of the VQR SQL have NOT been run on Snowflake; if CREATE rejects
-- them, move the 7 question/SQL pairs into the semantic YAML. backend/tests/test_semantic_verified_queries.py checks
-- offline that every column a verified query uses is defined in this view.
CREATE OR REPLACE SEMANTIC VIEW SAARTHI.OPERATIONAL.SAARTHI_SEMANTIC_VIEW
  TABLES (
    patient AS SAARTHI.CORE.PATIENT PRIMARY KEY (patient_id) WITH SYNONYMS ('patients') COMMENT = 'One row per patient',
    encounter AS SAARTHI.CORE.ENCOUNTER PRIMARY KEY (encounter_id) WITH SYNONYMS ('encounters', 'visits', 'cycles') COMMENT = 'Treatment cycles and visits',
    readiness AS SAARTHI.OPERATIONAL.READINESS_STATE PRIMARY KEY (patient_id, encounter_id, gate, rule_id) WITH SYNONYMS ('gates', 'readiness gates') COMMENT = 'Latest gate outcome per patient, encounter and rule. not_evaluated means evidence is missing, never a pass',
    review_issue AS SAARTHI.OPERATIONAL.REVIEW_ISSUE PRIMARY KEY (issue_id) WITH SYNONYMS ('blockers', 'review queue', 'issues') COMMENT = 'Coordinator review issues',
    authorization AS SAARTHI.CORE.AUTHORIZATION PRIMARY KEY (auth_id) WITH SYNONYMS ('authorisations', 'pre-authorisations') COMMENT = 'Scheme authorisations; letter_status is the value printed on the letter and may differ from status',
    scheme_eligibility AS SAARTHI.OPERATIONAL.DT_SCHEME_ELIGIBILITY PRIMARY KEY (patient_id, scheme_id) WITH SYNONYMS ('scheme eligibility') COMMENT = 'Patient by scheme eligibility status from versioned SQL'
  )
  RELATIONSHIPS (
    encounter (patient_id) REFERENCES patient,
    readiness (patient_id) REFERENCES patient,
    review_issue (patient_id) REFERENCES patient,
    authorization (patient_id) REFERENCES patient,
    scheme_eligibility (patient_id) REFERENCES patient
  )
  FACTS (
    encounter.is_complication AS IFF(encounter.gap_type = 'clinical_complication', 1, 0),
    readiness.is_not_evaluated AS IFF(readiness.outcome = 'not_evaluated', 1, 0),
    readiness.is_failed AS IFF(readiness.outcome = 'fail', 1, 0),
    review_issue.is_open_blocker AS IFF(review_issue.state='open'
        AND review_issue.severity='blocker',1,0),
    authorization.is_conflicting AS IFF(authorization.status='conflicting'
        OR (authorization.status IN ('pending','approved','denied','expired')
        AND authorization.letter_status IN ('pending','approved','denied','expired')
        AND authorization.status<>authorization.letter_status),1,0),
    authorization.is_curable_denial AS IFF(authorization.status = 'denied' AND authorization.denial_is_curable, 1, 0),
    scheme_eligibility.is_eligible AS IFF(scheme_eligibility.eligibility_status = 'eligible', 1, 0)
  )
  DIMENSIONS (
    patient.state AS patient.state WITH SYNONYMS ('region') COMMENT = 'Patient home state',
    encounter.gap_type AS encounter.gap_type COMMENT = 'Reason for delay, if any',
    encounter.cycle_number AS encounter.cycle_number,
    readiness.readiness_patient_id AS readiness.patient_id COMMENT = 'Patient the gate belongs to',
    authorization.authorization_patient_id AS authorization.patient_id,
    readiness.gate AS readiness.gate COMMENT = 'Readiness gate name',
    readiness.outcome AS readiness.outcome COMMENT = 'pass, fail, not_evaluated or conflicting',
    readiness.severity AS readiness.severity,
    review_issue.issue_gate AS review_issue.gate,
    review_issue.issue_state AS review_issue.state COMMENT = 'open, evidence_received, closed or escalated',
    review_issue.issue_severity AS review_issue.severity,
    authorization.auth_status AS authorization.status COMMENT = 'pending, approved, denied, partial, expired or conflicting',
    authorization.letter_status AS authorization.letter_status,
    authorization.scheme AS authorization.scheme,
    authorization.denial_is_curable AS authorization.denial_is_curable,
    scheme_eligibility.scheme_name AS scheme_eligibility.scheme_name,
    scheme_eligibility.eligibility_status AS scheme_eligibility.eligibility_status
  )
  METRICS (
    encounter.encounter_count AS COUNT(encounter.encounter_id) COMMENT = 'Total encounters',
    encounter.complication_count AS SUM(encounter.is_complication) COMMENT = 'Encounters with a clinical complication gap',
    readiness.not_evaluated_gate_count AS SUM(readiness.is_not_evaluated) COMMENT = 'Gates with evidence missing (not a pass)',
    readiness.failed_gate_count AS SUM(readiness.is_failed) COMMENT = 'Gates that failed',
    review_issue.open_blocker_count AS SUM(review_issue.is_open_blocker)
        COMMENT = 'Open review issues with blocker severity',
    authorization.conflicting_authorization_count AS SUM(authorization.is_conflicting) COMMENT = 'Authorisations where table and letter disagree',
    authorization.curable_denial_count AS SUM(authorization.is_curable_denial) COMMENT = 'Denied authorisations flagged procedurally curable',
    scheme_eligibility.eligible_scheme_count AS SUM(scheme_eligibility.is_eligible) COMMENT = 'Patient-scheme pairs with status eligible'
  )
  COMMENT = 'SAARTHI record-state questions (Class B only). Gates, review issues, authorisations, scheme eligibility, cohort encounters. Clinical judgment questions are refused upstream.'
  AI_QUESTION_CATEGORIZATION 'Answer only record and coverage state questions (what is documented, missing, conflicting, authorised, counted). Reject any question asking for clinical judgment, prognosis, dosing, safety or a recommendation, and say it needs the treating practitioner.'
  AI_VERIFIED_QUERIES (
    vq_patients_missing_evidence AS (
      QUESTION 'Which patients have gates with evidence not yet received?'
      SQL 'SELECT patient_id, COUNT(*) AS not_evaluated_gates FROM SAARTHI.OPERATIONAL.READINESS_STATE WHERE outcome = ''not_evaluated'' GROUP BY patient_id ORDER BY not_evaluated_gates DESC'
    ),
    vq_open_blockers_per_gate AS (
      QUESTION 'How many open blockers per gate?'
      SQL 'SELECT gate, COUNT(*) AS open_blockers FROM SAARTHI.OPERATIONAL.REVIEW_ISSUE
        WHERE state = ''open'' AND severity = ''blocker''
        GROUP BY gate ORDER BY open_blockers DESC'
    ),
    vq_conflicting_authorisation AS (
      QUESTION 'Which patients have conflicting authorisation status?'
      SQL 'SELECT patient_id, scheme, status, letter_status FROM SAARTHI.CORE.AUTHORIZATION
        WHERE status = ''conflicting'' OR (status IN (''pending'',''approved'',''denied'',''expired'')
          AND letter_status IN (''pending'',''approved'',''denied'',''expired'')
          AND status <> letter_status)
        ORDER BY patient_id'
    ),
    vq_failed_gates_per_gate AS (
      QUESTION 'How many gates failed, by gate?'
      SQL 'SELECT gate, COUNT(*) AS failed_gates FROM SAARTHI.OPERATIONAL.READINESS_STATE WHERE outcome = ''fail'' GROUP BY gate ORDER BY failed_gates DESC'
    ),
    vq_eligible_schemes AS (
      QUESTION 'How many patients are eligible for each scheme?'
      SQL 'SELECT scheme_name, COUNT(*) AS eligible_patients FROM SAARTHI.OPERATIONAL.DT_SCHEME_ELIGIBILITY WHERE eligibility_status = ''eligible'' GROUP BY scheme_name ORDER BY eligible_patients DESC'
    ),
    vq_curable_denials AS (
      QUESTION 'How many denied authorisations are flagged curable?'
      SQL 'SELECT COUNT(*) AS curable_denials FROM SAARTHI.CORE.AUTHORIZATION WHERE status = ''denied'' AND denial_is_curable = TRUE'
    ),
    vq_review_issues_by_state AS (
      QUESTION 'How many review issues are there in each state?'
      SQL 'SELECT state, COUNT(*) AS issues FROM SAARTHI.OPERATIONAL.REVIEW_ISSUE GROUP BY state ORDER BY issues DESC'
    )
  );
