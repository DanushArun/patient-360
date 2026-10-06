import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidPatientId } from "@/lib/api-contracts.mjs";
import type { ReactNode } from "react";
import { withUiReadDeadline } from "@/lib/ui-read-deadline.mjs";
import { loadPatientSnapshot } from "@/lib/patient";
import { after } from "next/server";
import { keepWarm, warmPatientViews } from "@/lib/warm";
import { Page, Rule } from "@/components/sa";
import PatientClient from "./patient-client";
import { fetchBindablePatients } from "@/lib/census";

export const dynamic = "force-dynamic";

export default async function PatientPage({ params }: PageProps<"/patient/[id]">)
  : Promise<ReactNode> {
  const { id } = await params;
  if (!isValidPatientId(id)) notFound();
  try {
    // Both reads start together: the roster no longer waits ~9 s behind the snapshot.
    const roster = withUiReadDeadline(fetchBindablePatients())
      .then((rows) => rows.map((row) => ({ id: row.PATIENT_ID, name: row.NAME })))
      .catch(() => null);
    const patient = await withUiReadDeadline(loadPatientSnapshot(id));
    const patients = await roster ?? [{ id: patient.patientId, name: patient.patientName }];
    // Read every tab ahead of the click, after this response is sent.
    after(() => { warmPatientViews(patient); keepWarm(patients.map((entry) => entry.id)); });
    return <PatientClient key={id} patient={patient} patients={patients} />;
  } catch {
    return <Page>
      <div className="sa-masthead" style={{ borderBottom: "none", marginBottom: 4 }}>
        <div className="sa-masthead-patient">Saarthi</div>
        <div className="sa-field"><span className="sa-field-label">Patient</span>
          <span className="sa-field-value">{id}</span></div>
      </div>
      <Rule />
      <div className="sa-limitation">This patient record could not be opened.
        The record service or access check is unavailable. Return to the day-care list to retry.</div>
      <Link href="/" className="sa-btn" style={{ marginTop: 16 }}>Return to day-care list</Link>
    </Page>;
  }
}
