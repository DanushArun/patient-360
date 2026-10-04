import { withPatientSession, procedureRows } from "@/lib/snowflake";
import { apiError, apiErrorStatus } from "@/lib/api-contracts.mjs";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const schemes = await withPatientSession(id, async (run) => {
      const rows = procedureRows(await run("CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA('schemes',NULL)"));
      return rows.map((r) => ({
        schemeId: r.SCHEME_ID,
        schemeName: r.SCHEME_NAME,
        schemeType: r.SCHEME_TYPE,
        annualLimit: r.ANNUAL_LIMIT,
        status: r.ELIGIBILITY_STATUS,
        packages: r.COVERED_PACKAGES,
      }));
    });
    return Response.json(schemes);
  } catch (error) {
    // Fixed code set only: driver and procedure text never reaches the client.
    const failure = apiError(error, "schemes_unavailable");
    return Response.json(failure, { status: apiErrorStatus(failure.error) });
  }
}
