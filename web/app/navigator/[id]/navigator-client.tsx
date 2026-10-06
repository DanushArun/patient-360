"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatClock } from "@/lib/display-format.mjs";
import Link from "next/link";
import { Page, Field, Rule, WorkspaceBar, WorkspaceNav, buttonStyle } from "@/components/sa";
import type { PatientData } from "@/lib/patient";
import { usePatientAccess } from "@/components/patient-access-boundary";
import { announcePatientAccessWithdrawn, purgesPatientState } from "@/lib/workspace-state.mjs";
import { isCurrentPatientRequest } from "@/lib/patient-request-lifecycle.mjs";
import { FamilyChecklist } from "@/components/workspace-patient-family";

type Scheme = {
  schemeId: string;
  schemeName: string;
  schemeType: string;
  annualLimit: number;
  status: string;
};
type SchemeState = { rows: Scheme[]; loading: boolean; error: boolean };
type SchemeSnapshot = SchemeState & { patientId: string };

export default function NavigatorClient({ patient }: { patient: PatientData }): ReactNode {
  const accessAvailable = usePatientAccess(patient.patientId);
  if (!accessAvailable) return <AccessUnavailable />;
  return <AuthorizedNavigator patient={patient} />;
}

function AuthorizedNavigator({ patient }: { patient: PatientData }): ReactNode {
  const schemes = usePatientSchemes(patient.patientId);
  const visit = patient.nextVisit ? new Date(`${patient.nextVisit}T00:00:00`) : null;
  const [language, setLanguage] = useState(initialLanguage(patient.language));
  return <Page>
    <WorkspaceNav patientId={patient.patientId} />
    <WorkspaceBar section={`${patient.patientName} · Family view`}
      knownAsOf={patient.knownAsOf ? `Known as of ${formatClock(patient.knownAsOf)}` : "Not available"} />
    <NavigatorHeader patient={patient} visit={visit} />
    {visit
      ? <FamilyChecklist patient={patient} gates={patient.gates} language={language}
        setLanguage={setLanguage} />
      : <NoUpcomingVisit />}
    <Rule />
    <SchemeRecords schemes={schemes} />
    <ClinicalDisclaimer />
  </Page>;
}

function initialLanguage(value: string | null): string {
  const key = value?.trim().toLowerCase() ?? "";
  const codes: Record<string, string> = {
    english: "en", hindi: "hi", tamil: "ta", bengali: "bn", marathi: "mr",
  };
  return codes[key] ?? (key || "en");
}

function usePatientSchemes(patientId: string): SchemeState {
  const [snapshot, setSnapshot] = useState<SchemeSnapshot | null>(null);
  const activePatient = useRef(patientId);
  activePatient.current = patientId;
  useEffect(() => {
    const controller = new AbortController();
    setSnapshot({ patientId, rows: [], loading: true, error: false });
    void loadSchemes(patientId, controller, activePatient, setSnapshot);
    return () => controller.abort();
  }, [patientId]);
  if (snapshot?.patientId === patientId) return snapshot;
  return { rows: [], loading: true, error: false };
}

async function loadSchemes(
  patientId: string,
  controller: AbortController,
  activePatient: { current: string },
  setSnapshot: (snapshot: SchemeSnapshot) => void,
): Promise<void> {
  try {
    const rows = await fetchSchemes(patientId, controller.signal);
    if (rows && isCurrentPatientRequest(patientId, activePatient.current, controller.signal)) {
      setSnapshot({ patientId, rows, loading: false, error: false });
    }
  } catch {
    if (isCurrentPatientRequest(patientId, activePatient.current, controller.signal)) {
      setSnapshot({ patientId, rows: [], loading: false, error: true });
    }
  }
}

async function fetchSchemes(patientId: string, signal: AbortSignal): Promise<Scheme[] | null> {
  const response = await fetch(
    `/api/patient/${encodeURIComponent(patientId)}/schemes`,
    { signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), cache: "no-store" },
  );
  const result = await response.json() as Scheme[] & { purge_patient_state?: boolean };
  if (purgesPatientState(result)) {
    announcePatientAccessWithdrawn(patientId);
    return null;
  }
  if (!response.ok || !Array.isArray(result)) throw new Error("schemes_unavailable");
  return result;
}

function AccessUnavailable(): ReactNode {
  return <Page>
    <WorkspaceNav />
    <WorkspaceBar section="Family view" knownAsOf="Not available" />
    <h1>Patient access is no longer available</h1>
    <p className="sa-data-unavailable">
      Patient content was removed after access could not be confirmed.
    </p>
    <Link href="/" className="sa-quiet-button">Return to authorized worklist</Link>
  </Page>;
}

function NavigatorHeader({ patient, visit }: {
  patient: PatientData; visit: Date | null;
}): ReactNode {
  return <>
    <div className="sa-masthead" style={{ borderBottom: "none", marginBottom: 4 }}>
      <div className="sa-masthead-patient">{patient.patientName}</div>
      <Field label="Patient" value={patient.patientId} />
      <Field label="Visit" value={visit ? visitDate(visit) : "No upcoming visit"} />
      <Field label="Practitioner" value={patient.practitionerName} />
    </div>
    <div className="mb-2 flex items-center gap-4">
      <div className="text-xs uppercase tracking-wide" style={{ color: "var(--sa-ink-muted)" }}>
        Navigator View
      </div>
      <Link href="/" style={{ ...buttonStyle, width: "auto" }}>Census</Link>
    </div>
    <Rule />
  </>;
}

function visitDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function NoUpcomingVisit(): ReactNode {
  return <div className="sa-limitation">
    No upcoming day-care visit is on record for this patient.
  </div>;
}

function SchemeRecords({ schemes }: { schemes: SchemeState }): ReactNode {
  return <>
    <div className="sa-field-label" style={{ margin: "12px 0 4px" }}>Scheme records</div>
    <p className="sa-meta">
      Recorded eligibility checks are not confirmation of enrolment, available cover or
      authorisation. The help desk must verify these.
    </p>
    {schemes.loading ? <div className="sa-meta">Loading scheme records…</div>
      : schemes.error ? <div className="sa-limitation" role="alert">
        Scheme records could not be loaded. No eligibility conclusion is available. Reload to retry.
      </div>
        : schemes.rows.length === 0 ? <div className="sa-meta">
          No scheme records returned for this patient.
        </div>
          : <div style={{ display: "grid", gap: 12 }}>
            {schemes.rows.map((scheme) => <SchemeCard key={scheme.schemeId} scheme={scheme} />)}
          </div>}
  </>;
}

function SchemeCard({ scheme }: { scheme: Scheme }): ReactNode {
  return <div className="sa-evidence sa-ev-patient">
    <div className="sa-ev-kind">{scheme.schemeType} scheme</div>
    <div style={{ fontWeight: 600, marginBottom: 4 }}>{scheme.schemeName}</div>
    <div className="sa-meta">
      Annual limit: <span className="sa-num">
        &#8377;{Number(scheme.annualLimit).toLocaleString("en-IN")}
      </span> · Status: {scheme.status}
    </div>
  </div>;
}

function ClinicalDisclaimer(): ReactNode {
  return <div className="sa-limitation" style={{ marginTop: 20 }}>
    The treating team confirms visits and treatment. This view reports returned record checks.
  </div>;
}
