import { notFound } from "next/navigation";
import recorded from "../../../../frontend/fixtures/daycare_census_recorded.json";
import PatientClient from "../../patient/[id]/patient-client";
import type { Gate, PatientData } from "@/lib/patient";

// An explicit visual-preview route, never a fallback for a live patient route.
// Every displayed clinical field comes from this repository's recorded fixture.
export default async function DesignPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = recorded.rows.filter(row => row.patient_id === id);
  if (!rows.length) notFound();
  const first = rows[0];
  const patient: PatientData = {
    patientId: first.patient_id, patientName: first.name,
    consentId: null, practitionerName: "Not included in recorded fixture",
    language: first.language, nextVisit: first.scheduled.slice(0,10), scheduledAt: first.scheduled,
    cycleNumber: first.cycle, regimen: first.regimen, knownAsOf: recorded.recorded_at,
    gates: rows.map(row => ({ gate: row.gate, rule_id: row.rule_id, rule_version: row.rule_version,
      outcome: row.outcome as Gate["outcome"], severity: row.severity, reason: row.reason,
      known_as_of: recorded.recorded_at })),
  };
  const patients = Array.from(new Map(recorded.rows.map(row => [row.patient_id, {id: row.patient_id, name: row.name}])).values());
  return <PatientClient key={id} patient={patient} patients={patients} preview />;
}
