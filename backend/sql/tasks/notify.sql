-- =============================================================================
-- STEP 16f - TASK notify
-- =============================================================================
-- SPEC.md §14 diagram: fires when a blocker gate fails and the patient's next
-- scheduled encounter is within 3 days. Creates a REVIEW_TASK for the treating
-- practitioner AND a NOTIFICATION row (channel = 'email' as placeholder until
-- an actual NOTIFICATION_INTEGRATION lands in STEP 21).
--
-- Idempotency: REVIEW_TASK.idempotency_key = MD5(patient_id || rule_id || days_bucket)
-- so a single failing gate produces one REVIEW_TASK per day, not one per task run.

CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.notify_proc()
  RETURNS VARIANT
  LANGUAGE SQL
  COMMENT = 'Task body for notify. Emits REVIEW_TASK + NOTIFICATION for imminent blocker fails.'
  EXECUTE AS OWNER
AS
$$
DECLARE
    v_review_tasks_created INTEGER DEFAULT 0;
    v_notifications_created INTEGER DEFAULT 0;
BEGIN
    MERGE INTO SAARTHI.OPERATIONAL.REVIEW_TASK t
    USING (
        SELECT
            UUID_STRING() AS task_id,
            rs.patient_id || ':' || rs.rule_id AS issue_id,
            ct.practitioner_id AS owner_practitioner_id,
            'open' AS state,
            MD5(rs.patient_id || rs.rule_id || TO_VARCHAR(CURRENT_DATE())) AS idempotency_key,
            'notify_task: ' || rs.rule_id || ' ' || rs.outcome || ' (' || rs.reason || ')' AS reason
          FROM SAARTHI.OPERATIONAL.READINESS_STATE rs
          JOIN SAARTHI.CORE.ENCOUNTER e ON e.encounter_id = rs.encounter_id
          JOIN SAARTHI.GOVERNANCE.CARE_TEAM ct
            ON ct.patient_id = rs.patient_id
           AND ct.role_type = 'treating'
           AND (ct.active_to IS NULL OR ct.active_to > CURRENT_TIMESTAMP())
         WHERE rs.outcome = 'fail'
           AND rs.severity = 'blocker'
           AND e.scheduled_time BETWEEN CURRENT_TIMESTAMP() AND DATEADD(day, 3, CURRENT_TIMESTAMP())
    ) s
    ON t.idempotency_key = s.idempotency_key
    WHEN NOT MATCHED THEN INSERT (task_id, issue_id, owner_practitioner_id, state, idempotency_key, reason, created_at)
    VALUES (s.task_id, s.issue_id, s.owner_practitioner_id, s.state, s.idempotency_key, s.reason, CURRENT_TIMESTAMP());

    v_review_tasks_created := SQLROWCOUNT;

    -- One NOTIFICATION per new REVIEW_TASK. Placeholder recipient/channel until
    -- STEP 21 notification integration lands.
    MERGE INTO SAARTHI.OPERATIONAL.NOTIFICATION t
    USING (
        SELECT UUID_STRING() AS notification_id, rt.issue_id, 'email' AS channel,
               'coordinator@saarthi.local' AS recipient, 1 AS escalation_level
          FROM SAARTHI.OPERATIONAL.REVIEW_TASK rt
         WHERE rt.state = 'open'
           AND NOT EXISTS (SELECT 1 FROM SAARTHI.OPERATIONAL.NOTIFICATION n WHERE n.issue_id = rt.issue_id)
    ) s
    ON t.notification_id = s.notification_id
    WHEN NOT MATCHED THEN INSERT (notification_id, issue_id, channel, recipient, sent_at, escalation_level)
    VALUES (s.notification_id, s.issue_id, s.channel, s.recipient, CURRENT_TIMESTAMP(), s.escalation_level);

    v_notifications_created := SQLROWCOUNT;

    RETURN OBJECT_CONSTRUCT(
        'review_tasks_created', v_review_tasks_created,
        'notifications_created', v_notifications_created,
        'notified_at', TO_VARCHAR(CURRENT_TIMESTAMP(), 'YYYY-MM-DD"T"HH24:MI:SS')
    );
END;
$$;

CREATE OR REPLACE TASK SAARTHI.OPERATIONAL.TASK_NOTIFY
  WAREHOUSE = SAARTHI_AI_WH
  AFTER SAARTHI.OPERATIONAL.TASK_REFRESH_READINESS
AS
  CALL SAARTHI.OPERATIONAL.notify_proc();
