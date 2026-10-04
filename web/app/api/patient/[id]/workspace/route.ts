import { procedureValue, withPatientSession } from "@/lib/snowflake";
import { apiError, apiErrorStatus, validateWorkspaceQuery } from "@/lib/api-contracts.mjs";
import { normalizeWorkspaceRows } from "@/lib/workspace-data.mjs";

export const dynamic = "force-dynamic";

type WorkspaceQuery = NonNullable<ReturnType<typeof validateWorkspaceQuery>>;
type Run = (sql: string, binds?: (string | number | null)[]) => Promise<Record<string, unknown>[]>;

export async function GET(
  request: Request,
  context: RouteContext<"/api/patient/[id]/workspace">,
): Promise<Response> {
  const query = validateWorkspaceQuery(new URL(request.url).searchParams);
  if (!query) return Response.json(apiError("invalid_argument"), { status: 400 });
  try {
    const { id } = await context.params;
    return Response.json(await withPatientSession(id, (run) => readView(run, query)));
  } catch (error) {
    const failure = apiError(error, "workspace_data_unavailable");
    // Missing financial consent withholds this read only; clinical access to the patient stands.
    if (failure.error === "consent_not_valid") failure.purge_patient_state = false;
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
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
