import { withPatientSession } from "@/lib/snowflake";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const schemes = await withPatientSession(id, async (run) => {
      const rows = await run(
        `SELECT scheme_id, scheme_name, scheme_type, annual_limit, eligibility_status, covered_packages
           FROM SAARTHI.OPERATIONAL.DT_SCHEME_ELIGIBILITY
          WHERE patient_id = (
            SELECT patient_id FROM SAARTHI.GOVERNANCE.PATIENT_BINDING
             WHERE session_id = CURRENT_SESSION() AND released_at IS NULL
             LIMIT 1)`
      );
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
