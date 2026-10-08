-- Forward day-care schedule: every cohort patient's later cycles, through 7 Dec 2026.
--
-- Why: the curated queue (load_daycare_cohort.sql) is one day ("tomorrow" at load time). Judges
-- review the live system across several weeks, so a single day goes stale. This adds each
-- patient's next cycles at the cadence their regimen states, capped at the plan's planned_cycles,
-- so any visit-date window from now to 30 Nov has visits in it.
--
-- Dates are offsets from the patient's anchor visit (ENC-DC-xx), so this re-anchors whenever the
-- cohort does; run it after load_daycare_cohort.sql and load_demo_hero.sql. First follow-ups are
-- staggered 0-5 days (a chair-availability reschedule) so the unit has visits on every weekday;
-- Sundays move to Monday. Encounter ids are deterministic (ENC-DC-xx-Cnn): reruns MERGE in place.
--
-- No evidence is invented for these visits. READINESS_STATE for them is computed by the same
-- evaluate_gates rules against the same records, so a pre-cycle CBC not yet received for a visit
-- three weeks out shows as exactly that (R1, R3).

SET fwd_until = '2026-12-07'::DATE;

MERGE INTO SAARTHI.CORE.ENCOUNTER t
USING (
  WITH anchor AS (
    SELECT e.patient_id, e.facility_id, e.department_id, e.scheduled_time AS at, e.cycle_number AS cycle,
           SUBSTR(e.encounter_id, 8, 2) AS k,
           (TO_NUMBER(SUBSTR(e.encounter_id, 8, 2)) * 5) % 6 AS shift_days,
           CASE WHEN p.regimen_display ILIKE '%3-weekly%' THEN 21
                WHEN p.regimen_display ILIKE '%2-weekly%' THEN 14
                WHEN p.regimen_display ILIKE '%weekly%'   THEN 7 END AS cadence,
           p.planned_cycles
      FROM SAARTHI.CORE.ENCOUNTER e
      JOIN SAARTHI.CORE.TREATMENT_PLAN p ON p.patient_id = e.patient_id
     WHERE e.encounter_id RLIKE 'ENC-DC-[0-9]{2}'
     QUALIFY ROW_NUMBER() OVER (PARTITION BY e.patient_id ORDER BY p.version DESC, p.decided_at DESC NULLS LAST) = 1
  ), n AS (SELECT SEQ4() + 1 AS i FROM TABLE(GENERATOR(ROWCOUNT => 20))),
  planned AS (
    SELECT a.*, n.i, DATEADD(day, a.cadence * n.i + a.shift_days, a.at) AS raw_at
      FROM anchor a JOIN n ON a.cycle + n.i <= a.planned_cycles
     WHERE a.cadence IS NOT NULL
  )
  SELECT 'ENC-DC-' || k || '-C' || LPAD(cycle + i, 2, '0') AS encounter_id, patient_id, facility_id,
         department_id, cycle + i AS cycle_number,
         IFF(DAYOFWEEKISO(raw_at) = 7, DATEADD(day, 1, raw_at), raw_at) AS scheduled_time
    FROM planned
   WHERE raw_at < $fwd_until
) s ON t.encounter_id = s.encounter_id
WHEN MATCHED THEN UPDATE SET t.scheduled_time = s.scheduled_time, t.cycle_number = s.cycle_number,
  t.status = 'scheduled'
WHEN NOT MATCHED THEN INSERT (encounter_id, patient_id, facility_id, department_id, encounter_type,
  scheduled_time, event_time, cycle_number, status, gap_type)
VALUES (s.encounter_id, s.patient_id, s.facility_id, s.department_id, 'daycare',
  s.scheduled_time, NULL, s.cycle_number, 'scheduled', 'none');

-- A re-anchor can push a previously generated cycle past the horizon; drop it and its snapshot.
DELETE FROM SAARTHI.OPERATIONAL.READINESS_STATE
 WHERE encounter_id IN (SELECT encounter_id FROM SAARTHI.CORE.ENCOUNTER
                         WHERE encounter_id RLIKE 'ENC-DC-[0-9]{2}-C[0-9]{2}' AND scheduled_time >= $fwd_until);
DELETE FROM SAARTHI.CORE.ENCOUNTER
 WHERE encounter_id RLIKE 'ENC-DC-[0-9]{2}-C[0-9]{2}' AND scheduled_time >= $fwd_until;
