import Link from "next/link";
import { loadPatientSnapshot } from "@/lib/patient";
import { Page, Rule, WorkspaceNav } from "@/components/sa";
import HistoryClient from "./history-client";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return <HistoryClient patient={await loadPatientSnapshot(id)} />;
  } catch {
    return <Page><WorkspaceNav current="history" /><div className="sa-screen-header"><div><p className="sa-eyebrow">Coordinator workspace</p><h1>Review history unavailable</h1></div></div><Rule />
      <div className="sa-limitation">This patient record could not be opened. Confirm active care-team access and valid consent.</div>
      <Link href="/" className="sa-inline-link">Return to day-care list</Link></Page>;
  }
}
