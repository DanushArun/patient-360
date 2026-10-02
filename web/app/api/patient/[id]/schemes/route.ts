import { withPatientSession, procedureRows } from "@/lib/snowflake";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("access") || msg.includes("bind failed")) return Response.json({ error: msg }, { status: 403 });
    return Response.json({ error: "schemes_unavailable" }, { status: 502 });
  }
}
