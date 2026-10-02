import Link from "next/link";
import type { ReactNode } from "react";
import { Page, WorkspaceBar, WorkspaceNav } from "@/components/sa";

export function RouteLoading({ patient = false }: { patient?: boolean }): ReactNode {
  return <Page>
    <WorkspaceNav current="census" patientsAvailable={false} />
    <WorkspaceBar section={patient ? "Patient record" : "Day care"} knownAsOf="Reading records" />
    <header className="sa-screen-header">
      <h1>{patient ? "Opening patient record" : "Day care"}</h1>
    </header>
    <p role="status" aria-live="polite" aria-busy="true" className="sa-meta">
      Loading records. Recovery options will appear if the record service cannot be reached.
    </p>
    <section className="sa-preview-entry" aria-label="Recorded design preview">
      <div><h2>Inspect the dashboard while records load</h2>
        <p>You can review a recorded synthetic patient without waiting for live records.</p></div>
      <Link href="/design-preview/PAT-DC-04" className="sa-quiet-button">
        Open recorded design preview
      </Link>
    </section>
  </Page>;
}
