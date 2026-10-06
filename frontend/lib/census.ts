import { diagnosisLabel } from "./diagnosis.mjs";
import { query, procedureRows } from "./snowflake";
import { cachedRead, WORKSPACE_SCOPE } from "./read-cache";
import { formatClock, humanizeClocks } from "./display-format.mjs";
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
  DIAGNOSIS?: string | null;
  DIAGNOSIS_CODE?: string | null;
  CYCLE_NUMBER: number | null;
  SCHEDULED: string;
  GATE: string | null;
  RULE_ID: string | null;
  RULE_VERSION: number | null;
  OUTCOME: "pass" | "fail" | "not_evaluated" | "conflicting" | null;
  SEVERITY: "blocker" | "advisory" | null;
  REASON: string | null;
  /** R2: the clock the gate outcome was computed against (READINESS_STATE.known_as_of). */
  KNOWN_AS_OF?: string | null;
  COMPUTED_AT?: string | null;
}

// Census reads share the 2-minute workspace cache (read-cache.ts); any patient write and the
// census Refresh action clear it, so a clinician's explicit refresh always re-reads.
export async function fetchCensus(horizonDays = 7): Promise<ReadinessRow[]> {
  const sql = "CALL SAARTHI.OPERATIONAL.GET_WEB_WORKSPACE('census',?)";
  return cachedRead(WORKSPACE_SCOPE, `census:${horizonDays}`,
    async () => procedureRows<ReadinessRow>(await query(sql, [horizonDays])));
}

export interface BindablePatient {
  PATIENT_ID: string;
  NAME: string;
}

export async function fetchBindablePatients(): Promise<BindablePatient[]> {
  const sql = "CALL SAARTHI.OPERATIONAL.GET_WEB_WORKSPACE('patients',7)";
  return cachedRead(WORKSPACE_SCOPE, "patients", async () => procedureRows<BindablePatient>(await query(sql))
    .sort((a, b) => a.NAME.localeCompare(b.NAME) || a.PATIENT_ID.localeCompare(b.PATIENT_ID)));
}

export async function fetchPractitionerName(): Promise<string> {
  const sql = "CALL SAARTHI.OPERATIONAL.GET_WEB_WORKSPACE('practitioner',7)";
  return cachedRead(WORKSPACE_SCOPE, "practitioner", async () => {
    const rows = procedureRows<{ NAME: string; QUALIFICATION: string }>(await query(sql));
    return rows[0]?.NAME ?? "Practitioner";
  });
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
  diagnosis: string | null;
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
    diagnosis: diagnosisLabel(meta.DIAGNOSIS, meta.DIAGNOSIS_CODE),
    cycle: meta.CYCLE_NUMBER,
    scheduled: meta.SCHEDULED,
    status,
    headlineRule: head?.RULE_ID ?? null,
    headline: humanizeClocks(gates.length ? describeGates(gates, head) : describeGates([], undefined)),
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

/** Oldest gate clock across the census, so the page never claims to be fresher than its
 * stalest row. Null when no row carries one (nothing computed yet). Timestamps are ISO
 * strings in a fixed format, so lexical order is chronological. */
export function oldestKnownAsOf(rows: ReadinessRow[]): string | null {
  let oldest: string | null = null;
  for (const row of rows) {
    if (typeof row.KNOWN_AS_OF === "string" && row.KNOWN_AS_OF
      && (oldest === null || row.KNOWN_AS_OF < oldest)) oldest = row.KNOWN_AS_OF;
  }
  return oldest;
}

/** R2: show the data's own clock, never the page-load time as if it were the data's.
 * "Nothing computed" (no rows) is distinct from "rows exist but carry no clock" (older
 * procedure deployment): the second must not claim readiness is missing. */
export function censusClockLabel(error: string | null, asOf: string | null,
  loadedAt: string, rowCount: number): string {
  if (error) return `Last attempt ${loadedAt}`;
  if (asOf) return `Readiness as of ${formatClock(asOf)} · page loaded ${loadedAt}`;
  return rowCount > 0
    ? `Readiness clock not reported by the server (page loaded ${loadedAt})`
    : `No readiness computed yet (page loaded ${loadedAt})`;
}
