import Link from "next/link";
import type { ReactNode } from "react";

export type RosterPatient = { id: string; name: string };

export function PatientRosterItems({
  patients,
  selectedId,
  preview,
  emptyMessage,
}: {
  patients: RosterPatient[];
  selectedId?: string;
  preview: boolean;
  emptyMessage: string;
}): ReactNode {
  if (!patients.length) return <p className="ct-roster-empty">{emptyMessage}</p>;
  return patients.map((patient, index) => <Link
    key={patient.id}
    href={`/${preview ? "design-preview" : "patient"}/${encodeURIComponent(patient.id)}`}
    prefetch={false}
    aria-current={selectedId === patient.id ? "page" : undefined}
    className={`ct-patient-option${selectedId === patient.id ? " selected" : ""}`}
  >
    <span className={`ct-avatar tone-${index % 6}`} aria-hidden="true">
      {patient.name.split(/\s+/).slice(0, 2).map((name) => name[0]).join("")}
    </span>
    <span><strong>{patient.name}</strong><small>{patient.id}</small></span>
  </Link>);
}
