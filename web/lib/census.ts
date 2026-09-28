import { query } from "./snowflake";

// Same query as frontend/core/live.py Session.daycare_census() - ported, not
// reinvented. Scope is server-side: an active CARE_TEAM row + valid CONSENT.
const CENSUS_SQL = `
  WITH plan AS (
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
     AND e.scheduled_time <  DATEADD(day, ?, CURRENT_DATE())
     AND EXISTS (
         SELECT 1 FROM SAARTHI.GOVERNANCE.CARE_TEAM ct
           JOIN SAARTHI.GOVERNANCE.PRACTITIONER pr ON pr.practitioner_id = ct.practitioner_id
          WHERE ct.patient_id = e.patient_id
            AND UPPER(pr.snowflake_user) = UPPER(CURRENT_USER())
            AND (ct.active_to IS NULL OR ct.active_to >= CURRENT_DATE()))
     AND EXISTS (
         SELECT 1 FROM SAARTHI.GOVERNANCE.CONSENT c
          WHERE c.patient_id = e.patient_id AND c.status = 'active'
            AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP()))
   ORDER BY e.scheduled_time, p.name
`;

export interface ReadinessRow {
  ENCOUNTER_ID: string;
  PATIENT_ID: string;
  NAME: string;
  DISTRICT: string | null;
  STATE: string | null;
  PRIMARY_LANGUAGE: string | null;
  REGIMEN_DISPLAY: string | null;
  CYCLE_NUMBER: number | null;
  SCHEDULED: string;
  GATE: string | null;
  RULE_ID: string | null;
  RULE_VERSION: number | null;
  OUTCOME: "pass" | "fail" | "not_evaluated" | "conflicting" | null;
  SEVERITY: "blocker" | "advisory" | null;
  REASON: string | null;
}

export async function fetchCensus(horizonDays = 7): Promise<ReadinessRow[]> {
  return query<ReadinessRow>(CENSUS_SQL, [horizonDays]);
}

const BINDABLE_SQL = `
  SELECT DISTINCT p.patient_id, p.name
    FROM SAARTHI.CORE.PATIENT p
   WHERE EXISTS (
       SELECT 1 FROM SAARTHI.GOVERNANCE.CARE_TEAM ct
         JOIN SAARTHI.GOVERNANCE.PRACTITIONER pr ON pr.practitioner_id = ct.practitioner_id
        WHERE ct.patient_id = p.patient_id
          AND UPPER(pr.snowflake_user) = UPPER(CURRENT_USER())
          AND (ct.active_to IS NULL OR ct.active_to >= CURRENT_DATE()))
     AND EXISTS (
       SELECT 1 FROM SAARTHI.GOVERNANCE.CONSENT c
        WHERE c.patient_id = p.patient_id AND c.status = 'active'
          AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP()))
   ORDER BY p.name
`;

export interface BindablePatient {
  PATIENT_ID: string;
  NAME: string;
}

export async function fetchBindablePatients(): Promise<BindablePatient[]> {
  return query<BindablePatient>(BINDABLE_SQL);
}

const PRACTITIONER_SQL = `
  SELECT name, qualification
    FROM SAARTHI.GOVERNANCE.PRACTITIONER
   WHERE UPPER(snowflake_user) = UPPER(CURRENT_USER()) AND active = TRUE
   LIMIT 1
`;

export async function fetchPractitionerName(): Promise<string> {
  const rows = await query<{ NAME: string; QUALIFICATION: string }>(PRACTITIONER_SQL);
  return rows[0]?.NAME ?? "Practitioner";
}

// --- Triage, ported from frontend/core/census.py::classify() ---------------
// Same 5 states, same precedence, so the two frontends can never disagree.

export type ChairStatus = "blocked" | "conflict" | "waiting" | "advisory" | "ready";

export interface Chair {
  encounterId: string;
  patientId: string;
  name: string;
  place: string;
  language: string | null;
  regimen: string | null;
  cycle: number | null;
  scheduled: string;
  status: ChairStatus;
  headlineRule: string | null;
  headline: string | null;
  otherIssues: number;
}

const ISSUE_RANK: Record<string, number> = {
  "fail:blocker": 0,
  "conflicting:blocker": 1,
  "conflicting:advisory": 1,
  "not_evaluated:blocker": 2,
  "fail:advisory": 3,
};

function classify(gates: ReadinessRow[]): ChairStatus {
  const has = (outcome: string, severity?: string) =>
    gates.some((g) => g.OUTCOME === outcome && (!severity || g.SEVERITY === severity));
  if (has("fail", "blocker")) return "blocked";
  if (has("conflicting")) return "conflict";
  if (has("not_evaluated", "blocker")) return "waiting";
  if (has("fail", "advisory")) return "advisory";
  return "ready";
}

export function buildCensus(rows: ReadinessRow[]): Chair[] {
  const byEncounter = new Map<string, ReadinessRow[]>();
  for (const r of rows) {
    if (!byEncounter.has(r.ENCOUNTER_ID)) byEncounter.set(r.ENCOUNTER_ID, []);
    byEncounter.get(r.ENCOUNTER_ID)!.push(r);
  }

  const chairs: Chair[] = [];
  for (const [encounterId, group] of byEncounter) {
    const meta = group[0];
    const gates = group.filter((g) => g.RULE_ID);
    const status = gates.length ? classify(gates) : "waiting";

    const issues = gates
      .filter((g) => ISSUE_RANK[`${g.OUTCOME}:${g.SEVERITY}`] !== undefined)
      .sort(
        (a, b) =>
          ISSUE_RANK[`${a.OUTCOME}:${a.SEVERITY}`] - ISSUE_RANK[`${b.OUTCOME}:${b.SEVERITY}`] ||
          (a.RULE_ID ?? "").localeCompare(b.RULE_ID ?? "")
      );
    const head = issues[0];

    chairs.push({
      encounterId,
      patientId: meta.PATIENT_ID,
      name: meta.NAME,
      place: [meta.DISTRICT, meta.STATE].filter(Boolean).join(", "),
      language: meta.PRIMARY_LANGUAGE,
      regimen: meta.REGIMEN_DISPLAY,
      cycle: meta.CYCLE_NUMBER,
      scheduled: meta.SCHEDULED,
      status,
      headlineRule: head?.RULE_ID ?? null,
      headline: head?.REASON ?? (gates.length ? "Every applicable rule passes." : null),
      otherIssues: Math.max(issues.length - 1, 0),
    });
  }

  const order: ChairStatus[] = ["blocked", "conflict", "waiting", "advisory", "ready"];
  chairs.sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.scheduled.localeCompare(b.scheduled)
  );
  return chairs;
}
