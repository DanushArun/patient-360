import Link from "next/link";
import type { ReactNode } from "react";
import { withUiReadDeadline } from "@/lib/ui-read-deadline.mjs";
import { loadPatientSnapshot } from "@/lib/patient";
import { Page, WorkspaceNav } from "@/components/sa";
import HistoryClient from "./history-client";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> })
  : Promise<ReactNode> {
  const { id } = await params;
  try {
    return <HistoryClient patient={await withUiReadDeadline(loadPatientSnapshot(id))} />;
  } catch {
    return <Page><WorkspaceNav current="history" />
      <header className="sa-screen-header"><h1>Review history unavailable</h1></header>
      <p className="sa-limitation">The record service or access check is unavailable.</p>
      <Link href="/" className="sa-inline-link">Return to day-care list</Link>
    </Page>;
  }
}
