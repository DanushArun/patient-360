import { procedureRows, procedureValue, withPatientSession } from "./snowflake";
import { cachedRead, WORKSPACE_SCOPE } from "./read-cache";
import { withReadSession } from "./snowflake";
import { readLiveReviewQueue } from "./review-queue.mjs";
import { normalizeWorkspaceRows } from "./workspace-data.mjs";
import type { validateWorkspaceQuery } from "./api-contracts.mjs";
import { workspaceCacheKey } from "./warm-plan.mjs";

// Workspace views and schemes, shared by the API routes and background read-ahead (warm.ts)
// so both use the same cache entries. Every miss is a full governed patient session.

export type WorkspaceQuery = NonNullable<ReturnType<typeof validateWorkspaceQuery>>;
type Run = (sql: string, binds?: (string | number | null)[]) => Promise<Record<string, unknown>[]>;

export function loadWorkspaceView(patientId: string, query: WorkspaceQuery) {
  return cachedRead(patientId, workspaceCacheKey(query),
    () => withPatientSession(patientId, (run) => readView(run, query)));
}

export function loadSchemes(patientId: string) {
  return cachedRead(patientId, "schemes", () => withPatientSession(patientId, async (run) => {
    const rows = procedureRows(await run("CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA('schemes',NULL)"));
    return rows.map((r) => ({
      schemeId: r.SCHEME_ID,
      schemeName: r.SCHEME_NAME,
      schemeType: r.SCHEME_TYPE,
      annualLimit: r.ANNUAL_LIMIT,
      status: r.ELIGIBILITY_STATUS,
      packages: r.COVERED_PACKAGES,
    }));
  }));
}

async function readView(run: Run, query: WorkspaceQuery): Promise<Record<string, unknown>> {
  if (query.view === "facts") {
    // Facts need a domain and a cutoff; the procedure's single ARGUMENT carries both.
    const body = await call(run, "facts",
      JSON.stringify({ domain: query.domain, known_as_of: query.knownAsOf }));
    return { domain: body.domain, facts: body.facts, known_as_of: body.known_as_of,
      requested_known_as_of: body.requested_known_as_of ?? null,
      as_of_semantics: body.as_of_semantics };
  }
  const body = await call(run, query.view, query.knownAsOf);
  if (!Array.isArray(body.rows)) throw new Error("procedure_rows_unavailable");
  if (query.view === "coverage_comparison") {
    return { rows: body.rows, known_as_of: body.known_as_of };
  }
  if (!Array.isArray(body.expected_documents)) throw new Error("procedure_rows_unavailable");
  return {
    rows: normalizeWorkspaceRows(body.rows),
    expected_documents: normalizeWorkspaceRows(body.expected_documents),
    known_as_of: body.known_as_of,
  };
}

async function call(run: Run, view: string, argument: string | null) {
  return procedureValue(await run(
    "CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA(?, ?)", [view, argument]));
}

/** Review queue, cached with the time it was actually read, so "Queue loaded" stays truthful. */
export function loadReviewQueue() {
  return cachedRead(WORKSPACE_SCOPE, "review-queue", async () => ({
    queue: await withReadSession(readLiveReviewQueue),
    loadedAt: new Date().toISOString(),
  }));
}
