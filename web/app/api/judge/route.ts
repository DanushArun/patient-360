import { query } from "@/lib/snowflake";
import { evaluateProbe } from "@/lib/judge-probes.mjs";

const PROBES: Record<number, { title: string; description: string; sql: string; expect: string }> = {
  1: {
    title: "Rule catalog completeness",
    description: "All 16 readiness rules exist in RULE_CATALOG with thresholds, guideline references, and severity.",
    sql: `SELECT rule_id, rule_version, gate, display_name, severity, guideline_ref
            FROM SAARTHI.OPERATIONAL.RULE_CATALOG
           WHERE effective_to IS NULL ORDER BY gate, rule_id`,
    expect: "16 active rules",
  },
  2: {
    title: "RAP scopes READINESS_STATE",
    description: "READINESS_STATE only returns patients where CURRENT_USER() has care-team membership. No leaked rows.",
    sql: `SELECT DISTINCT rs.patient_id, p.name
            FROM SAARTHI.OPERATIONAL.READINESS_STATE rs
            JOIN SAARTHI.CORE.PATIENT p ON p.patient_id = rs.patient_id
           WHERE NOT EXISTS (
             SELECT 1 FROM SAARTHI.GOVERNANCE.CARE_TEAM ct
               JOIN SAARTHI.GOVERNANCE.PRACTITIONER pr ON pr.practitioner_id = ct.practitioner_id
              WHERE ct.patient_id = rs.patient_id
                AND UPPER(pr.snowflake_user) = UPPER(CURRENT_USER())
                AND (ct.active_to IS NULL OR ct.active_to >= CURRENT_DATE()))`,
    expect: "0 rows — no leaked patients",
  },
  3: {
    title: "Binding lifecycle integrity",
    description: "Every completed patient binding has a release timestamp. No dangling sessions.",
    sql: `SELECT COUNT(*) AS dangling_bindings
            FROM SAARTHI.GOVERNANCE.PATIENT_BINDING
           WHERE released_at IS NULL
             AND bound_at < DATEADD(hour, -1, CURRENT_TIMESTAMP())`,
    expect: "0 dangling bindings older than 1 hour",
  },
  4: {
    title: "Three-clock coverage (R2)",
    description: "Every clinical event carries event_time, source_recorded_at, and ingested_at. No missing clocks.",
    sql: `SELECT COUNT(*) AS missing_clocks
            FROM SAARTHI.CORE.CLINICAL_EVENT
           WHERE event_time IS NULL OR source_recorded_at IS NULL OR ingested_at IS NULL`,
    expect: "0 events with missing clocks",
  },
  5: {
    title: "Review task idempotency",
    description: "No duplicate tasks exist for the same idempotency key. The system prevents double-filing.",
    sql: `SELECT idempotency_key, COUNT(*) AS cnt
            FROM SAARTHI.OPERATIONAL.REVIEW_TASK
           GROUP BY idempotency_key HAVING COUNT(*) > 1`,
    expect: "0 rows — no duplicate idempotency keys",
  },
  6: {
    title: "Consent-gated access",
    description: "Patients without active consent cannot be bound. The binding procedure rejects them.",
    sql: `SELECT p.patient_id, p.name,
                  CASE WHEN EXISTS (
                    SELECT 1 FROM SAARTHI.GOVERNANCE.CONSENT c
                     WHERE c.patient_id = p.patient_id AND c.status = 'active'
                       AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP())
                  ) THEN 'has_consent' ELSE 'no_consent' END AS consent_status
             FROM SAARTHI.CORE.PATIENT p
            WHERE NOT EXISTS (
              SELECT 1 FROM SAARTHI.GOVERNANCE.CONSENT c
               WHERE c.patient_id = p.patient_id AND c.status = 'active'
                 AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP()))`,
    expect: "Any patients listed here are unbindable — correct behavior",
  },
  7: {
    title: "Gate outcome distribution",
    description: "Readiness outcomes across all patients. Shows the system evaluates all four states, not just pass/fail.",
    sql: `SELECT outcome, COUNT(*) AS cnt,
                  COUNT(DISTINCT patient_id) AS patients
             FROM SAARTHI.OPERATIONAL.READINESS_STATE
            GROUP BY outcome ORDER BY outcome`,
    expect: "All 4 outcomes present: pass, fail, not_evaluated, conflicting",
  },
  8: {
    title: "Scheme eligibility coverage",
    description: "Government scheme eligibility computed for patients. PM-JAY, TN-CMHIS, MH-MJPJAY with annual limits.",
    sql: `SELECT scheme_name, scheme_type, annual_limit, COUNT(*) AS eligible_patients
             FROM SAARTHI.OPERATIONAL.DT_SCHEME_ELIGIBILITY
            WHERE eligibility_status = 'eligible'
            GROUP BY scheme_name, scheme_type, annual_limit
            ORDER BY scheme_name`,
    expect: "3 schemes with eligible patient counts",
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as { probe?: number };
    const probeId = body.probe;
    if (typeof probeId !== "number" || !PROBES[probeId]) {
      return Response.json({ error: "invalid_probe", valid: Object.keys(PROBES).map(Number) }, { status: 400 });
    }
    const probe = PROBES[probeId];
    const rows = await query(probe.sql);
    const rowCount = rows.length;
    const passed = evaluateProbe(probeId, rows);
    return Response.json({
      probe: probeId,
      title: probe.title,
      description: probe.description,
      sql: probe.sql.trim(),
      expect: probe.expect,
      passed,
      rowCount,
      rows: rows.slice(0, 50),
      query_id: (rows as typeof rows & { query_id?: string }).query_id ?? null,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "probe_failed" }, { status: 502 });
  }
}
