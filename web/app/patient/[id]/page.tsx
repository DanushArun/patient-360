import Link from "next/link";
import { loadPatientSnapshot } from "@/lib/patient";
import { Page, Rule } from "@/components/sa";
import PatientClient from "./patient-client";
import { headers } from "next/headers";
import { loginFromAuthorization } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export default async function PatientPage({ params }: PageProps<"/patient/[id]">) {
  const { id } = await params;
  try {
    const login = loginFromAuthorization((await headers()).get("authorization"));
    if (!login) throw new Error("professional_login_required");
    const patient = await loadPatientSnapshot(id, login);
    return <PatientClient key={id} patient={patient} />;
  } catch {
    return <Page>
      <div className="sa-masthead" style={{ borderBottom: "none", marginBottom: 4 }}>
        <div className="sa-masthead-patient">SAARTHI</div>
        <div className="sa-field"><span className="sa-field-label">Patient</span><span className="sa-field-value">{id}</span></div>
      </div>
      <Rule />
      <div className="sa-limitation">This patient record could not be opened. Confirm active care-team access and valid consent, then return to the day-care list.</div>
      <Link href="/" className="sa-btn" style={{ marginTop: 16 }}>Return to day-care list</Link>
    </Page>;
  }
}
