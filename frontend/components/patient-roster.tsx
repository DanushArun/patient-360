"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useOptionalCopilot } from "./copilot/copilot-provider";
import { Search } from "lucide-react";
import { filterAuthorizedPatients } from "@/lib/authorized-patient-search.mjs";
import { PatientRosterItems, type RosterPatient } from "./patient-roster-list";

export type { RosterPatient } from "./patient-roster-list";

type PatientRosterProps = {
  patients: RosterPatient[];
  selectedId?: string;
  preview?: boolean;
  available?: boolean;
};

export function PatientRoster({
  patients,
  selectedId,
  preview = false,
  available = true,
}: PatientRosterProps): ReactNode {
  const [query, setQuery] = useState("");
  // The live copilot matches a spoken name only against patients this person may open.
  const setLiveRoster = useOptionalCopilot()?.live.setRoster;
  useEffect(() => {
    if (available && !preview) setLiveRoster?.(patients);
  }, [setLiveRoster, patients, available, preview]);
  const matches = filterAuthorizedPatients(patients, query, available);
  const emptyMessage = !available
    ? "Patient list unavailable."
    : patients.length ? "No matching patients." : "No patient records available.";
  return <section className="ct-roster" id="patient-roster" aria-label="Authorized patients">
    <div className="ct-roster-heading">
      <span>Patients</span>
      {available && <span>{patients.length}</span>}
    </div>
    <label className="ct-search">
      <Search size={15} aria-hidden="true" />
      <input
        aria-label="Find a patient"
        placeholder="Find a patient"
        value={query}
        disabled={!available}
        onChange={(event) => setQuery(event.target.value)}
      />
    </label>
    <nav aria-label="Patient records" className="ct-patient-list">
      <PatientRosterItems
        patients={matches}
        selectedId={selectedId}
        preview={preview}
        emptyMessage={emptyMessage}
      />
    </nav>
  </section>;
}
