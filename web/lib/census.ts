import { query, procedureRows } from "./snowflake";
import { classifyGates, describeGates, orderIssues, type ChairStatus } from "./census-display.mjs";

// Scope is rechecked by the owner procedure on every request.
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
  const sql = "CALL SAARTHI.OPERATIONAL.GET_WEB_WORKSPACE('census',?)";
  return procedureRows<ReadinessRow>(await query(sql, [horizonDays]));
}

export interface BindablePatient {
  PATIENT_ID: string;
  NAME: string;
}

export async function fetchBindablePatients(): Promise<BindablePatient[]> {
  const sql = "CALL SAARTHI.OPERATIONAL.GET_WEB_WORKSPACE('patients',7)";
  return procedureRows<BindablePatient>(await query(sql))
    .sort((a, b) => a.NAME.localeCompare(b.NAME) || a.PATIENT_ID.localeCompare(b.PATIENT_ID));
}

export async function fetchPractitionerName(): Promise<string> {
  const sql = "CALL SAARTHI.OPERATIONAL.GET_WEB_WORKSPACE('practitioner',7)";
  const rows = procedureRows<{ NAME: string; QUALIFICATION: string }>(await query(sql));
  return rows[0]?.NAME ?? "Practitioner";
}

// --- Triage, ported from frontend/core/census.py::classify() ---------------
// Same 5 states, same precedence, so the two frontends can never disagree.

export type { ChairStatus } from "./census-display.mjs";

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

function projectChair(encounterId: string, group: ReadinessRow[]): Chair {
  const meta = group[0];
  const gates = group.filter((gate) => gate.RULE_ID);
  const status: ChairStatus = gates.length ? classifyGates(gates) : "waiting";
  const issues = orderIssues(gates);
  const head = issues[0];
  return {
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
    headline: gates.length ? describeGates(gates, head) : describeGates([], undefined),
    otherIssues: Math.max(issues.length - 1, 0),
  };
}

export function buildCensus(rows: ReadinessRow[]): Chair[] {
  const byEncounter = new Map<string, ReadinessRow[]>();
  for (const row of rows) {
    const group = byEncounter.get(row.ENCOUNTER_ID) ?? [];
    group.push(row);
    byEncounter.set(row.ENCOUNTER_ID, group);
  }
  const chairs = [...byEncounter].map(([id, group]) => projectChair(id, group));
  const order: ChairStatus[] = ["blocked", "conflict", "waiting", "advisory", "ready"];
  chairs.sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status) ||
      a.scheduled.localeCompare(b.scheduled)
  );
  return chairs;
}
