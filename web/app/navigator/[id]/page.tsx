import Link from "next/link";
import type { ReactNode } from "react";
import { withUiReadDeadline } from "@/lib/ui-read-deadline.mjs";
import { loadPatientSnapshot } from "@/lib/patient";
import { Page, Rule } from "@/components/sa";
import NavigatorClient from "./navigator-client";

export const dynamic = "force-dynamic";

export default async function NavigatorPage({ params }: { params: Promise<{ id: string }> })
  : Promise<ReactNode> {
  const { id } = await params;
  try {
    const patient = await withUiReadDeadline(loadPatientSnapshot(id));
    return <NavigatorClient key={id} patient={patient} />;
  } catch {
    return <Page>
      <div className="sa-masthead" style={{ borderBottom: "none", marginBottom: 4 }}>
        <div className="sa-masthead-patient">SAARTHI · Navigator</div>
      </div>
      <Rule />
      <div className="sa-limitation">This patient record could not be opened.
        The record service or access check is unavailable.</div>
      <Link href="/" className="sa-btn" style={{ marginTop: 16 }}>Return to day-care list</Link>
    </Page>;
  }
}
