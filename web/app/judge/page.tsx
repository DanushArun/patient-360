import { Page, Rule } from "@/components/sa";
import Link from "next/link";
import JudgeClient from "./judge-client";

export const dynamic = "force-dynamic";

export default function JudgePage() {
  return <Page>
    <div className="sa-masthead" style={{ borderBottom: "none", marginBottom: 4 }}>
      <div className="sa-masthead-patient">SAARTHI · Judge Console</div>
      <Link href="/" style={{ fontSize: 15, color: "#4A5157" }}>← Census</Link>
    </div>
    <div className="sa-meta" style={{ marginBottom: 16 }}>
      Live security and correctness probes. Each button runs a SQL query against the production database and shows the result.
      Query IDs are reproducible from Snowflake QUERY_HISTORY.
    </div>
    <Rule />
    <JudgeClient />
  </Page>;
}
