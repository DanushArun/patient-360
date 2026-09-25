import { query } from "./snowflake";
import type { ProfessionalLogin } from "./session-security";

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

export async function fetchCensus(horizonDays: number, login: ProfessionalLogin): Promise<ReadinessRow[]> {
  return query<ReadinessRow>(
    "CALL SAARTHI.OPERATIONAL.GET_WEB_CENSUS(?)", [horizonDays], login,
  );
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
